import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
import { getSheetUrl } from '../services/googleSheets';
import { buildDirectorProfiles, clearPeopleCaches, regeneratePeopleCaches } from '../services/tmdbPeopleService';
import { buildDirectorOverrideMap, splitDirectors } from '../services/directors';

export const SettingsPage: React.FC = () => {
  const { refreshAll, refreshSheet, refreshMissing, loading, sheetMeta, error, progress, movies } = useMovies();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [showProblematic, setShowProblematic] = useState(false);
  const [directorProgress, setDirectorProgress] = useState<{ current: number; total: number } | null>(null);
  const [regeneratingDirectors, setRegeneratingDirectors] = useState(false);
  const [peopleProgress, setPeopleProgress] = useState<{ current: number; total: number } | null>(null);
  const [regeneratingPeople, setRegeneratingPeople] = useState(false);

  const directorNames = useMemo(
    () => Array.from(new Set(movies.flatMap((movie) => splitDirectors(movie.director)))).sort(),
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
      setStatus('✅ Regeneración completa finalizada.');
    } catch (err) {
      console.error(err);
      setStatus('❌ No se pudo regenerar completamente.');
    }
  };

  const handleRefreshSheet = async () => {
    setStatus(null);
    try {
      await refreshSheet();
      setStatus('✅ Excel recargado correctamente.');
    } catch (err) {
      console.error(err);
      setStatus('❌ No se pudo recargar el Excel.');
    }
  };

  const handleRefreshMissing = async () => {
    setStatus(null);
    try {
      await refreshMissing();
      setStatus('✅ Películas sin caché actualizadas.');
    } catch (err) {
      console.error(err);
      setStatus('❌ No se pudieron actualizar las películas faltantes.');
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
      setStatus('✅ Directores regenerados correctamente.');
    } catch (err) {
      console.error(err);
      setStatus('❌ No se pudieron regenerar los directores.');
    } finally {
      setRegeneratingDirectors(false);
      setDirectorProgress(null);
    }
  };

  const handleRefreshPeopleCache = async () => {
    setStatus(null);
    setPeopleProgress({ current: 0, total: directorNames.length });
    setRegeneratingPeople(true);
    try {
      await regeneratePeopleCaches(directorNames, {
        overrides: directorOverrides,
        onProgress: (current, total) => setPeopleProgress({ current, total })
      });
      setStatus('✅ Caché de personas TMDb regenerada correctamente.');
    } catch (err) {
      console.error(err);
      setStatus('❌ No se pudo regenerar la caché de personas.');
    } finally {
      setRegeneratingPeople(false);
      setPeopleProgress(null);
    }
  };

  const lastUpdated = sheetMeta?.fetchedAt
    ? new Date(sheetMeta.fetchedAt).toLocaleString()
    : 'Sincronización pendiente';

  const sheetSourceLabel: Record<string, string> = {
    'network': 'En línea (último fetch)',
    'cache-fresh': 'Copia local fresca',
    'cache-stale': 'Copia local (stale, pero segura)',
    'embedded': 'Copia embebida en la app',
    'demo': 'Datos demo'
  };

  const sourceLabel = sheetMeta ? sheetSourceLabel[sheetMeta.source] : 'N/D';

  // Identificar películas problemáticas
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
        <h1>Configuración</h1>
        <p>
          Guardamos una copia local del documento para que no se rompa si Google Sheets devuelve 404/403 y cacheamos los datos
          enriquecidos de TMDb por 6 meses. Usa las opciones siguientes para gestionar la sincronización y el enriquecimiento de datos.
        </p>
      </div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <strong>Última sincronización</strong>
          <div>{lastUpdated}</div>
        </div>
        <div className="stat-card">
          <strong>Origen actual</strong>
          <div>{sourceLabel}</div>
        </div>
        <div className="stat-card">
          <strong>Hoja remota</strong>
          <div className="clamped" style={{ fontSize: 12 }}>{getSheetUrl()}</div>
        </div>
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Opciones de sincronización</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Regenerar todo</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Recarga el Excel desde Google Sheets y regenera todos los datos de TMDb (ignora caché existente).
            </p>
            <button className="btn" onClick={handleRefreshAll} disabled={loading}>
              {loading ? 'Regenerando…' : 'Regenerar todo'}
            </button>
          </div>
          
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Recargar Excel</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Solo recarga los datos desde Google Sheets. Solo enriquece las películas nuevas que no tienen caché.
            </p>
            <button className="btn" onClick={handleRefreshSheet} disabled={loading}>
              {loading ? 'Recargando…' : 'Recargar Excel'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Regenerar faltantes</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Solo enriquece las películas que no tienen caché o están en error. No recarga el Excel.
            </p>
            <button className="btn" onClick={handleRefreshMissing} disabled={loading}>
              {loading ? 'Regenerando…' : 'Regenerar faltantes'}
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
              {regeneratingDirectors ? 'Regenerando…' : 'Regenerar directores'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h3 style={{ marginBottom: 8, fontSize: '1em' }}>Regenerar caché de personas TMDb</h3>
            <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Borra la caché de sessionStorage/localStorage e IndexDB para los créditos de personas y la vuelve a generar con los
              directores del Excel.
            </p>
            <button
              className="btn"
              onClick={handleRefreshPeopleCache}
              disabled={
                loading || regeneratingPeople || regeneratingDirectors || directorNames.length === 0 || peopleProgress !== null
              }
            >
              {regeneratingPeople ? 'Regenerando…' : 'Regenerar caché TMDb de personas'}
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
            {progress.current} de {progress.total} películas
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

      {peopleProgress && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Caché de personas TMDb</strong>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${(peopleProgress.current / Math.max(peopleProgress.total, 1)) * 100}%` }}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: '0.9em', color: 'var(--text-muted)' }}>
            {peopleProgress.current} de {peopleProgress.total} personas
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
          cargarán desde ahí para evitar el error 404.
        </p>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Películas problemáticas</h3>
          <button 
            className="btn" 
            onClick={() => setShowProblematic(!showProblematic)}
            style={{ fontSize: '0.9em', padding: '6px 12px' }}
          >
            {showProblematic ? 'Ocultar' : 'Mostrar'} ({problematicMovies.length})
          </button>
        </div>
        <p style={{ fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Películas que no tienen datos de TMDb, están en error o no se encontraron coincidencias.
        </p>
        
        {showProblematic && (
          <div style={{ marginTop: 12 }}>
            {problematicMovies.length === 0 ? (
              <p style={{ color: 'var(--accent-2)' }}>✅ No hay películas problemáticas. Todas tienen datos válidos.</p>
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
                        {movie.year && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>• {movie.year}</span>}
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
                          <div><strong>Títulos consultados:</strong> {movie.tmdbStatus.requestedTitles.join(', ')}</div>
                        )}
                        {movie.tmdbStatus.requestedYear && (
                          <div><strong>Año consultado:</strong> {movie.tmdbStatus.requestedYear}</div>
                        )}
                        {movie.tmdbStatus.error && (
                          <div style={{ color: 'var(--accent)', marginTop: 4 }}>
                            <strong>Error:</strong> {movie.tmdbStatus.error}
                          </div>
                        )}
                        {movie.tmdbStatus.fetchedAt && (
                          <div><strong>Último intento:</strong> {new Date(movie.tmdbStatus.fetchedAt).toLocaleString('es-ES')}</div>
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
          <h3>Películas dañadas</h3>
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
          Basado en la columna <strong>Funciona</strong>: "No" = dañada, vacía = sin probar, "Si" = en buen estado.
        </p>
        {damagedMovies.length === 0 && (
          <p style={{ color: 'var(--accent-2)' }}>✅ No hay películas marcadas como dañadas.</p>
        )}
      </div>
    </div>
  );
};
