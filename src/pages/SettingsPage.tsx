import React, { useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { MovieCard } from '../components/MovieCard';
import { MovieDetail } from '../components/MovieDetail';
import { useMovies } from '../context/MovieContext';

import { getSheetUrl } from '../services/googleSheets';

import { compareShelfSort } from '../services/movieSort';
import { buildDirectorProfiles, clearPeopleCaches } from '../services/tmdbPeopleService';

import { buildDirectorOverrideMap, splitDirectors } from '../services/directors';

import { clearAdminSession, saveAdminSession } from '../services/adminSession';

import { createMovie, verifyAdminCredentials } from '../services/adminApi';

import { MovieRecord } from '../types/MovieRecord';


type SettingsTabId = 'new-movie' | 'legacy' | 'other' | 'where';

type SettingsTabItem = {
  id: SettingsTabId;
  label: string;
  content: React.ReactNode;
};

const SettingsTabs: React.FC<{
  tabs: SettingsTabItem[];
  activeId: SettingsTabId;
  onChange: (id: SettingsTabId) => void;
}> = ({ tabs, activeId, onChange }) => {
  return (
    <div className="detail-tabs">
      <div className="detail-tabs__list" role="tablist" aria-label="Secciones de configuracion">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeId === tab.id}
            aria-controls={`settings-tab-panel-${tab.id}`}
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
          id={`settings-tab-panel-${tab.id}`}
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

export const SettingsPage: React.FC = () => {

  const {

    refreshAll,

    refreshSheet,

    refreshMissing,

    refreshSupabase,

    loading,

    sheetMeta,

    error,

    progress,

    movies,

    tmdbEnrichmentEnabled,

    setTmdbEnrichmentEnabled,

    adminSession,

    setAdminSession

  } = useMovies();

  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<SettingsTabId>('new-movie');
  const [activeMovie, setActiveMovie] = useState<MovieRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [showProblematic, setShowProblematic] = useState(false);

  const [directorProgress, setDirectorProgress] = useState<{ current: number; total: number } | null>(null);

  const [regeneratingDirectors, setRegeneratingDirectors] = useState(false);

  const [adminUser, setAdminUser] = useState('');

  const [adminPass, setAdminPass] = useState('');

  const [adminBusy, setAdminBusy] = useState(false);

  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  const [adminError, setAdminError] = useState<string | null>(null);

  const [newMovie, setNewMovie] = useState({

    seccion: '',

    title: '',

    year: '',

    saga: '',

    originalTitle: '',

    genreRaw: '',

    director: '',

    season: '',

    group: '',

    seen: false,

    ratingGloria: '',

    ratingRodrigo: '',

    dubbing: '',

    format: ''

  });

  const [newMovieType, setNewMovieType] = useState<'movie' | 'series'>('movie');

  const [newMovieBusy, setNewMovieBusy] = useState(false);

  const [newMovieStatus, setNewMovieStatus] = useState<string | null>(null);

  const [whereQuery, setWhereQuery] = useState('');
  const [whereIndex, setWhereIndex] = useState<number | null>(null);
  const [whereMessage, setWhereMessage] = useState<string | null>(null);



  const directorNames = useMemo(

    () => Array.from(new Set(movies.flatMap((movie) => splitDirectors(movie.director)))).sort(),

    [movies]

  );

  const sectionOptions = useMemo(

    () => Array.from(new Set(movies.map((movie) => movie.seccion).filter(Boolean))).sort((a, b) => a.localeCompare(b)),

    [movies]

  );

  const directorOverrides = useMemo(() => buildDirectorOverrideMap(movies), [movies]);

  const damagedMovies = useMemo(

    () => movies.filter((movie) => movie.funcionaStatus === 'damaged'),

    [movies]

  );

  const shelfSortedMovies = useMemo(() => [...movies].sort(compareShelfSort), [movies]);

  const matchesWhereQuery = (movie: MovieRecord, query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return false;
    const candidates = [movie.title, movie.originalTitle, movie.tmdbTitle, movie.tmdbOriginalTitle]
      .filter((title): title is string => Boolean(title))
      .map((title) => title.toLowerCase());
    return candidates.some((title) => title.includes(normalized));
  };

  const handleWhereSearch = () => {
    const normalized = whereQuery.trim().toLowerCase();
    if (!normalized) {
      setWhereIndex(null);
      setWhereMessage('Escribe un titulo para buscar.');
      return;
    }
    const index = shelfSortedMovies.findIndex((movie) => matchesWhereQuery(movie, normalized));
    if (index == -1) {
      setWhereIndex(null);
      setWhereMessage('No se encontro ninguna pelicula con ese titulo.');
      return;
    }
    setWhereIndex(index);
    setWhereMessage(null);
  };

  const whereTarget = whereIndex != null ? shelfSortedMovies[whereIndex] : null;
  const whereSectionMovies = useMemo(() => {
    if (!whereTarget) return [];
    return shelfSortedMovies.filter((movie) => movie.seccion === whereTarget.seccion);
  }, [shelfSortedMovies, whereTarget?.seccion]);
  const whereSectionIndex = useMemo(() => {
    if (!whereTarget) return null;
    const index = whereSectionMovies.findIndex((movie) => movie.id === whereTarget.id);
    return index == -1 ? null : index;
  }, [whereSectionMovies, whereTarget?.id]);
  const whereWindow = useMemo(() => {
    if (whereSectionIndex == null) return [];
    const start = Math.max(0, whereSectionIndex - 2);
    const end = Math.min(whereSectionMovies.length, whereSectionIndex + 3);
    return whereSectionMovies.slice(start, end);
  }, [whereSectionIndex, whereSectionMovies]);

  const newMovieContent = adminSession ? (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel">
        <h2>Nueva pelicula</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Tipo</strong>
            <select
              value={newMovieType}
              onChange={(event) => setNewMovieType(event.target.value as 'movie' | 'series')}
            >
              <option value="movie">Pelicula</option>
              <option value="series">Serie</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Seccion</strong>
            <select
              value={newMovie.seccion}
              onChange={(event) => setNewMovie({ ...newMovie, seccion: event.target.value })}
            >
              <option value="">Selecciona seccion</option>
              {sectionOptions.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Titulo</strong>
            <input
              type="text"
              value={newMovie.title}
              onChange={(event) => setNewMovie({ ...newMovie, title: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Ano</strong>
            <input
              type="number"
              value={newMovie.year}
              onChange={(event) => setNewMovie({ ...newMovie, year: event.target.value })}
            />
          </label>
          {newMovieType === 'series' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong>Temporada</strong>
              <input
                type="number"
                value={newMovie.season}
                onChange={(event) => setNewMovie({ ...newMovie, season: event.target.value })}
              />
            </label>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Director</strong>
            <input
              type="text"
              value={newMovie.director}
              onChange={(event) => setNewMovie({ ...newMovie, director: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Genero</strong>
            <input
              type="text"
              value={newMovie.genreRaw}
              onChange={(event) => setNewMovie({ ...newMovie, genreRaw: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Saga</strong>
            <input
              type="text"
              value={newMovie.saga}
              onChange={(event) => setNewMovie({ ...newMovie, saga: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Titulo original</strong>
            <input
              type="text"
              value={newMovie.originalTitle}
              onChange={(event) => setNewMovie({ ...newMovie, originalTitle: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Grupo</strong>
            <input
              type="text"
              value={newMovie.group}
              onChange={(event) => setNewMovie({ ...newMovie, group: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Doblaje</strong>
            <input
              type="text"
              value={newMovie.dubbing}
              onChange={(event) => setNewMovie({ ...newMovie, dubbing: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Formato</strong>
            <input
              type="text"
              value={newMovie.format}
              onChange={(event) => setNewMovie({ ...newMovie, format: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Puntuacion Gloria</strong>
            <input
              type="number"
              step="0.5"
              value={newMovie.ratingGloria}
              onChange={(event) => setNewMovie({ ...newMovie, ratingGloria: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Puntuacion Rodrigo</strong>
            <input
              type="number"
              step="0.5"
              value={newMovie.ratingRodrigo}
              onChange={(event) => setNewMovie({ ...newMovie, ratingRodrigo: event.target.value })}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={newMovie.seen}
              onChange={(event) => setNewMovie({ ...newMovie, seen: event.target.checked })}
            />
            <span>Vista</span>
          </label>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn" onClick={handleCreateMovie} disabled={newMovieBusy}>
            {newMovieBusy ? 'Guardando...' : 'Crear pelicula'}
          </button>
          {newMovieStatus && <span className="muted">{newMovieStatus}</span>}
        </div>
      </div>
    </div>
  ) : (
    <div className="panel">
      <h2>Nueva pelicula</h2>
      <p className="muted">Inicia sesion admin para habilitar la creacion de peliculas.</p>
    </div>
  );

  const legacyContent = (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel">
        <h2>Legacy (Excel + TMDb)</h2>
        <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Acciones manuales para emergencias. No se ejecutan de forma automatica.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Enriquecimiento TMDb</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>
              {tmdbEnrichmentEnabled
                ? 'Activo: se consultara TMDb cuando se use legacy.'
                : 'Pausado: no se haran llamadas a TMDb.'}
            </p>
            <button
              className="btn"
              onClick={() => setTmdbEnrichmentEnabled(!tmdbEnrichmentEnabled)}
              disabled={loading}
            >
              {tmdbEnrichmentEnabled ? 'Pausar TMDb' : 'Reactivar TMDb'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Regenerar todo</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Recarga el Excel desde Google Sheets y regenera todos los datos de TMDb (ignora cache existente).
            </p>
            <button className="btn" onClick={handleRefreshAll} disabled={loading}>
              {loading ? 'Regenerando...' : 'Regenerar todo'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Recargar Excel</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Solo recarga los datos desde Google Sheets. Solo enriquece las peliculas nuevas que no tienen cache.
            </p>
            <button className="btn" onClick={handleRefreshSheet} disabled={loading}>
              {loading ? 'Recargando...' : 'Recargar Excel'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Regenerar faltantes</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Solo enriquece las peliculas que no tienen cache o estan en error. No recarga el Excel.
            </p>
            <button className="btn" onClick={handleRefreshMissing} disabled={loading}>
              {loading ? 'Regenerando...' : 'Regenerar faltantes'}
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Regenerar directores</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Limpia la cache de directores y vuelve a solicitar las biografias y retratos basados en los nombres del Excel.
            </p>
            <button
              className="btn"
              onClick={handleRefreshDirectors}
              disabled={loading || regeneratingDirectors || directorNames.length === 0}
            >
              {regeneratingDirectors ? 'Regenerando...' : 'Regenerar directores'}
            </button>
          </div>
        </div>
      </div>
      {progress && (
        <div className="panel">
          <div style={{ marginBottom: 8 }}>
            <strong>{progress.message}</strong>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: '0.9em', color: 'var(--text-muted)' }}>
            {progress.current} de {progress.total} peliculas
          </div>
        </div>
      )}
      {directorProgress && (
        <div className="panel">
          <div style={{ marginBottom: 8 }}>
            <strong>Directores</strong>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${(directorProgress.current / Math.max(directorProgress.total, 1)) * 100}%` }}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: '0.9em', color: 'var(--text-muted)' }}>
            {directorProgress.current} de {directorProgress.total} directores
          </div>
        </div>
      )}
      {status && (
        <div className="panel" style={{ background: 'var(--bg-2)' }}>
          <p>{status}</p>
        </div>
      )}
      {error && (
        <div className="panel" style={{ background: 'rgba(255, 54, 93, 0.1)' }}>
          <p style={{ color: 'var(--accent)' }}>{error}</p>
        </div>
      )}
    </div>
  );

  const otherContent = (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel">
        <h2>Supabase</h2>
        <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Supabase es la fuente principal. Las acciones legacy quedan separadas para uso manual.
        </p>
        <button className="btn" onClick={handleRefreshSupabase} disabled={loading}>
          {loading ? 'Cargando...' : 'Usar Supabase'}
        </button>
      </div>
      <div className="panel">
        <h3>Copia embebida</h3>
        <p>
          La app incluye una copia de seguridad dentro del bundle (<code>src/data/sheet-backup.csv</code>). Si todo falla, los datos se
          cargaran desde ahi para evitar el error 404.
        </p>
      </div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Peliculas problematicas</h3>
          <button
            className="btn"
            onClick={() => setShowProblematic(!showProblematic)}
            style={{ fontSize: '0.9em', padding: '6px 12px' }}
          >
            {showProblematic ? 'Ocultar' : 'Mostrar'} ({problematicMovies.length})
          </button>
        </div>
        <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Peliculas que no tienen datos de TMDb, estan en error o no se encontraron coincidencias.
        </p>
        {showProblematic && (
          <div style={{ marginTop: 12 }}>
            {problematicMovies.length === 0 ? (
              <p style={{ color: 'var(--accent-2)' }}>OK. No hay peliculas problematicas. Todas tienen datos validos.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '400px', overflowY: 'auto' }}>
                {problematicMovies.map((movie) => (
                  <div
                    key={movie.id}
                    style={{
                      padding: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'rgba(255, 54, 93, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                      <div>
                        <strong>{movie.title}</strong>
                        {movie.originalTitle && movie.originalTitle !== movie.title && (
                          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                            ({movie.originalTitle})
                          </span>
                        )}
                        {movie.year && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>Ano {movie.year}</span>}
                      </div>
                      <span
                        style={{
                          fontSize: '0.85em',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: movie.tmdbStatus?.source === 'error'
                            ? 'rgba(255, 54, 93, 0.2)'
                            : movie.tmdbStatus?.source === 'not-found'
                            ? 'rgba(255, 200, 0, 0.2)'
                            : 'rgba(122, 162, 211, 0.2)'
                        }}
                      >
                        {movie.tmdbStatus?.source || 'none'}
                      </span>
                    </div>
                    {movie.tmdbStatus && (
                      <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>
                        <div><strong>Estado:</strong> {movie.tmdbStatus.message || 'Sin estado'}</div>
                        {movie.tmdbStatus.requestedTitles && movie.tmdbStatus.requestedTitles.length > 0 && (
                          <div><strong>Titulos consultados:</strong> {movie.tmdbStatus.requestedTitles.join(', ')}</div>
                        )}
                        {movie.tmdbStatus.requestedYear && (
                          <div><strong>Ano consultado:</strong> {movie.tmdbStatus.requestedYear}</div>
                        )}
                        {movie.tmdbStatus.error && (
                          <div style={{ color: 'var(--accent)', marginTop: 4 }}>
                            <strong>Error:</strong> {movie.tmdbStatus.error}
                          </div>
                        )}
                        {movie.tmdbStatus.fetchedAt && (
                          <div><strong>Ultimo intento:</strong> {new Date(movie.tmdbStatus.fetchedAt).toLocaleString('es-ES')}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Peliculas danadas</h3>
          <button
            className="btn"
            onClick={() => navigate('/damaged')}
            disabled={damagedMovies.length === 0}
            style={{ fontSize: '0.9em', padding: '6px 12px' }}
          >
            Ver lista ({damagedMovies.length})
          </button>
        </div>
        <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Basado en la columna <strong>Funciona</strong>: "No" = danada, vacia = sin probar, "Si" = en buen estado.
        </p>
        {damagedMovies.length === 0 && (
          <p style={{ color: 'var(--accent-2)' }}>OK. No hay peliculas marcadas como danadas.</p>
        )}
      </div>
    </div>
  );

  const whereStartIndex = whereSectionIndex != null ? Math.max(0, whereSectionIndex - 2) : 0;
  const whereContent = (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel">
        <h2>Donde va?</h2>
        <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Busca una pelicula para ver la seccion y los vecinos segun el orden de Formato estanteria.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <input
            type="search"
            value={whereQuery}
            onChange={(event) => setWhereQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleWhereSearch();
            }}
            placeholder="Escribe un titulo"
            style={{ minWidth: 240 }}
          />
          <button className="btn" onClick={handleWhereSearch}>
            Buscar
          </button>
          <span className="muted">Orden: saga y luego titulo.</span>
        </div>
        {whereMessage && <p className="muted" style={{ marginTop: 12 }}>{whereMessage}</p>}
      </div>
      {whereTarget && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div className="where-section-title">Seccion: {whereTarget.seccion}</div>
            <div className="muted">
              {whereSectionIndex != null ? `${whereSectionIndex + 1} de ${whereSectionMovies.length}` : null}
            </div>
          </div>
          <div className="movie-grid where-grid">
            {whereWindow.map((movie, idx) => {
              const offset = whereStartIndex + idx - (whereSectionIndex ?? 0);
              const label = offset === 0 ? 'Buscada' : offset < 0 ? `Antes ${Math.abs(offset)}` : `Despues ${offset}`;
              const isTarget = offset === 0;
              return (
                <div key={movie.id} style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontSize: 12, color: isTarget ? 'var(--accent-2)' : 'var(--text-muted)' }}>
                    {label}
                  </span>
                  <div style={{ border: isTarget ? '2px solid var(--accent-2)' : '1px solid transparent', borderRadius: 16 }}>
                    <MovieCard movie={movie} onClick={() => setActiveMovie(movie)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const tabs: SettingsTabItem[] = [
    { id: 'new-movie', label: 'Nueva pelicula', content: newMovieContent },
    { id: 'legacy', label: 'Legacy (Excel + TMDb)', content: legacyContent },
    { id: 'other', label: 'Otros', content: otherContent },
    { id: 'where', label: 'Donde va?', content: whereContent }
  ];

  return (
    <div className="page panel">
      <div className="panel" style={{ marginBottom: 16 }}>
        <h1>Configuracion</h1>
        <p>
          Supabase es la fuente principal y guardamos una copia local para evitar cortes. Las herramientas legacy (Excel/TMDb) quedan
          abajo para uso manual.
        </p>
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Admin</h2>
        {!adminSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
              Inicia sesion para habilitar acciones de escritura en Supabase.
            </p>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong>Usuario</strong>
              <input
                type="text"
                value={adminUser}
                onChange={(event) => setAdminUser(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong>Contrasena</strong>
              <input
                type="password"
                value={adminPass}
                onChange={(event) => setAdminPass(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button className="btn" onClick={handleAdminLogin} disabled={adminBusy}>
              {adminBusy ? 'Validando...' : 'Iniciar sesion'}
            </button>
            {adminMessage && <p className="muted">{adminMessage}</p>}
            {adminError && <p style={{ color: 'var(--accent)' }}>{adminError}</p>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
              Sesion activa para <strong>{adminSession.user}</strong>.
            </p>
            <button className="btn" onClick={handleAdminLogout}>
              Cerrar sesion
            </button>
          </div>
        )}
      </div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <strong>Ultima sincronizacion</strong>
          <div>{lastUpdated}</div>
        </div>
        <div className="stat-card">
          <strong>Origen actual</strong>
          <div>{sourceLabel}</div>
        </div>
        <div className="stat-card">
          <strong>Estado Supabase</strong>
          <div>{sheetMeta?.source === 'supabase' ? 'Conectado' : 'No conectado'}</div>
        </div>
        <div className="stat-card">
          <strong>Hoja remota</strong>
          <div className="clamped" style={{ fontSize: 12 }}>
            {sheetMeta?.source === 'supabase' ? 'Supabase' : getSheetUrl()}
          </div>
        </div>
      </div>
      <SettingsTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
      {activeMovie && <MovieDetail movie={activeMovie} onClose={() => setActiveMovie(null)} />}
    </div>
  );

};
