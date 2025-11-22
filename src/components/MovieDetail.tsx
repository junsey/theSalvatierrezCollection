import React from 'react';
import { MovieRecord } from '../types/MovieRecord';

interface Props {
  movie: MovieRecord;
  onClose: () => void;
  onSeenChange: (seen: boolean) => void;
  onRatingChange: (rating: number) => void;
  onNoteChange: (note: string) => void;
  personalRating?: number;
  personalNote?: string;
}

const StarRating: React.FC<{ value: number; onChange: (val: number) => void }> = ({ value, onChange }) => {
  const stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div className="rating-stars">
      {stars.map((star) => (
        <button key={star} onClick={() => onChange(star)} aria-label={`Rate ${star}`}>
          {star <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
};

export const MovieDetail: React.FC<Props> = ({ movie, onClose, onSeenChange, onRatingChange, onNoteChange, personalRating, personalNote }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 260px' }}>
            <img
              className="poster"
              src={movie.posterUrl ?? 'https://via.placeholder.com/300x450/0b0f17/ffffff?text=No+Poster'}
              alt={movie.title}
            />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2>{movie.title}</h2>
            <p>
              {movie.originalTitle && (
                <span style={{ display: 'block', color: 'var(--text-muted)' }}>
                  Título original: {movie.originalTitle}
                </span>
              )}
              {movie.tmdbOriginalTitle && movie.tmdbOriginalTitle !== movie.originalTitle && (
                <em style={{ color: 'var(--text-muted)' }}>TMDb: {movie.tmdbOriginalTitle}</em>
              )}{' '}
              <br />
              <strong>{movie.tmdbYear ?? movie.year ?? 'Year ?'}</strong> • {movie.seccion}
            </p>
            <p>
              <strong>Género:</strong> {movie.genreRaw}
              {movie.tmdbGenres && movie.tmdbGenres.length > 0 && (
                <>
                  {' '}
                  <small>(TMDb: {movie.tmdbGenres.join(', ')})</small>
                </>
              )}
            </p>
            {movie.saga && <p><strong>Saga:</strong> {movie.saga}</p>}
            <p><strong>Director:</strong> {movie.director}</p>
            {movie.group && <p><strong>Group:</strong> {movie.group}</p>}
            <p><strong>Doblaje / Formato:</strong> {movie.dubbing} / {movie.format}</p>
            <p><strong>Plot:</strong> {movie.plot ?? 'No plot available.'}</p>
            <p>
              <strong>TMDb rating:</strong> {movie.tmdbRating?.toFixed(1) ?? 'N/A'}
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={movie.seen} onChange={(e) => onSeenChange(e.target.checked)} /> Vista
              </label>
              <div>
                <small>Mi puntuación (columna Puntuacion)</small>
                <StarRating value={personalRating ?? 0} onChange={onRatingChange} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <small>Personal notes</small>
              <textarea
                rows={4}
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Write your whispers from the catacombs..."
                value={personalNote ?? ''}
                onChange={(e) => onNoteChange(e.target.value)}
              />
            </div>
            <button style={{ marginTop: 12 }} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
