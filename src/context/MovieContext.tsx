import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { enrichMoviesBatch } from '../services/tmdbApi';
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
import { FetchMoviesResult, fetchMoviesFromSupabase } from '../services/supabaseMovies';
import { CollectionMeta } from '../types/CollectionMeta';
import { MovieRecord } from '../types/MovieRecord';

type RefreshOptions = { invalidateMovieCache?: boolean; forceNetwork?: boolean };

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
  collectionMeta: CollectionMeta | null;
  progress: ProgressState | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshCollection: () => Promise<void>;
  refreshMissing: () => Promise<void>;
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
  const [collectionMeta, setCollectionMeta] = useState<CollectionMeta | null>(null);
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
        setCollectionMeta(cached.collectionMeta ?? null);
        const withLocal = applyLocalOverrides(cached.movies);

        const needsEnrichment = withLocal.some(
          (movie) => !movie.tmdbStatus || movie.tmdbStatus.source === 'none'
        );

        if (!needsEnrichment) {
          setMovies(withLocal);
          setLoading(false);
          return;
        }

        try {
          setMovies(withLocal);
          const enriched = await enrichMoviesBatch(withLocal, {
            allowStaleCache: true,
            maxRequestsPerSecond: 40,
            onProgress: (current, total, movieTitle) => {
              const title = movieTitle ? `: ${movieTitle}` : '';
              setProgress({ current, total, message: `Enriqueciendo películas ${current}/${total}${title}` });
            }
          });
          setProgress(null);
          setMovies(enriched);
          saveMovieCache(enriched, cached.collectionMeta ?? null);
          setLoading(false);
          return;
        } catch (err) {
          console.warn('Failed to re-enrich cached movies, falling back to cached payload', err);
          setProgress(null);
          setMovies(withLocal);
          setLoading(false);
          return;
        }
      }
    }
    try {
      const result: FetchMoviesResult = await fetchMoviesFromSupabase();
      setCollectionMeta(result.meta);
      const withLocal = applyLocalOverrides(result.movies);
      setMovies(withLocal);
      const enriched = await enrichMoviesBatch(withLocal, {
        allowStaleCache: !options?.forceNetwork,
        forceNetwork: options?.invalidateMovieCache,
        maxRequestsPerSecond: 40,
        onProgress: (current, total, movieTitle) => {
          const title = movieTitle ? `: ${movieTitle}` : '';
          setProgress({ current, total, message: `Enriqueciendo películas ${current}/${total}${title}` });
        }
      });
      setProgress(null);
      setMovies(enriched);
      saveMovieCache(enriched, result.meta);
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

  const refreshCollection = async () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 100, message: 'Recargando colección desde Supabase...' });
    try {
      const result: FetchMoviesResult = await fetchMoviesFromSupabase();
      setCollectionMeta(result.meta);
      const withLocal = applyLocalOverrides(result.movies);
      setMovies(withLocal);
      // Solo enriquece las que no tienen caché
      const needsEnrichment = withLocal.filter(
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
        const updated = withLocal.map(m => enrichedMap.get(m.id) || m);
        setMovies(updated);
        saveMovieCache(updated, result.meta);
      } else {
        saveMovieCache(withLocal, result.meta);
      }
      setProgress(null);
      setLoading(false);
    } catch (err) {
      setProgress(null);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Unable to refresh collection');
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
        setError('No hay películas cargadas. Usa "Recargar colección" primero.');
        return;
      }

      // Filtrar películas que necesitan enriquecimiento
      const needsEnrichment = currentMovies.filter(
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
      const updated = currentMovies.map(m => enrichedMap.get(m.id) || m);
      
      setMovies(updated);
      const cached = loadMovieCache();
      saveMovieCache(updated, cached?.collectionMeta ?? null);
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
      refreshCollection,
      refreshMissing,
      updateSeen,
      updateRating,
      updateNote,
      seenOverrides,
      ratings: personalRatings,
      notes,
      collectionMeta,
      progress
    }),
    [movies, loading, error, seenOverrides, personalRatings, notes, collectionMeta, progress]
  );

  return <MovieContext.Provider value={value}>{children}</MovieContext.Provider>;
};

export const useMovies = (): MovieContextValue => {
  const ctx = useContext(MovieContext);
  if (!ctx) throw new Error('useMovies must be used within MovieProvider');
  return ctx;
};
