import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArchiveDropdown, ArchiveOption } from '../components/ArchiveDropdown';
import { MovieDetail } from '../components/MovieDetail';
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
  condition: 'all',
  deposit: 'all',
  view: 'grid',
  sort: 'title-asc'
};

const uniqueValues = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort();

const getMovieAverage = (movie: MovieRecord) => {
  if (movie.ratingGloria == null || movie.ratingRodrigo == null) return null;
  return (movie.ratingGloria + movie.ratingRodrigo) / 2;
};

type VirtualConfig = {
  count: number;
  itemHeight: number;
  containerRef: React.RefObject<HTMLDivElement>;
  overscan?: number;
  enabled?: boolean;
};

const useVirtualWindow = ({ count, itemHeight, containerRef, overscan = 6, enabled = true }: VirtualConfig) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => setScrollTop(el.scrollTop);
    const handleResize = () => setHeight(el.clientHeight);
    handleResize();
    el.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef, enabled]);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(count - 1, Math.floor((scrollTop + height) / itemHeight) + overscan);
  const offsetY = startIndex * itemHeight;
  const totalHeight = count * itemHeight;

  return { startIndex, endIndex, offsetY, totalHeight };
};

export const AllMoviesPage: React.FC = () => {
  const { visibleMovies, loading, error, ratings, updateSeen } = useMovies();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<MovieFilters>({ ...defaultFilters, ...getStoredFilters() });
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(120);
  const location = useLocation();

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

  const secciones = useMemo(() => uniqueValues(visibleMovies.map((m) => m.seccion)), [visibleMovies]);
  const sagas = useMemo(() => uniqueValues(visibleMovies.map((m) => m.saga)), [visibleMovies]);
  const sortOptions: ArchiveOption[] = [
    { value: 'title-asc', label: 'Title A–Z' },
    { value: 'year-desc', label: 'Year' },
    { value: 'rating-desc', label: 'Rating' },
    { value: 'shelf-asc', label: 'Recently Added' }
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
          <span className="muted">Por página</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={120}>120</option>
          </select>
        </label>
        <div className="archive-pagination__buttons">
          <button className="ghost" onClick={() => setPage(1)} disabled={page === 1}>
            «
          </button>
          <button className="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            ‹
          </button>
          <span className="muted">
            {page}/{totalPages}
          </span>
          <button
            className="ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            ›
          </button>
          <button className="ghost" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
            »
          </button>
        </div>
      </div>
    </div>
  );

  const gridRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [gridColumns, setGridColumns] = useState(6);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const updateColumns = () => {
      const width = el.clientWidth;
      const minColumn = 170;
      const columns = Math.max(1, Math.floor(width / minColumn));
      setGridColumns(columns);
    };
    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(el);
    return () => observer.disconnect();
  }, [filters.view]);

  const gridRowHeight = 280;
  const gridRowCount = Math.ceil(pagedMovies.length / gridColumns);
  const gridVirtual = useVirtualWindow({
    count: gridRowCount,
    itemHeight: gridRowHeight,
    containerRef: gridRef,
    overscan: 4,
    enabled: filters.view === 'grid'
  });

  const listRowHeight = 86;
  const listVirtual = useVirtualWindow({
    count: pagedMovies.length,
    itemHeight: listRowHeight,
    containerRef: tableRef,
    overscan: 8,
    enabled: filters.view === 'list'
  });

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
            placeholder="Title A–Z"
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
        <div className="archive-grid" ref={gridRef}>
          <div className="archive-grid__spacer" style={{ height: gridVirtual.totalHeight }}>
            <div
              className="archive-grid__window"
              style={{
                transform: `translateY(${gridVirtual.offsetY}px)`,
                gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
              }}
            >
              {pagedMovies
                .slice(gridVirtual.startIndex * gridColumns, (gridVirtual.endIndex + 1) * gridColumns)
                .map((movie) => (
                  <div key={movie.id} className="archive-card" onClick={() => setActiveMovie(movie)}>
                    <div className="archive-card__poster">
                      <img
                        src={movie.posterUrl ?? 'https://via.placeholder.com/300x450/0b0f17/ffffff?text=No+Poster'}
                        alt={movie.groupedDisplayTitle ?? movie.title}
                        loading="lazy"
                      />
                      {movie.seen && <span className="archive-card__badge archive-card__badge--seen">Viewed</span>}
                      <span className="archive-card__badge archive-card__badge--section">{movie.seccion}</span>
                      <div className="archive-card__ratings">
                        <span>G {movie.ratingGloria?.toFixed(1) ?? '—'}</span>
                        <span>R {movie.ratingRodrigo?.toFixed(1) ?? '—'}</span>
                        <span>Avg {getMovieAverage(movie)?.toFixed(1) ?? '—'}</span>
                      </div>
                    </div>
                    <div className="archive-card__meta">
                      <span className="archive-card__title">{movie.groupedDisplayTitle ?? movie.title}</span>
                      <span className="archive-card__year">{movie.tmdbYear ?? movie.year ?? '—'}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="archive-table" ref={tableRef}>
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
          <div className="archive-table__body" style={{ height: listVirtual.totalHeight }}>
            {pagedMovies.slice(listVirtual.startIndex, listVirtual.endIndex + 1).map((movie, index) => {
              const avg = getMovieAverage(movie);
              const rowIndex = listVirtual.startIndex + index;
              return (
                <div
                  key={movie.id}
                  className="archive-row"
                  style={{ top: rowIndex * listRowHeight }}
                  onClick={() => setActiveMovie(movie)}
                >
                  <span className="archive-row__poster">
                    <img
                      src={movie.posterUrl ?? 'https://via.placeholder.com/60x90/0b0f17/ffffff?text=No+Poster'}
                      alt={movie.groupedDisplayTitle ?? movie.title}
                      loading="lazy"
                    />
                  </span>
                  <span className="archive-row__title">{movie.groupedDisplayTitle ?? movie.title}</span>
                  <span className="is-right">{movie.tmdbYear ?? movie.year ?? '—'}</span>
                  <span className="archive-row__badge">{movie.seccion}</span>
                  <span className="archive-row__genre">{movie.genreRaw || '—'}</span>
                  <span className="is-right">{movie.seen ? 'Sí' : 'No'}</span>
                  <span className="is-right">{movie.tmdbRating?.toFixed(1) ?? '—'}</span>
                  <span className="is-right">{movie.ratingGloria?.toFixed(1) ?? '—'}</span>
                  <span className="is-right">{movie.ratingRodrigo?.toFixed(1) ?? '—'}</span>
                  <span className="is-right">{avg != null ? avg.toFixed(1) : '—'}</span>
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
