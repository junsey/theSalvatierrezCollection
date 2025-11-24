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
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" role="presentation">
        <circle className="donut__track" cx="60" cy="60" r={radius} />
        {data.map((slice) => {
          const fraction = total > 0 ? slice.value / total : 0;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const circle = (
            <circle
              key={slice.label}
              cx="60"
              cy="60"
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
      <div className="donut__legend">
        {data.map((slice) => (
          <div key={slice.label} className="donut__legend-item">
            <span className="dot" style={{ background: slice.color, boxShadow: `0 0 10px ${slice.color}` }} />
            <span>{slice.label}</span>
            <strong>{slice.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title: React.ReactNode;
  value: React.ReactNode;
  caption: string;
  href?: string;
}> = ({ title, value, caption, href }) => {
  const content = (
    <div className="metric-card">
      <div className="metric-card__glow" />
      <div className="metric-card__header">
        <small>{caption}</small>
        <h3>{title}</h3>
      </div>
      <div className="metric-card__value">{value}</div>
    </div>
  );

  if (href) {
    return <Link to={href} className="metric-card__link">{content}</Link>;
  }

  return content;
};

const TreasuresGrid: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => (
  <div className="treasure-grid">
    {movies.map((movie) => (
      <MovieCard key={movie.id} movie={movie} />
    ))}
  </div>
);

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
    oldestYear,
    newestYear
  } = useMemo(() => {
    const totalMovies = movies.filter((m) => !m.series).length;
    const totalSeries = movies.filter((m) => m.series).length;
    const watched = movies.filter((m) => m.seen).length;
    const untested = movies.filter((m) => !m.seen && m.funcionaStatus === 'untested').length;
    const unseen = Math.max(movies.length - watched - untested, 0);
    const damaged = movies.filter((m) => m.funcionaStatus === 'damaged').length;
    const sections = Array.from(new Set(movies.map((m) => m.seccion.trim()).filter(Boolean))).length;
    const directors = Array.from(new Set(movies.map((m) => m.director.trim()).filter(Boolean))).length;

    const ratingCandidates = movies.filter((m) => m.rating != null);
    const topRated = ratingCandidates
      .slice()
      .sort((a, b) => Number(b.rating) - Number(a.rating))
      .slice(0, 5);

    const years = movies
      .map((m) => m.year ?? m.tmdbYear)
      .filter((y): y is number => typeof y === 'number');
    const oldestYear = years.length ? Math.min(...years) : null;
    const newestYear = years.length ? Math.max(...years) : null;

    const watchChart: DonutDatum[] = [
      { label: 'Vista', value: watched, color: 'rgba(126, 217, 87, 0.9)' },
      { label: 'No vista', value: unseen, color: 'rgba(255, 86, 138, 0.9)' },
      { label: 'Sin probar', value: untested, color: 'rgba(224, 160, 64, 0.85)' }
    ];

    return {
      totalMovies,
      totalSeries,
      watchChart,
      damaged,
      sections,
      directors,
      topRated,
      oldestYear,
      newestYear
    };
  }, [movies]);

  return (
    <section className="panel panel--veil">
      <div className="home-hero">
        <div className="home-hero__text">
          <p className="eyebrow">Gran Hall del Archivo</p>
          <h1>Castillo Salvatiérrez</h1>
          <p className="lore">
            Bienvenido al Gran Archivo del Castillo Salvatiérrez. Aquí reposan las reliquias cinematográficas de eras
            pasadas: preservadas, restauradas y custodiadas bajo el fulgor de lámparas arcano-lúgubres. Que los espíritus
            del celuloide guíen tu exploración.
          </p>
          <div className="hero-actions">
            <Link className="nav-link" to="/movies">Ingresar al Archivo</Link>
            <Link className="nav-link" to="/surprise">Ritual Aleatorio</Link>
          </div>
        </div>
        <div className="home-hero__metrics">
          <StatDonut data={watchChart} total={movies.length} />
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard
          title={loading ? '...' : totalMovies.toLocaleString()}
          caption="Pergaminos Archivados"
          value={<span className="metric-number">Películas</span>}
        />
        <MetricCard
          title={loading ? '...' : totalSeries.toLocaleString()}
          caption="Crónicas Seriadas"
          value={<span className="metric-number">Series</span>}
        />
        <MetricCard
          title={loading ? '...' : damaged.toLocaleString()}
          caption="Reliquias Heridas"
          value={<span className="metric-number">Copias</span>}
        />
        <MetricCard
          title={loading ? '...' : sections.toLocaleString()}
          caption="Salas del Archivo"
          value={<span className="metric-number">Colecciones</span>}
          href="/sections"
        />
        <MetricCard
          title={loading ? '...' : directors.toLocaleString()}
          caption="Maestros del Arte"
          value={<span className="metric-number">Directores</span>}
          href="/directors"
        />
        {oldestYear && (
          <MetricCard
            title={oldestYear}
            caption="Más Antiguo"
            value={<span className="metric-number">Año</span>}
          />
        )}
        {newestYear && (
          <MetricCard
            title={newestYear}
            caption="Registro Más Joven"
            value={<span className="metric-number">Año</span>}
          />
        )}
      </div>

      <div className="treasure-section">
        <div className="treasure-section__header">
          <div>
            <p className="eyebrow">Selección de la Casa</p>
            <h2>Los Cinco Tesoros Mejor Valorados del Castillo</h2>
          </div>
          <Link className="nav-link" to="/movies">Ver todo el catálogo</Link>
        </div>
        {loading ? (
          <p className="muted">Invocando reliquias...</p>
        ) : topRated.length === 0 ? (
          <p className="muted">Aún no hay puntuaciones registradas.</p>
        ) : (
          <TreasuresGrid movies={topRated} />
        )}
      </div>
    </section>
  );
};
