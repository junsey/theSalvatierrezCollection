import React from 'react';
import { MovieRecord } from '../types/MovieRecord';
import { PawRating } from './PawRating';

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
        <small>{movie.tmdbYear ?? movie.year ?? 'Year ?'} • {movie.seccion}</small>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge">TMDb: {movie.tmdbRating?.toFixed(1) ?? 'N/A'}</span>
          {personalRating && (
            <span className="badge">Mi puntuación: {personalRating}</span>
          )}
          {(movie.ratingGloria != null || movie.ratingRodrigo != null) && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.85em' }}>
              {movie.ratingGloria != null && movie.ratingRodrigo != null ? (
                <PawRating value={(movie.ratingGloria + movie.ratingRodrigo) / 2} size="small" />
              ) : (
                <>
                  {movie.ratingGloria != null && <PawRating value={movie.ratingGloria} size="small" />}
                  {movie.ratingRodrigo != null && <PawRating value={movie.ratingRodrigo} size="small" />}
                </>
              )}
            </div>
          )}
          <span className="badge" style={{ background: movie.seen ? 'rgba(126, 217, 87, 0.2)' : 'rgba(255, 54, 93, 0.2)' }}>
            {movie.seen ? 'Vista' : 'No vista'}
          </span>
        </div>
      </div>
    </div>
  );
};
