import React from 'react';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movie: MovieRecord;
  onClick?: () => void;
  personalRating?: number;
}

export const MovieCard: React.FC<Props> = ({ movie, onClick, personalRating }) => {
  return (
    <div className="movie-card" onClick={onClick} role="button" tabIndex={0}>
      <img
        className="poster"
        src={movie.posterUrl ?? 'https://via.placeholder.com/300x450/0b0f17/ffffff?text=No+Poster'}
        alt={movie.title}
        loading="lazy"
      />
      <div className="card-body">
        <strong>{movie.title}</strong>
        <small>{movie.year ?? 'Year ?'} • {movie.seccion}</small>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge">IMDb: {movie.imdbRating ?? 'N/A'}</span>
          <span className="badge">My rating: {personalRating ?? '—'}</span>
          <span className="badge" style={{ background: movie.seen ? 'rgba(126, 217, 87, 0.2)' : 'rgba(255, 54, 93, 0.2)' }}>
            {movie.seen ? 'Seen' : 'Unseen'}
          </span>
        </div>
      </div>
    </div>
  );
};
