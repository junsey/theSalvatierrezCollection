import React from 'react';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movies: MovieRecord[];
  onSelect: (movie: MovieRecord) => void;
  personalRatings: Record<string, number>;
}

export const MovieTable: React.FC<Props> = ({ movies, onSelect, personalRatings }) => {
  return (
    <table className="table-list">
      <thead>
        <tr>
          <th>Poster</th>
          <th>Title</th>
          <th>Year</th>
          <th>Section</th>
          <th>Genre</th>
          <th>Seen</th>
          <th>IMDb</th>
          <th>My rating</th>
        </tr>
      </thead>
      <tbody>
        {movies.map((movie) => (
          <tr key={movie.id} onClick={() => onSelect(movie)} style={{ cursor: 'pointer' }}>
            <td>
              <img
                src={movie.posterUrl ?? 'https://via.placeholder.com/60x90/0b0f17/ffffff?text=No+Poster'}
                alt={movie.title}
                width={50}
              />
            </td>
            <td>{movie.title}</td>
            <td>{movie.year ?? '—'}</td>
            <td>{movie.seccion}</td>
            <td>{movie.genreRaw}</td>
            <td>{movie.seen ? 'Seen' : 'Unseen'}</td>
            <td>{movie.imdbRating ?? 'N/A'}</td>
            <td>{personalRatings[movie.id] ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
