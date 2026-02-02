import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionList } from '../components/SectionList';
import { useMovies } from '../context/MovieContext';

export const SeriesSectionsHub: React.FC = () => {
  const { visibleMovies: movies } = useMovies();
  const seriesMovies = useMemo(
    () => movies.filter((movie) => movie.series || movie.tmdbType === 'tv'),
    [movies]
  );
  const [orderBy, setOrderBy] = useState<'pending' | 'largest' | 'alpha'>('pending');
  const totals = useMemo(() => {
    const total = seriesMovies.length;
    const seen = seriesMovies.filter((movie) => movie.seen).length;
    return { total, seen, pending: Math.max(total - seen, 0) };
  }, [seriesMovies]);

  return (
    <section className="sections-hub">
      <header className="sections-hub__header">
        <div>
          <h1>Sections: Series</h1>
          <p className="text-muted">Explora la coleccion por secciones solo para series.</p>
        </div>
        <div className="sections-hub__metrics">
          <div className="sections-hub__metric">
            <span>Total</span>
            <strong>{totals.total}</strong>
          </div>
          <div className="sections-hub__metric">
            <span>Vistas</span>
            <strong>{totals.seen}</strong>
          </div>
          <div className="sections-hub__metric">
            <span>Pendientes</span>
            <strong>{totals.pending}</strong>
          </div>
        </div>
      </header>
      <div className="sections-hub__toolbar">
        <div className="sections-hub__chips">
          <Link className="sections-hub__chip" to="/sections">
            Todas
          </Link>
          <Link className="sections-hub__chip is-active" to="/sections-series">
            Series
          </Link>
          <button className="sections-hub__chip" type="button" disabled>
            Generos
          </button>
          <Link className="sections-hub__chip" to="/directors">
            Directores
          </Link>
          <Link className="sections-hub__chip" to="/sagas">
            Sagas
          </Link>
        </div>
        <label className="sections-hub__order">
          <span>Ordenar por</span>
          <select value={orderBy} onChange={(event) => setOrderBy(event.target.value as 'pending' | 'largest' | 'alpha')}>
            <option value="pending">Mas pendientes</option>
            <option value="largest">Mas grandes</option>
            <option value="alpha">A–Z</option>
          </select>
        </label>
      </div>
      <SectionList movies={seriesMovies} orderBy={orderBy} basePath="/sections-series" />
    </section>
  );
};
