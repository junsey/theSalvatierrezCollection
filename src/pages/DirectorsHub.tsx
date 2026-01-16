import React from 'react';
import { DirectorList } from '../components/DirectorList';
import { useMovies } from '../context/MovieContext';

export const DirectorsHub: React.FC = () => {
  const { movies } = useMovies();
  return (
    <section className="director-page">
      <header className="director-page__header">
        <p className="director-page__eyebrow">Archivo de autoría</p>
        <h1>Directores</h1>
        <p className="director-page__subtitle">
          Explora la colección por autor. Descubre cuánto de cada filmografía ya forma parte de tu archivo.
        </p>
      </header>
      <DirectorList movies={movies} />
    </section>
  );
};
