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
      </header>
      <DirectorList movies={movies} />
    </section>
  );
};
