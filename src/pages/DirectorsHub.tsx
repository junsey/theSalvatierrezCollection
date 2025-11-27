import React from 'react';
import { DirectorList } from '../components/DirectorList';
import { useMovies } from '../context/MovieContext';

export const DirectorsHub: React.FC = () => {
  const { movies } = useMovies();
  return (
    <section>
      <h1>Directores</h1>
      <p className="text-muted">Explora la colección por autoría. Solo aparecen los directores registrados en el Excel.</p>
      <DirectorList movies={movies} />
    </section>
  );
};
