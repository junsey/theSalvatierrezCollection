import React from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';

const splitDirectors = (value: string) =>
  value
    .split(/[,;/&]/g)
    .map((d) => d.trim())
    .filter(Boolean);

export const DirectorList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const directors = Array.from(
    new Set(
      movies
        .flatMap((m) => splitDirectors(m.director))
        .filter(Boolean)
    )
  ).sort();

  return (
    <ul className="director-simple-list">
      {directors.map((director) => (
        <li key={director}>
          <Link to={`/directors/${encodeURIComponent(director)}`}>{director}</Link>
        </li>
      ))}
    </ul>
  );
};
