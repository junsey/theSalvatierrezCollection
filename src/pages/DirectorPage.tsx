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
  seen: 'all',
  view: 'grid',
  sort: 'title-asc'
};

const splitDirectors = (value: string) =>
  value
    .split(/[,;/&]/g)
    .map((d) => d.trim())
    .filter(Boolean);

const matchesDirector = (movie: MovieRecord, directorName: string) => {
  const target = directorName.toLowerCase();
  return (
    splitDirectors(movie.director).some((d) => d.toLowerCase() === target) ||
    movie.director.toLowerCase().includes(target)
  );
};

export const DirectorPage: React.FC = () => {
  const { name } = useParams();
  const { movies, updateSeen, updateRating, updateNote, ratings, notes } = useMovies();
  const directorName = decodeURIComponent(name ?? '');
  const [filters, setFilters] = useState<MovieFilters>({ ...baseFilters });
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);

  const directorMovies = useMemo(() => movies.filter((m) => matchesDirector(m, directorName)), [movies, directorName]);

  const filtered = useMemo(() => {
    return directorMovies
      .filter((m) => m.title.toLowerCase().includes(filters.query.toLowerCase()))
      .filter((m) => (filters.seccion ? m.seccion === filters.seccion : true))
      .filter((m) => {
        if (filters.genre) {
          return m.genreRaw.toLowerCase().includes(filters.genre.toLowerCase());
        }
        return true;
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
          case 'imdb-asc':
            return (parseFloat(a.imdbRating ?? '0') || 0) - (parseFloat(b.imdbRating ?? '0') || 0);
          case 'imdb-desc':
            return (parseFloat(b.imdbRating ?? '0') || 0) - (parseFloat(a.imdbRating ?? '0') || 0);
          case 'rating-asc': {
            const ra = ratings[a.id] ?? null;
            const rb = ratings[b.id] ?? null;
            return (ra ?? 0) - (rb ?? 0);
          }
          case 'rating-desc': {
            const ra = ratings[a.id] ?? null;
            const rb = ratings[b.id] ?? null;
            return (rb ?? 0) - (ra ?? 0);
          }
          case 'title-asc':
          default:
            return a.title.localeCompare(b.title);
        }
      });
  }, [directorMovies, filters, ratings]);

  return (
    <section>
      <h1>Director: {directorName}</h1>
      <FiltersBar filters={filters} onChange={(patch) => setFilters({ ...filters, ...patch })} movies={directorMovies} />
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
