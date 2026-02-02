import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MovieCard } from '../components/MovieCard';
import { useMovies } from '../context/MovieContext';
import { setStoredFilters } from '../services/localStorage';
import { MovieFilters, MovieRecord } from '../types/MovieRecord';

type DonutDatum = {
  label: string;
  value: number;
  color: string;
};

const baseArchiveFilters: MovieFilters = {
  query: '',
  seccion: null,
  genre: null,
  saga: null,
  series: 'all',
  seen: 'all',
  status: 'all',
  view: 'grid',
  sort: 'title-asc'
};

const StatDonut: React.FC<{ data: DonutDatum[]; total: number; label?: string }> = ({ data, total, label }) => {
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
        <span className="donut__label">{label ?? 'Relics'}</span>
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

const VaultCard: React.FC<{
  label: string;
  count: React.ReactNode;
  to: string;
  onClick?: () => void;
  icon: React.ReactNode;
  children?: React.ReactNode;
}> = ({ label, count, to, onClick, icon, children }) => (
  <Link to={to} className="vault-card" onClick={onClick}>
    <div className="vault-card__glow" />
    <div className="vault-card__header">
      <div className="vault-card__icon">{icon}</div>
      <div className="vault-card__meta">
        <span className="vault-card__label">{label}</span>
        <strong className="vault-card__count">{count}</strong>
      </div>
    </div>
    {children && <div className="vault-card__body">{children}</div>}
  </Link>
);

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
  if (!data.entries.length) return <p className="muted">No media formats recorded.</p>;

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
  onViewDetails: (movie: MovieRecord) => void;
  onMarkViewed: (movie: MovieRecord) => void;
  onAddNote: (movie: MovieRecord) => void;
}> = ({ movies, onViewDetails, onMarkViewed, onAddNote }) => {
  const slots = Array.from({ length: 5 }, (_, index) => movies[index] ?? null);

  return (
    <div className="treasure-grid">
      {slots.map((movie, index) =>
        movie ? (
          <MovieCard
            key={movie.id}
            movie={movie}
            onClick={() => onViewDetails(movie)}
            actions={[
              { label: 'View Details', to: `/admin/movies/${movie.id}/edit` },
              { label: 'Mark as Viewed', onClick: () => onMarkViewed(movie), disabled: movie.seen },
              { label: 'Add Note', onClick: () => onAddNote(movie) }
            ]}
          />
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
  const { visibleMovies: movies, loading, updateSeen, updateNote, notes } = useMovies();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

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

  const setArchiveFilters = (patch: Partial<MovieFilters>) => {
    setStoredFilters({ ...baseArchiveFilters, ...patch });
  };

  const applyArchiveFilters = (patch: Partial<MovieFilters>) => {
    setArchiveFilters(patch);
    navigate('/movies');
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyArchiveFilters({ query: searchQuery.trim() });
  };

  const handleAddNote = (movie: MovieRecord) => {
    const current = notes[movie.id] ?? '';
    const next = window.prompt('Add a note for this relic:', current);
    if (next === null) return;
    updateNote(movie.id, next.trim());
  };

  return (
    <main className="grand-hall">
      <section className="grand-hall__banner">
        <div className="banner__text">
          <p className="eyebrow">Archive Wings</p>
          <h1 className="banner__title">The Grand Archive</h1>
          <h2 className="banner__subtitle">Castillo Salvatiérrez</h2>
          <p className="lore">Explore, catalog and rediscover your film legacy.</p>
          <form className="archive-search" onSubmit={handleSearchSubmit}>
            <input
              className="archive-search__input"
              type="search"
              placeholder="Search the Archive by title, director, year or format..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </form>
          <div className="hero-actions">
            <Link
              className="nav-link nav-link--solid"
              to="/movies"
              onClick={() => setArchiveFilters({})}
            >
              Enter the Archive
            </Link>
            <Link className="nav-link nav-link--ghost" to="/surprise">
              Invoke Random Relic
            </Link>
          </div>
        </div>
      </section>

      <section className="treasure-section treasure-section--curator">
        <div className="treasure-section__header">
          <div>
            <h2>Curator's Selection</h2>
            <p className="treasure-section__subtitle">Five Relics of Highest Renown</p>
          </div>
          <Link
            className="nav-link nav-link--ghost"
            to="/movies"
            onClick={() => setArchiveFilters({})}
          >
            Explore Full Archive
          </Link>
        </div>
        {loading ? (
          <p className="muted">Summoning relics...</p>
        ) : (
          <>
            {topRated.length === 0 && <p className="muted">No ratings registered yet.</p>}
            <TreasuresGrid
              movies={topRated}
              onViewDetails={(movie) => navigate(`/admin/movies/${movie.id}/edit`)}
              onMarkViewed={(movie) => updateSeen(movie.id, true)}
              onAddNote={handleAddNote}
            />
          </>
        )}
      </section>

      <section className="vaults-section">
        <div className="vaults-section__header">
          <div>
            <p className="eyebrow">Archive Wings</p>
            <h2>Quick Access Vaults</h2>
            <p className="vaults-section__subtitle">Choose a wing to explore the archive.</p>
          </div>
        </div>
        <div className="vaults-grid">
          <VaultCard
            label="Motion Picture Vault"
            count={loading ? '...' : totalMovies.toLocaleString()}
            to="/movies"
            onClick={() => setArchiveFilters({ series: 'movies' })}
            icon={(
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M7 5l2-3m6 3l2-3" />
              </svg>
            )}
          />
          <VaultCard
            label="Series Vault"
            count={loading ? '...' : totalSeries.toLocaleString()}
            to="/movies"
            onClick={() => setArchiveFilters({ series: 'series' })}
            icon={(
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="4" width="6" height="16" rx="2" />
                <rect x="14" y="4" width="6" height="16" rx="2" />
              </svg>
            )}
          />
          <VaultCard
            label="Directors Index"
            count={loading ? '...' : directors.toLocaleString()}
            to="/directors"
            icon={(
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3" />
                <path d="M5 20c1.8-3.5 11.2-3.5 14 0" />
              </svg>
            )}
          />
          <VaultCard
            label="Media Formats"
            count={loading ? '...' : formatChartData.total.toLocaleString()}
            to="/movies"
            onClick={() => setArchiveFilters({})}
            icon={(
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16v12H4z" />
                <circle cx="9" cy="12" r="2" />
                <circle cx="15" cy="12" r="2" />
              </svg>
            )}
          >
            <FormatMiniChart data={formatChartData} />
          </VaultCard>
        </div>
      </section>

      <section className="status-section">
        <div className="status-section__header">
          <div>
            <p className="eyebrow">Archive Status</p>
            <h2>Archive Status</h2>
            <p className="status-section__subtitle">Relics Under Custody</p>
          </div>
          <Link
            className="nav-link nav-link--ghost"
            to="/movies"
            onClick={() => setArchiveFilters({})}
          >
            Explore Full Archive
          </Link>
        </div>
        <div className="status-section__grid">
          <div className="chart-panel">
            <header className="chart-panel__header">
              <div>
                <p className="eyebrow">Relics Under Custody</p>
                <h3>Relics Under Custody</h3>
              </div>
              <Link
                to="/movies"
                className="chart-total"
                onClick={() => setArchiveFilters({})}
              >
                <span className="chart-total__number">{movies.length.toLocaleString()}</span>
                <span className="chart-total__label">relics</span>
              </Link>
            </header>
            <div className="chart-panel__body">
              <Link
                to="/movies"
                className="donut-link"
                onClick={() => setArchiveFilters({})}
              >
                <StatDonut data={watchChart} total={movies.length} label="Relics" />
              </Link>
              <div className="chart-panel__legend">
                <button
                  type="button"
                  className="status-pill status-pill--watched"
                  onClick={() => applyArchiveFilters({ seen: 'seen', status: 'all' })}
                >
                  <span>Viewed</span>
                  <strong>{watchedCount}</strong>
                </button>
                <button
                  type="button"
                  className="status-pill status-pill--unwatched"
                  onClick={() => applyArchiveFilters({ seen: 'unseen', status: 'all' })}
                >
                  <span>Unviewed</span>
                  <strong>{unseenCount}</strong>
                </button>
                <button
                  type="button"
                  className="status-pill status-pill--untested"
                  onClick={() => applyArchiveFilters({ seen: 'unseen', status: 'untested' })}
                >
                  <span>Unverified</span>
                  <strong>{untestedCount}</strong>
                </button>
                <button
                  type="button"
                  className="status-pill status-pill--deposit"
                  onClick={() => applyArchiveFilters({ status: 'deposit' })}
                >
                  <span>In Deposit</span>
                  <strong>{depositCount}</strong>
                </button>
                <button
                  type="button"
                  className="status-pill status-pill--damaged"
                  onClick={() => applyArchiveFilters({ status: 'damaged' })}
                >
                  <span>Damaged</span>
                  <strong>{damaged}</strong>
                </button>
              </div>
            </div>
          </div>
          <div className="status-section__metrics">
            <MetricCard
              title={loading ? '...' : sections.toLocaleString()}
              caption="Archive Wings"
              href="/sections"
            />
          </div>
        </div>
      </section>
    </main>
  );
};
