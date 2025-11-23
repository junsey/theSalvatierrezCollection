import React, { useState } from 'react';
import { SurpriseMovieNight } from '../components/SurpriseMovieNight';
import { MovieDetail } from '../components/MovieDetail';
import { useMovies } from '../context/MovieContext';
import { MovieRecord } from '../types/MovieRecord';

export const SurpriseMovieNightPage: React.FC = () => {
  const { movies, notes, updateNote } = useMovies();
  const [active, setActive] = useState<MovieRecord | null>(null);
  return (
    <section>
      <h1>Surprise Movie Night</h1>
      <p>Summon a random film with genre/section filtros. Exclude seen movies to keep the ritual fresh.</p>
      <SurpriseMovieNight movies={movies} onSelect={setActive} />
      {active && (
        <MovieDetail
          movie={active}
          personalNote={notes[active.id]}
          onClose={() => setActive(null)}
          onNoteChange={(note) => updateNote(active.id, note)}
        />
      )}
    </section>
  );
};
