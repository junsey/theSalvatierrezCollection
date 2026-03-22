import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MovieCard } from '../components/MovieCard';
import { CollectionCurator } from '../components/CollectionCurator';
import { useMovies } from '../context/MovieContext';
import { setStoredFilters } from '../services/localStorage';
import { MovieFilters, MovieRecord } from '../types/MovieRecord';

type DonutDatum = {
  label: string;
  value: number;
  color: string;
};

const StatDonut: React.FC<{
  data: DonutDatum[];
  total: number;
  centerNumber?: React.ReactNode;
  centerLabel?: React.ReactNode;
}> = ({ data, total, centerNumber, centerLabel }) => {
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
        <span className="donut__number">{centerNumber ?? total}</span>
        <span className="donut__label">{centerLabel ?? 'Relics'}</span>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title?: React.ReactNode;
  caption: string;
  href?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}> = ({ title, caption, href, onClick, children }) => {
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
    return (
      <Link to={href} className="metric-card__link" onClick={onClick}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className="metric-card__link metric-card__button" onClick={onClick}>
        {content}
      </button>
    );
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
  if (!data.entries.length) return <p className="muted">No formats registered yet.</p>;

  return (
    <div className="format-chart" aria-label="Format distribution">
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

const TreasuresGrid: React.FC<{
  movies: MovieRecord[];
  onView: (movie: MovieRecord) => void;
  onMarkViewed: (movie: MovieRecord) => void;
}> = ({ movies, onView, onMarkViewed }) => {
  const slots = Array.from({ length: 5 }, (_, index) => movies[index] ?? null);

  return (
    <div className="treasure-grid">
      {slots.map((movie, index) =>
        movie ? (
          <div
            key={movie.id}
            className="treasure-card"
            role="button"
            tabIndex={0}
            onClick={() => onView(movie)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onView(movie);
            }}
          >
            <MovieCard movie={movie} />
            <div
              className="treasure-card__actions"
              onClick={(event) => event.stopPropagation()}
              role="presentation"
            >
              <button type="button" className="treasure-card__action" onClick={() => onView(movie)}>
                View Details
              </button>
              <button
                type="button"
                className="treasure-card__action"
                onClick={() => onMarkViewed(movie)}
                disabled={movie.seen}
              >
                Mark as Viewed
              </button>
              <Link className="treasure-card__action" to={`/admin/movies/${movie.id}/edit`}>
                Add Note
              </Link>
            </div>
          </div>
        ) : (
          <div key={`placeholder-${index}`} className="treasure-placeholder">
            <div className="treasure-placeholder__veil" />
            <p>Space reserved for future relics.</p>
          </div>
        )
      )}
    </div>
  );
};

export const HomePage: React.FC = () => {
  const { visibleMovies: movies, loading, updateSeen } = useMovies();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

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
      const key = movie.format && movie.format.trim() ? movie.format.trim() : 'Unidentified';
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
      { label: 'Viewed', value: watched, color: 'rgba(111, 207, 151, 0.92)' },
      { label: 'Unviewed', value: unseen, color: 'rgba(224, 68, 68, 0.92)' },
      { label: 'Unverified', value: untested, color: 'rgba(230, 176, 64, 0.9)' },
      { label: 'In Deposit', value: enDeposito, color: 'rgba(98, 174, 255, 0.9)' }
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

  const applyFilters = (filters: Partial<MovieFilters>) => {
    setStoredFilters({
      query: '',
      seccion: null,
      genre: null,
      saga: null,
      series: 'all',
      seen: 'all',
      view: 'grid',
      sort: 'title-asc',
      condition: 'all',
      deposit: 'all',
      ...filters
    });
  };

  const applyFiltersAndNavigate = (filters: Partial<MovieFilters>, target = '/movies') => {
    applyFilters(filters);
    navigate(target);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    applyFiltersAndNavigate({ query: trimmed });
  };

  const handleViewDetails = (movie: MovieRecord) => {
    if (movie.tmdbId != null) {
      navigate(`/movies?tmdbId=${movie.tmdbId}`);
      return;
    }
    applyFiltersAndNavigate({ query: movie.title });
  };

  return (
    <main className="grand-hall">
      <section className="grand-hall__banner">
        <div className="banner__text">
          <p className="eyebrow">The Grand Archive</p>
          <h1>The Grand Archive</h1>
          <h2 className="banner__subtitle">Castillo Salvatiérrez</h2>
          <p className="lore">Explore, catalog and rediscover your film legacy.</p>
          <form className="hero-search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              className="hero-search__input"
              placeholder="Search the Archive by title, director, year or format..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search the archive"
            />
          </form>
          <div className="hero-actions">
            <Link className="nav-link nav-link--solid" to="/movies">Enter the Archive</Link>
            <Link className="nav-link nav-link--ghost" to="/surprise">Invoke Random Relic</Link>
          </div>
        </div>
      </section>

      <section className="treasure-section">
        <div className="treasure-section__header">
          <div>
            <p className="eyebrow">Curator’s Selection</p>
            <h2>Five Relics of Highest Renown</h2>
          </div>
          <Link className="nav-link nav-link--ghost" to="/movies">Explore Full Archive</Link>
        </div>
        {loading ? (
          <p className="muted">Summoning relics...</p>
        ) : (
          <>
            {topRated.length === 0 && <p className="muted">No ratings recorded yet.</p>}
            <TreasuresGrid
              movies={topRated}
              onView={handleViewDetails}
              onMarkViewed={(movie) => updateSeen(movie.id, true)}
            />
          </>
        )}
      </section>

      <section className="vaults-section">
        <div className="vaults-section__header">
          <div>
            <p className="eyebrow">Archive Wings</p>
            <h2>Quick Access Vaults</h2>
          </div>
          <p className="muted">Every count leads to a hall of the archive.</p>
        </div>
        <div className="vaults-grid">
          <button
            type="button"
            className="vault-card"
            onClick={() => applyFiltersAndNavigate({ series: 'movies' })}
          >
            <span className="vault-card__icon">🎞️</span>
            <span className="vault-card__count">{loading ? '…' : totalMovies.toLocaleString()}</span>
            <span className="vault-card__label">Motion Picture Vault</span>
          </button>
          <button
            type="button"
            className="vault-card"
            onClick={() => applyFiltersAndNavigate({ series: 'series' })}
          >
            <span className="vault-card__icon">📺</span>
            <span className="vault-card__count">{loading ? '…' : totalSeries.toLocaleString()}</span>
            <span className="vault-card__label">Series Vault</span>
          </button>
          <Link className="vault-card vault-card__link" to="/directors">
            <span className="vault-card__icon">🜂</span>
            <span className="vault-card__count">{loading ? '…' : directors.toLocaleString()}</span>
            <span className="vault-card__label">Directors Index</span>
          </Link>
          <button type="button" className="vault-card" onClick={() => applyFiltersAndNavigate({})}>
            <span className="vault-card__icon">⛶</span>
            <span className="vault-card__count">{loading ? '…' : formatChartData.total.toLocaleString()}</span>
            <span className="vault-card__label">Media Formats</span>
          </button>
        </div>
      </section>

      <section className="archive-status">
        <div className="archive-status__header">
          <div>
            <p className="eyebrow">ARCHIVE STATUS</p>
            <h2>Relics Under Custody</h2>
          </div>
        </div>
        <div className="chart-panel">
          <div className="chart-panel__body">
            <div className="donut-stack">
              <button
                type="button"
                className="donut-link"
                onClick={() => applyFiltersAndNavigate({})}
                aria-label="Explore full archive"
              >
                <StatDonut data={watchChart} total={movies.length} centerNumber="1349" centerLabel="Relics" />
              </button>
              <p className="donut__subtitle">Under Custody</p>
            </div>
            <div className="chart-panel__legend">
              <button
                type="button"
                className="status-pill status-pill--watched"
                onClick={() => applyFiltersAndNavigate({ seen: 'seen' })}
              >
                <span>Viewed ({watchedCount})</span>
              </button>
              <button
                type="button"
                className="status-pill status-pill--unwatched"
                onClick={() => applyFiltersAndNavigate({ seen: 'unseen' })}
              >
                <span>Unviewed ({unseenCount})</span>
              </button>
              <button
                type="button"
                className="status-pill status-pill--untested"
                onClick={() => applyFiltersAndNavigate({ condition: 'untested', seen: 'unseen' })}
              >
                <span>Unverified ({untestedCount})</span>
              </button>
              <button
                type="button"
                className="status-pill status-pill--deposit"
                onClick={() => applyFiltersAndNavigate({ deposit: 'deposit' })}
              >
                <span>In Deposit ({depositCount})</span>
              </button>
              <button
                type="button"
                className="status-pill status-pill--damaged"
                onClick={() => applyFiltersAndNavigate({ condition: 'damaged' })}
              >
                <span>Damaged ({damaged})</span>
              </button>
            </div>
          </div>
          <div className="chart-panel__footer">
            <button
              type="button"
              className="nav-link nav-link--ghost"
              onClick={() => applyFiltersAndNavigate({})}
            >
              Explore Full Archive
            </button>
          </div>
        </div>
      </section>

      <CollectionCurator movies={movies} loading={loading} />

      <section className="metrics-section">
        <div className="metrics-grid">
          <MetricCard
            title={loading ? '…' : totalMovies.toLocaleString()}
            caption="Motion Picture Vault"
            href="/movies"
            onClick={() => applyFilters({ series: 'movies' })}
          />
          <MetricCard
            title={loading ? '…' : totalSeries.toLocaleString()}
            caption="Series Vault"
            href="/movies"
            onClick={() => applyFilters({ series: 'series' })}
          />
          <MetricCard
            title={loading ? '…' : directors.toLocaleString()}
            caption="Directors Index"
            href="/directors"
          />
          <MetricCard
            title={loading ? '…' : sections.toLocaleString()}
            caption="Archive Wings"
            href="/sections"
          />
          <MetricCard
            title={loading ? '…' : formatChartData.total.toLocaleString()}
            caption="Media Formats"
            href="/movies"
          >
            <FormatMiniChart data={formatChartData} />
          </MetricCard>
        </div>
      </section>
    </main>
  );
};
