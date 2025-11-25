import { TMDB_BEARER, tmdbFetchJson, TMDB_API_KEY } from './tmdbApi';
import { CachedDirector, clearDirectorCache, loadDirectorCache, saveDirectorCache } from './localStorage';

const API_BASE = 'https://api.themoviedb.org/3';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const PERSON_CACHE_KEY = 'salvatierrez-tmdb-person-cache-v1';
const PERSON_SEARCH_CACHE_KEY = 'salvatierrez-tmdb-person-search-cache-v1';
const CREDITS_CACHE_KEY = 'salvatierrez-tmdb-person-credits-cache-v1';
const CONFIG_CACHE_KEY = 'salvatierrez-tmdb-person-img-config-v1';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 180;
const CACHE_LIMITS: Record<string, number> = {
  [PERSON_CACHE_KEY]: 150,
  [PERSON_SEARCH_CACHE_KEY]: 200,
  [CREDITS_CACHE_KEY]: 150,
  [CONFIG_CACHE_KEY]: 5
};

type PersonCacheEntry<T> = { fetchedAt: number; data: T };
type SearchCacheEntry = { id: number; name: string } | null;

type PersonDetails = {
  id: number;
  name: string;
  biography?: string | null;
  profilePath?: string | null;
  profileUrl?: string;
  placeOfBirth?: string | null;
  birthday?: string | null;
  deathday?: string | null;
  alsoKnownAs?: string[];
};

export type DirectedMovie = {
  id: number;
  title: string;
  year: number | null;
  posterUrl?: string;
  popularity?: number;
  mediaType?: 'movie' | 'tv';
  job?: string;
  releaseDate?: string | null;
  firstAirDate?: string | null;
};

export type DirectorProfile = {
  name: string;
  displayName: string;
  tmdbId: number | null;
  profileUrl?: string | null;
};

export type DirectorLookup = {
  name: string;
  tmdbId?: number | null;
};

type ConfigCache = { fetchedAt: number; baseUrl: string; size: string };

const personDetailsCache: Record<string, PersonCacheEntry<PersonDetails>> = loadCache<PersonDetails>(PERSON_CACHE_KEY);
const personSearchCache: Record<string, PersonCacheEntry<SearchCacheEntry>> = loadCache<SearchCacheEntry>(
  PERSON_SEARCH_CACHE_KEY
);
const personCreditsCache: Record<string, PersonCacheEntry<DirectedMovie[]>> = loadCache<DirectedMovie[]>(
  CREDITS_CACHE_KEY
);
let legacyCreditsCache: Record<string, PersonCacheEntry<DirectedMovie[]>> | null = null;

type CreditsPersistedEntry = PersonCacheEntry<DirectedMovie[]> & { id: string };
const CACHE_DB_NAME = 'salvatierrez-cache';
const CACHE_DB_VERSION = 1;
const PERSON_CREDITS_STORE = 'personCredits';

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

    request.onerror = () => resolve(null);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PERSON_CREDITS_STORE)) {
        db.createObjectStore(PERSON_CREDITS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
}

async function readPersistedCredits(cacheKey: string): Promise<PersonCacheEntry<DirectedMovie[]> | null> {
  const db = await openCacheDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PERSON_CREDITS_STORE, 'readonly');
      const store = tx.objectStore(PERSON_CREDITS_STORE);
      const request = store.get(cacheKey);

      request.onsuccess = () => {
        resolve((request.result as CreditsPersistedEntry | undefined) ?? null);
      };
      request.onerror = () => resolve(null);
    } catch (error) {
      console.warn('No se pudo leer la caché persistida de créditos de persona', error);
      resolve(null);
    }
  });
}

