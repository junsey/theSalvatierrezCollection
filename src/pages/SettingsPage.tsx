import React, { useState } from 'react';
import { useMovies } from '../context/MovieContext';
import { getSheetUrl } from '../services/googleSheets';

export const SettingsPage: React.FC = () => {
  const { refresh, loading, sheetMeta, error, refreshLog, clearRefreshLog } = useMovies();
  const [status, setStatus] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setStatus('Regenerando documento y caché TMDb…');
    clearRefreshLog();
    try {
      await refresh({ forceNetwork: true, invalidateMovieCache: true });
      setStatus('Documento y datos enriquecidos actualizados.');
    } catch (err) {
      console.error(err);
      setStatus('No se pudo regenerar, usando la copia guardada.');
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
          enriquecidos de TMDb por 6 meses. Usa el botón para regenerar manualmente y forzar una lectura nueva + refrescar la
          caché de TMDb cuando quieras actualizar la colección.
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
      <button className="btn" onClick={handleRegenerate} disabled={loading}>
        {loading ? 'Sincronizando…' : 'Regenerar documento ahora'}
      </button>
      {status && <p style={{ marginTop: 12 }}>{status}</p>}
      {error && <p style={{ marginTop: 8, color: 'var(--accent)' }}>{error}</p>}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Consola de sincronización</h3>
        {loading ? <p>Sincronizando…</p> : <p>Última corrida registrada abajo.</p>}
        <div className="log-console">
          {refreshLog.length === 0 && <div className="log-line">Sin eventos aún.</div>}
          {refreshLog.map((line, idx) => (
            <div className="log-line" key={idx}>
              {line}
            </div>
          ))}
        </div>
      </div>
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
