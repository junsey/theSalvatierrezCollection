import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { getSheetUrl } from '../services/googleSheets';

export const HomePage: React.FC = () => {
  const { movies, loading } = useMovies();
  const hasOmdbKey = Boolean(import.meta.env.VITE_OMDB_API_KEY);
  const stats = useMemo(() => {
    const seen = movies.filter((m) => m.seen).length;
    const unseen = movies.length - seen;
    const sections = Array.from(new Set(movies.map((m) => m.seccion))).length;
    return { total: movies.length, seen, unseen, sections };
  }, [movies]);

  return (
    <div className="panel">
      <div className="hero">
        <div>
          <h1>The Salvatierrez Collection</h1>
          <p>
            Un catálogo oscuro con estética dungeon synth para tu videoteca. Las películas descienden en vivo desde Google
            Sheets, se visten con datos de IMDb/OMDb (portadas, rating, sinopsis) y guardan tus marcas locales de "vista" y
            "puntuación" (columna Puntuacion) junto a tus notas personales en este navegador.
          </p>
          <p>
            Fuente del Excel: <code>{getSheetUrl()}</code>
          </p>
          {!hasOmdbKey && (
            <p style={{ color: 'var(--accent)' }}>
              No hay clave <code>VITE_OMDB_API_KEY</code> cargada: verás portadas genéricas hasta que añadas tu API de OMDb/IMDb.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="nav-link" to="/movies">Enter the Archive</Link>
            <Link className="nav-link" to="/surprise">Ritual of Random Cinema</Link>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <small>Total</small>
            <h3>{loading ? '...' : stats.total}</h3>
          </div>
          <div className="stat-card">
            <small>Seen</small>
            <h3>{loading ? '...' : stats.seen}</h3>
          </div>
          <div className="stat-card">
            <small>Unseen</small>
            <h3>{loading ? '...' : stats.unseen}</h3>
          </div>
          <div className="stat-card">
            <small>Sections</small>
            <h3>{loading ? '...' : stats.sections}</h3>
          </div>
        </div>
      </div>
    </div>
  );
};
