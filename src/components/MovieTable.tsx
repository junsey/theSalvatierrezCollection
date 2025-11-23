import React from 'react';
import { MovieRecord } from '../types/MovieRecord';
import { PawRating } from './PawRating';

interface Props {
  movies: MovieRecord[];
  onSelect: (movie: MovieRecord) => void;
}

export const MovieTable: React.FC<Props> = ({ movies, onSelect }) => {
  return (
    <table className="table-list">
      <thead>
        <tr>
          <th>Poster</th>
          <th>Título</th>
          <th>Año</th>
          <th>Sección</th>
          <th>Género</th>
          <th>Vista</th>
          <th>TMDb</th>
          <th>Gloria</th>
          <th>Rodrigo</th>
          <th>Promedio</th>
        </tr>
      </thead>
      <tbody>
        {movies.map((movie) => {
          const promedio =
            movie.ratingGloria != null && movie.ratingRodrigo != null
              ? (movie.ratingGloria + movie.ratingRodrigo) / 2
              : null;
          return (
            <tr key={movie.id} onClick={() => onSelect(movie)} style={{ cursor: 'pointer' }}>
              <td>
                <img
                  src={movie.posterUrl ?? 'https://via.placeholder.com/60x90/0b0f17/ffffff?text=No+Poster'}
                  alt={movie.title}
                  width={50}
                />
              </td>
              <td>{movie.title}</td>
              <td>{movie.tmdbYear ?? movie.year ?? '—'}</td>
              <td>{movie.seccion}</td>
              <td>{movie.genreRaw}</td>
              <td>{movie.seen ? 'Sí' : 'No'}</td>
              <td>{movie.tmdbRating?.toFixed(1) ?? 'N/A'}</td>
              <td style={{ textAlign: 'center' }}>
                {movie.ratingGloria != null ? <PawRating value={movie.ratingGloria} size="small" /> : '—'}
              </td>
              <td style={{ textAlign: 'center' }}>
                {movie.ratingRodrigo != null ? <PawRating value={movie.ratingRodrigo} size="small" /> : '—'}
              </td>
              <td style={{ textAlign: 'center' }}>
                {promedio != null ? <PawRating value={promedio} size="small" /> : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