async function prunePersistedCredits(limit: number) {
  const db = await openCacheDb();
  if (!db || !limit) return;

  const readAll = () =>
    new Promise<CreditsPersistedEntry[]>((resolve) => {
      try {
        const tx = db.transaction(PERSON_CREDITS_STORE, 'readonly');
        const store = tx.objectStore(PERSON_CREDITS_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result as CreditsPersistedEntry[]) ?? []);
        request.onerror = () => resolve([]);
      } catch (error) {
        console.warn('No se pudo listar la caché de créditos persistida', error);
        resolve([]);
      }
    });

  const entries = await readAll();
  if (entries.length <= limit) return;

  const sorted = entries.sort((a, b) => (b?.fetchedAt ?? 0) - (a?.fetchedAt ?? 0));
  const toDelete = sorted.slice(limit);

  await Promise.all(
    toDelete.map(
      (entry) =>
        new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(PERSON_CREDITS_STORE, 'readwrite');
            const store = tx.objectStore(PERSON_CREDITS_STORE);
            const request = store.delete(entry.id);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
          } catch (error) {
            console.warn('No se pudo limpiar la caché de créditos persistida', error);
            resolve();
          }
        })
    )
  );
}

async function writePersistedCredits(
  cacheKey: string,
  entry: PersonCacheEntry<DirectedMovie[]>,
  limit: number
): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PERSON_CREDITS_STORE, 'readwrite');
      const store = tx.objectStore(PERSON_CREDITS_STORE);
      const request = store.put({ id: cacheKey, ...entry });
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch (error) {
      console.warn('No se pudo guardar la caché de créditos en IndexedDB', error);
      resolve();
    }
  });

  await prunePersistedCredits(limit);
}

function loadLegacyCredits(): Record<string, PersonCacheEntry<DirectedMovie[]>> {
  if (legacyCreditsCache) return legacyCreditsCache;
  legacyCreditsCache = loadCache<DirectedMovie[]>(CREDITS_CACHE_KEY);
  return legacyCreditsCache;
}

function loadCache<T>(key: string): Record<string, PersonCacheEntry<T>> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PersonCacheEntry<T>>;
  } catch (error) {
    console.warn('No se pudo leer la caché de personas TMDb', error);
    return {};
  }
}

function pruneCacheEntries<T>(
  payload: Record<string, PersonCacheEntry<T>>,
  limit: number
): Record<string, PersonCacheEntry<T>> {
  const entries = Object.entries(payload);
  if (entries.length <= limit) return payload;

  const sorted = entries.sort(([, a], [, b]) => (b?.fetchedAt ?? 0) - (a?.fetchedAt ?? 0));
  const trimmedEntries = sorted.slice(0, limit);
  const keepKeys = new Set(trimmedEntries.map(([key]) => key));

  Object.keys(payload).forEach((key) => {
    if (!keepKeys.has(key)) delete payload[key];
  });

  return Object.fromEntries(trimmedEntries);
}

function saveCache<T>(key: string, payload: Record<string, PersonCacheEntry<T>>) {
  if (typeof localStorage === 'undefined') return;
  const limit = CACHE_LIMITS[key];
  const boundedPayload = limit ? pruneCacheEntries(payload, limit) : payload;
  try {
    localStorage.setItem(key, JSON.stringify(boundedPayload));
  } catch (error) {
    console.warn('No se pudo guardar la caché de personas TMDb', error);

    if (limit && Object.keys(boundedPayload).length > 0) {
      const tighterLimit = Math.max(10, Math.floor(limit * 0.7));
      const pruned = pruneCacheEntries(payload, tighterLimit);
      try {
        localStorage.setItem(key, JSON.stringify(pruned));
        return;
      } catch (retryError) {
        console.warn('No se pudo guardar la caché de personas TMDb tras recortar', retryError);
      }
    }

    try {
      localStorage.removeItem(key);
    } catch (cleanupError) {
      console.warn('No se pudo limpiar la caché de personas TMDb tras un error de cuota', cleanupError);
    }
  }
}

