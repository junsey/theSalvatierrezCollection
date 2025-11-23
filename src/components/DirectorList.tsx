import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DirectorProfile,
  buildDirectorProfiles,
  getPersonDirectedMovies
} from '../services/tmdbPeopleService';
import { MovieRecord } from '../types/MovieRecord';
import { buildDirectorOverrideMap, normalizeDirectorName, splitDirectors } from '../services/directors';

const FALLBACK_PORTRAIT =
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=crop&w=400&q=80&sat=-100&blend=000000&blend-mode=multiply';

const normalizeTitle = (value: string) => {
  const lower = value.trim().toLowerCase();
  const stripped = lower
    .replace(/\btemporada\s*\d+\b/g, '')
    .replace(/\btemp\.?\s*\d+\b/g, '')
    .replace(/\bseason\s*\d+\b/g, '')
    .replace(/\bseas\.?\s*\d+\b/g, '')
    .replace(/\bt\s*\d+\b/g, '');
  return stripped.replace(/\s+/g, ' ').trim();
};

const getWorkKey = (movie: MovieRecord) => {
  const mediaType = movie.tmdbType ?? (movie.series ? 'tv' : 'movie');
  const base = movie.tmdbId ? `tmdb-${movie.tmdbId}` : `title-${normalizeTitle(movie.title)}`;
  return `${base}:${mediaType}`;
};

