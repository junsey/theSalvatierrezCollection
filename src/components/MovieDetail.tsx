import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { fixMovieTmdb, resolveMovieTmdb, updateMovieStatus } from '../services/adminApi';
import { MovieRecord } from '../types/MovieRecord';
import { getDirectorFromMovie } from '../services/tmdbPeopleService';
import { fetchTvSeasonEpisodes, fetchTvSeasons } from '../services/tmdbApi';

interface Props {
  movie: MovieRecord;
  onClose: () => void;
}

type TabId = 'summary' | 'details' | 'admin' | 'seasons' | 'episodes';

type TabItem = {
  id: TabId;
  label: string;
  content: React.ReactNode;
};

type EpisodeInput = {
  seen: boolean;
  ratingGloria: string;
  ratingRodrigo: string;
  busy?: boolean;
  error?: string;
};

const buildEpisodeKey = (seasonNumber: number, episodeNumber: number) => `${seasonNumber}-${episodeNumber}`;

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
            {seen ? 'Quitar vista' : 'Marcar como vista'}
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
              {movie.director && directorList.length === 0 && (
                <small className="muted">Dato base: {movie.director}</small>
              )}
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

const WatchedForm: React.FC<{
  input: {
    seen: boolean;
    ratingGloria: string;
    ratingRodrigo: string;
    busy?: boolean;
    error?: string;
  };
  onChange: (field: 'seen' | 'ratingGloria' | 'ratingRodrigo', value: string | boolean) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ input, onChange, onSave, onCancel }) => {
  return (
    <div className="detail-sheet__card">
      <div className="detail-sheet__card-header">
        <h3>Marcar como vista</h3>
      </div>
      <div className="ritual-admin__body">
        <label className="ritual-admin__check">
          <input
            type="checkbox"
            checked={input.seen}
            onChange={(event) => onChange('seen', event.target.checked)}
          />
          <span>Vista</span>
        </label>
        <div className="ritual-admin__ratings">
          <label>
            <span>Gloria</span>
            <input
              type="number"
              step="0.5"
              value={input.ratingGloria}
              onChange={(event) => onChange('ratingGloria', event.target.value)}
            />
          </label>
          <label>
            <span>Rodrigo</span>
            <input
              type="number"
              step="0.5"
              value={input.ratingRodrigo}
              onChange={(event) => onChange('ratingRodrigo', event.target.value)}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onSave} disabled={input.busy} type="button">
            {input.busy ? 'Guardando...' : 'Guardar'}
          </button>
          <button className="ghost" onClick={onCancel} type="button" disabled={input.busy}>
            Cancelar
          </button>
        </div>
        {input.error && <p className="ritual-admin__error">{input.error}</p>}
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
  inventoryBusy: boolean;
  inventoryMessage: string | null;
  localDeposito: boolean;
  localFuncionaStatus: MovieRecord['funcionaStatus'];
  handleAdminTmdbInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFixTmdb: () => void;
  handleResolveTmdb: () => void;
  handleToggleDeposito: () => void;
  handleToggleFunciona: () => void;
  movie: MovieRecord;
  onEdit: () => void;
  setAdminSeason: (value: string) => void;
  setAdminTmdbType: (value: 'movie' | 'tv') => void;
}> = ({
  adminBusy,
  adminMessage,
  adminSeason,
  adminTmdbId,
  adminTmdbType,
  inventoryBusy,
  inventoryMessage,
  localDeposito,
  localFuncionaStatus,
  handleAdminTmdbInputChange,
  handleFixTmdb,
  handleResolveTmdb,
  handleToggleDeposito,
  handleToggleFunciona,
  movie,
  onEdit,
  setAdminSeason,
  setAdminTmdbType
}) => {
  return (
    <div className="detail-sheet__admin">
      <div className="detail-sheet__admin-toolbox">
        <div className="detail-sheet__admin-label">Edicion</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onEdit} type="button">
            Editar pelicula
          </button>
        </div>
      </div>
      <hr className="detail-sheet__admin-separator" />
      <div className="detail-sheet__admin-toolbox">
        <div className="detail-sheet__admin-label">Inventario</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleToggleDeposito} disabled={inventoryBusy} type="button">
            {localDeposito ? 'Traer a la coleccion' : 'Mover al deposito'}
          </button>
          <button className="btn" onClick={handleToggleFunciona} disabled={inventoryBusy} type="button">
            {localFuncionaStatus === 'working' ? 'Marcar no funciona' : 'Marcar funciona'}
          </button>
          {inventoryMessage && <span className="muted">{inventoryMessage}</span>}
        </div>
      </div>
      <hr className="detail-sheet__admin-separator" />
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
  const { movies, adminSession, refreshSupabase, tmdbEnrichmentEnabled, applyMovieStatusUpdate } = useMovies();
  const navigate = useNavigate();
  const currentMovie = useMemo(
    () => movies.find((entry) => entry.id === movie.id) ?? movie,
    [movies, movie]
  );
  const [directors, setDirectors] = useState<string[]>([]);
  const [loadingDirectors, setLoadingDirectors] = useState(false);
  const [adminTmdbId, setAdminTmdbId] = useState('');
  const [adminTmdbType, setAdminTmdbType] = useState<'movie' | 'tv'>(
    currentMovie.tmdbType === 'tv' || currentMovie.series ? 'tv' : 'movie'
  );
  const [adminSeason, setAdminSeason] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryMessage, setInventoryMessage] = useState<string | null>(null);
  const [localDeposito, setLocalDeposito] = useState(currentMovie.enDeposito ?? false);
  const [localFuncionaStatus, setLocalFuncionaStatus] = useState(currentMovie.funcionaStatus);
  const [showWatchedForm, setShowWatchedForm] = useState(false);
  const [watchedInput, setWatchedInput] = useState({
    seen: true,
    ratingGloria: currentMovie.ratingGloria != null ? String(currentMovie.ratingGloria) : '',
    ratingRodrigo: currentMovie.ratingRodrigo != null ? String(currentMovie.ratingRodrigo) : '',
    busy: false,
    error: undefined as string | undefined
  });
  const [seasonOverrides, setSeasonOverrides] = useState<MovieRecord['tmdbSeasons'] | null>(null);
  const [episodeSeason, setEpisodeSeason] = useState<number | null>(currentMovie.season ?? null);
  const [episodeRecords, setEpisodeRecords] = useState<MovieRecord['seriesEpisodes']>(currentMovie.seriesEpisodes ?? []);
  const [episodeInputs, setEpisodeInputs] = useState<Record<string, EpisodeInput>>({});
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  const [episodeModal, setEpisodeModal] = useState<{
    seasonNumber: number;
    episodeNumber: number;
  } | null>(null);
  const [episodeModalInput, setEpisodeModalInput] = useState({
    seen: true,
    ratingGloria: '',
    ratingRodrigo: '',
    busy: false,
    error: undefined as string | undefined
  });
  const episodeRecordsRef = useRef<MovieRecord['seriesEpisodes']>(currentMovie.seriesEpisodes ?? []);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [showCompactTitle, setShowCompactTitle] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const fallbackDirectors = currentMovie.director
    ? currentMovie.director
        .split(/[,;/&]/g)
        .map((d) => d.trim())
        .filter(Boolean)
    : [];

  const funcionaLabel = (() => {
    switch (localFuncionaStatus) {
      case 'working':
        return 'Funciona correctamente';
      case 'damaged':
        return 'Dañada';
      default:
        return 'Sin probar';
    }
  })();

  const displayMovie = useMemo(
    () => ({ ...currentMovie, enDeposito: localDeposito, funcionaStatus: localFuncionaStatus }),
    [currentMovie, localDeposito, localFuncionaStatus]
  );

  const tmdbUrl = currentMovie.tmdbId
    ? `https://www.themoviedb.org/${currentMovie.tmdbType === 'tv' || currentMovie.series ? 'tv' : 'movie'}/${currentMovie.tmdbId}`
    : null;

  useEffect(() => {
    setAdminMessage(null);
    setInventoryMessage(null);
    setInventoryBusy(false);
    setLocalDeposito(currentMovie.enDeposito ?? false);
    setLocalFuncionaStatus(currentMovie.funcionaStatus);
    setAdminTmdbId('');
    setAdminTmdbType(currentMovie.tmdbType === 'tv' || currentMovie.series ? 'tv' : 'movie');
    setAdminBusy(false);
    setAdminSeason(currentMovie.season != null ? String(currentMovie.season) : '');
    setSeasonOverrides(null);
    setEpisodeSeason(currentMovie.season ?? null);
    setEpisodeRecords(currentMovie.seriesEpisodes ?? []);
    setEpisodeInputs({});
    setEpisodeLoading(false);
    setEpisodeError(null);
    setEpisodeModal(null);
    setEpisodeModalInput({
      seen: true,
      ratingGloria: '',
      ratingRodrigo: '',
      busy: false,
      error: undefined
    });
    setActiveTab('summary');
    setPlotExpanded(false);
    setShowCompactTitle(false);
    setShowWatchedForm(false);
    setWatchedInput({
      seen: true,
      ratingGloria: currentMovie.ratingGloria != null ? String(currentMovie.ratingGloria) : '',
      ratingRodrigo: currentMovie.ratingRodrigo != null ? String(currentMovie.ratingRodrigo) : '',
      busy: false,
      error: undefined
    });
  }, [movie.id]);

  useEffect(() => {
    episodeRecordsRef.current = episodeRecords;
  }, [episodeRecords]);

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
      if (!currentMovie.tmdbId || !tmdbEnrichmentEnabled) {
        setDirectors([]);
        return;
      }
      setLoadingDirectors(true);
      const found = await getDirectorFromMovie(currentMovie.tmdbId);
      if (!active) return;
      const names = Array.from(new Set(found.map((entry) => entry.name)));
      setDirectors(names);
      setLoadingDirectors(false);
    }
    fetchDirectors();
    return () => {
      active = false;
    };
  }, [currentMovie.tmdbId, tmdbEnrichmentEnabled]);

  useEffect(() => {
    let active = true;
    async function fetchSeasons() {
      const isSeries = currentMovie.tmdbType === 'tv' || currentMovie.series;
      if (!isSeries || !currentMovie.tmdbId) {
        setSeasonOverrides(null);
        return;
      }
      const hasPoster = currentMovie.tmdbSeasons?.some((season) => season.posterUrl || season.posterPath);
      if (hasPoster) {
        setSeasonOverrides(null);
        return;
      }
      try {
        const seasons = await fetchTvSeasons(currentMovie.tmdbId);
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
  }, [currentMovie.tmdbId, currentMovie.tmdbType, currentMovie.tmdbSeasons, currentMovie.series]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showWatchedForm) {
          setShowWatchedForm(false);
          return;
        }
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
  }, [showWatchedForm]);

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

  const handleToggleDeposito = async () => {
    if (!adminSession) return;
    const nextValue = !localDeposito;
    setInventoryBusy(true);
    setInventoryMessage(null);
    try {
      await updateMovieStatus({ collectionId: movie.id, enDeposito: nextValue });
      applyMovieStatusUpdate(movie.id, { enDeposito: nextValue });
      setLocalDeposito(nextValue);
      setInventoryMessage(nextValue ? 'Movida a deposito.' : 'Devuelta a la coleccion.');
    } catch (error) {
      console.error(error);
      setInventoryMessage('No se pudo actualizar el deposito.');
    } finally {
      setInventoryBusy(false);
    }
  };

  const handleToggleFunciona = async () => {
    if (!adminSession) return;
    const nextStatus = localFuncionaStatus === 'working' ? 'damaged' : 'working';
    setInventoryBusy(true);
    setInventoryMessage(null);
    try {
      await updateMovieStatus({ collectionId: movie.id, funcionaStatus: nextStatus });
      applyMovieStatusUpdate(movie.id, { funcionaStatus: nextStatus });
      setLocalFuncionaStatus(nextStatus);
      setInventoryMessage(nextStatus === 'working' ? 'Marcada como funcional.' : 'Marcada como no funcional.');
    } catch (error) {
      console.error(error);
      setInventoryMessage('No se pudo actualizar el estado.');
    } finally {
      setInventoryBusy(false);
    }
  };

  const updateWatchedField = (field: 'seen' | 'ratingGloria' | 'ratingRodrigo', value: string | boolean) => {
    setWatchedInput((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const updateEpisodeField = (key: string, field: keyof EpisodeInput, value: string | boolean) => {
    setEpisodeInputs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const updateEpisodeModalField = (field: 'seen' | 'ratingGloria' | 'ratingRodrigo', value: string | boolean) => {
    setEpisodeModalInput((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const openEpisodeModal = (episode: NonNullable<MovieRecord['seriesEpisodes']>[number]) => {
    setEpisodeModal({ seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber });
    setEpisodeModalInput({
      seen: true,
      ratingGloria: episode.ratingGloria != null ? String(episode.ratingGloria) : '',
      ratingRodrigo: episode.ratingRodrigo != null ? String(episode.ratingRodrigo) : '',
      busy: false,
      error: undefined
    });
  };

  const handleSaveEpisodeModal = async () => {
    if (!adminSession || !episodeModal) return;
    setEpisodeModalInput((prev) => ({ ...prev, busy: true, error: undefined }));
    try {
      const ratingGloria = episodeModalInput.ratingGloria ? Number(episodeModalInput.ratingGloria) : null;
      const ratingRodrigo = episodeModalInput.ratingRodrigo ? Number(episodeModalInput.ratingRodrigo) : null;
      const updatedEpisodes = (episodeRecordsRef.current ?? []).map((episode) => {
        if (episode.seasonNumber !== episodeModal.seasonNumber || episode.episodeNumber !== episodeModal.episodeNumber) {
          return episode;
        }
        return {
          ...episode,
          seen: episodeModalInput.seen,
          ratingGloria,
          ratingRodrigo
        };
      });
      await updateMovieStatus({ collectionId: movie.id, seriesEpisodes: updatedEpisodes });
      applyMovieStatusUpdate(movie.id, { seriesEpisodes: updatedEpisodes });
      setEpisodeRecords(updatedEpisodes);
      setEpisodeModal(null);
    } catch (error) {
      console.error(error);
      setEpisodeModalInput((prev) => ({ ...prev, busy: false, error: 'No se pudo guardar.' }));
    }
  };

  const handleClearEpisode = async (episode: NonNullable<MovieRecord['seriesEpisodes']>[number]) => {
    if (!adminSession) return;
    try {
      const updatedEpisodes = (episodeRecordsRef.current ?? []).map((entry) => {
        if (entry.seasonNumber !== episode.seasonNumber || entry.episodeNumber !== episode.episodeNumber) {
          return entry;
        }
        return {
          ...entry,
          seen: false,
          ratingGloria: null,
          ratingRodrigo: null
        };
      });
      await updateMovieStatus({ collectionId: movie.id, seriesEpisodes: updatedEpisodes });
      applyMovieStatusUpdate(movie.id, { seriesEpisodes: updatedEpisodes });
      setEpisodeRecords(updatedEpisodes);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveEpisode = async (seasonNumber: number, episodeNumber: number) => {
    if (!adminSession) return;
    const key = buildEpisodeKey(seasonNumber, episodeNumber);
    const input = episodeInputs[key];
    if (!input) return;
    setEpisodeInputs((prev) => ({
      ...prev,
      [key]: { ...input, busy: true, error: undefined }
    }));
    try {
      const ratingGloria = input.ratingGloria ? Number(input.ratingGloria) : null;
      const ratingRodrigo = input.ratingRodrigo ? Number(input.ratingRodrigo) : null;
      const updatedEpisodes = (episodeRecordsRef.current ?? []).map((episode) => {
        if (episode.seasonNumber !== seasonNumber || episode.episodeNumber !== episodeNumber) return episode;
        return {
          ...episode,
          seen: input.seen,
          ratingGloria,
          ratingRodrigo
        };
      });
      await updateMovieStatus({ collectionId: movie.id, seriesEpisodes: updatedEpisodes });
      applyMovieStatusUpdate(movie.id, { seriesEpisodes: updatedEpisodes });
      setEpisodeRecords(updatedEpisodes);
      setEpisodeInputs((prev) => ({
        ...prev,
        [key]: { ...input, busy: false, error: undefined }
      }));
    } catch (error) {
      console.error(error);
      setEpisodeInputs((prev) => ({
        ...prev,
        [key]: { ...input, busy: false, error: 'No se pudo guardar.' }
      }));
    }
  };

  const handleSaveWatched = async () => {
    if (!adminSession) return;
    setWatchedInput((prev) => ({ ...prev, busy: true, error: undefined }));
    try {
      const ratingGloria = watchedInput.ratingGloria ? Number(watchedInput.ratingGloria) : null;
      const ratingRodrigo = watchedInput.ratingRodrigo ? Number(watchedInput.ratingRodrigo) : null;
      await updateMovieStatus({
        collectionId: movie.id,
        seen: watchedInput.seen,
        ratingGloria,
        ratingRodrigo
      });
      applyMovieStatusUpdate(movie.id, { seen: watchedInput.seen, ratingGloria, ratingRodrigo });
      setShowWatchedForm(false);
      setWatchedInput((prev) => ({ ...prev, busy: false, error: undefined }));
    } catch (error) {
      console.error(error);
      setWatchedInput((prev) => ({ ...prev, busy: false, error: 'No se pudo guardar.' }));
    }
  };

  const handleUnsetWatched = async () => {
    if (!adminSession) return;
    setWatchedInput((prev) => ({ ...prev, busy: true, error: undefined }));
    try {
      await updateMovieStatus({ collectionId: movie.id, seen: false });
      applyMovieStatusUpdate(movie.id, { seen: false });
      setShowWatchedForm(false);
      setWatchedInput((prev) => ({ ...prev, busy: false, error: undefined }));
    } catch (error) {
      console.error(error);
      setWatchedInput((prev) => ({ ...prev, busy: false, error: 'No se pudo guardar.' }));
    }
  };

  const episodeSeasonOptions = useMemo(() => {
    const fromTmdb = (currentMovie.tmdbSeasons ?? []).map((season) => season.seasonNumber);
    const fromEpisodes = (episodeRecords ?? []).map((episode) => episode.seasonNumber);
    return Array.from(new Set([...fromTmdb, ...fromEpisodes].filter(Number.isFinite))).sort((a, b) => a - b);
  }, [currentMovie.tmdbSeasons, episodeRecords]);

  const ownedSeasons = useMemo(() => {
    const owned = new Set<number>();
    movies.forEach((entry) => {
      const isSeries = entry.series || entry.tmdbType === 'tv';
      if (!isSeries || entry.season == null) return;
      if (currentMovie.tmdbId && entry.tmdbId === currentMovie.tmdbId) {
        owned.add(entry.season);
      }
    });
    if (currentMovie.season != null) {
      owned.add(currentMovie.season);
    }
    return owned;
  }, [currentMovie.season, currentMovie.tmdbId, movies]);

  useEffect(() => {
    if (episodeSeason != null) return;
    if (episodeSeasonOptions.length > 0) {
      setEpisodeSeason(episodeSeasonOptions[0]);
    }
  }, [episodeSeason, episodeSeasonOptions]);

  const displaySeasons = useMemo(() => {
    const base = currentMovie.tmdbSeasons ?? [];
    const overrides = seasonOverrides ?? [];
    if (overrides.length === 0) return base;
    const map = new Map(overrides.map((season) => [season.seasonNumber, season]));
    return base.length > 0
      ? base.map((season) => ({ ...season, ...map.get(season.seasonNumber) }))
      : overrides;
  }, [currentMovie.tmdbSeasons, seasonOverrides]);

  const sortEpisodes = (a: NonNullable<MovieRecord['seriesEpisodes']>[number], b: NonNullable<MovieRecord['seriesEpisodes']>[number]) =>
    a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber;

  const mergeEpisodeRecords = (
    current: MovieRecord['seriesEpisodes'] | undefined,
    incoming: NonNullable<MovieRecord['seriesEpisodes']>,
    seasonNumber: number
  ) => {
    const existing = current ?? [];
    const existingMap = new Map(existing.map((episode) => [buildEpisodeKey(episode.seasonNumber, episode.episodeNumber), episode]));
    const mergedSeason = incoming.map((episode) => {
      const key = buildEpisodeKey(episode.seasonNumber, episode.episodeNumber);
      const prev = existingMap.get(key);
      return {
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        tmdbId: episode.tmdbId ?? prev?.tmdbId ?? null,
        name: episode.name ?? prev?.name ?? null,
        airDate: episode.airDate ?? prev?.airDate ?? null,
        overview: episode.overview ?? prev?.overview ?? null,
        tmdbRating: episode.tmdbRating ?? prev?.tmdbRating ?? null,
        seen: prev?.seen ?? false,
        ratingGloria: prev?.ratingGloria ?? null,
        ratingRodrigo: prev?.ratingRodrigo ?? null
      };
    });
    const rest = existing.filter((episode) => episode.seasonNumber !== seasonNumber);
    const merged = [...rest, ...mergedSeason].sort(sortEpisodes);
    const changed = merged.length !== existing.length || merged.some((episode) => {
      const key = buildEpisodeKey(episode.seasonNumber, episode.episodeNumber);
      const prev = existingMap.get(key);
      return (
        !prev ||
        prev.name !== episode.name ||
        prev.airDate !== episode.airDate ||
        prev.tmdbId !== episode.tmdbId ||
        prev.overview !== episode.overview ||
        prev.tmdbRating !== episode.tmdbRating
      );
    });
    return { merged, changed };
  };

  useEffect(() => {
    let active = true;
    async function fetchEpisodes() {
      const isSeries = currentMovie.tmdbType === 'tv' || currentMovie.series;
      if (!isSeries || !currentMovie.tmdbId || episodeSeason == null) {
        return;
      }
      setEpisodeLoading(true);
      setEpisodeError(null);
      const episodes = await fetchTvSeasonEpisodes(currentMovie.tmdbId, episodeSeason);
      if (!active) return;
      if (episodes.length === 0) {
        setEpisodeLoading(false);
        return;
      }
      const { merged, changed } = mergeEpisodeRecords(episodeRecordsRef.current ?? [], episodes, episodeSeason);
      if (changed) {
        setEpisodeRecords(merged);
        if (adminSession) {
          try {
            await updateMovieStatus({ collectionId: movie.id, seriesEpisodes: merged });
            applyMovieStatusUpdate(movie.id, { seriesEpisodes: merged });
          } catch (error) {
            console.warn('No se pudo guardar capitulos en Supabase', error);
          }
        }
      }
      setEpisodeLoading(false);
    }
    fetchEpisodes();
    return () => {
      active = false;
    };
  }, [adminSession, applyMovieStatusUpdate, currentMovie.tmdbId, currentMovie.tmdbType, episodeSeason, movie.id, currentMovie.series]);

  const seasonEpisodes = useMemo(() => {
    if (episodeSeason == null) return [];
    return (episodeRecords ?? []).filter((episode) => episode.seasonNumber === episodeSeason).sort(sortEpisodes);
  }, [episodeRecords, episodeSeason]);

  const episodesSeen = useMemo(() => seasonEpisodes.filter((episode) => episode.seen).length, [seasonEpisodes]);

  useEffect(() => {
    if (episodeSeason == null) return;
    setEpisodeInputs((prev) => {
      const next: Record<string, EpisodeInput> = {};
      seasonEpisodes.forEach((episode) => {
        const key = buildEpisodeKey(episode.seasonNumber, episode.episodeNumber);
        const existing = prev[key];
        next[key] = existing?.busy
          ? existing
          : {
              seen: episode.seen ?? false,
              ratingGloria: episode.ratingGloria != null ? String(episode.ratingGloria) : '',
              ratingRodrigo: episode.ratingRodrigo != null ? String(episode.ratingRodrigo) : ''
            };
      });
      return next;
    });
  }, [episodeSeason, seasonEpisodes]);

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
    if (currentMovie.seen) {
      void handleUnsetWatched();
      return;
    }
    setShowWatchedForm(true);
    setWatchedInput((prev) => ({
      ...prev,
      seen: true,
      ratingGloria: currentMovie.ratingGloria != null ? String(currentMovie.ratingGloria) : '',
      ratingRodrigo: currentMovie.ratingRodrigo != null ? String(currentMovie.ratingRodrigo) : '',
      error: undefined
    }));
  };

  const handleEdit = () => {
    navigate(`/admin/movies/${currentMovie.id}/edit`);
    requestClose();
  };

  const dubbingValue = currentMovie.dubbing as unknown;
  const dubbingLabel =
    typeof dubbingValue === 'boolean'
      ? dubbingValue
        ? 'Sí'
        : 'No'
      : currentMovie.dubbing
      ? currentMovie.dubbing
      : 'No especificado';

  const summaryContent = (
    <div className="detail-sheet__content-grid">
      <div className="detail-sheet__main">
        <div className="detail-sheet__section">
          <h3>Sinopsis</h3>
          <p className={`detail-sheet__plot ${plotExpanded ? 'is-expanded' : ''}`}>
            {currentMovie.plot ?? 'No plot available.'}
          </p>
          {currentMovie.plot && currentMovie.plot.length > 180 && (
            <button className="ghost" onClick={() => setPlotExpanded((prev) => !prev)} type="button">
              {plotExpanded ? 'Ver menos' : 'Ver mas'}
            </button>
          )}
        </div>
        <div className="detail-sheet__section">
          <h3>Detalles principales</h3>
          <div className="detail-sheet__info-grid">
            <div>
              <strong>Doblaje / Formato</strong>
              <p>{dubbingLabel} / {currentMovie.format}</p>
            </div>
            <div>
              <strong>Estado fisico</strong>
              <p>{funcionaLabel}</p>
            </div>
            {currentMovie.group && (
              <div>
                <strong>Group</strong>
                <p>{currentMovie.group}</p>
              </div>
            )}
            {currentMovie.saga && (
              <div>
                <strong>Saga</strong>
                <p>
                  <Link to={`/movies?saga=${encodeURIComponent(currentMovie.saga)}`}>{currentMovie.saga}</Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <aside className="detail-sheet__sidebar">
        <RatingsCard movie={currentMovie} />
      </aside>
    </div>
  );

  const seasonsContent = (
    <div className="detail-sheet__content-grid">
      <div className="detail-sheet__main">
        <div className="detail-sheet__section">
          <div className="director-section__heading">
            <strong>Temporadas</strong>
            {currentMovie.season != null && (
              <small className="muted"> Temporada solicitada: {currentMovie.season}</small>
            )}
          </div>
          {displaySeasons && displaySeasons.length > 0 ? (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  overflowX: 'auto',
                  paddingBottom: 6
                }}
              >
                {displaySeasons.map((season) => {
                  const owned = ownedSeasons.has(season.seasonNumber);
                  const isActive = episodeSeason === season.seasonNumber;
                  return (
                    <button
                      key={season.seasonNumber}
                      type="button"
                      onClick={() => {
                        if (!owned) return;
                        setEpisodeSeason(season.seasonNumber);
                        setActiveTab('episodes');
                      }}
                      style={{
                        border: isActive ? '2px solid var(--accent-2)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 14,
                        padding: 8,
                        background: 'rgba(0,0,0,0.2)',
                        color: 'inherit',
                        minWidth: 140,
                        textAlign: 'left',
                        cursor: owned ? 'pointer' : 'default'
                      }}
                      aria-disabled={!owned}
                    >
                      <div
                        style={{
                          width: 120,
                          height: 170,
                          borderRadius: 10,
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          backgroundImage: season.posterUrl ? `url(${season.posterUrl})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          filter: owned ? 'none' : 'grayscale(1)',
                          opacity: owned ? 1 : 0.5,
                          marginBottom: 8
                        }}
                      />
                      <div style={{ fontWeight: 600 }}>T{season.seasonNumber}</div>
                      {season.name && <div className="muted">{season.name}</div>}
                    </button>
                  );
                })}
              </div>
              {episodeSeason != null && (
                <div className="muted" style={{ marginTop: 8 }}>
                  {(() => {
                    const selected = displaySeasons.find((season) => season.seasonNumber === episodeSeason);
                    if (!selected) return null;
                    return (
                      <>
                        Episodios: {selected.episodeCount ?? '???'}
                        {selected.airDate && <span> ??? Estreno: {selected.airDate}</span>}
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <p className="muted">Sin temporadas registradas.</p>
          )}
        </div>
      </div>
      <aside className="detail-sheet__sidebar">
        <RatingsCard movie={currentMovie} />
      </aside>
    </div>
  );

  const episodesContent = (
    <div className="detail-sheet__content-grid">
      <div className="detail-sheet__main">
        <div className="detail-sheet__section">
          <div className="director-section__heading" style={{ alignItems: 'center' }}>
            <strong>Capitulos</strong>
            {episodeSeason != null && (
              <small className="muted">Vistos: {episodesSeen}/{seasonEpisodes.length}</small>
            )}
          </div>
          {episodeSeason == null && <p className="muted">Selecciona una temporada para ver los capitulos.</p>}
          {!currentMovie.tmdbId && (
            <p className="muted">Sin ID de TMDb para cargar capitulos.</p>
          )}
          {episodeSeason != null && episodeLoading && <p className="muted">Cargando capitulos...</p>}
          {episodeSeason != null && episodeError && <p className="muted">{episodeError}</p>}
          {episodeSeason != null && seasonEpisodes.length > 0 ? (
            <div style={{ display: 'grid', gap: 16 }}>
              {seasonEpisodes.map((episode) => {
                const myRatings = [episode.ratingGloria, episode.ratingRodrigo].filter(
                  (value): value is number => value != null
                );
                const myAverage = myRatings.length
                  ? (myRatings.reduce((sum, value) => sum + value, 0) / myRatings.length).toFixed(1)
                  : '???';
                const tmdbScore = episode.tmdbRating != null ? episode.tmdbRating.toFixed(1) : '???';
                return (
                  <div
                    key={buildEpisodeKey(episode.seasonNumber, episode.episodeNumber)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) 180px',
                      gap: 16,
                      alignItems: 'start',
                      paddingBottom: 16,
                      borderBottom: '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        S{episode.seasonNumber}E{episode.episodeNumber} {episode.name ?? ''}
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {episode.overview || 'Sin sinopsis.'}
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {episode.airDate ? `Estreno: ${episode.airDate}` : 'Sin fecha'}
                        {episode.seen && <span> ??? Visto</span>}
                      </div>
                    </div>
                    <div
                      style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12,
                        padding: 12,
                        display: 'grid',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="muted">Mi nota</span>
                        <strong>{myAverage}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="muted">TMDb</span>
                        <strong>{tmdbScore}</strong>
                      </div>
                      {adminSession && (
                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            if (episode.seen) {
                              void handleClearEpisode(episode);
                            } else {
                              openEpisodeModal(episode);
                            }
                          }}
                        >
                          {episode.seen ? 'Limpiar puntuacion' : 'Marcar visto'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : episodeSeason != null ? (
            <p className="muted">Sin capitulos disponibles.</p>
          ) : null}
        </div>
      </div>
      <aside className="detail-sheet__sidebar">
        <RatingsCard movie={currentMovie} />
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
              <p>{currentMovie.tmdbYear ?? currentMovie.year ?? 'Year ?'}</p>
            </div>
            <div>
              <strong>Sección</strong>
              <p>{currentMovie.seccion}</p>
            </div>
            <div>
              <strong>Género</strong>
              <p>{currentMovie.genreRaw}</p>
              {currentMovie.tmdbGenres && currentMovie.tmdbGenres.length > 0 && (
                <small className="muted">TMDb: {currentMovie.tmdbGenres.join(', ')}</small>
              )}
            </div>
            <div>
              <strong>Región</strong>
              <p>{currentMovie.region || '—'}</p>
            </div>
            <div>
              <strong>Tipo</strong>
              <p>{currentMovie.tmdbType === 'tv' || currentMovie.series ? 'Serie' : 'Película'}</p>
            </div>
            {currentMovie.originalTitle && (
              <div>
                <strong>Título original</strong>
                <p>{currentMovie.originalTitle}</p>
              </div>
            )}
            {currentMovie.tmdbOriginalTitle && currentMovie.tmdbOriginalTitle !== currentMovie.originalTitle && (
              <div>
                <strong>TMDb original</strong>
                <p>{currentMovie.tmdbOriginalTitle}</p>
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
          inventoryBusy={inventoryBusy}
          inventoryMessage={inventoryMessage}
          localDeposito={localDeposito}
          localFuncionaStatus={localFuncionaStatus}
          handleAdminTmdbInputChange={handleAdminTmdbInputChange}
          handleFixTmdb={handleFixTmdb}
          handleResolveTmdb={handleResolveTmdb}
          handleToggleDeposito={handleToggleDeposito}
          handleToggleFunciona={handleToggleFunciona}
          movie={currentMovie}
          onEdit={handleEdit}
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
        aria-label={`Detalles de ${currentMovie.title}`}
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
      >
        <div className="detail-sheet__inner">
          <TopBar
            title={currentMovie.title}
            showTitle={showCompactTitle}
            onClose={requestClose}
            tmdbUrl={tmdbUrl}
            onToggleSeen={handleToggleSeen}
            seen={currentMovie.seen}
            showWatchedToggle={Boolean(adminSession)}
            closeButtonRef={closeButtonRef}
          />
          <Hero
            movie={displayMovie}
            directors={directors}
            loadingDirectors={loadingDirectors}
            fallbackDirectors={fallbackDirectors}
            funcionaLabel={funcionaLabel}
          />
          <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
        </div>
      </div>
      {adminSession && showWatchedForm && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 45 }}
          onClick={(event) => {
            event.stopPropagation();
            setShowWatchedForm(false);
          }}
        >
          <div className="modal watched-modal" onClick={(event) => event.stopPropagation()}>
            <WatchedForm
              input={watchedInput}
              onChange={updateWatchedField}
              onSave={handleSaveWatched}
              onCancel={() => setShowWatchedForm(false)}
            />
          </div>
        </div>
      )}
      {adminSession && episodeModal && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 46 }}
          onClick={(event) => {
            event.stopPropagation();
            setEpisodeModal(null);
          }}
        >
          <div className="modal watched-modal" onClick={(event) => event.stopPropagation()}>
            <WatchedForm
              input={episodeModalInput}
              onChange={updateEpisodeModalField}
              onSave={handleSaveEpisodeModal}
              onCancel={() => setEpisodeModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const MovieDetail: React.FC<Props> = (props) => <MovieDetailSheet {...props} />;



