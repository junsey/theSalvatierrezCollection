import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DirectorProfile,
  buildDirectorProfiles,
  getPersonDirectedMovies
} from '../services/tmdbPeopleService';
import { MovieRecord } from '../types/MovieRecord';
import { buildDirectorOverrideMap, normalizeDirectorName, splitDirectors } from '../services/directors';
import {
  CACHE_VERSION,
  DirectorProfilesCache,
  getCachedProfilesForKeys,
  loadDirectorCache,
  saveDirectorCache
} from '../lib/directorCache';

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

const buildDirectorKey = (name: string, tmdbId?: number | null) =>
  Number.isFinite(tmdbId) ? `tmdb-${tmdbId}` : `name-${normalizeDirectorName(name)}`;

const getOverrideKey = (name: string, overrides: Map<string, number>) =>
  buildDirectorKey(name, overrides.get(normalizeDirectorName(name)));

const getWorkKey = (movie: MovieRecord) => {
  const mediaType = movie.tmdbType ?? (movie.series ? 'tv' : 'movie');
  const normalizedTitle = normalizeTitle(movie.title);
  const isSeriesEntry = mediaType === 'tv' || movie.series || movie.season != null;

  if (isSeriesEntry) {
    // Para series, colapsa múltiples temporadas bajo la misma clave de título.
    return `series-${normalizedTitle}`;
  }

  const base = movie.tmdbId ? `tmdb-${movie.tmdbId}` : `title-${normalizedTitle}`;
  return `${base}:${mediaType}`;
};

type DirectorListProfile = DirectorProfile & {
  key: string;
  worksCount: number;
  totalWorksDirected?: number | null;
  totalWorksCreated?: number | null;
};

