import { tmdbFetchJson, TMDB_API_KEY } from './tmdbApi';
import { CachedDirector, clearDirectorCache, loadDirectorCache, saveDirectorCache } from './localStorage';

const API_BASE = 'https://api.themoviedb.org/3';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const PERSON_CACHE_KEY = 'salvatierrez-tmdb-person-cache-v1';
const PERSON_SEARCH_CACHE_KEY = 'salvatierrez-tmdb-person-search-cache-v1';
const CREDITS_CACHE_KEY = 'salvatierrez-tmdb-person-credits-cache-v1';
const CONFIG_CACHE_KEY = 'salvatierrez-tmdb-person-img-config-v1';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 180;

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

type DirectedMovie = {
  id: number;
  title: string;
  year: number | null;
  posterUrl?: string;
  popularity?: number;
};

export type DirectorProfile = {
  name: string;
  displayName: string;
  tmdbId: number | null;
  profileUrl?: string | null;
};

type ConfigCache = { fetchedAt: number; baseUrl: string; size: string };

const personDetailsCache: Record<string, PersonCacheEntry<PersonDetails>> = loadCache<PersonDetails>(PERSON_CACHE_KEY);
const personSearchCache: Record<string, PersonCacheEntry<SearchCacheEntry>> = loadCache<SearchCacheEntry>(
  PERSON_SEARCH_CACHE_KEY
);
const personCreditsCache: Record<string, PersonCacheEntry<DirectedMovie[]>> = loadCache<DirectedMovie[]>(CREDITS_CACHE_KEY);

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

function saveCache<T>(key: string, payload: Record<string, PersonCacheEntry<T>>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn('No se pudo guardar la caché de personas TMDb', error);
  }
}

function isFresh(entry?: PersonCacheEntry<any>): boolean {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < SIX_MONTHS_MS;
}

const normalizeName = (value: string) => value.trim().toLowerCase();

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
  if (!TMDB_API_KEY) return [];
  try {
    const url = `${API_BASE}/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=es-ES`;
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
  if (!TMDB_API_KEY) return null;
  const normalized = normalizeName(name);
  const cached = personSearchCache[normalized];
  if (isFresh(cached)) return cached.data;

  try {
    const url = new URL(`${API_BASE}/search/person`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('query', name.trim());
    url.searchParams.set('language', 'es-ES');
    const data = await tmdbFetchJson<{ results?: { id: number; name: string }[] }>(url.toString());
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
  if (!TMDB_API_KEY) return null;
  const cacheKey = String(personId);
  const cached = personDetailsCache[cacheKey];
  if (isFresh(cached)) return cached.data;

  const requestDetails = async (language: string) => {
    const url = `${API_BASE}/person/${personId}?api_key=${TMDB_API_KEY}&language=${language}`;
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

export async function getPersonDirectedMovies(personId: number): Promise<DirectedMovie[]> {
  if (!TMDB_API_KEY) return [];
  const cacheKey = String(personId);
  const cached = personCreditsCache[cacheKey];
  if (isFresh(cached)) return cached.data;

  try {
    const url = `${API_BASE}/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=es-ES`;
    const data = await tmdbFetchJson<{
      crew?: {
        id: number;
        media_type?: string;
        title?: string;
        job?: string;
        release_date?: string | null;
        poster_path?: string | null;
        popularity?: number;
      }[];
    }>(url);

    const directedMovies = new Map<number, DirectedMovie>();

    (data.crew ?? [])
      .filter((item) => item.media_type === 'movie' && item.job?.toLowerCase().includes('director'))
      .forEach((item) => {
        const entry: DirectedMovie = {
          id: item.id,
          title: item.title ?? 'Película sin título',
          year: parseYear(item.release_date),
          posterUrl: item.poster_path ? `${POSTER_BASE_URL}${item.poster_path}` : undefined,
          popularity: item.popularity
        };

        directedMovies.set(item.id, entry);
      });

    const sorted = Array.from(directedMovies.values()).sort((a, b) => {
      const byYear = (b.year ?? 0) - (a.year ?? 0);
      if (byYear !== 0) return byYear;
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    });

    personCreditsCache[cacheKey] = { fetchedAt: Date.now(), data: sorted };
    saveCache(CREDITS_CACHE_KEY, personCreditsCache);
    return sorted;
  } catch (error) {
    console.warn('No se pudo obtener la filmografía del director', error);
    return [];
  }
}

export async function buildDirectorProfiles(
  names: string[],
  options?: { forceRefresh?: boolean; onProgress?: (current: number, total: number) => void }
): Promise<DirectorProfile[]> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (unique.length === 0) return [];
  if (!TMDB_API_KEY) {
    return unique.map((name) => ({ name, displayName: name, tmdbId: null, profileUrl: null }));
  }

  const total = unique.length;
  let completed = 0;
  const report = () => options?.onProgress?.(completed, total);

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
      if (cached) {
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
      const search = await searchPersonByName(target);
      let profileUrl: string | undefined;
      let resolvedName = search?.name ?? target;
      let tmdbId: number | null = search?.id ?? null;

      if (search?.id) {
        const details = await getPersonDetails(search.id);
        profileUrl = details?.profileUrl ?? undefined;
        resolvedName = details?.name ?? resolvedName;
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
      tmdbId: null,
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

export type { PersonDetails, DirectedMovie };
