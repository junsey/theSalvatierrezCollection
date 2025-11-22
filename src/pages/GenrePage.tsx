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

export const GenrePage: React.FC = () => {
  const { name } = useParams();
  const { movies, updateSeen, updateRating, updateNote, ratings, notes } = useMovies();
  const genreName = decodeURIComponent(name ?? '');
  const [filters, setFilters] = useState<MovieFilters>({ ...baseFilters, genre: genreName });
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);

  const genreMovies = useMemo(() => movies.filter((m) => m.genreRaw.toLowerCase().includes(genreName.toLowerCase())), [movies, genreName]);

  const filtered = useMemo(() => {
    return genreMovies
      .filter((m) => m.title.toLowerCase().includes(filters.query.toLowerCase()))
      .filter((m) => (filters.seccion ? m.seccion === filters.seccion : true))
      .filter((m) => {
        if (filters.seen === 'all') return true;
        if (filters.seen === 'seen') return m.seen;
        return !m.seen;
      })
      .sort((a, b) => (filters.sort === 'title-desc' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title)));
  }, [genreMovies, filters]);

  return (
    <section>
      <h1>Genre: {genreName}</h1>
      <FiltersBar filters={filters} onChange={(patch) => setFilters({ ...filters, ...patch })} movies={genreMovies} />
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
