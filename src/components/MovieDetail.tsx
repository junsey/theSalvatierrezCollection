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
      <div className="panel modal movie-detail" onClick={(e) => e.stopPropagation()}>
        <div className="movie-detail__layout">
          <div className="movie-detail__poster">
            <img
              className="poster"
              src={movie.posterUrl ?? 'https://via.placeholder.com/300x450/0b0f17/ffffff?text=No+Poster'}
              alt={movie.title}
            />
          </div>
          <div className="movie-detail__content">
            <div className="movie-detail__header">
              <h2>{movie.title}</h2>
              <p className="movie-detail__meta">
                {movie.originalTitle && (
                  <span className="muted">Título original: {movie.originalTitle}</span>
                )}
                {movie.tmdbOriginalTitle && movie.tmdbOriginalTitle !== movie.originalTitle && (
                  <em className="muted">TMDb: {movie.tmdbOriginalTitle}</em>
                )}
                <span className="movie-detail__year">
                  <strong>{movie.tmdbYear ?? movie.year ?? 'Year ?'}</strong> • {movie.seccion}
                </span>
              </p>
            </div>
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
            {movie.group && (
              <p>
                <strong>Group:</strong> {movie.group}
              </p>
            )}
            <p>
              <strong>Doblaje / Formato:</strong> {movie.dubbing} / {movie.format}
            </p>
            <p>
              <strong>Plot:</strong> {movie.plot ?? 'No plot available.'}
            </p>
            <p>
              <strong>TMDb rating:</strong> {movie.tmdbRating?.toFixed(1) ?? 'N/A'}
            </p>
            {movie.tmdbType === 'tv' && (
              <div className="director-section">
                <div className="director-section__heading">
                  <strong>Temporadas</strong>
                  {movie.season != null && (
                    <small className="muted"> Temporada solicitada: {movie.season}</small>
                  )}
                </div>
                {movie.tmdbSeasons && movie.tmdbSeasons.length > 0 ? (
                  <ul className="director-link-list">
                    {movie.tmdbSeasons.map((season) => (
                      <li key={season.seasonNumber}>
                        <span>
                          T{season.seasonNumber}{' '}
                          {season.name && <em style={{ color: 'var(--text-muted)' }}>({season.name})</em>}
                          {movie.season === season.seasonNumber && <strong> — Seleccionada</strong>}
                        </span>
                        <div className="muted" style={{ fontSize: '0.9em' }}>
                          Episodios: {season.episodeCount ?? '¿?'}{' '}
                          {season.airDate && <span>• Estreno: {season.airDate}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Sin temporadas registradas.</p>
                )}
              </div>
            )}
            <div className="movie-detail__ratings">
              <h3>Puntuaciones</h3>
              <div className="movie-detail__ratings-grid">
                {(movie.ratingGloria != null || movie.ratingRodrigo != null) && (
                  <>
                    {movie.ratingGloria != null && (
                      <div>
                        <div className="movie-detail__rating-row">
                          <strong>Gloria:</strong>
                          <PawRating value={movie.ratingGloria} />
                        </div>
                      </div>
                    )}
                    {movie.ratingRodrigo != null && (
                      <div>
                        <div className="movie-detail__rating-row">
                          <strong>Rodrigo:</strong>
                          <PawRating value={movie.ratingRodrigo} />
                        </div>
                      </div>
                    )}
                    {movie.ratingGloria != null && movie.ratingRodrigo != null && (
                      <div className="movie-detail__rating-average">
                        <div className="movie-detail__rating-row">
                          <strong>Promedio:</strong>
                          <PawRating value={(movie.ratingGloria + movie.ratingRodrigo) / 2} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="movie-detail__toggles">
              <label className="movie-detail__seen">
                <input type="checkbox" checked={movie.seen} onChange={(e) => onSeenChange(e.target.checked)} /> Vista
              </label>
              <div>
                <small>Mi puntuación (columna Puntuacion)</small>
                <StarRating value={personalRating ?? 0} onChange={onRatingChange} />
              </div>
            </div>
            <div className="movie-detail__notes">
              <small>Personal notes</small>
              <textarea
                rows={4}
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
            <button className="movie-detail__close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
