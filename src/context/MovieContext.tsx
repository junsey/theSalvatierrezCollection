import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { enrichMoviesBatch } from '../services/tmdbApi';
import { hydrateFromSupabase, persistSupabaseTmdb } from '../services/supabaseTmdb';
import {
  applyLocalOverrides,
  clearMovieCache,
  getNotes,
  getRatingOverrides,
  getSeenOverrides,
  loadMovieCache,
  saveMovieCache,
  setNote,
  setRating,
  setSeenOverride
} from '../services/localStorage';
import { FetchMoviesResult, SheetMeta, fetchMovies } from '../services/googleSheets';
import { fetchCollectionFromSupabase } from '../services/supabaseCollection';
import { MovieRecord } from '../types/MovieRecord';

type RefreshOptions = Parameters<typeof fetchMovies>[0] & { invalidateMovieCache?: boolean };

interface ProgressState {
  current: number;
  total: number;
  message: string;
}

interface MovieContextValue {
  movies: MovieRecord[];
  loading: boolean;
  error: string | null;
  seenOverrides: Record<string, boolean>;
  ratings: Record<string, number>;
  notes: Record<string, string>;
  sheetMeta: SheetMeta | null;
  progress: ProgressState | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshSheet: () => Promise<void>;
  refreshMissing: () => Promise<void>;
  refreshSupabase: () => Promise<void>;
  updateSeen: (id: string, seen: boolean) => void;
  updateRating: (id: string, rating: number) => void;
  updateNote: (id: string, text: string) => void;
}

const MovieContext = createContext<MovieContextValue | undefined>(undefined);

