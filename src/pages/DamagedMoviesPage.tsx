import React, { useMemo, useState } from 'react';
import { MovieCard } from '../components/MovieCard';
import { MovieDetail } from '../components/MovieDetail';
import { useMovies } from '../context/MovieContext';
import { MovieRecord } from '../types/MovieRecord';

export const DamagedMoviesPage: React.FC = () => {
  const { movies, loading, error } = useMovies();
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);

  const damagedMovies = useMemo(
    () => movies.filter((movie) => movie.funcionaStatus === 'damaged'),
    [movies]
  );

  return (
    <section>
      <h1>Películas dañadas</h1>
      <p className="muted">
        Listado basado en la columna <strong>Funciona</strong> del Excel. Las películas marcadas con "No" aparecen aquí para
        facilitar la recompra o sustitución.
      </p>

      {loading && <p>Cargando colección...</p>}
      {error && <p style={{ color: 'var(--accent)' }}>Error: {error}</p>}

      {!loading && !error && damagedMovies.length === 0 && (
        <p style={{ color: 'var(--accent-2)' }}>🎉 No hay películas marcadas como dañadas.</p>
      )}

      {!loading && !error && damagedMovies.length > 0 && (
        <div className="movie-grid movie-grid--six">
          {damagedMovies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onClick={() => setActiveMovie(movie)}
            />
          ))}
        </div>
      )}

      {activeMovie && <MovieDetail movie={activeMovie} onClose={() => setActiveMovie(null)} />}
    </section>
  );
};