function buildTmdbUrl(path: string, params?: Record<string, string | undefined | null>): string {
  const url = new URL(`${API_BASE}${path}`);
  if (TMDB_API_KEY) {
    url.searchParams.set('api_key', TMDB_API_KEY);
  }
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function isFresh(entry?: PersonCacheEntry<any>): boolean {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < SIX_MONTHS_MS;
}

const normalizeName = (value: string) => value.trim().toLowerCase();

const buildOverrideMap = (
  overrides?: Map<string, number | null> | Record<string, number | null | undefined>
): Map<string, number> => {
  if (!overrides) return new Map();

  const map = new Map<string, number>();
  const addEntry = (key: string, value?: number | null) => {
    if (value == null) return;
    if (!Number.isFinite(value)) return;
    map.set(normalizeName(key), value);
  };

  if (overrides instanceof Map) {
    overrides.forEach((value, key) => addEntry(key, value ?? null));
  } else {
    Object.entries(overrides).forEach(([key, value]) => addEntry(key, value ?? null));
  }

  return map;
};

async function getProfileBase(): Promise<{ baseUrl: string; size: string }> {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(CONFIG_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as ConfigCache;
        if (Date.now() - cached.fetchedAt < SIX_MONTHS_MS) {
          return { baseUrl: cached.baseUrl, size: cached.size };
        }
      }
    } catch (error) {
      console.warn('No se pudo leer la configuración de imágenes TMDb', error);
    }
  }

  const url = `${API_BASE}/configuration?api_key=${TMDB_API_KEY}`;
  try {
    const data = await tmdbFetchJson<{ images?: { secure_base_url?: string; profile_sizes?: string[] } }>(url);
    const baseUrl = data.images?.secure_base_url ?? 'https://image.tmdb.org/t/p/';
    const size = data.images?.profile_sizes?.[2] ?? 'w300';
    if (typeof localStorage !== 'undefined') {
      const payload: ConfigCache = { fetchedAt: Date.now(), baseUrl, size };
      localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(payload));
    }
    return { baseUrl, size };
  } catch (error) {
    console.warn('Fallo al obtener configuración TMDb, se usa fallback', error);
    return { baseUrl: 'https://image.tmdb.org/t/p/', size: 'w300' };
  }
}

function buildProfileUrl(base: { baseUrl: string; size: string }, path?: string | null): string | undefined {
  if (!path) return undefined;
  return `${base.baseUrl}${base.size}${path}`;
}

function parseYear(date?: string | null): number | null {
  if (!date) return null;
  const [yearStr] = date.split('-');
  const year = Number(yearStr);
  return Number.isFinite(year) ? year : null;
}

export async function getDirectorFromMovie(movieId: number): Promise<{ id: number; name: string }[]> {
  if (!TMDB_API_KEY && !TMDB_BEARER) return [];
  try {
    const url = buildTmdbUrl(`/movie/${movieId}/credits`, { language: 'es-ES' });
    const data = await tmdbFetchJson<{ crew?: { id: number; name: string; job: string }[] }>(url);
    const directors = (data.crew ?? []).filter((member) => member.job === 'Director');
    const seen = new Set<number>();
    return directors
      .filter((person) => {
        if (seen.has(person.id)) return false;
        seen.add(person.id);
        return true;
      })
      .map((person) => ({ id: person.id, name: person.name }));
  } catch (error) {
    console.warn('No se pudo obtener el director desde TMDb', error);
    return [];
  }
}

export async function searchPersonByName(name: string): Promise<{ id: number; name: string } | null> {
  if (!TMDB_API_KEY && !TMDB_BEARER) return null;
  const normalized = normalizeName(name);
  const cached = personSearchCache[normalized];
  if (isFresh(cached)) return cached.data;

  try {
    const url = buildTmdbUrl('/search/person', { query: name.trim(), language: 'es-ES' });
    const data = await tmdbFetchJson<{ results?: { id: number; name: string }[] }>(url);
    const match = data.results?.[0];
    const payload = match ? { id: match.id, name: match.name } : null;
    personSearchCache[normalized] = { fetchedAt: Date.now(), data: payload };
    saveCache(PERSON_SEARCH_CACHE_KEY, personSearchCache);
    return payload;
  } catch (error) {
    console.warn('No se pudo buscar el director en TMDb', error);
    return null;
  }
}

