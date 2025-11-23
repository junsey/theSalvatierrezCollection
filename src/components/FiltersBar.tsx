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
  const genres = uniqueValues(
    movies
      .flatMap((m) => [
        ...m.genreRaw.split(/[,;\-/]/g).map((g) => g.trim()),
        ...(m.tmdbGenres ?? [])
      ])
      .filter(Boolean)
  );

  return (
    <div className="filters">
      <input
        placeholder="Buscar título"
        value={filters.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <select value={filters.seccion ?? ''} onChange={(e) => onChange({ seccion: e.target.value || null })}>
        <option value="">Todas las secciones</option>
        {secciones.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select value={filters.saga ?? ''} onChange={(e) => onChange({ saga: e.target.value || null })}>
        <option value="">Todas las sagas</option>
        {sagas.map((saga) => (
          <option key={saga} value={saga}>
            {saga}
          </option>
        ))}
      </select>
      <select value={filters.genre ?? ''} onChange={(e) => onChange({ genre: e.target.value || null })}>
        <option value="">Todos los géneros</option>
        {genres.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <select value={filters.seen} onChange={(e) => onChange({ seen: e.target.value as MovieFilters['seen'] })}>
        <option value="all">Vistas + no vistas</option>
        <option value="seen">Solo vistas</option>
        <option value="unseen">Solo no vistas</option>
      </select>
      <select value={filters.series} onChange={(e) => onChange({ series: e.target.value as MovieFilters['series'] })}>
        <option value="all">Películas y series</option>
        <option value="movies">Solo películas</option>
        <option value="series">Solo series</option>
      </select>
      <select value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as MovieFilters['sort'] })}>
        <option value="title-asc">Título A-Z</option>
        <option value="title-desc">Título Z-A</option>
        <option value="year-desc">Año ↓</option>
        <option value="year-asc">Año ↑</option>
        <option value="tmdb-desc">TMDb ↓</option>
        <option value="tmdb-asc">TMDb ↑</option>
        <option value="rating-desc">Mi puntuación ↓</option>
        <option value="rating-asc">Mi puntuación ↑</option>
      </select>
      <div className="filters__actions">
        <button onClick={() => onChange({ view: 'grid' })} aria-label="Grid view">
          Carteles
        </button>
        <button onClick={() => onChange({ view: 'list' })} aria-label="List view">
          Lista
        </button>
        {onReset && (
          <button className="ghost" onClick={onReset} aria-label="Limpiar filtros">
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
};
