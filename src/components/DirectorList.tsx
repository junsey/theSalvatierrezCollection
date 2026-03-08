import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMovies } from '../context/MovieContext';
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
import {
  fetchAllDirectorProfiles,
  fetchDirectorFavoriteKeys,
  fetchDirectorFilmographyCountByPersonId,
  setDirectorFavorite
} from '../services/supabaseDirectors';
import { getFavoriteDirectorKeys, toggleFavoriteDirectorKey } from '../services/directorFavorites';

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
  const { tmdbEnrichmentEnabled } = useMovies();
  const collator = useMemo(() => new Intl.Collator('es', { sensitivity: 'base' }), []);
  const directorOverrides = useMemo(() => buildDirectorOverrideMap(movies), [movies]);
  const [supabaseProfiles, setSupabaseProfiles] = useState<
    Record<string, { profileUrl?: string; tmdbId?: number | null }>
  >({});
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
          const supabaseId = supabaseProfiles[normalizedName]?.tmdbId ?? null;
          const tmdbId = overrideId ?? supabaseId ?? undefined;
          const key = buildDirectorKey(name, tmdbId);
          const mapKey = normalizedName;

          if (!map.has(mapKey)) {
            map.set(mapKey, {
              key,
              name: name.trim(),
              normalizedName,
              tmdbId: tmdbId ?? undefined,
              worksCount: 0
            });
          }
          const entry = map.get(mapKey)!;
          const workKey = getWorkKey(movie);
          const workKeys = worksByDirector.get(mapKey) ?? new Set<string>();
          if (!worksByDirector.has(mapKey)) {
            worksByDirector.set(mapKey, workKeys);
          }
          if (!workKeys.has(workKey)) {
            entry.worksCount += 1;
            workKeys.add(workKey);
          }
        });
    });

    return Array.from(map.values()).sort((a, b) => collator.compare(a.name, b.name));
  }, [collator, directorOverrides, movies, supabaseProfiles]);
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
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(() => new Set());
  const [favoriteHint, setFavoriteHint] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadFavoriteKeys() {
      try {
        const remoteKeys = await fetchDirectorFavoriteKeys();
        if (!active) return;
        if (remoteKeys.length > 0) {
          setFavoriteKeys(new Set(remoteKeys));
          return;
        }
      } catch (error) {
        console.warn('No se pudieron cargar favoritos desde Supabase', error);
      }

      if (!active) return;
      setFavoriteKeys(new Set(getFavoriteDirectorKeys()));
    }

    async function loadSupabaseProfiles() {
      try {
        const map = await fetchAllDirectorProfiles();
        if (!active) return;
        setSupabaseProfiles(map);
      } catch (error) {
        console.warn('No se pudieron cargar retratos desde Supabase', error);
      }
    }
    if (directors.length > 0) {
      loadSupabaseProfiles();
      loadFavoriteKeys();
    }
    return () => {
      active = false;
    };
  }, [directors.length]);

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

      if (!tmdbEnrichmentEnabled) {
        const mergedProfiles: DirectorListProfile[] = [...initialProfiles];
        directors
          .filter((director) => missing.includes(director.key))
          .forEach((director) => {
            mergedProfiles.push({
              key: director.key,
              name: director.name,
              displayName: director.name,
              tmdbId: director.tmdbId ?? null,
              profileUrl: null,
              worksCount: director.worksCount,
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
  }, [collator, directors, directorOverrides, tmdbEnrichmentEnabled]);

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
              const supabaseTotal = await fetchDirectorFilmographyCountByPersonId(profile.tmdbId);
              if (supabaseTotal != null) {
                total = supabaseTotal;
                directedCount = supabaseTotal;
                createdCount = 0;
                tmdbTotals.set(profile.tmdbId, supabaseTotal);
              } else if (tmdbEnrichmentEnabled) {
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
  }, [profiles, tmdbEnrichmentEnabled]);

  const uniqueProfiles = useMemo(() => {
    const map = new Map<string, DirectorListProfile>();
    profiles.forEach((profile) => {
      if (!map.has(profile.key)) {
        map.set(profile.key, profile);
      }
    });
    return Array.from(map.values());
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = uniqueProfiles.filter((director) => {
      const label = (director.displayName || director.name || '').trim();
      const upper = label.toUpperCase();
      const lower = label.toLowerCase();

      const matchesLetter = letterFilter ? upper.startsWith(letterFilter) : true;
      const matchesSearch = normalizedSearch ? lower.includes(normalizedSearch) : true;

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
  }, [letterFilter, searchTerm, uniqueProfiles, coverage, orderBy, collator]);

  const getProgressClass = (owned: number, total: number | null) => {
    if (!total || total <= 0) return 'director-list-card--neutral';
    const ratio = owned / total;
    if (ratio >= 1) return 'director-list-card--complete';
    if (ratio >= 0.75) return 'director-list-card--strong';
    if (ratio >= 0.5) return 'director-list-card--soft';
    return 'director-list-card--neutral';
  };

  const isCompleteDirector = (owned: number, total: number | null) => Boolean(total && total > 0 && owned >= total);

  const favoriteProfiles = useMemo(
    () =>
      filteredProfiles.filter((director) => {
        if (!favoriteKeys.has(director.key)) return false;
        const stats = coverage[director.key];
        const owned = stats?.owned ?? director.worksCount;
        const total = stats?.total ?? null;
        return isCompleteDirector(owned, total);
      }),
    [filteredProfiles, favoriteKeys, coverage]
  );

  const handleFavoriteToggle = async (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    directorKey: string,
    directorName: string,
    directorTmdbId: number | null | undefined,
    shouldBeFavorite: boolean
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (shouldBeFavorite) {
        next.add(directorKey);
      } else {
        next.delete(directorKey);
      }
      return next;
    });
    setFavoriteHint(null);
    toggleFavoriteDirectorKey(directorKey, shouldBeFavorite);

    try {
      await setDirectorFavorite({
        directorKey,
        directorName,
        tmdbId: directorTmdbId,
        isFavorite: shouldBeFavorite
      });
    } catch (error) {
      console.warn('No se pudo guardar favorito en Supabase', error);
      setFavoriteHint('No se pudo guardar el favorito en la base de datos. Reintentá en unos segundos.');
      setFavoriteKeys((prev) => {
        const next = new Set(prev);
        if (shouldBeFavorite) {
          next.delete(directorKey);
        } else {
          next.add(directorKey);
        }
        return next;
      });
      toggleFavoriteDirectorKey(directorKey, !shouldBeFavorite);
    }
  };

  const handleFavoriteKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    directorKey: string,
    directorName: string,
    directorTmdbId: number | null | undefined,
    shouldBeFavorite: boolean
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      void handleFavoriteToggle(event, directorKey, directorName, directorTmdbId, shouldBeFavorite);
    }
  };

  const handleBlockedFavoriteAttempt = (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    name: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setFavoriteHint(`Solo puedes marcar a ${name} como favorito cuando completes su filmografía.`);
  };

  if (loading) {
    const skeletonCards = Array.from({ length: 12 }, (_, idx) => idx);
    return (
      <div className="director-grid">
        {skeletonCards.map((idx) => (
          <div key={idx} className="director-list-card director-list-card--skeleton" aria-hidden>
            <span className="director-list-card__badge skeleton" />
            <div className="director-list-card__thumb skeleton" />
            <span className="director-list-card__name skeleton" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="muted">{error}</p>;
  }

  return (
    <>
      {(availableLetters.length > 1 || profiles.length > 0) && (
        <div className="director-toolbar">
          <div className="director-toolbar__inputs">
            <label className="director-toolbar__field director-toolbar__field--grow">
              <span className="director-toolbar__label">Buscar director</span>
              <input
                type="search"
                placeholder="Nombre del director"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
            {availableLetters.length > 1 && (
              <label className="director-toolbar__field">
                <span className="director-toolbar__label">Letra</span>
                <select
                  value={letterFilter ?? ''}
                  onChange={(e) => setLetterFilter(e.target.value || null)}
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
            <label className="director-toolbar__field">
              <span className="director-toolbar__label">Orden</span>
              <select value={orderBy} onChange={(e) => setOrderBy(e.target.value as 'alpha' | 'owned')}>
                <option value="alpha">A–Z</option>
                <option value="owned">Colección</option>
              </select>
            </label>
          </div>
          <div className="director-toolbar__status">
            <span>Mostrando {filteredProfiles.length} directores</span>
            {(letterFilter || orderBy) && (
              <span className="director-toolbar__status-meta">
                {letterFilter ? `Letra: ${letterFilter}` : 'Letra: Todas'} ·{' '}
                {orderBy === 'alpha' ? 'Orden: A–Z' : 'Orden: Colección'}
              </span>
            )}
            {favoriteHint && <span className="director-toolbar__status-meta">{favoriteHint}</span>}
          </div>
        </div>
      )}
      {favoriteProfiles.length > 0 && (
        <section className="director-subsection">
          <div className="director-subsection__header">
            <h2>Directores favoritos</h2>
            <span className="muted">Solo directores completados y marcados como favoritos</span>
          </div>
          <div className="director-grid">
            {favoriteProfiles.map((director) => {
              const key = director.key;
              const stats = coverage[key];
              const owned = stats?.owned ?? director.worksCount;
              const total = stats?.total ?? null;
              const label = total ? `${owned} / ${total}` : `${owned} / —`;
              const supabaseKey =
                director.tmdbId != null
                  ? `tmdb-${director.tmdbId}`
                  : normalizeDirectorName(director.displayName || director.name);
              const supabasePortrait =
                supabaseProfiles[supabaseKey]?.profileUrl ??
                supabaseProfiles[(director.displayName || director.name).toLowerCase()]?.profileUrl;

              return (
                <Link
                  to={`/directors/${encodeURIComponent(director.displayName || director.name)}`}
                  className="director-list-card director-list-card--complete"
                  key={`favorite-${director.key}`}
                >
                  <span className="director-list-card__badge" title="Películas en tu colección / filmografía total">
                    🎬 {label}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="director-list-card__favorite is-active"
                    onClick={(event) =>
                      void handleFavoriteToggle(
                        event,
                        director.key,
                        director.displayName || director.name,
                        director.tmdbId,
                        false
                      )
                    }
                    onKeyDown={(event) =>
                      handleFavoriteKeyDown(
                        event,
                        director.key,
                        director.displayName || director.name,
                        director.tmdbId,
                        false
                      )
                    }
                    aria-label={`Quitar a ${director.displayName || director.name} de favoritos`}
                    title="Quitar de favoritos"
                  >
                    ★
                  </span>
                  <div
                    className="director-list-card__thumb"
                    style={{ backgroundImage: `url(${supabasePortrait ?? director.profileUrl ?? FALLBACK_PORTRAIT})` }}
                    aria-hidden
                  />
                  <strong className="director-list-card__name">{director.displayName || director.name}</strong>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      <div className="director-grid">
        {letterFilter && (
          <div className="director-grid__letter" aria-hidden>
            {letterFilter}
          </div>
        )}
        {filteredProfiles.map((director) => {
          const key = director.key;
          const stats = coverage[key];
          const owned = stats?.owned ?? director.worksCount;
          const total = stats?.total ?? null;
          const progressClass = getProgressClass(owned, total);
          const canFavorite = isCompleteDirector(owned, total);
          const isFavorite = favoriteKeys.has(director.key);
          const label = total ? `${owned} / ${total}` : `${owned} / —`;
          const supabaseKey =
            director.tmdbId != null ? `tmdb-${director.tmdbId}` : normalizeDirectorName(director.displayName || director.name);
          const supabasePortrait =
            supabaseProfiles[supabaseKey]?.profileUrl ??
            supabaseProfiles[(director.displayName || director.name).toLowerCase()]?.profileUrl;

          return (
            <Link
              to={`/directors/${encodeURIComponent(director.displayName || director.name)}`}
              className={['director-list-card', progressClass].join(' ')}
              key={director.key}
            >
              <span
                className="director-list-card__badge"
                title="Películas en tu colección / filmografía total"
              >
                🎬 {label}
              </span>
              <span
                role="button"
                tabIndex={canFavorite ? 0 : -1}
                aria-disabled={!canFavorite}
                className={`director-list-card__favorite ${isFavorite ? 'is-active' : ''} ${
                  canFavorite ? '' : 'is-disabled'
                }`}
                onClick={(event) => {
                  if (!canFavorite) {
                    handleBlockedFavoriteAttempt(event, director.displayName || director.name);
                    return;
                  }
                  void handleFavoriteToggle(
                    event,
                    director.key,
                    director.displayName || director.name,
                    director.tmdbId,
                    !isFavorite
                  );
                }}
                onKeyDown={(event) => {
                  if (!canFavorite) {
                    if (event.key === 'Enter' || event.key === ' ') {
                      handleBlockedFavoriteAttempt(event, director.displayName || director.name);
                    }
                    return;
                  }
                  handleFavoriteKeyDown(
                    event,
                    director.key,
                    director.displayName || director.name,
                    director.tmdbId,
                    !isFavorite
                  );
                }}
                aria-label={
                  canFavorite
                    ? `${isFavorite ? 'Quitar' : 'Agregar'} a ${director.displayName || director.name} ${
                        isFavorite ? 'de' : 'a'
                      } favoritos`
                    : `${director.displayName || director.name} aún no está completado`
                }
                title={
                  canFavorite
                    ? isFavorite
                      ? 'Quitar de favoritos'
                      : 'Agregar a favoritos'
                    : 'Disponible al completar filmografía'
                }
              >
                {isFavorite ? '★' : '☆'}
              </span>
              <div
                className="director-list-card__thumb"
                style={{ backgroundImage: `url(${supabasePortrait ?? director.profileUrl ?? FALLBACK_PORTRAIT})` }}
                aria-hidden
              />
              <strong className="director-list-card__name">{director.displayName || director.name}</strong>
            </Link>
          );
        })}
        {filteredProfiles.length === 0 && (
          <p className="muted" style={{ padding: '12px 0' }}>
            No hay directores que coincidan con los filtros aplicados.
          </p>
        )}
      </div>
    </>
  );
};
