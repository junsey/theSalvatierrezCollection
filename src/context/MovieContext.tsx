import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { enrichMoviesBatch } from '../services/tmdbApi';
import { hydrateFromSupabase, persistSupabaseTmdb } from '../services/supabaseTmdb';
import {
  applyLocalOverrides,
  clearMovieCache,
  getTmdbEnrichmentEnabled,
  getNotes,
  getRatingOverrides,
  getSeenOverrides,
  loadMovieCache,
  saveMovieCache,
  setTmdbEnrichmentEnabled,
  setNote,
  setRating,
  setSeenOverride
} from '../services/localStorage';
import { SheetMeta, fetchMovies } from '../services/googleSheets';
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
  visibleMovies: MovieRecord[];
  loading: boolean;
  error: string | null;
  seenOverrides: Record<string, boolean>;
  ratings: Record<string, number>;
  notes: Record<string, string>;
  sheetMeta: SheetMeta | null;
  progress: ProgressState | null;
  tmdbEnrichmentEnabled: boolean;
  refresh: (options?: RefreshOptions) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshSheet: () => Promise<void>;
  refreshMissing: () => Promise<void>;
  refreshSupabase: () => Promise<void>;
  setTmdbEnrichmentEnabled: (value: boolean) => void;
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
  const [tmdbEnrichmentEnabledState, setTmdbEnrichmentEnabledState] = useState(getTmdbEnrichmentEnabled());

  const visibleMovies = useMemo(
    () => movies.filter((movie) => movie.seccion.trim().toLowerCase() !== 'z-inexistente'),
    [movies]
  );

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
        setMovies(supabaseHydrated.movies);
        setLoading(false);
        return;
      }
    }
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
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Unable to load movies');
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 100, message: 'Iniciando regeneraciA3n completa...' });
    try {
      const result = await fetchMovies({ forceNetwork: true });
      setSheetMeta(result.meta);
      const withLocal = applyLocalOverrides(result.movies);
      const supabaseHydrated = await hydrateFromSupabase(withLocal);
      const withSupabase = supabaseHydrated.movies;
      setMovies(withSupabase);
      if (!tmdbEnrichmentEnabledState) {
        saveMovieCache(withSupabase, result.meta);
        setProgress(null);
        return;
      }
      const enriched = await enrichMoviesBatch(withSupabase, {
        allowStaleCache: false,
        forceNetwork: true,
        maxRequestsPerSecond: 40,
        onProgress: (current, total, movieTitle) => {
          const title = movieTitle ? `: ${movieTitle}` : '';
          setProgress({ current, total, message: `Enriqueciendo pelA-culas ${current}/${total}${title}` });
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
      setError(err instanceof Error ? err.message : 'Unable to refresh sheet');
    } finally {
      setLoading(false);
    }
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
      const result = await fetchMovies({ forceNetwork: true });
      setSheetMeta(result.meta);
      const withLocal = applyLocalOverrides(result.movies);
      const supabaseHydrated = await hydrateFromSupabase(withLocal);
      const withSupabase = supabaseHydrated.movies;
      setMovies(withSupabase);
      // Solo enriquece las que no tienen cachAc
      if (!tmdbEnrichmentEnabledState) {
        saveMovieCache(withSupabase, result.meta);
        setProgress(null);
        setLoading(false);
        return;
      }
      const needsEnrichment = withSupabase.filter(
        (movie) => !movie.tmdbStatus || movie.tmdbStatus.source === 'none'
      );
      if (needsEnrichment.length > 0) {
        setProgress({ current: 0, total: needsEnrichment.length, message: `Enriqueciendo ${needsEnrichment.length} pelA-culas nuevas...` });
        const enriched = await enrichMoviesBatch(needsEnrichment, {
          allowStaleCache: false,
          maxRequestsPerSecond: 40,
          onProgress: (current, total, movieTitle) => {
            const title = movieTitle ? `: ${movieTitle}` : '';
            setProgress({ current, total, message: `Enriqueciendo pelA-culas ${current}/${total}${title}` });
          }
        });
        // Actualizar solo las pelA-culas enriquecidas
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
      if (!tmdbEnrichmentEnabledState) {
        setProgress(null);
        setLoading(false);
        return;
      }
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

  const updateTmdbEnrichmentEnabled = (value: boolean) => {
    setTmdbEnrichmentEnabled(value);
    setTmdbEnrichmentEnabledState(value);
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
      visibleMovies,
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
      progress,
      tmdbEnrichmentEnabled: tmdbEnrichmentEnabledState,
      setTmdbEnrichmentEnabled: updateTmdbEnrichmentEnabled
    }),
    [
      movies,
      visibleMovies,
      loading,
      error,
      seenOverrides,
      personalRatings,
      notes,
      sheetMeta,
      progress,
      tmdbEnrichmentEnabledState
    ]
  );

  return <MovieContext.Provider value={value}>{children}</MovieContext.Provider>;
};

export const useMovies = (): MovieContextValue => {
  const ctx = useContext(MovieContext);
  if (!ctx) throw new Error('useMovies must be used within MovieProvider');
  return ctx;
};
