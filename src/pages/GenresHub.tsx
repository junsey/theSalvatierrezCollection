import React from 'react';
import { GenreList } from '../components/GenreList';
import { useMovies } from '../context/MovieContext';

export const GenresHub: React.FC = () => {
  const { movies } = useMovies();
  return (
    <section>
      <h1>Genres</h1>
      <GenreList movies={movies} />
    </section>
  );
};
