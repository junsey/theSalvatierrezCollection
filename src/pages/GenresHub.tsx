import React from 'react';
import { GenreList } from '../components/GenreList';
import { useMovies } from '../context/MovieContext';

export const GenresHub: React.FC = () => {
  const { visibleMovies: movies } = useMovies();
  return (
    <section>
      <h1>Géneros</h1>
      <p>Explora las criptas por género, mezclando los tags del Excel y los que llegan desde TMDb.</p>
      <GenreList movies={movies} />
    </section>
  );
};
