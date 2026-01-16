import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { fixMovieTmdb, resolveMovieTmdb } from '../services/adminApi';
import { MovieRecord } from '../types/MovieRecord';
import { getDirectorFromMovie } from '../services/tmdbPeopleService';
import { fetchTvSeasons } from '../services/tmdbApi';

interface Props {
  movie: MovieRecord;
  onClose: () => void;
}

type TabId = 'summary' | 'details' | 'admin';

type TabItem = {
  id: TabId;
  label: string;
  content: React.ReactNode;
};

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Tabs: React.FC<{
  tabs: TabItem[];
  activeId: TabId;
  onChange: (id: TabId) => void;
}> = ({ tabs, activeId, onChange }) => {
  return (
    <div className="detail-tabs">
      <div className="detail-tabs__list" role="tablist" aria-label="Secciones de detalles">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeId === tab.id}
            aria-controls={`tab-panel-${tab.id}`}
            className={`detail-tabs__tab ${activeId === tab.id ? 'is-active' : ''}`}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`tab-panel-${tab.id}`}
          role="tabpanel"
          hidden={activeId !== tab.id}
          className="detail-tabs__panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};

const TopBar: React.FC<{
  title: string;
  showTitle: boolean;
  onClose: () => void;
  tmdbUrl: string | null;
  onToggleSeen: () => void;
  seen: boolean;
  showWatchedToggle: boolean;
  closeButtonRef: React.RefObject<HTMLButtonElement>;
}> = ({ title, showTitle, onClose, tmdbUrl, onToggleSeen, seen, showWatchedToggle, closeButtonRef }) => {
  return (
    <div className="detail-sheet__topbar">
      <div className="detail-sheet__topbar-left">
        <button
          ref={closeButtonRef}
          className="detail-sheet__icon-button"
          onClick={onClose}
          type="button"
          aria-label="Cerrar detalles"
        >
          ✕
        </button>
        <span className="detail-sheet__hint">Esc</span>
      </div>
      <div className={`detail-sheet__topbar-title ${showTitle ? 'is-visible' : ''}`} aria-hidden={!showTitle}>
        {title}
      </div>
      <div className="detail-sheet__topbar-actions">
        {showWatchedToggle && (
          <button className="ghost" onClick={onToggleSeen} type="button">
            {seen ? 'Quitar vista' : 'Mark as Watched'}
          </button>
        )}
        {tmdbUrl && (
          <a className="ghost" href={tmdbUrl} target="_blank" rel="noreferrer">
            Open TMDb
          </a>
        )}
      </div>
    </div>
  );
};

