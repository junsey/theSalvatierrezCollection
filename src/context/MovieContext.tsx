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
import { FetchMoviesResult, SheetMeta, fetchMovies } from '../services/googleSheets';
import { MovieRecord } from '../types/MovieRecord';

type RefreshOptions = Parameters<typeof fetchMovies>[0] & { invalidateMovieCache?: boolean };

interface MovieContextValue {
  movies: MovieRecord[];
  loading: boolean;
  error: string | null;
  seenOverrides: Record<string, boolean>;
  ratings: Record<string, number>;
  notes: Record<string, string>;
  sheetMeta: SheetMeta | null;
  refreshLog: string[];
  clearRefreshLog: () => void;
  refresh: (options?: RefreshOptions) => Promise<void>;
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
  const [refreshLog, setRefreshLog] = useState<string[]>([]);

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setRefreshLog((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const clearRefreshLog = () => setRefreshLog([]);

  const refresh = async (options?: RefreshOptions) => {
    setLoading(true);
    setError(null);
    log('Inicio de sincronización');
    if (options?.invalidateMovieCache) {
      log('Limpiando caché enriquecida de TMDb');
      clearMovieCache();
    }
    if (!options?.forceNetwork) {
      const cached = loadMovieCache();
      if (cached) {
        log('Usando copia local de películas (caché)');
        setSheetMeta(cached.sheetMeta ?? null);
        const withLocal = applyLocalOverrides(cached.movies);

        const needsEnrichment = withLocal.some((movie) => {
          const status = movie.tmdbStatus?.source;
          return !status || status === 'none' || status === 'error' || status === 'not-found';
        });

        if (!needsEnrichment) {
          setMovies(withLocal);
          setLoading(false);
          log('Caché enriquecida vigente, sin llamadas adicionales a TMDb');
          return;
        }

        try {
          setMovies(withLocal);
          log('Reenriqueciendo películas faltantes desde caché');
          const enriched = await enrichMoviesBatch(withLocal, {
            allowStaleCache: true,
            maxRequestsPerSecond: 40
          });
          setMovies(enriched);
          saveMovieCache(enriched, cached.sheetMeta ?? null);
          log('Caché actualizada con respuestas de TMDb');
          setLoading(false);
          return;
        } catch (err) {
          console.warn('Failed to re-enrich cached movies, falling back to cached payload', err);
          log('Fallo al reenriquecer; se mantiene la copia local');
          setMovies(withLocal);
          setLoading(false);
          return;
        }
      }
    }
    try {
      log('Consultando Google Sheets');
      const result: FetchMoviesResult = await fetchMovies(options);
      setSheetMeta(result.meta);
      log(`Hoja cargada desde ${result.meta.source}`);
      const withLocal = applyLocalOverrides(result.movies);
      setMovies(withLocal);
      log('Enriqueciendo películas con TMDb');
      const enriched = await enrichMoviesBatch(withLocal, {
        allowStaleCache: !options?.forceNetwork,
        forceNetwork: options?.invalidateMovieCache,
        maxRequestsPerSecond: 40
      });
      setMovies(enriched);
      saveMovieCache(enriched, result.meta);
      log('Enriquecimiento completado y guardado en caché');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load movies');
      log('Error en sincronización; se muestra el mensaje en pantalla');
    } finally {
      setLoading(false);
      log('Sincronización finalizada');
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
      updateSeen,
      updateRating,
      updateNote,
      seenOverrides,
      ratings: personalRatings,
      notes,
      sheetMeta,
      refreshLog,
      clearRefreshLog
    }),
    [movies, loading, error, seenOverrides, personalRatings, notes, sheetMeta, refreshLog]
  );

  return <MovieContext.Provider value={value}>{children}</MovieContext.Provider>;
};

export const useMovies = (): MovieContextValue => {
  const ctx = useContext(MovieContext);
  if (!ctx) throw new Error('useMovies must be used within MovieProvider');
  return ctx;
};
