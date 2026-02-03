import React, { useState } from 'react';
import { SurpriseMovieNight } from '../components/SurpriseMovieNight';
import { MovieDetail } from '../components/MovieDetail';
import { useMovies } from '../context/MovieContext';
import { MovieRecord } from '../types/MovieRecord';

export const SurpriseMovieNightPage: React.FC = () => {
  const { visibleMovies: movies } = useMovies();
  const [active, setActive] = useState<MovieRecord | null>(null);
  return (
    <section className="surprise-page-wrap">
      <SurpriseMovieNight movies={movies} onSelect={setActive} />
      {active && <MovieDetail movie={active} onClose={() => setActive(null)} />}
    </section>
  );
};