export const DirectorList: React.FC<{ movies: MovieRecord[] }> = ({ movies }) => {
  const collator = useMemo(() => new Intl.Collator('es', { sensitivity: 'base' }), []);
  const directorOverrides = useMemo(() => buildDirectorOverrideMap(movies), [movies]);
  const directors = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        normalizedName: string;
        tmdbId?: number;
        worksCount: number;
      }
    >();
    const worksByDirector = new Map<string, Set<string>>();

    movies.forEach((movie) => {
      splitDirectors(movie.director)
        .filter(Boolean)
        .forEach((name) => {
          const normalizedName = normalizeDirectorName(name);
          const overrideId = directorOverrides.get(normalizedName);
          const key = buildDirectorKey(name, overrideId);
          if (!map.has(key)) {
            map.set(key, {
              key,
              name: name.trim(),
              normalizedName,
              tmdbId: overrideId,
              worksCount: 0
            });
          }
          const entry = map.get(key)!;
          const workKey = getWorkKey(movie);
          const workKeys = worksByDirector.get(key) ?? new Set<string>();
          if (!worksByDirector.has(key)) {
            worksByDirector.set(key, workKeys);
          }
          if (!workKeys.has(workKey)) {
            entry.worksCount += 1;
            workKeys.add(workKey);
          }
        });
    });

    return Array.from(map.values()).sort((a, b) => collator.compare(a.name, b.name));
  }, [collator, directorOverrides, movies]);
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    directors.forEach((director) => {
      const first = director.name.trim()[0];
      if (first) letters.add(first.toUpperCase());
    });
    return Array.from(letters).sort();
  }, [directors]);

  const [profiles, setProfiles] = useState<DirectorListProfile[]>([]);
  const totalsCache = useRef<Map<number, number>>(new Map());
  const [coverage, setCoverage] = useState<Record<string, { owned: number; total: number | null }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState<'alpha' | 'owned'>('alpha');

  const getTotalFromEntry = (entry?: {
    totalWorksDirected?: number | null;
    totalWorksCreated?: number | null;
  }) => {
    if (!entry) return null;
    const directed = entry.totalWorksDirected;
    const created = entry.totalWorksCreated;
    if (directed == null && created == null) return null;
    return (directed ?? 0) + (created ?? 0);
  };

  useEffect(() => {
    let active = true;

    async function hydrate() {
      if (directors.length === 0) {
        setProfiles([]);
        setProgress(null);
        return;
      }

      setLoading(true);
      setError(null);

      const cache = loadDirectorCache();
      const directorKeys = directors.map((director) => director.key);
      const { found, missing } = getCachedProfilesForKeys(directorKeys, cache);

      const initialProfiles: DirectorListProfile[] = [];
      const cachedCoverage: Record<string, { owned: number; total: number | null }> = {};

      directors.forEach((director) => {
        const cached = found.get(director.key);
        if (cached) {
          const cachedTotal = getTotalFromEntry(cached);
          const ownedCount = director.worksCount || cached.worksCountOwned || 0;

          initialProfiles.push({
            key: director.key,
            name: cached.name,
            displayName: cached.displayName ?? cached.name,
            tmdbId: cached.tmdbId ?? null,
            profileUrl: cached.profileUrl ?? null,
            worksCount: ownedCount,
            totalWorksDirected: cached.totalWorksDirected ?? null,
            totalWorksCreated: cached.totalWorksCreated ?? null
          });

          if (cachedTotal != null) {
            cachedCoverage[director.key] = { owned: ownedCount, total: cachedTotal };
          }
        }
      });

      const sortedInitial = [...initialProfiles].sort((a, b) =>
        collator.compare(a.displayName || a.name, b.displayName || b.name)
      );
      setProfiles(sortedInitial);
      if (Object.keys(cachedCoverage).length > 0) {
        setCoverage((prev) => ({ ...cachedCoverage, ...prev }));
      }
      setProgress({ current: initialProfiles.length, total: directors.length });

      if (missing.length === 0) {
        const nextCache: DirectorProfilesCache = {
          version: CACHE_VERSION,
          directors: { ...(cache?.directors || {}) }
        };
        const now = new Date().toISOString();

        sortedInitial.forEach((profile) => {
          nextCache.directors[profile.key] = {
            key: profile.key,
            name: profile.name,
            displayName: profile.displayName,
            tmdbId: profile.tmdbId ?? undefined,
            profileUrl: profile.profileUrl ?? undefined,
            worksCountOwned: profile.worksCount,
            totalWorksDirected: profile.totalWorksDirected ?? null,
            totalWorksCreated: profile.totalWorksCreated ?? null,
            updatedAt: now
          };
        });

        saveDirectorCache(nextCache);
        setLoading(false);
        setProgress(null);
        return;
      }

      try {
        const missingNames = directors
          .filter((director) => missing.includes(director.key))
          .map((director) => director.name);

        const enrichedMissing = await buildDirectorProfiles(missingNames, {
          overrides: directorOverrides,
          onProgress: (current, total) => {
            if (!active) return;
            const base = initialProfiles.length;
            setProgress({ current: base + current, total: directors.length });
          }
        });

        if (!active) return;

        const mergedProfiles: DirectorListProfile[] = [...initialProfiles];

        enrichedMissing.forEach((profile) => {
          const dir = directors.find((director) => director.name === profile.name);
          if (!dir) return;

          mergedProfiles.push({
            ...profile,
            key: dir.key,
            worksCount: dir.worksCount,
            totalWorksDirected: null,
            totalWorksCreated: null
          });
        });

        const sorted = [...mergedProfiles].sort((a, b) =>
          collator.compare(a.displayName || a.name, b.displayName || b.name)
        );
        setProfiles(sorted);
        setLoading(false);
        setProgress(null);

        const nextCache: DirectorProfilesCache = {
          version: CACHE_VERSION,
          directors: { ...(cache?.directors || {}) }
        };
        const now = new Date().toISOString();

        sorted.forEach((profile) => {
          nextCache.directors[profile.key] = {
            key: profile.key,
            name: profile.name,
            displayName: profile.displayName,
            tmdbId: profile.tmdbId ?? undefined,
            profileUrl: profile.profileUrl ?? undefined,
            worksCountOwned: profile.worksCount,
            totalWorksDirected: profile.totalWorksDirected ?? null,
            totalWorksCreated: profile.totalWorksCreated ?? null,
            updatedAt: now
          };
        });

        saveDirectorCache(nextCache);
      } catch (err) {
        console.warn('No se pudieron cargar los directores', err);
        if (active) setError('No se pudieron cargar los directores.');
        if (active) setLoading(false);
      }
    }
    hydrate();
    return () => {
      active = false;
    };
  }, [collator, directors, directorOverrides]);

  useEffect(() => {
    let cancelled = false;
    async function loadCoverage() {
      if (profiles.length === 0) {
        setCoverage({});
        return;
      }

      const tmdbTotals = totalsCache.current;
      const cache = loadDirectorCache();

      const initialCoverage: Record<string, { owned: number; total: number | null }> = {};
      const pending: DirectorListProfile[] = [];

      profiles.forEach((profile) => {
        const cached = cache?.directors?.[profile.key];
        const ownedFromCache = cached?.worksCountOwned;
        const owned = profile.worksCount || ownedFromCache || 0;
        const totalFromCache = getTotalFromEntry(cached) ?? getTotalFromEntry(profile);
        if (totalFromCache != null) {
          initialCoverage[profile.key] = { owned, total: totalFromCache };
        } else {
          pending.push({ ...profile, worksCount: owned });
        }
      });

      if (!cancelled) {
        setCoverage(initialCoverage);
      }

      if (pending.length === 0) {
        return;
      }

      const rows = await Promise.all(
        pending.map(async (profile) => {
          const owned = profile.worksCount;

          let total: number | null = null;
          let directedCount: number | null = null;
          let createdCount: number | null = null;

          if (profile.tmdbId) {
            if (tmdbTotals.has(profile.tmdbId)) {
              total = tmdbTotals.get(profile.tmdbId) ?? null;
            } else {
              const filmography = await getPersonDirectedMovies(profile.tmdbId);
              directedCount = filmography.filter((item) =>
                (item.job ?? '').toLowerCase().includes('director')
              ).length;
              createdCount = filmography.filter((item) =>
                (item.job ?? '').toLowerCase().includes('creator')
              ).length;
              total = filmography.length;
              tmdbTotals.set(profile.tmdbId, total ?? 0);
            }
          }

          return { key: profile.key, owned, total, directedCount, createdCount, profile };
        })
      );

      if (cancelled) return;

      const rowsByKey = new Map(rows.map((row) => [row.key, row]));
      const nextCoverage: Record<string, { owned: number; total: number | null }> = {
        ...initialCoverage
      };

      const nextCache: DirectorProfilesCache = {
        version: CACHE_VERSION,
        directors: { ...(cache?.directors ?? {}) }
      };
      const now = new Date().toISOString();

      profiles.forEach((profile) => {
        const cached = cache?.directors?.[profile.key];
        const row = rowsByKey.get(profile.key);

        const directedCount =
          row?.directedCount ?? cached?.totalWorksDirected ?? profile.totalWorksDirected ?? null;
        const createdCount =
          row?.createdCount ?? cached?.totalWorksCreated ?? profile.totalWorksCreated ?? null;

        const total =
          row?.total ??
          initialCoverage[profile.key]?.total ??
          getTotalFromEntry({ totalWorksDirected: directedCount, totalWorksCreated: createdCount });

        const owned = profile.worksCount || cached?.worksCountOwned || 0;

        if (total != null) {
          nextCoverage[profile.key] = { owned, total };
        }

        nextCache.directors[profile.key] = {
          key: profile.key,
          name: profile.name,
          displayName: profile.displayName,
          tmdbId: profile.tmdbId ?? undefined,
          profileUrl: profile.profileUrl ?? undefined,
          worksCountOwned: owned,
          totalWorksDirected: directedCount,
          totalWorksCreated: createdCount,
          updatedAt: now
        };
      });

      setCoverage(nextCoverage);
      saveDirectorCache(nextCache);
    }

    loadCoverage();
    return () => {
      cancelled = true;
    };
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = profiles.filter((director) => {
      const name = (director.displayName || director.name).trim();
      const matchesLetter = letterFilter ? name.toUpperCase().startsWith(letterFilter) : true;
      const matchesSearch = normalizedSearch ? name.toLowerCase().includes(normalizedSearch) : true;
      return matchesLetter && matchesSearch;
    });

    const enriched = filtered.map((profile) => {
      const owned = coverage[profile.key]?.owned ?? profile.worksCount;
      return { profile, owned };
    });

    const sorted = [...enriched].sort((a, b) => {
      if (orderBy === 'owned') {
        const diff = b.owned - a.owned;
        if (diff !== 0) return diff;
      }
      return collator.compare(
        a.profile.displayName || a.profile.name,
        b.profile.displayName || b.profile.name
      );
    });

    return sorted.map((entry) => entry.profile);
  }, [letterFilter, searchTerm, profiles, coverage, orderBy, collator]);

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

  return (
    <>
      {(availableLetters.length > 1 || profiles.length > 0) && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
              rowGap: 10
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexGrow: 1, minWidth: 240 }}>
              <strong style={{ whiteSpace: 'nowrap' }}>Buscar:</strong>
              <input
                type="search"
                placeholder="Nombre del director"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            {availableLetters.length > 1 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ whiteSpace: 'nowrap' }}>Filtrar por letra:</strong>
                <select
                  value={letterFilter ?? ''}
                  onChange={(e) => setLetterFilter(e.target.value || null)}
                  style={{ minWidth: 120 }}
                >
                  <option value="">Todas</option>
                  {availableLetters.map((letter) => (
                    <option key={letter} value={letter}>
                      {letter}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong style={{ whiteSpace: 'nowrap' }}>Ordenar por:</strong>
              <select value={orderBy} onChange={(e) => setOrderBy(e.target.value as 'alpha' | 'owned')}>
                <option value="alpha">Alfabético (A-Z)</option>
                <option value="owned">Mayor cantidad en colección</option>
              </select>
            </label>
          </div>
        </div>
      )}
      <div className="director-grid">
        {filteredProfiles.map((director) => (
          <Link
            to={`/directors/${encodeURIComponent(director.displayName || director.name)}`}
            className="director-card"
            key={buildDirectorKey(director.name, director.tmdbId)}
          >
            {(() => {
              const key = director.key;
              const stats = coverage[key];
              const owned = stats?.owned ?? director.worksCount;
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
            No hay directores que coincidan con los filtros aplicados.
          </p>
        )}
      </div>
    </>
  );
};
