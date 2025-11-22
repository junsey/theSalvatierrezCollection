import React, { useState } from 'react';
import { SurpriseMovieNight } from '../components/SurpriseMovieNight';
import { MovieDetail } from '../components/MovieDetail';
import { useMovies } from '../context/MovieContext';
import { MovieRecord } from '../types/MovieRecord';

export const SurpriseMovieNightPage: React.FC = () => {
  const { movies, ratings, notes, updateNote, updateRating, updateSeen } = useMovies();
  const [active, setActive] = useState<MovieRecord | null>(null);
  return (
    <section>
      <h1>Surprise Movie Night</h1>
      <p>Summon a random film with filters. Exclude seen movies to keep the ritual fresh.</p>
      <SurpriseMovieNight movies={movies} onSelect={setActive} />
      {active && (
        <MovieDetail
          movie={active}
          personalRating={ratings[active.id]}
          personalNote={notes[active.id]}
          onClose={() => setActive(null)}
          onSeenChange={(seen) => updateSeen(active.id, seen)}
          onRatingChange={(rating) => updateRating(active.id, rating)}
          onNoteChange={(note) => updateNote(active.id, note)}
        />
      )}
    </section>
  );
};
