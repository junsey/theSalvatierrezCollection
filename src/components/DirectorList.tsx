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
    <div className="genre-grid">
      {directors.map((director) => (
        <Link key={director} to={`/directors/${encodeURIComponent(director)}`} className="genre-card">
          <strong>{director}</strong>
          <small>{movies.filter((m) => splitDirectors(m.director).some((d) => d.toLowerCase() === director.toLowerCase())).length} películas</small>
        </Link>
      ))}
    </div>
  );
};