export const DirectorList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const collator = useMemo(() => new Intl.Collator('es', { sensitivity: 'base' }), []);
  const directorOverrides = useMemo(() => buildDirectorOverrideMap(movies), [movies]);
  const directorNames = useMemo(() => {
    const names = new Map<string, string>();
    movies.forEach((movie) => {
      splitDirectors(movie.director)
        .filter(Boolean)
        .forEach((name) => {
          const normalized = normalizeDirectorName(name);
          if (!names.has(normalized)) {
            names.set(normalized, name.trim());
          }
        });
    });
    return Array.from(names.values()).sort((a, b) => collator.compare(a, b));
  }, [collator, movies]);
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    directorNames.forEach((name) => {
      const first = name.trim()[0];
      if (first) letters.add(first.toUpperCase());
    });
    return Array.from(letters).sort();
  }, [directorNames]);

  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const workSeenByDirector = new Map<string, Set<string>>();

    movies.forEach((movie) => {
      const workKey = getWorkKey(movie);
      splitDirectors(movie.director).forEach((name) => {
        const directorKey = normalizeDirectorName(name);
        const seen = workSeenByDirector.get(directorKey) ?? new Set<string>();
        if (!seen.has(workKey)) {
          seen.add(workKey);
          workSeenByDirector.set(directorKey, seen);
          counts.set(directorKey, (counts.get(directorKey) ?? 0) + 1);
        }
      });
    });

    return counts;
  }, [movies]);

  const [profiles, setProfiles] = useState<DirectorProfile[]>([]);
  const uniqueProfiles = useMemo(() => {
    const map = new Map<string, DirectorProfile>();
    profiles.forEach((profile) => {
      const key = normalizeDirectorName(profile.name);
      if (!map.has(key)) {
        map.set(key, profile);
      }
    });
    return Array.from(map.values());
  }, [profiles]);
  const totalsCache = useRef<Map<number, number>>(new Map());
  const [coverage, setCoverage] = useState<Record<string, { owned: number; total: number | null }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [letterFilter, setLetterFilter] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      if (directorNames.length === 0) {
        setProfiles([]);
        setProgress(null);
        return;
      }
      setLoading(true);
      setError(null);
      setProgress({ current: 0, total: directorNames.length });
      try {
        const enriched = await buildDirectorProfiles(directorNames, {
          overrides: directorOverrides,
          onProgress: (current, total) => {
            if (!active) return;
            setProgress({ current, total });
          }
        });
        if (!active) return;
        const sorted = [...enriched].sort((a, b) =>
          collator.compare(a.displayName || a.name, b.displayName || b.name)
        );
        setProfiles(sorted);
        setProgress(null);
      } catch (err) {
        console.warn('No se pudieron cargar los directores', err);
        if (active) setError('No se pudieron cargar los directores.');
      } finally {
        if (active) setLoading(false);
      }
    }
    hydrate();
    return () => {
      active = false;
    };
  }, [collator, directorNames, directorOverrides]);

  useEffect(() => {
    let cancelled = false;
    async function loadCoverage() {
      if (uniqueProfiles.length === 0) {
        setCoverage({});
        return;
      }

      const tmdbTotals = totalsCache.current;
      const rows = await Promise.all(
        uniqueProfiles.map(async (profile) => {
          const key = normalizeDirectorName(profile.name);
          const owned = collectionCounts.get(key) ?? 0;

          let total: number | null = null;
          if (profile.tmdbId) {
            if (tmdbTotals.has(profile.tmdbId)) {
              total = tmdbTotals.get(profile.tmdbId) ?? null;
            } else {
              const filmography = await getPersonDirectedMovies(profile.tmdbId);
              total = filmography.length;
              tmdbTotals.set(profile.tmdbId, total);
            }
          }

          return { key, owned, total };
        })
      );

      if (cancelled) return;

      const nextCoverage: Record<string, { owned: number; total: number | null }> = {};
      rows.forEach(({ key, owned, total }) => {
        nextCoverage[key] = { owned, total };
      });
      setCoverage(nextCoverage);
    }

    loadCoverage();
    return () => {
      cancelled = true;
    };
  }, [uniqueProfiles, collectionCounts]);

  const getMedal = (owned: number, total: number | null) => {
    if (!total || total <= 0) return null;
    const ratio = owned / total;
    if (ratio >= 1) return 'gold';
    if (ratio > 0.75) return 'silver';
    if (ratio > 0.5) return 'bronze';
    return null;
  };

  if (loading) {
    return (
      <div className="panel" style={{ marginBottom: 12 }}>
        <p style={{ marginBottom: 8 }} className="muted">
          Cargando directores...
        </p>
        {progress && (
          <>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
            <div style={{ marginTop: 6, fontSize: '0.9em', color: 'var(--text-muted)' }}>
              {progress.current} de {progress.total}
            </div>
          </>
        )}
      </div>
    );
  }

  if (error) {
    return <p className="muted">{error}</p>;
  }

  const filteredProfiles = letterFilter
    ? uniqueProfiles.filter((director) =>
        (director.displayName || director.name)
          .trim()
          .toUpperCase()
          .startsWith(letterFilter)
      )
    : uniqueProfiles;

  return (
    <>
      {availableLetters.length > 1 && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <strong style={{ marginRight: 4 }}>Filtrar por letra:</strong>
            <button
              type="button"
              className={`button button--sm ${letterFilter === null ? 'is-primary' : 'is-ghost'}`}
              onClick={() => setLetterFilter(null)}
            >
              Todas
            </button>
            {availableLetters.map((letter) => (
              <button
                key={letter}
                type="button"
                className={`button button--sm ${letterFilter === letter ? 'is-primary' : 'is-ghost'}`}
                onClick={() => setLetterFilter(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="director-grid">
        {filteredProfiles.map((director) => (
          <Link
            to={`/directors/${encodeURIComponent(director.displayName || director.name)}`}
            className="director-card"
            key={normalizeDirectorName(director.name)}
          >
            {(() => {
              const key = normalizeDirectorName(director.name);
            const stats = coverage[key];
            const owned = stats?.owned ?? collectionCounts.get(key) ?? 0;
            const total = stats?.total ?? null;
            const medal = getMedal(owned, total);
            const label = total ? `${owned} de ${total}` : `${owned} en colección`;
            return (
              <span className="director-coverage" aria-label={`Películas en colección: ${label}`}>
                <span className="director-coverage__counts">
                  {owned}
                  <span className="director-coverage__divider">/</span>
                  {total ?? '—'}
                </span>
                {medal && (
                  <span
                    className={`director-coverage__medal director-coverage__medal--${medal}`}
                    aria-hidden
                  >
                    ★
                  </span>
                )}
              </span>
            );
          })()}
          <div
            className="director-thumb"
            style={{ backgroundImage: `url(${director.profileUrl || FALLBACK_PORTRAIT})` }}
            aria-hidden
          />
          <div className="section-meta">
            <strong className="section-title">{director.displayName || director.name}</strong>
            <small className="section-count">Ver perfil</small>
          </div>
          </Link>
        ))}
        {filteredProfiles.length === 0 && (
          <p className="muted" style={{ padding: '12px 0' }}>
            No hay directores para la letra seleccionada.
          </p>
        )}
      </div>
    </>
  );
};
