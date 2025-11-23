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
  series: 'all',
  seen: 'all',
  view: 'grid',
  sort: 'title-asc'
};

export const SectionPage: React.FC = () => {
  const { name } = useParams();
  const sectionName = decodeURIComponent(name ?? '');
  const { movies, ratings } = useMovies();
  const [filters, setFilters] = useState<MovieFilters>({ ...baseFilters, seccion: sectionName });
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);

  const handleReset = () => setFilters({ ...baseFilters, seccion: sectionName });

  const sectionMovies = useMemo(() => movies.filter((m) => m.seccion === sectionName), [movies, sectionName]);

  const filtered = useMemo(() => {
    return sectionMovies
      .filter((m) => m.title.toLowerCase().includes(filters.query.toLowerCase()))
      .filter((m) => {
        if (filters.series === 'series') return Boolean(m.series);
        if (filters.series === 'movies') return !m.series;
        return true;
      })
      .filter((m) => {
        if (!filters.genre) return true;
        const genre = filters.genre.toLowerCase();
        return (
          m.genreRaw.toLowerCase().includes(genre) ||
          (m.tmdbGenres ?? []).some((g) => g.toLowerCase() === genre)
        );
      })
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
  }, [sectionMovies, filters, ratings]);

  return (
    <section>
      <h1>Section: {sectionName}</h1>
      <FiltersBar
        filters={filters}
        onChange={(patch) => setFilters({ ...filters, ...patch })}
        movies={sectionMovies}
        onReset={handleReset}
      />
      {filters.view === 'grid' ? (
        <div className="movie-grid">
          {filtered.map((movie) => (
            <MovieCard key={movie.id} movie={movie} onClick={() => setActiveMovie(movie)} />
          ))}
        </div>
      ) : (
        <MovieTable movies={filtered} onSelect={setActiveMovie} />
      )}
      {activeMovie && <MovieDetail movie={activeMovie} onClose={() => setActiveMovie(null)} />}
    </section>
  );
};
