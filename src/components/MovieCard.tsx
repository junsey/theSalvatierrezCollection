import React from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';

type MovieCardAction = {
  label: string;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
};

interface Props {
  movie: MovieRecord;
  onClick?: () => void;
  actions?: MovieCardAction[];
}

export const MovieCard: React.FC<Props> = ({ movie, onClick, actions }) => {
  const pawValue =
    movie.ratingGloria != null && movie.ratingRodrigo != null
      ? (movie.ratingGloria + movie.ratingRodrigo) / 2
      : movie.ratingGloria ?? movie.ratingRodrigo ?? null;
  const seasonPoster = movie.season != null
    ? movie.tmdbSeasons?.find((season) => season.seasonNumber === movie.season)?.posterUrl
    : undefined;
  const posterUrl = seasonPoster ?? movie.posterUrl;
  const displayTitle = movie.groupedDisplayTitle ?? movie.title;
  const groupedSeasons = movie.groupedSeasons ?? [];

  return (
    <div
      className={`movie-card${actions?.length ? ' movie-card--curator' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="poster-frame">
        <img
          className="poster"
          src={posterUrl ?? 'https://via.placeholder.com/300x450/0b0f17/ffffff?text=No+Poster'}
          alt={displayTitle}
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
        <strong>{displayTitle}</strong>
        <small>{movie.tmdbYear ?? movie.year ?? 'Year ?'} - {movie.seccion}</small>
        {groupedSeasons.length > 0 && (
          <div className="card-seasons">
            {groupedSeasons.map((season) => (
              <span
                key={season.seasonNumber}
                className="badge"
                style={{
                  background: season.owned ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  color: season.owned ? 'inherit' : 'var(--text-muted)'
                }}
              >
                T{season.seasonNumber}
              </span>
            ))}
          </div>
        )}
        <div className="card-ratings">
          <span className="badge">TMDb: {movie.tmdbRating?.toFixed(1) ?? 'N/A'}</span>
          <span className="badge">Paws: {pawValue != null ? pawValue.toFixed(1) : 'N/A'}</span>
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
      {actions?.length ? (
        <div className="movie-card__actions">
          {actions.map((action) => {
            if (action.to) {
              return (
                <Link
                  key={action.label}
                  to={action.to}
                  className={`movie-card__action${action.disabled ? ' is-disabled' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (action.disabled) {
                      event.preventDefault();
                      return;
                    }
                    action.onClick?.();
                  }}
                >
                  {action.label}
                </Link>
              );
            }

            return (
              <button
                key={action.label}
                type="button"
                className={`movie-card__action${action.disabled ? ' is-disabled' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick?.();
                }}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
