import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiltersBar } from '../components/FiltersBar';
import { MovieCard } from '../components/MovieCard';
import { MovieDetail } from '../components/MovieDetail';
import { MovieTable } from '../components/MovieTable';
import { useMovies } from '../context/MovieContext';
import { setStoredFilters, getStoredFilters } from '../services/localStorage';
import { compareShelfSort } from '../services/movieSort';
import { normalizeText } from '../services/textNormalize';
import { groupSeriesForDisplay } from '../services/seriesGrouping';
import { MovieFilters, MovieRecord } from '../types/MovieRecord';

const defaultFilters: MovieFilters = {
  query: '',
  seccion: null,
  genre: null,
  saga: null,
  series: 'all',
  seen: 'all',
  status: 'all',
  view: 'grid',
  sort: 'title-asc'
};

export const AllMoviesPage: React.FC = () => {
  const { visibleMovies, loading, error, ratings } = useMovies();
  const [filters, setFilters] = useState<MovieFilters>({ ...defaultFilters, ...getStoredFilters() });
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(102);
  const location = useLocation();

  const handleChange = (patch: Partial<MovieFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setStoredFilters(next);
  };

  const handleReset = () => {
    const next = { ...defaultFilters };
    setFilters(next);
    setStoredFilters(next);
  };

  const filtered = useMemo(() => {
    const query = normalizeText(filters.query);

    const matchesTitle = (movie: MovieRecord) => {
      if (!query) return true;
      const candidates = [movie.title, movie.originalTitle, movie.tmdbTitle, movie.tmdbOriginalTitle]
        .filter((title): title is string => Boolean(title))
        .map((title) => normalizeText(title));
      return candidates.some((title) => title.includes(query));
    };

    return visibleMovies
      .filter((m) => matchesTitle(m))
      .filter((m) => (filters.seccion ? m.seccion === filters.seccion : true))
      .filter((m) => {
        if (filters.series === 'series') return Boolean(m.series);
        if (filters.series === 'movies') return !m.series;
        return true;
      })
      .filter((m) => {
        if (!filters.genre) return true;
        const genre = filters.genre.toLowerCase();
        const rawMatch = m.genreRaw.toLowerCase().includes(genre);
        const tmdbMatch = (m.tmdbGenres ?? []).some((g) => g.toLowerCase() === genre);
        return rawMatch || tmdbMatch;
      })
      .filter((m) => (filters.saga ? m.saga === filters.saga : true))
      .filter((m) => {
        if (filters.seen === 'all') return true;
        if (filters.seen === 'seen') return m.seen;
        return !m.seen;
      })
      .filter((m) => {
        switch (filters.status) {
          case 'deposit':
            return Boolean(m.enDeposito);
          case 'damaged':
            return m.funcionaStatus === 'damaged';
          case 'untested':
            return m.funcionaStatus === 'untested' && !m.seen;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        switch (filters.sort) {
          case 'title-desc':
            return b.title.localeCompare(a.title);
          case 'shelf-asc':
            return compareShelfSort(a, b);
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
  }, [visibleMovies, filters, ratings]);

  const grouped = useMemo(() => groupSeriesForDisplay(visibleMovies, filtered), [visibleMovies, filtered]);

  const totalPages = Math.max(1, Math.ceil(grouped.length / pageSize));
  const pagedMovies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return grouped.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  useEffect(() => {
    if (!visibleMovies.length) return;
    const params = new URLSearchParams(location.search);
    const tmdbId = params.get('tmdbId');
    const saga = params.get('saga');
    if (tmdbId) {
      const match = visibleMovies.find((m) => m.tmdbId === Number(tmdbId));
      if (match) {
        setActiveMovie(match);
      }
    }

    if (saga !== null) {
      setFilters((prev) => {
        if (prev.saga === saga && prev.sort === 'year-asc') return prev;
        const next: MovieFilters = { ...prev, saga: saga || null, sort: 'year-asc' };
        setStoredFilters(next);
        return next;
      });
    }
  }, [location.search, visibleMovies]);

  const renderPagination = (position: 'top' | 'bottom') => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        paddingBottom: position === 'top' ? 16 : 0,
        paddingTop: position === 'bottom' ? 16 : 0
      }}
    >
      <span className="muted">
        Mostrando {grouped.length === 0 ? 0 : (page - 1) * pageSize + 1}-
        {Math.min(page * pageSize, grouped.length)} de {grouped.length}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="muted">Por pagina</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={15}>15</option>
            <option value={102}>102</option>
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="ghost" onClick={() => setPage(1)} disabled={page === 1}>
            Prim.
          </button>
          <button className="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Anterior
          </button>
          <span className="muted">
            Pag {page} de {totalPages}
          </span>
          <button
            className="ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Siguiente
          </button>
          <button className="ghost" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
            Ult.
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section>
      <h1>Archive of All Films</h1>
      {loading && <p>Summoning data from the crypt...</p>}
      {error && <p>Error: {error}</p>}
      <FiltersBar filters={filters} onChange={handleChange} movies={visibleMovies} onReset={handleReset} />
      {renderPagination('top')}
      {filters.view === 'grid' ? (
        <div className="movie-grid movie-grid--six">
          {pagedMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} onClick={() => setActiveMovie(movie)} />
          ))}
        </div>
      ) : (
        <MovieTable movies={pagedMovies} onSelect={(m) => setActiveMovie(m)} />
      )}
      {renderPagination('bottom')}
      {activeMovie && <MovieDetail movie={activeMovie} onClose={() => setActiveMovie(null)} />}
    </section>
  );
};
