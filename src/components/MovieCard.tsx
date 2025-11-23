import React from 'react';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movie: MovieRecord;
  onClick?: () => void;
  personalRating?: number;
}

export const MovieCard: React.FC<Props> = ({ movie, onClick, personalRating }) => {
  const pawValue =
    movie.ratingGloria != null && movie.ratingRodrigo != null
      ? (movie.ratingGloria + movie.ratingRodrigo) / 2
      : movie.ratingGloria ?? movie.ratingRodrigo ?? null;

  return (
    <div className="movie-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="poster-frame">
        <img
          className="poster"
          src={movie.posterUrl ?? 'https://via.placeholder.com/300x450/0b0f17/ffffff?text=No+Poster'}
          alt={movie.title}
          loading="lazy"
        />
        <span
          className="badge badge--floating"
          style={{ background: movie.seen ? 'rgba(126, 217, 87, 0.2)' : 'rgba(255, 54, 93, 0.2)' }}
        >
          {movie.seen ? 'Vista' : 'No vista'}
        </span>
      </div>
      <div className="card-body">
        <strong>{movie.title}</strong>
        <small>{movie.tmdbYear ?? movie.year ?? 'Year ?'} • {movie.seccion}</small>
        <div className="card-ratings">
          <span className="badge">TMDb: {movie.tmdbRating?.toFixed(1) ?? 'N/A'}</span>
          <span className="badge">Paws: {pawValue != null ? pawValue.toFixed(1) : 'N/A'}</span>
          {personalRating != null && <span className="badge">Mi puntuación: {personalRating}</span>}
        </div>
        <div className="card-tags">
          {movie.enDeposito && (
            <span className="badge" style={{ background: 'rgba(255, 200, 0, 0.2)', color: '#d7a100' }}>
              En depósito
            </span>
          )}
          {movie.funcionaStatus === 'damaged' && (
            <span className="badge" style={{ background: 'rgba(255, 54, 93, 0.15)', color: 'var(--accent)' }}>
              Dañada
            </span>
          )}
          {movie.funcionaStatus === 'untested' && (
            <span className="badge" style={{ background: 'rgba(255, 200, 0, 0.2)', color: '#b58100' }}>
              Sin probar
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