export async function getPersonDetails(personId: number): Promise<PersonDetails | null> {
  if (!TMDB_API_KEY && !TMDB_BEARER) return null;
  const cacheKey = String(personId);
  const cached = personDetailsCache[cacheKey];
  if (isFresh(cached)) return cached.data;

  const requestDetails = async (language: string) => {
    const url = buildTmdbUrl(`/person/${personId}`, { language });
    return tmdbFetchJson<{
      id: number;
      name: string;
      biography?: string | null;
      profile_path?: string | null;
      place_of_birth?: string | null;
      birthday?: string | null;
      deathday?: string | null;
      also_known_as?: string[];
    }>(url);
  };

  try {
    const profileBase = await getProfileBase();
    const primary = await requestDetails('es-ES');
    const needsFallback = !primary?.biography || primary.biography.trim() === '';
    const fallback = needsFallback ? await requestDetails('en-US') : null;
    const chosen = primary ?? fallback;

    if (!chosen) return null;

    const biography = needsFallback ? fallback?.biography ?? primary?.biography : primary?.biography;
    const profilePath = chosen.profile_path ?? primary?.profile_path ?? fallback?.profile_path;
    const payload: PersonDetails = {
      id: chosen.id,
      name: chosen.name,
      biography: biography ?? null,
      profilePath,
      profileUrl: buildProfileUrl(profileBase, profilePath),
      placeOfBirth: chosen.place_of_birth ?? primary?.place_of_birth ?? fallback?.place_of_birth,
      birthday: chosen.birthday ?? primary?.birthday ?? fallback?.birthday,
      deathday: chosen.deathday ?? primary?.deathday ?? fallback?.deathday,
      alsoKnownAs: chosen.also_known_as ?? primary?.also_known_as ?? fallback?.also_known_as
    };

    personDetailsCache[cacheKey] = { fetchedAt: Date.now(), data: payload };
    saveCache(PERSON_CACHE_KEY, personDetailsCache);
    return payload;
  } catch (error) {
    console.warn('No se pudo obtener el detalle de la persona', error);
    return null;
  }
}

const isFeatureLengthProduction = (item: {
  title?: string | null;
  name?: string | null;
  video?: boolean | null;
  genre_ids?: number[];
}) => {
  const title = (item.title ?? item.name ?? '').toLowerCase();
  const isMarkedVideo = item.video === true;
  const looksLikeShort = /\bshort\b|\bcorto\b/.test(title);

  return !isMarkedVideo && !looksLikeShort;
};

