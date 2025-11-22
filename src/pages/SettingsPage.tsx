import React, { useState } from 'react';
import { useMovies } from '../context/MovieContext';
import { getSheetUrl } from '../services/googleSheets';

export const SettingsPage: React.FC = () => {
  const { refreshAll, refreshSheet, refreshMissing, loading, sheetMeta, error, progress } = useMovies();
  const [status, setStatus] = useState<string | null>(null);

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
    </div>
  );
};
