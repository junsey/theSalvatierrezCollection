import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArchiveDropdown, ArchiveOption } from '../components/ArchiveDropdown';
import { MovieDetail } from '../components/MovieDetail';
import { useMovies } from '../context/MovieContext';
import { setStoredFilters, getStoredFilters } from '../services/localStorage';
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
  condition: 'all',
  deposit: 'all',
  view: 'grid',
  sort: 'title-asc'
};

const uniqueValues = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort();

const getMovieAverage = (movie: MovieRecord) => {
  if (movie.ratingGloria != null && movie.ratingRodrigo != null) {
    return (movie.ratingGloria + movie.ratingRodrigo) / 2;
  }
  if (movie.ratingGloria != null) return movie.ratingGloria;
  if (movie.ratingRodrigo != null) return movie.ratingRodrigo;
  return null;
};

const coerceTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
};

export const AllMoviesPage: React.FC = () => {
  const { visibleMovies, loading, error, ratings, updateSeen } = useMovies();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<MovieFilters>({ ...defaultFilters, ...getStoredFilters() });
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(120);
  const location = useLocation();

  const recentIndexMap = useMemo(() => new Map(visibleMovies.map((movie, index) => [movie.id, index])), [visibleMovies]);

  const handleChange = (patch: Partial<MovieFilters>) => {
    const next = { ...filters, ...patch };
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
        if (filters.deposit === 'all') return true;
        if (filters.deposit === 'deposit') return Boolean(m.enDeposito);
        return !m.enDeposito;
      })
      .filter((m) => {
        if (filters.condition === 'all') return true;
        return m.funcionaStatus === filters.condition;
      })
      .sort((a, b) => {
        const titleCompare = a.title.localeCompare(b.title);
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
            return Number(ratings[b.id] ?? 0) - Number(ratings[a.id] ?? 0) || titleCompare;
          case 'rating-asc':
            return Number(ratings[a.id] ?? 0) - Number(ratings[b.id] ?? 0) || titleCompare;
          case 'rating-best': {
            const aAvg = getMovieAverage(a);
            const bAvg = getMovieAverage(b);
            if (aAvg == null && bAvg == null) return titleCompare;
            if (aAvg == null) return 1;
            if (bAvg == null) return -1;
            return bAvg - aAvg || titleCompare;
          }
          case 'recent-desc': {
            const metaA = a as MovieRecord & {
              createdAt?: string | number;
              created_at?: string | number;
              addedAt?: string | number;
              added_at?: string | number;
              importedAt?: string | number;
              imported_at?: string | number;
            };
            const metaB = b as MovieRecord & {
              createdAt?: string | number;
              created_at?: string | number;
              addedAt?: string | number;
              added_at?: string | number;
              importedAt?: string | number;
              imported_at?: string | number;
            };
            const aTimestamp =
              coerceTimestamp(metaA.createdAt) ??
              coerceTimestamp(metaA.created_at) ??
              coerceTimestamp(metaA.addedAt) ??
              coerceTimestamp(metaA.added_at) ??
              coerceTimestamp(metaA.importedAt) ??
              coerceTimestamp(metaA.imported_at) ??
              recentIndexMap.get(a.id);
            const bTimestamp =
              coerceTimestamp(metaB.createdAt) ??
              coerceTimestamp(metaB.created_at) ??
              coerceTimestamp(metaB.addedAt) ??
              coerceTimestamp(metaB.added_at) ??
              coerceTimestamp(metaB.importedAt) ??
              coerceTimestamp(metaB.imported_at) ??
              recentIndexMap.get(b.id);
            if (aTimestamp == null && bTimestamp == null) return titleCompare;
            if (aTimestamp == null) return 1;
            if (bTimestamp == null) return -1;
            return bTimestamp - aTimestamp || titleCompare;
          }
          default:
            return titleCompare;
        }
      });
  }, [visibleMovies, filters, ratings, recentIndexMap]);

  const grouped = useMemo(() => groupSeriesForDisplay(visibleMovies, filtered), [visibleMovies, filtered]);

  const totalPages = Math.max(1, Math.ceil(grouped.length / pageSize));
  const pagedMovies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return grouped.slice(start, start + pageSize);
  }, [grouped, page, pageSize]);

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

  const secciones = useMemo(() => uniqueValues(visibleMovies.map((m) => m.seccion)), [visibleMovies]);
  const sagas = useMemo(() => uniqueValues(visibleMovies.map((m) => m.saga)), [visibleMovies]);
  const sortOptions: ArchiveOption[] = [
    { value: 'title-asc', label: 'Title A?Z' },
    { value: 'title-desc', label: 'Title Z?A' },
    { value: 'year-desc', label: 'Year (Newest)' },
    { value: 'year-asc', label: 'Year (Oldest)' },
    { value: 'rating-desc', label: 'Rating' },
    { value: 'recent-desc', label: 'Recently Added' },
    { value: 'rating-best', label: 'Best Rated (Highest Avg)' }
  ];

  useEffect(() => {
    if (!sortOptions.some((option) => option.value === filters.sort)) {
      handleChange({ sort: 'title-asc' });
    }
  }, [filters.sort]);

  const renderPagination = () => (
    <div className="archive-pagination">
      <div className="archive-pagination__meta">
        <span className="muted">
          {grouped.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, grouped.length)} de{' '}
          {grouped.length}
        </span>
      </div>
      <div className="archive-pagination__controls">
        <label className="archive-pagination__size">
          <span className="muted">Por p?gina</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={120}>120</option>
          </select>
        </label>
        <div className="archive-pagination__buttons">
          <button className="ghost" onClick={() => setPage(1)} disabled={page === 1}>
            ?
          </button>
          <button className="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            ?
          </button>
          <span className="muted">
            {page}/{totalPages}
          </span>
          <button
            className="ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            ?
          </button>
          <button className="ghost" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
            ?
          </button>
        </div>
      </div>
    </div>
  );

  const hasActiveFilters =
    Boolean(filters.query.trim()) ||
    Boolean(filters.seccion) ||
    Boolean(filters.saga) ||
    filters.series !== 'all' ||
    filters.seen !== 'all';

  const clearFilters = () => {
    handleChange({
      query: '',
      seccion: null,
      saga: null,
      series: 'all',
      seen: 'all'
    });
  };

  return (
    <section className="archive-page">
      <header className="archive-header">
        <h1>Archive of All Films</h1>
        {loading && <p className="muted">Summoning data from the crypt...</p>}
        {error && <p className="muted">Error: {error}</p>}
      </header>

      <div className="archive-filter-bar">
        <div className="archive-filter-row archive-filter-row--top">
          <input
            className="archive-search"
            placeholder="Search by title or original name..."
            value={filters.query}
            onChange={(event) => handleChange({ query: event.target.value })}
          />
          <div className="archive-view-toggle">
            <button
              type="button"
              className={`archive-toggle__button ${filters.view === 'grid' ? 'is-active' : ''}`}
              onClick={() => handleChange({ view: 'grid' })}
            >
              Posters
            </button>
            <button
              type="button"
              className={`archive-toggle__button ${filters.view === 'list' ? 'is-active' : ''}`}
              onClick={() => handleChange({ view: 'list' })}
            >
              List
            </button>
          </div>
          <ArchiveDropdown
            label="Sort by"
            value={filters.sort}
            options={sortOptions}
            onChange={(value) => handleChange({ sort: value as MovieFilters['sort'] })}
            placeholder="Title A?Z"
          />
        </div>
        <div className="archive-filter-row archive-filter-row--bottom">
          <ArchiveDropdown
            label="Section"
            value={filters.seccion ?? ''}
            options={[{ value: '', label: 'All Sections' }, ...secciones.map((s) => ({ value: s, label: s }))]}
            onChange={(value) => handleChange({ seccion: value || null })}
            placeholder="All Sections"
          />
          <ArchiveDropdown
            label="Saga"
            value={filters.saga ?? ''}
            options={[{ value: '', label: 'All Sagas' }, ...sagas.map((s) => ({ value: s, label: s }))]}
            onChange={(value) => handleChange({ saga: value || null })}
            placeholder="All Sagas"
          />
          <ArchiveDropdown
            label="Content Type"
            value={filters.series}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'movies', label: 'Movie' },
              { value: 'series', label: 'Series' }
            ]}
            onChange={(value) => handleChange({ series: value as MovieFilters['series'] })}
            placeholder="All Types"
          />
          <ArchiveDropdown
            label="View Status"
            value={filters.seen}
            options={[
              { value: 'all', label: 'All' },
              { value: 'seen', label: 'Viewed' },
              { value: 'unseen', label: 'Unviewed' }
            ]}
            onChange={(value) => handleChange({ seen: value as MovieFilters['seen'] })}
            placeholder="All"
          />
          {hasActiveFilters && (
            <button type="button" className="archive-clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filters.view === 'grid' ? (
        <div className="archive-grid">
          {pagedMovies.map((movie) => (
            <div key={movie.id} className="archive-card" onClick={() => setActiveMovie(movie)}>
              <div className="archive-card__poster">
                <img
                  src={movie.posterUrl ?? 'https://via.placeholder.com/300x450/0b0f17/ffffff?text=No+Poster'}
                  alt={movie.groupedDisplayTitle ?? movie.title}
                  loading="lazy"
                />
                {movie.seen && <span className="archive-card__badge archive-card__badge--seen">Viewed</span>}
                <div className="archive-card__chips">
                  <span className="archive-card__chip">{movie.tmdbYear ?? movie.year ?? '?'}</span>
                  <span className="archive-card__chip">{movie.seccion}</span>
                </div>
                <div className="archive-card__overlay">
                  <span className="archive-card__overlay-title">{movie.groupedDisplayTitle ?? movie.title}</span>
                  <div className="archive-card__overlay-actions">
                    <button type="button" onClick={() => setActiveMovie(movie)}>
                      Open
                    </button>
                    <button type="button" onClick={() => navigate(`/admin/movies/${movie.id}/edit`)}>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="archive-table">
          <div className="archive-table__header">
            <span>Poster</span>
            <span>Title</span>
            <span className="is-right">Year</span>
            <span>Section</span>
            <span>Genre</span>
            <span className="is-right">Viewed</span>
            <span className="is-right">TMDb</span>
            <span className="is-right">G</span>
            <span className="is-right">R</span>
            <span className="is-right">Avg</span>
          </div>
          <div className="archive-table__body">
            {pagedMovies.map((movie) => {
              const avg = getMovieAverage(movie);
              return (
                <div key={movie.id} className="archive-row" onClick={() => setActiveMovie(movie)}>
                  <span className="archive-row__poster">
                    <img
                      src={movie.posterUrl ?? 'https://via.placeholder.com/60x90/0b0f17/ffffff?text=No+Poster'}
                      alt={movie.groupedDisplayTitle ?? movie.title}
                      loading="lazy"
                    />
                  </span>
                  <span className="archive-row__title">{movie.groupedDisplayTitle ?? movie.title}</span>
                  <span className="is-right">{movie.tmdbYear ?? movie.year ?? '?'}</span>
                  <span className="archive-row__badge">{movie.seccion}</span>
                  <span className="archive-row__genre">{movie.genreRaw || '?'}</span>
                  <span className="is-right">{movie.seen ? 'S?' : 'No'}</span>
                  <span className="is-right">{movie.tmdbRating?.toFixed(1) ?? '?'}</span>
                  <span className="is-right">{movie.ratingGloria?.toFixed(1) ?? '?'}</span>
                  <span className="is-right">{movie.ratingRodrigo?.toFixed(1) ?? '?'}</span>
                  <span className="is-right">{avg != null ? avg.toFixed(1) : '?'}</span>
                  <div className="archive-row__actions" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => setActiveMovie(movie)}>
                      Open
                    </button>
                    <button type="button" onClick={() => navigate(`/admin/movies/${movie.id}/edit`)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => updateSeen(movie.id, !movie.seen)}>
                      {movie.seen ? 'Mark Unviewed' : 'Mark Viewed'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {renderPagination()}
      {activeMovie && <MovieDetail movie={activeMovie} onClose={() => setActiveMovie(null)} />}
    </section>
  );
};
