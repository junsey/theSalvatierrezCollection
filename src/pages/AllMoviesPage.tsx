import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiltersBar } from '../components/FiltersBar';
import { MovieCard } from '../components/MovieCard';
import { MovieDetail } from '../components/MovieDetail';
import { MovieTable } from '../components/MovieTable';
import { useMovies } from '../context/MovieContext';
import { setStoredFilters, getStoredFilters } from '../services/localStorage';
import { MovieFilters, MovieRecord } from '../types/MovieRecord';

const defaultFilters: MovieFilters = {
  query: '',
  seccion: null,
  genre: null,
  seen: 'all',
  view: 'grid',
  sort: 'title-asc'
};

export const AllMoviesPage: React.FC = () => {
  const { movies, loading, error, updateSeen, updateRating, updateNote, ratings, notes } = useMovies();
  const [filters, setFilters] = useState<MovieFilters>({ ...defaultFilters, ...getStoredFilters() });
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);
  const location = useLocation();

  const handleChange = (patch: Partial<MovieFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setStoredFilters(next);
  };

  const filtered = useMemo(() => {
    return movies
      .filter((m) => m.title.toLowerCase().includes(filters.query.toLowerCase()))
      .filter((m) => (filters.seccion ? m.seccion === filters.seccion : true))
      .filter((m) => {
        if (!filters.genre) return true;
        const genre = filters.genre.toLowerCase();
        const rawMatch = m.genreRaw.toLowerCase().includes(genre);
        const tmdbMatch = (m.tmdbGenres ?? []).some((g) => g.toLowerCase() === genre);
        return rawMatch || tmdbMatch;
      })
      .filter((m) => {
        if (filters.seen === 'all') return true;
        if (filters.seen === 'seen') return m.seen;
        return !m.seen;
      })
      .sort((a, b) => {
        switch (filters.sort) {
          case 'title-desc':
            return b.title.localeCompare(a.title);
          case 'year-asc':
            return (a.year ?? 0) - (b.year ?? 0);
          case 'year-desc':
            return (b.year ?? 0) - (a.year ?? 0);
          case 'tmdb-desc':
            return Number(b.tmdbRating ?? 0) - Number(a.tmdbRating ?? 0);
          case 'tmdb-asc':
            return Number(a.tmdbRating ?? 0) - Number(b.tmdbRating ?? 0);
          case 'rating-desc':
            return Number(ratings[b.id] ?? 0) - Number(ratings[a.id] ?? 0);
          case 'rating-asc':
            return Number(ratings[a.id] ?? 0) - Number(ratings[b.id] ?? 0);
          default:
            return a.title.localeCompare(b.title);
        }
      });
  }, [movies, filters, ratings]);

  useEffect(() => {
    if (!movies.length) return;
    const params = new URLSearchParams(location.search);
    const tmdbId = params.get('tmdbId');
    if (tmdbId) {
      const match = movies.find((m) => m.tmdbId === Number(tmdbId));
      if (match) {
        setActiveMovie(match);
      }
    }
  }, [location.search, movies]);

  return (
    <section>
      <h1>Archive of All Films</h1>
      {loading && <p>Summoning data from the crypt...</p>}
      {error && <p>Error: {error}</p>}
      <FiltersBar filters={filters} onChange={handleChange} movies={movies} />
      {filters.view === 'grid' ? (
        <div className="movie-grid">
          {filtered.map((movie) => (
            <MovieCard key={movie.id} movie={movie} personalRating={ratings[movie.id]} onClick={() => setActiveMovie(movie)} />
          ))}
        </div>
      ) : (
        <MovieTable movies={filtered} personalRatings={ratings} onSelect={(m) => setActiveMovie(m)} />
      )}
      {activeMovie && (
        <MovieDetail
          movie={activeMovie}
          personalRating={ratings[activeMovie.id]}
          personalNote={notes[activeMovie.id]}
          onClose={() => setActiveMovie(null)}
          onSeenChange={(seen) => updateSeen(activeMovie.id, seen)}
          onRatingChange={(rating) => updateRating(activeMovie.id, rating)}
          onNoteChange={(note) => updateNote(activeMovie.id, note)}
        />
      )}
    </section>
  );
};