export const MovieProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [movies, setMovies] = useState<MovieRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenOverrides, setSeenOverridesState] = useState(getSeenOverrides());
  const [ratingOverrides, setRatings] = useState(getRatingOverrides());
  const [notes, setNotes] = useState(getNotes());
  const [sheetMeta, setSheetMeta] = useState<SheetMeta | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const refresh = async (options?: RefreshOptions) => {
    setLoading(true);
    setError(null);
    if (options?.invalidateMovieCache) {
      clearMovieCache();
    }
    if (!options?.forceNetwork) {
      const cached = loadMovieCache();
      if (cached) {
        setSheetMeta(cached.sheetMeta ?? null);
        const withLocal = applyLocalOverrides(cached.movies);
        const supabaseHydrated = await hydrateFromSupabase(withLocal);
        const withSupabase = supabaseHydrated.movies;

        const needsEnrichment = withSupabase.some(
          (movie) => !movie.tmdbStatus || movie.tmdbStatus.source === 'none'
        );

        if (!needsEnrichment) {
          setMovies(withSupabase);
          setLoading(false);
          return;
        }

        try {
          setMovies(withSupabase);
          const needs = withSupabase.filter(
            (movie) => !movie.tmdbStatus || movie.tmdbStatus.source === 'none'
          );
          const enriched = await enrichMoviesBatch(needs, {
            allowStaleCache: true,
            maxRequestsPerSecond: 40,
            onProgress: (current, total, movieTitle) => {
              const title = movieTitle ? `: ${movieTitle}` : '';
              setProgress({ current, total, message: `Enriqueciendo películas ${current}/${total}${title}` });
            }
          });
          setProgress(null);
          const enrichedMap = new Map(enriched.map((movie) => [movie.id, movie]));
          const updated = withSupabase.map((movie) => enrichedMap.get(movie.id) || movie);
          setMovies(updated);
          saveMovieCache(updated, cached.sheetMeta ?? null);
          const toPersist = updated.filter(
            (movie) =>
              movie.tmdbId &&
              !supabaseHydrated.hydratedIds.has(movie.id)
          );
          await persistSupabaseTmdb(toPersist);
          setLoading(false);
          return;
        } catch (err) {
          console.warn('Failed to re-enrich cached movies, falling back to cached payload', err);
          setProgress(null);
          setMovies(withSupabase);
          setLoading(false);
          return;
        }
      }
    }
    try {
      let result: FetchMoviesResult;
      try {
        result = (await fetchCollectionFromSupabase()) ?? await fetchMovies(options);
      } catch (err) {
        console.warn('Supabase fetch failed; falling back to Sheets', err);
        result = await fetchMovies(options);
      }
      setSheetMeta(result.meta);
      const withLocal = applyLocalOverrides(result.movies);
      const supabaseHydrated = await hydrateFromSupabase(withLocal);
      const withSupabase = supabaseHydrated.movies;
      setMovies(withSupabase);
      const needs = withSupabase.filter(
        (movie) => !movie.tmdbStatus || movie.tmdbStatus.source === 'none'
      );
      const enriched = await enrichMoviesBatch(needs, {
        allowStaleCache: !options?.forceNetwork,
        forceNetwork: options?.invalidateMovieCache,
        maxRequestsPerSecond: 40,
        onProgress: (current, total, movieTitle) => {
          const title = movieTitle ? `: ${movieTitle}` : '';
          setProgress({ current, total, message: `Enriqueciendo películas ${current}/${total}${title}` });
        }
      });
      setProgress(null);
      const enrichedMap = new Map(enriched.map((movie) => [movie.id, movie]));
      const updated = withSupabase.map((movie) => enrichedMap.get(movie.id) || movie);
      setMovies(updated);
      saveMovieCache(updated, result.meta);
      const toPersist = updated.filter(
        (movie) =>
          movie.tmdbId &&
          !supabaseHydrated.hydratedIds.has(movie.id)
      );
      await persistSupabaseTmdb(toPersist);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Unable to load movies');
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 100, message: 'Iniciando regeneración completa...' });
    await refresh({ forceNetwork: true, invalidateMovieCache: true });
  };

  const refreshSupabase = async () => {
    setLoading(true);
    setError(null);
    setProgress(null);
    clearMovieCache();
    try {
      const result = await fetchCollectionFromSupabase();
      if (!result) {
        throw new Error('Supabase no estA1 disponible o no estA1 configurado.');
      }
      setSheetMeta(result.meta);
      const withLocal = applyLocalOverrides(result.movies);
      const supabaseHydrated = await hydrateFromSupabase(withLocal);
      setMovies(supabaseHydrated.movies);
      saveMovieCache(supabaseHydrated.movies, result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Supabase data');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshSheet = async () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 100, message: 'Recargando desde Google Sheets...' });
    try {
      let result: FetchMoviesResult;
      try {
        result = (await fetchCollectionFromSupabase()) ?? await fetchMovies({ forceNetwork: true });
      } catch (err) {
        console.warn('Supabase fetch failed; falling back to Sheets', err);
        result = await fetchMovies({ forceNetwork: true });
      }
      setSheetMeta(result.meta);
      const withLocal = applyLocalOverrides(result.movies);
      const supabaseHydrated = await hydrateFromSupabase(withLocal);
      const withSupabase = supabaseHydrated.movies;
      setMovies(withSupabase);
      // Solo enriquece las que no tienen caché
      const needsEnrichment = withSupabase.filter(
        (movie) => !movie.tmdbStatus || movie.tmdbStatus.source === 'none'
      );
      if (needsEnrichment.length > 0) {
        setProgress({ current: 0, total: needsEnrichment.length, message: `Enriqueciendo ${needsEnrichment.length} películas nuevas...` });
        const enriched = await enrichMoviesBatch(needsEnrichment, {
          allowStaleCache: false,
          maxRequestsPerSecond: 40,
          onProgress: (current, total, movieTitle) => {
            const title = movieTitle ? `: ${movieTitle}` : '';
            setProgress({ current, total, message: `Enriqueciendo películas ${current}/${total}${title}` });
          }
        });
        // Actualizar solo las películas enriquecidas
        const enrichedMap = new Map(enriched.map(m => [m.id, m]));
        const updated = withSupabase.map(m => enrichedMap.get(m.id) || m);
        setMovies(updated);
        saveMovieCache(updated, result.meta);
        const toPersist = updated.filter(
          (movie) =>
            movie.tmdbId &&
            !supabaseHydrated.hydratedIds.has(movie.id)
        );
        await persistSupabaseTmdb(toPersist);
      } else {
        saveMovieCache(withSupabase, result.meta);
      }
      setProgress(null);
      setLoading(false);
    } catch (err) {
      setProgress(null);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Unable to refresh sheet');
    }
  };

  const refreshMissing = async () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 100, message: 'Identificando películas sin caché...' });
    try {
      // Obtener películas actuales
      const currentMovies = movies.length > 0 ? movies : (() => {
        const cached = loadMovieCache();
        if (cached) {
          return applyLocalOverrides(cached.movies);
        }
        return [];
      })();

      if (currentMovies.length === 0) {
        setProgress(null);
        setLoading(false);
        setError('No hay películas cargadas. Usa "Recargar Excel" primero.');
        return;
      }
      const supabaseHydrated = await hydrateFromSupabase(currentMovies);
      const hydratedMovies = supabaseHydrated.movies;
      setMovies(hydratedMovies);


      // Filtrar películas que necesitan enriquecimiento
      const needsEnrichment = hydratedMovies.filter(
        (movie) => 
          !movie.tmdbStatus || 
          movie.tmdbStatus.source === 'none' || 
          movie.tmdbStatus.source === 'error' ||
          movie.tmdbStatus.source === 'not-found'
      );

      if (needsEnrichment.length === 0) {
        setProgress(null);
        setLoading(false);
        return; // Todas tienen caché válido
      }

      setProgress({ current: 0, total: needsEnrichment.length, message: `Enriqueciendo ${needsEnrichment.length} películas...` });
      
      const enriched = await enrichMoviesBatch(needsEnrichment, {
        allowStaleCache: false,
        forceNetwork: true, // Forzar red para regenerar películas en error
        maxRequestsPerSecond: 40,
        onProgress: (current, total, movieTitle) => {
          const title = movieTitle ? `: ${movieTitle}` : '';
          setProgress({ current, total, message: `Enriqueciendo películas ${current}/${total}${title}` });
        }
      });

      // Actualizar solo las películas enriquecidas
      const enrichedMap = new Map(enriched.map(m => [m.id, m]));
      const updated = hydratedMovies.map(m => enrichedMap.get(m.id) || m);
      
      setMovies(updated);
      const cached = loadMovieCache();
      saveMovieCache(updated, cached?.sheetMeta ?? null);
      const toPersist = updated.filter(
        (movie) =>
          movie.tmdbId &&
          !supabaseHydrated.hydratedIds.has(movie.id)
      );
      await persistSupabaseTmdb(toPersist);
      setProgress(null);
      setLoading(false);
    } catch (err) {
      setProgress(null);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Unable to refresh missing movies');
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const updateSeen = (id: string, seen: boolean) => {
    setSeenOverride(id, seen);
    setSeenOverridesState((prev) => ({ ...prev, [id]: seen }));
    setMovies((prev) => prev.map((movie) => (movie.id === id ? { ...movie, seen } : movie)));
  };

  const updateRating = (id: string, rating: number) => {
    setRating(id, rating);
    setRatings((prev) => ({ ...prev, [id]: rating }));
  };

  const updateNote = (id: string, text: string) => {
    setNote(id, text);
    setNotes((prev) => ({ ...prev, [id]: text }));
  };

  const personalRatings = useMemo(() => {
    const map: Record<string, number> = {};
    movies.forEach((movie) => {
      const override = ratingOverrides[movie.id];
      if (override !== undefined) {
        map[movie.id] = override;
      } else if (movie.rating != null) {
        map[movie.id] = movie.rating;
      }
    });
    return map;
  }, [movies, ratingOverrides]);

  const value = useMemo(
    () => ({ 
      movies, 
      loading, 
      error, 
      refresh, 
      refreshAll, 
      refreshSupabase,
      refreshSheet, 
      refreshMissing,
      updateSeen, 
      updateRating, 
      updateNote, 
      seenOverrides, 
      ratings: personalRatings, 
      notes, 
      sheetMeta,
      progress
    }),
    [movies, loading, error, seenOverrides, personalRatings, notes, sheetMeta, progress]
  );

  return <MovieContext.Provider value={value}>{children}</MovieContext.Provider>;
};

export const useMovies = (): MovieContextValue => {
  const ctx = useContext(MovieContext);
  if (!ctx) throw new Error('useMovies must be used within MovieProvider');
  return ctx;
};
