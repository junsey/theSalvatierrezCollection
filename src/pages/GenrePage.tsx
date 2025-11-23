import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiltersBar } from '../components/FiltersBar';
import { MovieCard } from '../components/MovieCard';
import { MovieDetail } from '../components/MovieDetail';
import { MovieTable } from '../components/MovieTable';
import { useMovies } from '../context/MovieContext';
import { MovieFilters, MovieRecord } from '../types/MovieRecord';

const baseFilters: MovieFilters = {
  query: '',
  seccion: null,
  genre: null,
  saga: null,
  seen: 'all',
  view: 'grid',
  sort: 'title-asc'
};

const hasGenre = (movie: MovieRecord, genre: string) => {
  const g = genre.toLowerCase();
  return (
    movie.genreRaw.toLowerCase().includes(g) ||
    (movie.tmdbGenres ?? []).some((item) => item.toLowerCase() === g)
  );
};

export const GenrePage: React.FC = () => {
  const { name } = useParams();
  const genreName = decodeURIComponent(name ?? '');
  const { movies, updateSeen, updateRating, updateNote, ratings, notes } = useMovies();
  const [filters, setFilters] = useState<MovieFilters>({ ...baseFilters, genre: genreName });
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);

  const handleReset = () => setFilters({ ...baseFilters, genre: genreName });

  const genreMovies = useMemo(() => movies.filter((m) => hasGenre(m, genreName)), [movies, genreName]);

  const filtered = useMemo(() => {
    return genreMovies
      .filter((m) => m.title.toLowerCase().includes(filters.query.toLowerCase()))
      .filter((m) => (filters.seccion ? m.seccion === filters.seccion : true))
      .filter((m) => (filters.genre ? hasGenre(m, filters.genre) : true))
      .filter((m) => (filters.saga ? m.saga === filters.saga : true))
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
  }, [genreMovies, filters, ratings]);

  return (
    <section>
      <h1>Género: {genreName}</h1>
      <FiltersBar
        filters={filters}
        onChange={(patch) => setFilters({ ...filters, ...patch })}
        movies={genreMovies}
        onReset={handleReset}
      />
      {filters.view === 'grid' ? (
        <div className="movie-grid">
          {filtered.map((movie) => (
            <MovieCard key={movie.id} movie={movie} personalRating={ratings[movie.id]} onClick={() => setActiveMovie(movie)} />
          ))}
        </div>
      ) : (
        <MovieTable movies={filtered} personalRatings={ratings} onSelect={setActiveMovie} />
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
