import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { enrichWithImdb } from '../services/imdbApi';
import { applyLocalOverrides, getNotes, getRatingOverrides, getSeenOverrides, setNote, setRating, setSeenOverride } from '../services/localStorage';
import { fetchMovies } from '../services/googleSheets';
import { MovieRecord } from '../types/MovieRecord';

interface MovieContextValue {
  movies: MovieRecord[];
  loading: boolean;
  error: string | null;
  seenOverrides: Record<string, boolean>;
  ratings: Record<string, number>;
  notes: Record<string, string>;
  refresh: () => Promise<void>;
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

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = await fetchMovies();
      const withLocal = applyLocalOverrides(base);
      setMovies(withLocal);
      const enriched = await Promise.all(withLocal.map((movie) => enrichWithImdb(movie)));
      setMovies(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load movies');
    } finally {
      setLoading(false);
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
    () => ({ movies, loading, error, refresh, updateSeen, updateRating, updateNote, seenOverrides, ratings: personalRatings, notes }),
    [movies, loading, error, seenOverrides, personalRatings, notes]
  );

  return <MovieContext.Provider value={value}>{children}</MovieContext.Provider>;
};

export const useMovies = (): MovieContextValue => {
  const ctx = useContext(MovieContext);
  if (!ctx) throw new Error('useMovies must be used within MovieProvider');
  return ctx;
};
