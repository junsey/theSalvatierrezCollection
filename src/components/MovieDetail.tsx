import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { splitDirectors } from '../services/directors';
import { MovieRecord } from '../types/MovieRecord';
import { PawRating } from './PawRating';

interface Props {
  movie: MovieRecord;
  onClose: () => void;
}
export const MovieDetail: React.FC<Props> = ({ movie, onClose }) => {
  const directors = useMemo(() => {
    const names = splitDirectors(movie.director ?? '');
    const tmdbIds = (movie.directorTmdbIds ?? [])
      .filter((id) => Number.isFinite(id))
      .map((id) => Number(id));

    if (tmdbIds.length === 0 && movie.directorTmdbId != null && Number.isFinite(movie.directorTmdbId)) {
      tmdbIds.push(Number(movie.directorTmdbId));
    }

    return names.map((name, index) => ({ name, tmdbId: tmdbIds[index] ?? tmdbIds[0] ?? null }));
  }, [movie.director, movie.directorTmdbId, movie.directorTmdbIds]);

  const funcionaLabel = (() => {
    switch (movie.funcionaStatus) {
      case 'working':
        return 'Funciona correctamente';
      case 'damaged':
        return 'Dañada';
      default:
        return 'Sin probar';
    }
  })();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="panel modal movie-detail"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalles de ${movie.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="movie-detail__body">
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
                <div className="movie-detail__title-row">
                  <h2>{movie.title}</h2>
                  {movie.seen && (
                    <span className="movie-detail__seen-flag" title="Vista">
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9Zm-1.05 13.44-3.4-3.39 1.41-1.42 1.99 1.99 4.69-4.69 1.41 1.42-6.1 6.09Z"
                          fill="currentColor"
                        />
                      </svg>
                      <span>Vista</span>
                    </span>
                  )}
                  {movie.enDeposito && (
                    <span className="movie-detail__seen-flag" title="En depósito">
                      <span>En depósito</span>
                    </span>
                  )}
                </div>
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
                {directors.length === 0 && <p className="muted">No hay directores registrados.</p>}
                <ul className="director-link-list">
                  {directors.map((director) => (
                    <li key={director.name}>
                      <Link
                        to={
                          director.tmdbId
                            ? `/directors/${director.tmdbId}`
                            : `/directors/${encodeURIComponent(director.name)}`
                        }
                      >
                        {director.name}
                      </Link>
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
                <strong>Estado físico:</strong> {funcionaLabel}
              </p>
              <p>
                <strong>Plot:</strong> {movie.plot ?? 'No plot available.'}
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
                  <div className="movie-detail__rating-compare">
                    <div className="movie-detail__rating-chip">
                      <span className="muted">IMDb / TMDb</span>
                      <strong>{movie.tmdbRating?.toFixed(1) ?? 'N/A'}</strong>
                    </div>
                    {movie.ratingGloria != null && movie.ratingRodrigo != null && (
                      <div className="movie-detail__rating-chip">
                        <span className="muted">Promedio paws</span>
                        <strong>{((movie.ratingGloria + movie.ratingRodrigo) / 2).toFixed(1)}</strong>
                      </div>
                    )}
                  </div>
                  {(movie.ratingGloria != null || movie.ratingRodrigo != null) && (
                    <div className="movie-detail__rating-list">
                      {movie.ratingGloria != null && (
                        <div className="movie-detail__rating-row">
                          <strong>Gloria:</strong>
                          <PawRating value={movie.ratingGloria} />
                        </div>
                      )}
                      {movie.ratingRodrigo != null && (
                        <div className="movie-detail__rating-row">
                          <strong>Rodrigo:</strong>
                          <PawRating value={movie.ratingRodrigo} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
            </div>
          </div>
          <button className="movie-detail__close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
