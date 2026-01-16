import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionList } from '../components/SectionList';
import { useMovies } from '../context/MovieContext';

export const SectionsHub: React.FC = () => {
  const { visibleMovies: movies } = useMovies();
  const [orderBy, setOrderBy] = useState<'pending' | 'largest' | 'alpha'>('pending');
  const totals = useMemo(() => {
    const total = movies.length;
    const seen = movies.filter((movie) => movie.seen).length;
    return { total, seen, pending: Math.max(total - seen, 0) };
  }, [movies]);

  return (
    <section className="sections-hub">
      <header className="sections-hub__header">
        <div>
          <h1>Sections</h1>
          <p className="text-muted">Explora la colección por secciones y prioriza tus pendientes.</p>
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
          <Link className="sections-hub__chip is-active" to="/sections">
            Todas
          </Link>
          <Link className="sections-hub__chip" to="/genres">
            Géneros
          </Link>
          <Link className="sections-hub__chip" to="/directors">
            Directores
          </Link>
          <button className="sections-hub__chip" type="button" disabled>
            Sagas
          </button>
        </div>
        <label className="sections-hub__order">
          <span>Ordenar por</span>
          <select value={orderBy} onChange={(event) => setOrderBy(event.target.value as 'pending' | 'largest' | 'alpha')}>
            <option value="pending">Más pendientes</option>
            <option value="largest">Más grandes</option>
            <option value="alpha">A–Z</option>
          </select>
        </label>
      </div>
      <SectionList movies={movies} orderBy={orderBy} />
    </section>
  );
};
