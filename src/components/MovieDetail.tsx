import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MovieRecord } from '../types/MovieRecord';
import { getDirectorFromMovie } from '../services/tmdbPeopleService';
import { PawRating } from './PawRating';

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
  const [directors, setDirectors] = useState<string[]>([]);
  const [loadingDirectors, setLoadingDirectors] = useState(false);

  const fallbackDirectors = movie.director
    ? movie.director
        .split(/[,;/&]/g)
        .map((d) => d.trim())
        .filter(Boolean)
    : [];

  useEffect(() => {
    let active = true;
    async function fetchDirectors() {
      if (!movie.tmdbId) {
        setDirectors([]);
        return;
      }
      setLoadingDirectors(true);
      const found = await getDirectorFromMovie(movie.tmdbId);
      if (!active) return;
      const names = Array.from(new Set(found.map((entry) => entry.name)));
      setDirectors(names);
      setLoadingDirectors(false);
    }
    fetchDirectors();
    return () => {
      active = false;
    };
  }, [movie.tmdbId]);

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
            {movie.saga && (
              <p>
                <strong>Saga:</strong>{' '}
                <Link to={`/movies?saga=${encodeURIComponent(movie.saga)}`}>{movie.saga}</Link>
              </p>
            )}
            <div className="director-section">
              <div className="director-section__heading">
                <strong>Director(es)</strong>
                {movie.director && <small className="muted">Dato base: {movie.director}</small>}
              </div>
              {movie.tmdbId && loadingDirectors && <p className="muted">Invocando créditos de TMDb...</p>}
              {!loadingDirectors && directors.length === 0 && fallbackDirectors.length === 0 && (
                <p className="muted">No hay directores registrados.</p>
              )}
              <ul className="director-link-list">
                {(directors.length > 0 ? directors : fallbackDirectors).map((director) => (
                  <li key={director}>
                    <Link to={`/directors/${encodeURIComponent(director)}`}>{director}</Link>
                  </li>
                ))}
              </ul>
            </div>
            {movie.group && <p><strong>Group:</strong> {movie.group}</p>}
            <p><strong>Doblaje / Formato:</strong> {movie.dubbing} / {movie.format}</p>
            <p><strong>Plot:</strong> {movie.plot ?? 'No plot available.'}</p>
            <p>
              <strong>TMDb rating:</strong> {movie.tmdbRating?.toFixed(1) ?? 'N/A'}
            </p>
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12, fontSize: '1.1em' }}>Puntuaciones</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(movie.ratingGloria != null || movie.ratingRodrigo != null) && (
                  <>
                    {movie.ratingGloria != null && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <strong>Gloria:</strong>
                          <PawRating value={movie.ratingGloria} />
                        </div>
                      </div>
                    )}
                    {movie.ratingRodrigo != null && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <strong>Rodrigo:</strong>
                          <PawRating value={movie.ratingRodrigo} />
                        </div>
                      </div>
                    )}
                    {movie.ratingGloria != null && movie.ratingRodrigo != null && (
                      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong>Promedio:</strong>
                          <PawRating value={(movie.ratingGloria + movie.ratingRodrigo) / 2} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
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
            <details className="status-accordion">
              <summary>Status</summary>
              <div className="status-accordion__body">
                {movie.tmdbStatus ? (
                  <ul>
                    <li>
                      <strong>Estado:</strong>{' '}
                      {(() => {
                        const map: Record<string, string> = {
                          network: 'Respuesta en línea',
                          cache: 'Desde caché vigente',
                          'stale-cache': 'Caché expirada',
                          'not-found': 'Sin coincidencias',
                          error: 'Error en TMDb',
                          none: 'Sin consulta'
                        };
                        return map[movie.tmdbStatus?.source] ?? 'Desconocido';
                      })()}{' '}
                      {movie.tmdbStatus.message && <span>({movie.tmdbStatus.message})</span>}
                    </li>
                    <li>
                      <strong>Títulos consultados:</strong> {movie.tmdbStatus.requestedTitles.join(' · ') || '—'}
                    </li>
                    <li>
                      <strong>Año enviado:</strong> {movie.tmdbStatus.requestedYear ?? '—'}
                    </li>
                    <li>
                      <strong>Coincidencia TMDb:</strong>{' '}
                      {movie.tmdbStatus.matchedId ? (
                        <>
                          #{movie.tmdbStatus.matchedId} — {movie.tmdbStatus.matchedTitle}
                          {movie.tmdbStatus.matchedOriginalTitle && (
                            <span className="muted"> (Original: {movie.tmdbStatus.matchedOriginalTitle})</span>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </li>
                    {movie.tmdbStatus.fetchedAt && (
                      <li>
                        <strong>Última consulta:</strong>{' '}
                        {new Date(movie.tmdbStatus.fetchedAt).toLocaleString('es-ES')}
                      </li>
                    )}
                    {movie.tmdbStatus.error && (
                      <li className="status-accordion__error">
                        <strong>Error:</strong> {movie.tmdbStatus.error}
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="muted">Sin estado TMDb registrado.</p>
                )}
              </div>
            </details>
            <button style={{ marginTop: 12 }} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