const Hero: React.FC<{
  movie: MovieRecord;
  directors: string[];
  loadingDirectors: boolean;
  fallbackDirectors: string[];
  funcionaLabel: string;
}> = ({
  movie,
  directors,
  loadingDirectors,
  fallbackDirectors,
  funcionaLabel
}) => {
  const genres = useMemo(() => {
    const base = movie.tmdbGenres?.length ? movie.tmdbGenres : movie.genreRaw?.split(/[,/;|]+/g) ?? [];
    return base.map((item) => item.trim()).filter(Boolean);
  }, [movie.genreRaw, movie.tmdbGenres]);

  const directorList = directors.length > 0 ? directors : fallbackDirectors;
  const heroBackdrop = movie.posterUrl;

  return (
    <section className="detail-sheet__hero" aria-label="Resumen de película">
      <div
        className="detail-sheet__hero-backdrop"
        style={heroBackdrop ? { backgroundImage: `url(${heroBackdrop})` } : undefined}
      />
      <div className="detail-sheet__hero-content">
        <div className="detail-sheet__poster">
          <img
            src={movie.posterUrl ?? 'https://via.placeholder.com/300x450/0b0f17/ffffff?text=No+Poster'}
            alt={movie.title}
          />
        </div>
        <div className="detail-sheet__hero-text">
          <div className="detail-sheet__eyebrow">
            <span>{movie.tmdbYear ?? movie.year ?? 'Year ?'}</span>
            <span>•</span>
            <span>{movie.seccion}</span>
          </div>
          <h2 className="detail-sheet__title">{movie.title}</h2>
          {(movie.originalTitle || movie.tmdbOriginalTitle) && (
            <p className="detail-sheet__subtitle">
              {movie.originalTitle && <span>Título original: {movie.originalTitle}</span>}
              {movie.tmdbOriginalTitle && movie.tmdbOriginalTitle !== movie.originalTitle && (
                <em>TMDb: {movie.tmdbOriginalTitle}</em>
              )}
            </p>
          )}
          <div className="detail-sheet__chips">
            {movie.seen && <span className="detail-sheet__chip detail-sheet__chip--accent">Vista</span>}
            {movie.enDeposito && <span className="detail-sheet__chip">En depósito</span>}
            <span className="detail-sheet__chip">{funcionaLabel}</span>
            {movie.saga && (
              <span className="detail-sheet__chip detail-sheet__chip--saga">
                Saga: <Link to={`/movies?saga=${encodeURIComponent(movie.saga)}`}>{movie.saga}</Link>
              </span>
            )}
            {genres.map((genre) => (
              <span key={genre} className="detail-sheet__chip">
                {genre}
              </span>
            ))}
          </div>
          <div className="detail-sheet__meta">
            <div>
              <strong>Director(es)</strong>
              {movie.director && <small className="muted">Dato base: {movie.director}</small>}
            </div>
            {movie.tmdbId && loadingDirectors && <p className="muted">Invocando créditos de TMDb...</p>}
            {!loadingDirectors && directorList.length === 0 && (
              <p className="muted">No hay directores registrados.</p>
            )}
            {directorList.length > 0 && (
              <ul className="detail-sheet__link-list">
                {directorList.map((director) => (
                  <li key={director}>
                    <Link to={`/directors/${encodeURIComponent(director)}`}>{director}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const RatingsCard: React.FC<{ movie: MovieRecord }> = ({ movie }) => {
  const avgRating =
    movie.ratingGloria != null && movie.ratingRodrigo != null
      ? (movie.ratingGloria + movie.ratingRodrigo) / 2
      : null;

  const userRatings = [
    { name: 'Gloria', value: movie.ratingGloria },
    { name: 'Rodrigo', value: movie.ratingRodrigo }
  ];

  const paws = Array.from({ length: 10 }, (_, i) => i + 1);

  const PawGlyph: React.FC<{ filled: boolean }> = ({ filled }) => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{
        color: filled ? 'var(--accent-2)' : 'var(--text-muted)',
        opacity: filled ? 1 : 0.35
      }}
    >
      <path
        d="M12 14c-2.9 0-5 1.9-5 4.2 0 1.2.8 2.3 2 2.3 1.4 0 2.2-.7 2.8-1.5.2-.3.6-.3.8 0 .6.8 1.4 1.5 2.8 1.5 1.2 0 2-.9 2-2.2C17.5 15.9 14.9 14 12 14Z"
        fill="currentColor"
      />
      <circle cx="6.5" cy="9" r="2.2" fill="currentColor" />
      <circle cx="10.5" cy="6.5" r="2.2" fill="currentColor" />
      <circle cx="14.5" cy="6.5" r="2.2" fill="currentColor" />
      <circle cx="18.5" cy="9" r="2.2" fill="currentColor" />
    </svg>
  );

  const renderScore = (value: number | null | undefined) => (value != null ? value.toFixed(1) : '—');

  return (
    <div className="detail-sheet__card">
      <div className="detail-sheet__card-header">
        <h3>Puntuaciones</h3>
      </div>
      <div className="detail-sheet__rating-summary">
        <div className="detail-sheet__rating-mini">
          <span className="detail-sheet__rating-label">IMDb</span>
          <strong className="detail-sheet__rating-value">{movie.tmdbRating?.toFixed(1) ?? '—'}</strong>
        </div>
        <div className="detail-sheet__rating-mini">
          <span className="detail-sheet__rating-label">Paws</span>
          <strong className="detail-sheet__rating-value">{avgRating != null ? avgRating.toFixed(1) : '—'}</strong>
        </div>
      </div>
      <div className="detail-sheet__rating-scale">Escala 0–10</div>
      <div className="detail-sheet__rating-users">
        {userRatings.map((user) => {
          const filledCount = user.value != null ? Math.round(user.value) : 0;
          return (
            <div key={user.name} className="detail-sheet__rating-user">
              <div className="detail-sheet__rating-user-header">
                <span className="detail-sheet__rating-name">{user.name}</span>
                <span className="detail-sheet__rating-score">{renderScore(user.value)}</span>
              </div>
              <div className="detail-sheet__rating-bar" aria-hidden="true">
                <div className="detail-sheet__rating-paws">
                  {paws.map((paw) => (
                    <PawGlyph key={paw} filled={paw <= filledCount} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminPanel: React.FC<{
  adminBusy: boolean;
  adminMessage: string | null;
  adminSeason: string;
  adminTmdbId: string;
  adminTmdbType: 'movie' | 'tv';
  handleAdminTmdbInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFixTmdb: () => void;
  handleResolveTmdb: () => void;
  movie: MovieRecord;
  setAdminSeason: (value: string) => void;
  setAdminTmdbType: (value: 'movie' | 'tv') => void;
}> = ({
  adminBusy,
  adminMessage,
  adminSeason,
  adminTmdbId,
  adminTmdbType,
  handleAdminTmdbInputChange,
  handleFixTmdb,
  handleResolveTmdb,
  movie,
  setAdminSeason,
  setAdminTmdbType
}) => {
  return (
    <div className="detail-sheet__admin">
      <div className="detail-sheet__admin-toolbox">
        <div className="detail-sheet__admin-label">TMDb</div>
        <div className="detail-sheet__admin-grid">
          <button className="secondary" onClick={handleResolveTmdb} disabled={adminBusy} type="button">
            {adminBusy ? 'Buscando...' : 'Buscar en TMDb'}
          </button>
          <label className="detail-sheet__field">
            <span>Tipo</span>
            <select
              value={adminTmdbType}
              onChange={(event) => setAdminTmdbType(event.target.value as 'movie' | 'tv')}
            >
              <option value="movie">Película</option>
              <option value="tv">Serie</option>
            </select>
          </label>
          {adminTmdbType === 'tv' && (
            <label className="detail-sheet__field">
              <span>Temporada</span>
              <input
                type="number"
                min={1}
                value={adminSeason}
                onChange={(event) => setAdminSeason(event.target.value)}
              />
            </label>
          )}
          <label className="detail-sheet__field detail-sheet__field--full">
            <span>ID o link de TMDb</span>
            <input type="text" value={adminTmdbId} onChange={handleAdminTmdbInputChange} />
          </label>
          <button className="detail-sheet__admin-danger" onClick={handleFixTmdb} disabled={adminBusy} type="button">
            {adminBusy ? 'Actualizando...' : 'Corregir TMDb'}
          </button>
        </div>
        {adminMessage && <p className="muted detail-sheet__admin-message">{adminMessage}</p>}
      </div>
      <hr className="detail-sheet__admin-separator" />
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
  );
};

export const MovieDetailSheet: React.FC<Props> = ({ movie, onClose }) => {
  const { adminSession, refreshSupabase, tmdbEnrichmentEnabled, updateSeen } = useMovies();
  const [directors, setDirectors] = useState<string[]>([]);
  const [loadingDirectors, setLoadingDirectors] = useState(false);
  const [adminTmdbId, setAdminTmdbId] = useState('');
  const [adminTmdbType, setAdminTmdbType] = useState<'movie' | 'tv'>(
    movie.tmdbType === 'tv' || movie.series ? 'tv' : 'movie'
  );
  const [adminSeason, setAdminSeason] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [seasonOverrides, setSeasonOverrides] = useState<MovieRecord['tmdbSeasons'] | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [showCompactTitle, setShowCompactTitle] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

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

  const tmdbUrl = movie.tmdbId
    ? `https://www.themoviedb.org/${movie.tmdbType === 'tv' || movie.series ? 'tv' : 'movie'}/${movie.tmdbId}`
    : null;

  useEffect(() => {
    setAdminMessage(null);
    setAdminTmdbId('');
    setAdminTmdbType(movie.tmdbType === 'tv' || movie.series ? 'tv' : 'movie');
    setAdminBusy(false);
    setAdminSeason(movie.season != null ? String(movie.season) : '');
    setSeasonOverrides(null);
    setActiveTab('summary');
    setPlotExpanded(false);
    setShowCompactTitle(false);
  }, [movie.id]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      if (!dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
    const seasonValue = adminSeason.trim();
    const season = seasonValue ? Number(seasonValue) : null;
    if (adminTmdbType === 'tv' && seasonValue && !Number.isFinite(season)) {
      setAdminMessage('La temporada debe ser numérica.');
      return;
    }
    setAdminBusy(true);
    setAdminMessage(null);
    try {
      await fixMovieTmdb({
        collectionId: movie.id,
        tmdbId: parsed.id,
        mediaType: parsed.mediaType,
        season: parsed.mediaType === 'tv' ? season : null
      });
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

  const requestClose = () => {
    if (closeTimeoutRef.current != null) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
    }, 260);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleScroll = () => {
    const top = overlayRef.current?.scrollTop ?? 0;
    setShowCompactTitle(top > 140);
  };

  const handleToggleSeen = () => {
    updateSeen(movie.id, !movie.seen);
  };

  const dubbingValue = movie.dubbing as unknown;
  const dubbingLabel =
    typeof dubbingValue === 'boolean'
      ? dubbingValue
        ? 'Sí'
        : 'No'
      : movie.dubbing
      ? movie.dubbing
      : 'No especificado';

  const summaryContent = (
    <div className="detail-sheet__content-grid">
      <div className="detail-sheet__main">
        <div className="detail-sheet__section">
          <h3>Sinopsis</h3>
          <p className={`detail-sheet__plot ${plotExpanded ? 'is-expanded' : ''}`}>
            {movie.plot ?? 'No plot available.'}
          </p>
          {movie.plot && movie.plot.length > 180 && (
            <button className="ghost" onClick={() => setPlotExpanded((prev) => !prev)} type="button">
              {plotExpanded ? 'Ver menos' : 'Ver más'}
            </button>
          )}
        </div>
        <div className="detail-sheet__section">
          <h3>Detalles principales</h3>
          <div className="detail-sheet__info-grid">
            <div>
              <strong>Doblaje / Formato</strong>
              <p>{dubbingLabel} / {movie.format}</p>
            </div>
            <div>
              <strong>Estado físico</strong>
              <p>{funcionaLabel}</p>
            </div>
            {movie.group && (
              <div>
                <strong>Group</strong>
                <p>{movie.group}</p>
              </div>
            )}
            {movie.saga && (
              <div>
                <strong>Saga</strong>
                <p>
                  <Link to={`/movies?saga=${encodeURIComponent(movie.saga)}`}>{movie.saga}</Link>
                </p>
              </div>
            )}
          </div>
        </div>
        {movie.tmdbType === 'tv' && (
          <div className="detail-sheet__section">
            <div className="director-section__heading">
              <strong>Temporadas</strong>
              {movie.season != null && <small className="muted"> Temporada solicitada: {movie.season}</small>}
            </div>
            {displaySeasons && displaySeasons.length > 0 ? (
              <ul className="detail-sheet__season-list">
                {displaySeasons.map((season) => (
                  <li key={season.seasonNumber}>
                    <div>
                      T{season.seasonNumber}{' '}
                      {season.name && <em className="muted">({season.name})</em>}
                      {movie.season === season.seasonNumber && <strong> — Seleccionada</strong>}
                    </div>
                    <div className="muted">
                      Episodios: {season.episodeCount ?? 'A??'}{' '}
                      {season.airDate && <span>• Estreno: {season.airDate}</span>}
                    </div>
                    {season.posterUrl && (
                      <div className="detail-sheet__season-poster">
                        <img
                          src={season.posterUrl}
                          alt={season.name ?? `Temporada ${season.seasonNumber}`}
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
      </div>
      <aside className="detail-sheet__sidebar">
        <RatingsCard movie={movie} />
      </aside>
    </div>
  );

  const detailsContent = (
    <div className="detail-sheet__content-grid">
      <div className="detail-sheet__main">
        <div className="detail-sheet__section">
          <h3>Ficha</h3>
          <div className="detail-sheet__info-grid">
            <div>
              <strong>Año</strong>
              <p>{movie.tmdbYear ?? movie.year ?? 'Year ?'}</p>
            </div>
            <div>
              <strong>Sección</strong>
              <p>{movie.seccion}</p>
            </div>
            <div>
              <strong>Género</strong>
              <p>{movie.genreRaw}</p>
              {movie.tmdbGenres && movie.tmdbGenres.length > 0 && (
                <small className="muted">TMDb: {movie.tmdbGenres.join(', ')}</small>
              )}
            </div>
            <div>
              <strong>Tipo</strong>
              <p>{movie.tmdbType === 'tv' || movie.series ? 'Serie' : 'Película'}</p>
            </div>
            {movie.originalTitle && (
              <div>
                <strong>Título original</strong>
                <p>{movie.originalTitle}</p>
              </div>
            )}
            {movie.tmdbOriginalTitle && movie.tmdbOriginalTitle !== movie.originalTitle && (
              <div>
                <strong>TMDb original</strong>
                <p>{movie.tmdbOriginalTitle}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <aside className="detail-sheet__sidebar">
        <div className="detail-sheet__card">
          <div className="detail-sheet__card-header">
            <h3>Notas rápidas</h3>
          </div>
          <p className="muted">Revisa la sección de resumen para sinopsis y puntuaciones.</p>
        </div>
      </aside>
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'summary', label: 'Resumen', content: summaryContent },
    { id: 'details', label: 'Detalles', content: detailsContent }
  ];

  if (adminSession) {
    tabs.push({
      id: 'admin',
      label: 'Admin',
      content: (
        <AdminPanel
          adminBusy={adminBusy}
          adminMessage={adminMessage}
          adminSeason={adminSeason}
          adminTmdbId={adminTmdbId}
          adminTmdbType={adminTmdbType}
          handleAdminTmdbInputChange={handleAdminTmdbInputChange}
          handleFixTmdb={handleFixTmdb}
          handleResolveTmdb={handleResolveTmdb}
          movie={movie}
          setAdminSeason={setAdminSeason}
          setAdminTmdbType={setAdminTmdbType}
        />
      )
    });
  }

  return (
    <div
      className={`detail-sheet__overlay ${isClosing ? 'is-closing' : 'is-open'}`}
      onClick={requestClose}
      onScroll={handleScroll}
      ref={overlayRef}
    >
      <div
        className={`detail-sheet ${isClosing ? 'is-closing' : 'is-open'}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalles de ${movie.title}`}
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
      >
        <div className="detail-sheet__inner">
          <TopBar
            title={movie.title}
            showTitle={showCompactTitle}
            onClose={requestClose}
            tmdbUrl={tmdbUrl}
            onToggleSeen={handleToggleSeen}
            seen={movie.seen}
            showWatchedToggle={Boolean(adminSession)}
            closeButtonRef={closeButtonRef}
          />
          <Hero
            movie={movie}
            directors={directors}
            loadingDirectors={loadingDirectors}
            fallbackDirectors={fallbackDirectors}
            funcionaLabel={funcionaLabel}
          />
          <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
        </div>
      </div>
    </div>
  );
};

export const MovieDetail: React.FC<Props> = (props) => <MovieDetailSheet {...props} />;