export async function getPersonDirectedMovies(personId: number): Promise<DirectedMovie[]> {
  if (!TMDB_API_KEY && !TMDB_BEARER) return [];
  const cacheKey = String(personId);
  const cached = personCreditsCache[cacheKey];
  if (isFresh(cached)) return cached.data;

  const persisted = await readPersistedCredits(cacheKey);
  if (persisted && isFresh(persisted)) {
    personCreditsCache[cacheKey] = persisted;
    saveCache(CREDITS_CACHE_KEY, personCreditsCache);
    return persisted.data;
  }

  const legacy = loadLegacyCredits()[cacheKey];
  if (legacy && isFresh(legacy)) {
    personCreditsCache[cacheKey] = legacy;
    saveCache(CREDITS_CACHE_KEY, personCreditsCache);
    void writePersistedCredits(cacheKey, legacy, CACHE_LIMITS[CREDITS_CACHE_KEY]);
    return legacy.data;
  }

  try {
    const url = buildTmdbUrl(`/person/${personId}/combined_credits`, { language: 'es-ES' });
    const data = await tmdbFetchJson<{
      crew?: {
        id: number;
        media_type?: string;
        title?: string;
        name?: string;
        job?: string;
        release_date?: string | null;
        first_air_date?: string | null;
        poster_path?: string | null;
        popularity?: number;
        video?: boolean | null;
        genre_ids?: number[];
      }[];
    }>(url);

    const directedMovies = new Map<number, DirectedMovie>();

    (data.crew ?? [])
      .filter((item) => {
        if (item.media_type !== 'movie' && item.media_type !== 'tv') return false;
        const job = item.job?.trim().toLowerCase();
        const isPrimaryDirector = job === 'director' || job === 'series director' || job === 'director de la serie';
        const isSeriesCreator = job === 'creator' || job === 'series creator';
        if (!isPrimaryDirector && !isSeriesCreator) return false;
        if (item.media_type === 'movie' && !isFeatureLengthProduction(item)) return false;
        return true;
      })
      .forEach((item) => {
        const title = item.title ?? item.name ?? 'Producción sin título';
        const releaseDate = item.release_date ?? null;
        const firstAirDate = item.first_air_date ?? null;
        const year = item.media_type === 'tv' ? parseYear(firstAirDate) : parseYear(releaseDate);
        const entry: DirectedMovie = {
          id: item.id,
          title,
          year,
          posterUrl: item.poster_path ? `${POSTER_BASE_URL}${item.poster_path}` : undefined,
          popularity: item.popularity,
          mediaType: item.media_type === 'tv' ? 'tv' : 'movie',
          job: item.job,
          releaseDate,
          firstAirDate
        };

        directedMovies.set(item.id, entry);
      });

    const sorted = Array.from(directedMovies.values()).sort((a, b) => {
      const yearA = a.year ?? Number.POSITIVE_INFINITY;
      const yearB = b.year ?? Number.POSITIVE_INFINITY;
      const byYear = yearA - yearB;
      if (byYear !== 0) return byYear;
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    });

    const entry: PersonCacheEntry<DirectedMovie[]> = { fetchedAt: Date.now(), data: sorted };
    personCreditsCache[cacheKey] = entry;
    void writePersistedCredits(cacheKey, entry, CACHE_LIMITS[CREDITS_CACHE_KEY]);
    saveCache(CREDITS_CACHE_KEY, personCreditsCache);
    return sorted;
  } catch (error) {
    console.warn('No se pudo obtener la filmografía del director', error);
    return [];
  }
}

export async function fetchDirectorFromTMDb(
  director: DirectorLookup
): Promise<{ person: PersonDetails | null; credits: DirectedMovie[]; resolvedName: string; tmdbId: number | null } | null> {
  if (!TMDB_API_KEY) return null;

  const loadById = async (id: number) => {
    const [person, credits] = await Promise.all([getPersonDetails(id), getPersonDirectedMovies(id)]);
    return {
      person,
      credits,
      resolvedName: person?.name ?? director.name,
      tmdbId: id
    };
  };

  try {
    if (director.tmdbId) {
      return await loadById(director.tmdbId);
    }

    const match = await searchPersonByName(director.name);
    if (!match) return null;

    const [person, credits] = await Promise.all([getPersonDetails(match.id), getPersonDirectedMovies(match.id)]);
    return {
      person,
      credits,
      resolvedName: person?.name ?? match.name ?? director.name,
      tmdbId: match.id
    };
  } catch (error) {
    console.warn('No se pudo obtener al director desde TMDb', director.name, error);
    return null;
  }
}

