import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DirectorList } from '../components/DirectorList';
import { useMovies } from '../context/MovieContext';
import { normalizeDirectorName, splitDirectors } from '../services/directors';

export const DirectorsHub: React.FC = () => {
  const { visibleMovies: movies } = useMovies();
  const totals = useMemo(() => {
    const totalMovies = movies.length;
    const seen = movies.filter((movie) => movie.seen).length;
    const directorSet = new Set<string>();
    movies.forEach((movie) => {
      splitDirectors(movie.director).forEach((name) => {
        directorSet.add(normalizeDirectorName(name));
      });
    });
    return {
      totalMovies,
      seen,
      pending: Math.max(totalMovies - seen, 0),
      directors: directorSet.size
    };
  }, [movies]);

  return (
    <section className="sections-hub director-page">
      <header className="sections-hub__header">
        <div>
          <h1>Directores</h1>
          <p className="text-muted">Explora la colecciÃ³n por directores y vuelve a secciones cuando necesites.</p>
        </div>
        <div className="sections-hub__metrics">
          <div className="sections-hub__metric">
            <span>PelÃ­culas</span>
            <strong>{totals.totalMovies}</strong>
          </div>
          <div className="sections-hub__metric">
            <span>Directores</span>
            <strong>{totals.directors}</strong>
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
          <Link className="sections-hub__chip is-active" to="/directors">
            Directores
          </Link>
          <button className="sections-hub__chip" type="button" disabled>
            Sagas
          </button>
        </div>
      </div>
      <DirectorList movies={movies} />
    </section>
  );
};
