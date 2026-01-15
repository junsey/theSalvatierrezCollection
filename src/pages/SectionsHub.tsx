import React from 'react';
import { SectionList } from '../components/SectionList';
import { useMovies } from '../context/MovieContext';

export const SectionsHub: React.FC = () => {
  const { visibleMovies: movies } = useMovies();
  return (
    <section>
      <h1>Sections</h1>
      <SectionList movies={movies} />
    </section>
  );
};
