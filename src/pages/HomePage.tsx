import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MovieCard } from '../components/MovieCard';
import { useMovies } from '../context/MovieContext';
import { MovieRecord } from '../types/MovieRecord';

type DonutDatum = {
  label: string;
  value: number;
  color: string;
};

const StatDonut: React.FC<{ data: DonutDatum[]; total: number }> = ({ data, total }) => {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" role="presentation">
        <circle className="donut__track" cx="70" cy="70" r={radius} />
        {data.map((slice) => {
          const fraction = total > 0 ? slice.value / total : 0;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const circle = (
            <circle
              key={slice.label}
              cx="70"
              cy="70"
              r={radius}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              style={{ stroke: slice.color }}
              className="donut__slice"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div className="donut__center">
        <span className="donut__number">{total}</span>
        <span className="donut__label">Títulos</span>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title?: React.ReactNode;
  caption: string;
  href?: string;
  children?: React.ReactNode;
}> = ({ title, caption, href, children }) => {
  const content = (
    <div className="metric-card">
      <div className="metric-card__glow" />
      <div className="metric-card__header">
        <small>{caption}</small>
        {title !== undefined && <div className="metric-card__value">{title}</div>}
      </div>
      {children && <div className="metric-card__body">{children}</div>}
    </div>
  );

  if (href) {
    return <Link to={href} className="metric-card__link">{content}</Link>;
  }

  return content;
};

const formatPalette = [
  'linear-gradient(90deg, rgba(224, 160, 64, 0.9), rgba(255, 213, 128, 0.8))',
  'linear-gradient(90deg, rgba(137, 200, 255, 0.95), rgba(84, 133, 203, 0.9))',
  'linear-gradient(90deg, rgba(255, 160, 197, 0.92), rgba(255, 110, 160, 0.9))',
  'linear-gradient(90deg, rgba(156, 235, 184, 0.95), rgba(88, 185, 141, 0.92))',
  'linear-gradient(90deg, rgba(210, 175, 255, 0.9), rgba(150, 114, 210, 0.85))',
  'linear-gradient(90deg, rgba(255, 190, 125, 0.9), rgba(230, 124, 78, 0.85))'
];

const FormatMiniChart: React.FC<{
  data: { entries: [string, number][]; total: number };
}> = ({ data }) => {
  if (!data.entries.length) return <p className="muted">Sin formatos registrados.</p>;

  return (
    <div className="format-chart" aria-label="Distribución de formatos">
      <div className="format-chart__stack">
        {data.entries.map(([label, value], index) => (
          <div
            key={label}
            className="format-chart__segment"
            style={{
              flexGrow: value,
              flexBasis: 0,
              minWidth: value > 0 ? 4 : 0,
              background: formatPalette[index % formatPalette.length]
            }}
            title={`${label}: ${value}`}
          />
        ))}
      </div>
      <div className="format-chart__legend">
        {data.entries.map(([label, value], index) => (
          <div key={label} className="format-chart__legend-item">
            <span
              className="format-chart__dot"
              style={{ background: formatPalette[index % formatPalette.length] }}
            />
            <span className="format-chart__legend-label">{label}</span>
            <span className="format-chart__legend-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TreasuresGrid: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const slots = Array.from({ length: 5 }, (_, index) => movies[index] ?? null);

  return (
    <div className="treasure-grid">
      {slots.map((movie, index) =>
        movie ? (
          <MovieCard key={movie.id} movie={movie} />
        ) : (
          <div key={`placeholder-${index}`} className="treasure-placeholder">
            <div className="treasure-placeholder__veil" />
            <p>Espacio reservado para futuras reliquias.</p>
          </div>
        )
      )}
    </div>
  );
};

export const HomePage: React.FC = () => {
  const { movies, loading } = useMovies();

  const {
    totalMovies,
    totalSeries,
    watchChart,
    damaged,
    sections,
    directors,
    topRated,
    formatBreakdown,
    watchedCount,
    unseenCount,
    untestedCount,
    depositCount
  } = useMemo(() => {
    const totalMovies = movies.filter((m) => !m.series).length;
    const totalSeries = movies.filter((m) => m.series).length;
    const enDeposito = movies.filter((m) => m.enDeposito).length;
    const nonDepositoMovies = movies.filter((m) => !m.enDeposito);
    const watched = nonDepositoMovies.filter((m) => m.seen).length;
    const untested = nonDepositoMovies.filter((m) => !m.seen && m.funcionaStatus === 'untested').length;
    const unseen = Math.max(nonDepositoMovies.length - watched - untested, 0);
    const damaged = movies.filter((m) => m.funcionaStatus === 'damaged').length;
    const sections = Array.from(new Set(movies.map((m) => m.seccion.trim()).filter(Boolean))).length;
    const directors = Array.from(new Set(movies.map((m) => m.director.trim()).filter(Boolean))).length;

    const formatCounts = movies.reduce<Record<string, number>>((acc, movie) => {
      const key = movie.format && movie.format.trim() ? movie.format.trim() : 'Sin identificar';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const ratedByHouse = movies
      .map((movie) => {
        if (movie.ratingGloria == null || movie.ratingRodrigo == null) return null;
        const houseAverage = (movie.ratingGloria + movie.ratingRodrigo) / 2;
        return { movie, houseAverage };
      })
      .filter((entry): entry is { movie: MovieRecord; houseAverage: number } => entry !== null)
      .sort((a, b) => b.houseAverage - a.houseAverage)
      .slice(0, 5)
      .map(({ movie }) => movie);

    const watchChart: DonutDatum[] = [
      { label: 'Vista', value: watched, color: 'rgba(111, 207, 151, 0.92)' },
      { label: 'No vista', value: unseen, color: 'rgba(224, 68, 68, 0.92)' },
      { label: 'Sin probar', value: untested, color: 'rgba(230, 176, 64, 0.9)' },
      { label: 'En depósito', value: enDeposito, color: 'rgba(98, 174, 255, 0.9)' }
    ];

    return {
      totalMovies,
      totalSeries,
      watchChart,
      damaged,
      sections,
      directors,
      topRated: ratedByHouse,
      formatBreakdown: formatCounts,
      watchedCount: watched,
      unseenCount: unseen,
      untestedCount: untested,
      depositCount: enDeposito
    };
  }, [movies]);

  const formatChartData = useMemo(() => {
    const entries = Object.entries(formatBreakdown).sort((a, b) => b[1] - a[1]);
    const total = Object.values(formatBreakdown).reduce((sum, value) => sum + value, 0);
    return { entries, total };
  }, [formatBreakdown]);

  return (
    <main className="grand-hall">
      <section className="grand-hall__banner">
        <div className="banner__text">
          <p className="eyebrow">Castillo Salvatiérrez — Grand Hall of the Archive</p>
          <h1>Castillo Salvatiérrez — Grand Hall of the Archive</h1>
          <p className="lore">
            Welcome to the Grand Archive of Castillo Salvatíerrez. Here lie the cinematic relics of bygone eras:
            preserved, restored, and safeguarded beneath arcane-lit lanterns. May the spirits of celluloid guide your
            exploration.
          </p>
          <div className="hero-actions">
            <Link className="nav-link nav-link--solid" to="/movies">Enter the Archive</Link>
            <Link className="nav-link nav-link--ghost" to="/surprise">Random Ritual</Link>
          </div>
        </div>
        <div className="banner__chart">
          <div className="chart-panel">
            <header className="chart-panel__header">
              <div>
                <p className="eyebrow">Inventario Total</p>
                <h2>Tesoros Custodiados</h2>
              </div>
              <span className="chart-total">{movies.length.toLocaleString()} títulos</span>
            </header>
            <div className="chart-panel__body">
              <StatDonut data={watchChart} total={movies.length} />
              <div className="chart-panel__legend">
                <div className="status-pill status-pill--watched">
                  <span>Vistas</span>
                  <strong>{watchedCount}</strong>
                </div>
                <div className="status-pill status-pill--unwatched">
                  <span>No vistas</span>
                  <strong>{unseenCount}</strong>
                </div>
                <div className="status-pill status-pill--untested">
                  <span>Sin probar</span>
                  <strong>{untestedCount}</strong>
                </div>
                <div className="status-pill status-pill--deposit">
                  <span>En depósito</span>
                  <strong>{depositCount}</strong>
                </div>
                <div className="status-pill status-pill--damaged">
                  <span>Dañadas</span>
                  <strong>{damaged}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="metrics-section">
        <div className="metrics-grid">
          <MetricCard
            title={loading ? '…' : totalMovies.toLocaleString()}
            caption="Archivo de Películas"
          />
          <MetricCard
            title={loading ? '…' : totalSeries.toLocaleString()}
            caption="Archivo de Series"
          />
          <MetricCard
            title={loading ? '…' : directors.toLocaleString()}
            caption="Archivo de Directores"
            href="/directors"
          />
          <MetricCard
            title={loading ? '…' : sections.toLocaleString()}
            caption="Secciones del archivo"
            href="/sections"
          />
          <MetricCard title={loading ? '…' : formatChartData.total.toLocaleString()} caption="Formatos">
            <FormatMiniChart data={formatChartData} />
          </MetricCard>
        </div>
      </section>

      <section className="treasure-section">
        <div className="treasure-section__header">
          <div>
            <p className="eyebrow">Selección de la Casa</p>
            <h2>Los Cinco Tesoros Mejor Valorados del Castillo</h2>
          </div>
          <Link className="nav-link nav-link--ghost" to="/movies">Ver todo el catálogo</Link>
        </div>
        {loading ? (
          <p className="muted">Invocando reliquias...</p>
        ) : (
          <>
            {topRated.length === 0 && <p className="muted">Aún no hay puntuaciones registradas.</p>}
            <TreasuresGrid movies={topRated} />
          </>
        )}
      </section>
    </main>
  );
};
