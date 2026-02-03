import React from 'react';
import { MovieFilters, MovieRecord } from '../types/MovieRecord';

interface Props {
  filters: MovieFilters;
  onChange: (patch: Partial<MovieFilters>) => void;
  movies: MovieRecord[];
  onReset?: () => void;
}

const uniqueValues = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort();

export const FiltersBar: React.FC<Props> = ({ filters, onChange, movies, onReset }) => {
  const secciones = uniqueValues(movies.map((m) => m.seccion));
  const sagas = uniqueValues(movies.map((m) => m.saga));

  return (
    <div className="filters-container">
      <div className="filters-group filters-group--search">
        <div className="filters-row filters-row--search">
          <input
            className="filter-control filter-control--search"
            placeholder="Search by title or original name..."
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
          />
        </div>
      </div>

      <div className="filters-group filters-group--filters">
        <div className="filters-row filters-row--grid">
          <select
            className="filter-control filter-control--pill"
            value={filters.seccion ?? ''}
            onChange={(e) => onChange({ seccion: e.target.value || null })}
          >
            <option value="">Section</option>
            {secciones.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="filter-control filter-control--pill"
            value={filters.saga ?? ''}
            onChange={(e) => onChange({ saga: e.target.value || null })}
          >
            <option value="">Saga</option>
            {sagas.map((saga) => (
              <option key={saga} value={saga}>
                {saga}
              </option>
            ))}
          </select>
          <select
            className="filter-control filter-control--pill"
            value={filters.series}
            onChange={(e) => onChange({ series: e.target.value as MovieFilters['series'] })}
          >
            <option value="all">Content Type</option>
            <option value="movies">Movie</option>
            <option value="series">Series</option>
          </select>
          <select
            className="filter-control filter-control--pill"
            value={filters.seen}
            onChange={(e) => onChange({ seen: e.target.value as MovieFilters['seen'] })}
          >
            <option value="all">View Status</option>
            <option value="seen">Viewed</option>
            <option value="unseen">Unviewed</option>
          </select>
        </div>
      </div>

      <div className="filters-group filters-group--sort">
        <select
          className="filter-control filter-control--sort"
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as MovieFilters['sort'] })}
          aria-label="Sort by"
        >
          <option value="title-asc">Title A–Z</option>
          <option value="year-desc">Year</option>
          <option value="rating-desc">Rating</option>
          <option value="shelf-asc">Recently Added</option>
        </select>
        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`filter-control view-toggle__button ${filters.view === 'grid' ? 'is-active' : ''}`}
            onClick={() => onChange({ view: 'grid' })}
            aria-pressed={filters.view === 'grid'}
          >
            Posters
          </button>
          <button
            type="button"
            className={`filter-control view-toggle__button ${filters.view === 'list' ? 'is-active' : ''}`}
            onClick={() => onChange({ view: 'list' })}
            aria-pressed={filters.view === 'list'}
          >
            List
          </button>
        </div>
        {onReset && (
          <button className="filter-control ghost filter-control--clear" onClick={onReset} aria-label="Clear filters">
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};



