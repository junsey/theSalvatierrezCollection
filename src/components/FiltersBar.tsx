import React from 'react';
import { MovieFilters, MovieRecord } from '../types/MovieRecord';

interface Props {
  filters: MovieFilters;
  onChange: (patch: Partial<MovieFilters>) => void;
  movies: MovieRecord[];
}

const uniqueValues = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort();

export const FiltersBar: React.FC<Props> = ({ filters, onChange, movies }) => {
  const secciones = uniqueValues(movies.map((m) => m.seccion));
  const genres = uniqueValues(
    movies
      .flatMap((m) => m.genreRaw.split(/[,;\-/]/g).map((g) => g.trim()))
      .filter(Boolean)
  );

  return (
    <div className="filters">
      <input
        placeholder="Search title"
        value={filters.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <select value={filters.seccion ?? ''} onChange={(e) => onChange({ seccion: e.target.value || null })}>
        <option value="">All Sections</option>
        {secciones.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select value={filters.genre ?? ''} onChange={(e) => onChange({ genre: e.target.value || null })}>
        <option value="">All Genres</option>
        {genres.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <select value={filters.seen} onChange={(e) => onChange({ seen: e.target.value as MovieFilters['seen'] })}>
        <option value="all">Seen + Unseen</option>
        <option value="seen">Seen only</option>
        <option value="unseen">Unseen only</option>
      </select>
      <select value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as MovieFilters['sort'] })}>
        <option value="title-asc">Title A-Z</option>
        <option value="title-desc">Title Z-A</option>
        <option value="year-desc">Year ↓</option>
        <option value="year-asc">Year ↑</option>
        <option value="imdb-desc">IMDb rating ↓</option>
        <option value="imdb-asc">IMDb rating ↑</option>
        <option value="rating-desc">My rating ↓</option>
        <option value="rating-asc">My rating ↑</option>
      </select>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onChange({ view: 'grid' })} aria-label="Grid view">
          Grid
        </button>
        <button onClick={() => onChange({ view: 'list' })} aria-label="List view">
          List
        </button>
      </div>
    </div>
  );
};
