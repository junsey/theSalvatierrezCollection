import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SagaList } from '../components/SagaList';
import { useMovies } from '../context/MovieContext';

export const SagasHub: React.FC = () => {
  const { visibleMovies: movies } = useMovies();
  const [orderBy, setOrderBy] = useState<'pending' | 'largest' | 'alpha'>('pending');
  const totals = useMemo(() => {
    const sagaMap = new Map<string, number>();
    let totalMovies = 0;
    let seen = 0;
    movies.forEach((movie) => {
      const saga = (movie.saga ?? '').trim();
      if (!saga) return;
      sagaMap.set(saga, (sagaMap.get(saga) ?? 0) + 1);
      totalMovies += 1;
      if (movie.seen) seen += 1;
    });
    const sagaCount = Array.from(sagaMap.values()).filter((count) => count > 1).length;
    return { totalMovies, seen, pending: Math.max(totalMovies - seen, 0), sagaCount };
  }, [movies]);

  return (
    <section className="sections-hub">
      <header className="sections-hub__header">
        <div>
          <h1>Sagas</h1>
          <p className="text-muted">Explora sagas con más de una película y vuelve a secciones cuando necesites.</p>
        </div>
        <div className="sections-hub__metrics">
          <div className="sections-hub__metric">
            <span>Películas</span>
            <strong>{totals.totalMovies}</strong>
          </div>
          <div className="sections-hub__metric">
            <span>Sagas</span>
            <strong>{totals.sagaCount}</strong>
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
            Secciones
          </Link>
          <button className="sections-hub__chip" type="button" disabled>
            Generos
          </button>
          <Link className="sections-hub__chip" to="/directors">
            Directores
          </Link>
          <Link className="sections-hub__chip is-active" to="/sagas">
            Sagas
          </Link>
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
      <SagaList movies={movies} orderBy={orderBy} />
    </section>
  );
};
