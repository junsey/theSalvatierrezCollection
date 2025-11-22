import React from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';

export const GenreList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const genres = Array.from(
    new Set(
      movies
        .flatMap((m) => m.genreRaw.split(/[,;\-/]/g).map((g) => g.trim()))
        .filter(Boolean)
    )
  ).sort();
  return (
    <div className="genre-grid">
      {genres.map((genre) => (
        <Link key={genre} to={`/genres/${encodeURIComponent(genre)}`} className="genre-card">
          <strong>{genre}</strong>
          <small>{movies.filter((m) => m.genreRaw.includes(genre)).length} films</small>
        </Link>
      ))}
    </div>
  );
};
