import React, { useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { useMovies } from '../context/MovieContext';

import { getSheetUrl } from '../services/googleSheets';

import { buildDirectorProfiles, clearPeopleCaches } from '../services/tmdbPeopleService';

import { buildDirectorOverrideMap, splitDirectors } from '../services/directors';

import { clearAdminSession, saveAdminSession } from '../services/adminSession';

import { createMovie, verifyAdminCredentials } from '../services/adminApi';



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

    group: '',

    seen: false,

    ratingGloria: '',

    ratingRodrigo: '',

    dubbing: '',

    format: ''

  });

  const [newMovieBusy, setNewMovieBusy] = useState(false);

  const [newMovieStatus, setNewMovieStatus] = useState<string | null>(null);



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



  const handleRefreshAll = async () => {

    setStatus(null);

    try {

      await refreshAll();

      setStatus('â RegeneraciÃ³n completa finalizada.');

    } catch (err) {

      console.error(err);

      setStatus('â No se pudo regenerar completamente.');

    }

  };



  const handleRefreshSupabase = async () => {

    setStatus(null);

    try {

      await refreshSupabase();

      setStatus('OK. Datos cargados desde Supabase.');

    } catch (err) {

      console.error(err);

      setStatus('ERROR. No se pudo cargar Supabase.');

    }

  };



  const handleRefreshSheet = async () => {

    setStatus(null);

    try {

      await refreshSheet();

      setStatus('â Excel recargado correctamente.');

    } catch (err) {

      console.error(err);

      setStatus('â No se pudo recargar el Excel.');

    }

  };



  const handleRefreshMissing = async () => {

    setStatus(null);

    try {

      await refreshMissing();

      setStatus('â PelÃ­culas sin cachÃ© actualizadas.');

    } catch (err) {

      console.error(err);

      setStatus('â No se pudieron actualizar las pelÃ­culas faltantes.');

    }

  };



  const handleRefreshDirectors = async () => {

    setStatus(null);

    setDirectorProgress({ current: 0, total: directorNames.length });

    setRegeneratingDirectors(true);

    try {

      clearPeopleCaches();

      await buildDirectorProfiles(directorNames, {

        forceRefresh: true,

        overrides: directorOverrides,

        onProgress: (current, total) => setDirectorProgress({ current, total })

      });

      setStatus('â Directores regenerados correctamente.');

    } catch (err) {

      console.error(err);

      setStatus('â No se pudieron regenerar los directores.');

    } finally {

      setRegeneratingDirectors(false);

      setDirectorProgress(null);

    }

  };



  const handleAdminLogin = async () => {

    setAdminBusy(true);

    setAdminError(null);

    setAdminMessage(null);

    try {

      const ok = await verifyAdminCredentials(adminUser.trim(), adminPass.trim());

      if (!ok) {

        setAdminError('Credenciales incorrectas.');

        return;

      }

      const session = saveAdminSession(adminUser.trim(), adminPass.trim());

      setAdminSession(session);

      setAdminMessage('SesiÃ³n admin iniciada.');

    } catch (error) {

      console.error(error);

      setAdminError('No se pudo validar la sesiÃ³n admin.');

    } finally {

      setAdminBusy(false);

    }

  };



  const handleAdminLogout = () => {

    clearAdminSession();

    setAdminSession(null);

    setAdminMessage('SesiÃ³n admin cerrada.');

  };



  const handleCreateMovie = async () => {

    setNewMovieBusy(true);

    setNewMovieStatus(null);

    try {

      const payload = {

        seccion: newMovie.seccion.trim(),

        title: newMovie.title.trim(),

        year: newMovie.year ? Number(newMovie.year) : null,

        saga: newMovie.saga.trim(),

        originalTitle: newMovie.originalTitle.trim(),

        genreRaw: newMovie.genreRaw.trim(),

        director: newMovie.director.trim(),

        group: newMovie.group.trim(),

        seen: newMovie.seen,

        ratingGloria: newMovie.ratingGloria ? Number(newMovie.ratingGloria) : null,

        ratingRodrigo: newMovie.ratingRodrigo ? Number(newMovie.ratingRodrigo) : null,

        dubbing: newMovie.dubbing.trim(),

        format: newMovie.format.trim()

      };

      if (!payload.seccion || !payload.title) {

        setNewMovieStatus('SecciÃ³n y tÃ­tulo son obligatorios.');

        return;

      }

      await createMovie(payload);

      await refreshSupabase();

      setNewMovieStatus('PelÃ­cula creada y sincronizada con Supabase.');

      setNewMovie({

        seccion: '',

        title: '',

        year: '',

        saga: '',

        originalTitle: '',

        genreRaw: '',

        director: '',

        group: '',

        seen: false,

        ratingGloria: '',

        ratingRodrigo: '',

        dubbing: '',

        format: ''

      });

    } catch (error) {

      console.error(error);

      setNewMovieStatus('No se pudo crear la pelÃ­cula.');

    } finally {

      setNewMovieBusy(false);

    }

  };



  const lastUpdated = sheetMeta?.fetchedAt

    ? new Date(sheetMeta.fetchedAt).toLocaleString()

    : 'SincronizaciÃ³n pendiente';



  const sheetSourceLabel: Record<string, string> = {

    'network': 'En lÃ­nea (Ãºltimo fetch)',

    'cache-fresh': 'Copia local fresca',

    'cache-stale': 'Copia local (stale, pero segura)',

    'embedded': 'Copia embebida en la app',

    'demo': 'Datos demo',

    'supabase': 'Supabase (BD)'

  };



  const sourceLabel = sheetMeta ? sheetSourceLabel[sheetMeta.source] : 'N/D';



  // Identificar pelÃ­culas problemÃ¡ticas

  const problematicMovies = movies.filter(

    (movie) =>

      !movie.tmdbStatus ||

      movie.tmdbStatus.source === 'none' ||

      movie.tmdbStatus.source === 'error' ||

      movie.tmdbStatus.source === 'not-found' ||

      (!movie.tmdbId && !movie.posterUrl && !movie.plot)

  );



  return (

    <div className="page panel">

      <div className="panel" style={{ marginBottom: 16 }}>

        <h1>ConfiguraciÃ³n</h1>

        <p>

          Supabase es la fuente principal y guardamos una copia local para evitar cortes. Las herramientas legacy (Excel/TMDb) quedan

          abajo para uso manual.

        </p>

      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>

        <div className="stat-card">

          <strong>Ãltima sincronizaciÃ³n</strong>

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

          <div className="clamped" style={{ fontSize: 12 }}>{sheetMeta?.source === 'supabase' ? 'Supabase' : getSheetUrl()}</div>

        </div>

      </div>

      <div className="panel" style={{ marginBottom: 16 }}>

        <h2>Admin</h2>

        {!adminSession ? (

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>

              Inicia sesión para habilitar acciones de escritura en Supabase.

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

              <strong>Contraseña</strong>

              <input

                type="password"

                value={adminPass}

                onChange={(event) => setAdminPass(event.target.value)}

                autoComplete="current-password"

              />

            </label>

            <button className="btn" onClick={handleAdminLogin} disabled={adminBusy}>

              {adminBusy ? 'Validando...' : 'Iniciar sesión'}

            </button>

            {adminMessage && <p className="muted">{adminMessage}</p>}

            {adminError && <p style={{ color: 'var(--accent)' }}>{adminError}</p>}

          </div>

        ) : (

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>

              Sesión activa para <strong>{adminSession.user}</strong>.

            </p>

            <button className="btn" onClick={handleAdminLogout}>

              Cerrar sesión

            </button>

          </div>

        )}

      </div>

      {adminSession && (

        <div className="panel" style={{ marginBottom: 16 }}>

          <h2>Nueva película</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

              <strong>Sección</strong>

              <select

                value={newMovie.seccion}

                onChange={(event) => setNewMovie({ ...newMovie, seccion: event.target.value })}

              >

                <option value="">Selecciona sección</option>

                {sectionOptions.map((section) => (

                  <option key={section} value={section}>

                    {section}

                  </option>

                ))}

              </select>

            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

              <strong>Título</strong>

              <input

                type="text"

                value={newMovie.title}

                onChange={(event) => setNewMovie({ ...newMovie, title: event.target.value })}

              />

            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

              <strong>Año</strong>

              <input

                type="number"

                value={newMovie.year}

                onChange={(event) => setNewMovie({ ...newMovie, year: event.target.value })}

              />

            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

              <strong>Director</strong>

              <input

                type="text"

                value={newMovie.director}

                onChange={(event) => setNewMovie({ ...newMovie, director: event.target.value })}

              />

            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

              <strong>Género</strong>

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

              <strong>Título original</strong>

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

              <strong>Puntuación Gloria</strong>

              <input

                type="number"

                step="0.5"

                value={newMovie.ratingGloria}

                onChange={(event) => setNewMovie({ ...newMovie, ratingGloria: event.target.value })}

              />

            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

              <strong>Puntuación Rodrigo</strong>

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

              {newMovieBusy ? 'Guardando...' : 'Crear película'}

            </button>

            {newMovieStatus && <span className="muted">{newMovieStatus}</span>}

          </div>

        </div>

      )}

      <div className="panel" style={{ marginBottom: 16 }}>

        <h2>Supabase</h2>

        <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 12 }}>

          Supabase es la fuente principal. Las acciones legacy quedan separadas para uso manual.

        </p>

        <button className="btn" onClick={handleRefreshSupabase} disabled={loading}>

          {loading ? 'Cargando...' : 'Usar Supabase'}

        </button>

      </div>

      <div className="panel" style={{ marginBottom: 16 }}>

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

              Recarga el Excel desde Google Sheets y regenera todos los datos de TMDb (ignora caché existente).

            </p>

            <button className="btn" onClick={handleRefreshAll} disabled={loading}>

              {loading ? 'Regenerando...' : 'Regenerar todo'}

            </button>

          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>

            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Recargar Excel</h3>

            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>

              Solo recarga los datos desde Google Sheets. Solo enriquece las películas nuevas que no tienen caché.

            </p>

            <button className="btn" onClick={handleRefreshSheet} disabled={loading}>

              {loading ? 'Recargando...' : 'Recargar Excel'}

            </button>

          </div>



          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>

            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Regenerar faltantes</h3>

            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>

              Solo enriquece las películas que no tienen caché o están en error. No recarga el Excel.

            </p>

            <button className="btn" onClick={handleRefreshMissing} disabled={loading}>

              {loading ? 'Regenerando...' : 'Regenerar faltantes'}

            </button>

          </div>



          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>

            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Regenerar directores</h3>

            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>

              Limpia la caché de directores y vuelve a solicitar las biografías y retratos basados en los nombres del Excel.

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

        <div className="panel" style={{ marginBottom: 16 }}>

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

            {progress.current} de {progress.total} pelÃ­culas

          </div>

        </div>

      )}



      {directorProgress && (

        <div className="panel" style={{ marginBottom: 16 }}>

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

        <div className="panel" style={{ marginBottom: 16, background: 'var(--bg-2)' }}>

          <p>{status}</p>

        </div>

      )}

      

      {error && (

        <div className="panel" style={{ marginBottom: 16, background: 'rgba(255, 54, 93, 0.1)' }}>

          <p style={{ color: 'var(--accent)' }}>{error}</p>

        </div>

      )}

      <div className="panel" style={{ marginTop: 16 }}>

        <h3>Copia embebida</h3>

        <p>

          La app incluye una copia de seguridad dentro del bundle (<code>src/data/sheet-backup.csv</code>). Si todo falla, los datos se

          cargarÃ¡n desde ahÃ­ para evitar el error 404.

        </p>

      </div>



      <div className="panel" style={{ marginTop: 16 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>

          <h3>PelÃ­culas problemÃ¡ticas</h3>

          <button 

            className="btn" 

            onClick={() => setShowProblematic(!showProblematic)}

            style={{ fontSize: '0.9em', padding: '6px 12px' }}

          >

            {showProblematic ? 'Ocultar' : 'Mostrar'} ({problematicMovies.length})

          </button>

        </div>

        <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 12 }}>

          PelÃ­culas que no tienen datos de TMDb, estÃ¡n en error o no se encontraron coincidencias.

        </p>

        

        {showProblematic && (

          <div style={{ marginTop: 12 }}>

            {problematicMovies.length === 0 ? (

              <p style={{ color: 'var(--accent-2)' }}>â No hay pelÃ­culas problemÃ¡ticas. Todas tienen datos vÃ¡lidos.</p>

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

                        {movie.year && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>â¢ {movie.year}</span>}

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

                          <div><strong>TÃ­tulos consultados:</strong> {movie.tmdbStatus.requestedTitles.join(', ')}</div>

                        )}

                        {movie.tmdbStatus.requestedYear && (

                          <div><strong>AÃ±o consultado:</strong> {movie.tmdbStatus.requestedYear}</div>

                        )}

                        {movie.tmdbStatus.error && (

                          <div style={{ color: 'var(--accent)', marginTop: 4 }}>

                            <strong>Error:</strong> {movie.tmdbStatus.error}

                          </div>

                        )}

                        {movie.tmdbStatus.fetchedAt && (

                          <div><strong>Ãltimo intento:</strong> {new Date(movie.tmdbStatus.fetchedAt).toLocaleString('es-ES')}</div>

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



      <div className="panel" style={{ marginTop: 16 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>

          <h3>PelÃ­culas daÃ±adas</h3>

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

          Basado en la columna <strong>Funciona</strong>: "No" = daÃ±ada, vacÃ­a = sin probar, "Si" = en buen estado.

        </p>

        {damagedMovies.length === 0 && (

          <p style={{ color: 'var(--accent-2)' }}>â No hay pelÃ­culas marcadas como daÃ±adas.</p>

        )}

      </div>

    </div>

  );

};