export async function buildDirectorProfiles(
  names: string[],
  options?: {
    forceRefresh?: boolean;
    onProgress?: (current: number, total: number) => void;
    overrides?: Map<string, number | null> | Record<string, number | null | undefined>;
  }
): Promise<DirectorProfile[]> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (unique.length === 0) return [];
  if (!TMDB_API_KEY) {
    return unique.map((name) => ({ name, displayName: name, tmdbId: null, profileUrl: null }));
  }

  const total = unique.length;
  let completed = 0;
  const report = () => options?.onProgress?.(completed, total);

  const overrideMap = buildOverrideMap(options?.overrides);

  const cachedPayload = options?.forceRefresh ? null : loadDirectorCache();
  const cachedMap = new Map<string, CachedDirector>();
  cachedPayload?.directors.forEach((director) => {
    cachedMap.set(normalizeName(director.name), director);
  });

  const missing: string[] = options?.forceRefresh ? [...unique] : [];
  const now = Date.now();

  if (!options?.forceRefresh) {
    for (const name of unique) {
      const cached = cachedMap.get(normalizeName(name));
      const overrideId = overrideMap.get(normalizeName(name));
      const cacheMatchesOverride = overrideId === undefined || cached?.tmdbId === overrideId;
      if (cached && cacheMatchesOverride) {
        completed += 1;
      } else {
        missing.push(name);
      }
    }
  }

  report();

  const fetched: CachedDirector[] = [];
  for (const target of missing) {
    try {
      let profileUrl: string | undefined;
      let resolvedName = target;
      let tmdbId: number | null = null;
      const overrideTmdbId = overrideMap.get(normalizeName(target));

      if (overrideTmdbId !== undefined) {
        tmdbId = overrideTmdbId;
        const details = await getPersonDetails(overrideTmdbId);
        profileUrl = details?.profileUrl ?? undefined;
        resolvedName = details?.name ?? resolvedName;
      } else {
        const search = await searchPersonByName(target);
        resolvedName = search?.name ?? target;
        tmdbId = search?.id ?? null;

        if (search?.id) {
          const details = await getPersonDetails(search.id);
          profileUrl = details?.profileUrl ?? undefined;
          resolvedName = details?.name ?? resolvedName;
        }
      }

      fetched.push({
        name: target,
        resolvedName,
        tmdbId,
        profileUrl: profileUrl ?? null,
        fetchedAt: now
      });
    } catch (error) {
      console.warn('No se pudo enriquecer al director', target, error);
      fetched.push({ name: target, resolvedName: target, tmdbId: null, profileUrl: null, fetchedAt: now });
    }

    completed += 1;
    report();
  }

  const mergedMap = new Map<string, CachedDirector>();
  const existing = cachedPayload?.directors ?? [];
  existing.forEach((entry) => {
    if (!options?.forceRefresh || missing.includes(entry.name)) {
      mergedMap.set(normalizeName(entry.name), entry);
    }
  });
  fetched.forEach((entry) => mergedMap.set(normalizeName(entry.name), entry));

  const mergedList = unique.map((name) => {
    const entry = mergedMap.get(normalizeName(name)) ?? {
      name,
      resolvedName: name,
      tmdbId: overrideMap.get(normalizeName(name)) ?? null,
      profileUrl: null,
      fetchedAt: now
    };
    return entry;
  });

  const savedPayload = options?.forceRefresh ? mergedList : [...mergedMap.values()];
  saveDirectorCache(savedPayload);

  return mergedList.map((entry) => ({
    name: entry.name,
    displayName: entry.resolvedName || entry.name,
    tmdbId: entry.tmdbId ?? null,
    profileUrl: entry.profileUrl ?? null
  }));
}

export function clearPeopleCaches() {
  clearDirectorCache();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(PERSON_CACHE_KEY);
    localStorage.removeItem(PERSON_SEARCH_CACHE_KEY);
    localStorage.removeItem(CREDITS_CACHE_KEY);
    localStorage.removeItem(CONFIG_CACHE_KEY);
  }
  Object.keys(personDetailsCache).forEach((key) => delete personDetailsCache[key]);
  Object.keys(personSearchCache).forEach((key) => delete personSearchCache[key]);
  Object.keys(personCreditsCache).forEach((key) => delete personCreditsCache[key]);
}

export type { PersonDetails };
