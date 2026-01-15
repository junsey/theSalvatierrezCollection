import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { fixMovieTmdb, resolveMovieTmdb } from '../services/adminApi';
import { MovieRecord } from '../types/MovieRecord';
import { getDirectorFromMovie } from '../services/tmdbPeopleService';
import { fetchTvSeasons } from '../services/tmdbApi';
import { PawRating } from './PawRating';

interface Props {
  movie: MovieRecord;
  onClose: () => void;
}
export const MovieDetail: React.FC<Props> = ({ movie, onClose }) => {
  const { adminSession, refreshSupabase, tmdbEnrichmentEnabled } = useMovies();
  const [directors, setDirectors] = useState<string[]>([]);
  const [loadingDirectors, setLoadingDirectors] = useState(false);
  const [adminTmdbId, setAdminTmdbId] = useState('');
  const [adminTmdbType, setAdminTmdbType] = useState<'movie' | 'tv'>(
    movie.tmdbType === 'tv' || movie.series ? 'tv' : 'movie'
  );
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [seasonOverrides, setSeasonOverrides] = useState<MovieRecord['tmdbSeasons'] | null>(null);

  const fallbackDirectors = movie.director
    ? movie.director
        .split(/[,;/&]/g)
        .map((d) => d.trim())
        .filter(Boolean)
    : [];

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

  useEffect(() => {
    setAdminMessage(null);
    setAdminTmdbId('');
    setAdminTmdbType(movie.tmdbType === 'tv' || movie.series ? 'tv' : 'movie');
    setAdminBusy(false);
    setSeasonOverrides(null);
  }, [movie.id]);

  useEffect(() => {
    let active = true;
    async function fetchDirectors() {
      if (!movie.tmdbId || !tmdbEnrichmentEnabled) {
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
  }, [movie.tmdbId, tmdbEnrichmentEnabled]);

  useEffect(() => {
    let active = true;
    async function fetchSeasons() {
      if (!tmdbEnrichmentEnabled || movie.tmdbType !== 'tv' || !movie.tmdbId) {
        setSeasonOverrides(null);
        return;
      }
      const hasPoster = movie.tmdbSeasons?.some((season) => season.posterUrl || season.posterPath);
      if (hasPoster) {
        setSeasonOverrides(null);
        return;
      }
      try {
        const seasons = await fetchTvSeasons(movie.tmdbId);
        if (active) {
          setSeasonOverrides(seasons);
        }
      } catch (error) {
        console.warn('No se pudieron cargar las temporadas', error);
      }
    }
    fetchSeasons();
    return () => {
      active = false;
    };
  }, [movie.tmdbId, movie.tmdbType, movie.tmdbSeasons, tmdbEnrichmentEnabled]);

  const parseTmdbInput = (value: string, fallbackType: 'movie' | 'tv') => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const urlMatch = trimmed.match(/(?:themoviedb\.org\/)?(movie|tv)\/(\d+)/i);
    if (urlMatch) {
      return {
        id: Number(urlMatch[2]),
        mediaType: urlMatch[1].toLowerCase() as 'movie' | 'tv'
      };
    }
    if (/^\d+$/.test(trimmed)) {
      return { id: Number(trimmed), mediaType: fallbackType };
    }
    return null;
  };

  const handleAdminTmdbInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setAdminTmdbId(nextValue);
    const urlMatch = nextValue.match(/(?:themoviedb\.org\/)?(movie|tv)\/\d+/i);
    if (urlMatch) {
      setAdminTmdbType(urlMatch[1].toLowerCase() as 'movie' | 'tv');
    }
  };

  const handleResolveTmdb = async () => {
    if (!adminSession) return;
    setAdminBusy(true);
    setAdminMessage(null);
    try {
      await resolveMovieTmdb({ collectionId: movie.id });
      await refreshSupabase();
      setAdminMessage('TMDb actualizado desde búsqueda.');
    } catch (error) {
      console.error(error);
      setAdminMessage('No se pudo resolver TMDb.');
    } finally {
      setAdminBusy(false);
    }
  };

  const handleFixTmdb = async () => {
    if (!adminSession) return;
    const parsed = parseTmdbInput(adminTmdbId, adminTmdbType);
    if (!parsed || !Number.isFinite(parsed.id)) {
      setAdminMessage('El ID TMDb debe ser numérico.');
      return;
    }
    setAdminBusy(true);
    setAdminMessage(null);
    try {
      await fixMovieTmdb({ collectionId: movie.id, tmdbId: parsed.id, mediaType: parsed.mediaType });
      await refreshSupabase();
      setAdminMessage('TMDb corregido.');
      setAdminTmdbId('');
    } catch (error) {
      console.error(error);
      setAdminMessage('No se pudo corregir TMDb.');
    } finally {
      setAdminBusy(false);
    }
  };

  const displaySeasons = useMemo(() => {
    const base = movie.tmdbSeasons ?? [];
    const overrides = seasonOverrides ?? [];
    if (overrides.length === 0) return base;
    const map = new Map(overrides.map((season) => [season.seasonNumber, season]));
    return base.length > 0
      ? base.map((season) => ({ ...season, ...map.get(season.seasonNumber) }))
      : overrides;
  }, [movie.tmdbSeasons, seasonOverrides]);

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
                  {displaySeasons && displaySeasons.length > 0 ? (
                    <ul className="director-link-list">
                      {displaySeasons.map((season) => (
                        <li key={season.seasonNumber}>
                          <span>
                            T{season.seasonNumber}{' '}
                            {season.name && <em style={{ color: 'var(--text-muted)' }}>({season.name})</em>}
                            {movie.season === season.seasonNumber && <strong> ??" Seleccionada</strong>}
                          </span>
                          <div className="muted" style={{ fontSize: '0.9em' }}>
                            Episodios: {season.episodeCount ?? 'A??'}{' '}
                            {season.airDate && <span>??? Estreno: {season.airDate}</span>}
                          </div>
                          {season.posterUrl && (
                            <div style={{ marginTop: 8 }}>
                              <img
                                src={season.posterUrl}
                                alt={season.name ?? `Temporada ${season.seasonNumber}`}
                                style={{ width: 120, borderRadius: 8 }}
                                loading="lazy"
                              />
                            </div>
                          )}
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
              {adminSession && (
                <div className="movie-detail__ratings" style={{ marginTop: 16 }}>
                  <h3>Admin</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <button className="btn" onClick={handleResolveTmdb} disabled={adminBusy}>
                      {adminBusy ? 'Buscando...' : 'Buscar en TMDb'}
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>Tipo</span>
                      <select
                        value={adminTmdbType}
                        onChange={(event) => setAdminTmdbType(event.target.value as 'movie' | 'tv')}
                      >
                        <option value="movie">Película</option>
                        <option value="tv">Serie</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>ID o link de TMDb</span>
                      <input
                        type="text"
                        value={adminTmdbId}
                        onChange={handleAdminTmdbInputChange}
                        style={{ width: 220 }}
                      />
                    </label>
                    <button className="btn" onClick={handleFixTmdb} disabled={adminBusy}>
                      {adminBusy ? 'Actualizando...' : 'Corregir TMDb'}
                    </button>
                  </div>
                  {adminMessage && <p className="muted" style={{ marginTop: 8 }}>{adminMessage}</p>}
                </div>
              )}
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
