import { tmdbFetchJson, TMDB_API_KEY } from './tmdbApi';

const API_BASE = 'https://api.themoviedb.org/3';
const PERSON_CACHE_KEY = 'salvatierrez-tmdb-person-cache-v1';
const CREDITS_CACHE_KEY = 'salvatierrez-tmdb-person-credits-cache-v1';
const CONFIG_CACHE_KEY = 'salvatierrez-tmdb-person-img-config-v1';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 180;

type PersonCacheEntry<T> = { fetchedAt: number; data: T };

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
};

type ConfigCache = { fetchedAt: number; baseUrl: string; size: string };

const personDetailsCache: Record<number, PersonCacheEntry<PersonDetails>> = loadCache<PersonDetails>(PERSON_CACHE_KEY);
const personCreditsCache: Record<number, PersonCacheEntry<DirectedMovie[]>> = loadCache<DirectedMovie[]>(CREDITS_CACHE_KEY);

function loadCache<T>(key: string): Record<number, PersonCacheEntry<T>> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, PersonCacheEntry<T>>;
  } catch (error) {
    console.warn('No se pudo leer la caché de personas TMDb', error);
    return {};
  }
}

function saveCache<T>(key: string, payload: Record<number, PersonCacheEntry<T>>) {
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

export async function getPersonDetails(personId: number): Promise<PersonDetails | null> {
  if (!TMDB_API_KEY) return null;
  const cached = personDetailsCache[personId];
  if (isFresh(cached)) return cached.data;

  try {
    const url = `${API_BASE}/person/${personId}?api_key=${TMDB_API_KEY}&language=es-ES`;
    const data = await tmdbFetchJson<{
      id: number;
      name: string;
      biography?: string | null;
      profile_path?: string | null;
      place_of_birth?: string | null;
      birthday?: string | null;
      deathday?: string | null;
      also_known_as?: string[];
    }>(url);
    const profileBase = await getProfileBase();
    const payload: PersonDetails = {
      id: data.id,
      name: data.name,
      biography: data.biography,
      profilePath: data.profile_path,
      profileUrl: buildProfileUrl(profileBase, data.profile_path),
      placeOfBirth: data.place_of_birth,
      birthday: data.birthday,
      deathday: data.deathday,
      alsoKnownAs: data.also_known_as
    };
    personDetailsCache[personId] = { fetchedAt: Date.now(), data: payload };
    saveCache(PERSON_CACHE_KEY, personDetailsCache);
    return payload;
  } catch (error) {
    console.warn('No se pudo obtener el detalle de la persona', error);
    return null;
  }
}

export async function getPersonDirectedMovies(personId: number): Promise<DirectedMovie[]> {
  if (!TMDB_API_KEY) return [];
  const cached = personCreditsCache[personId];
  if (isFresh(cached)) return cached.data;

  try {
    const url = `${API_BASE}/person/${personId}/movie_credits?api_key=${TMDB_API_KEY}&language=es-ES`;
    const data = await tmdbFetchJson<{ crew?: { id: number; title: string; job: string; release_date?: string | null }[] }>(url);
    const directed = (data.crew ?? [])
      .filter((item) => item.job === 'Director')
      .map((item) => ({ id: item.id, title: item.title, year: parseYear(item.release_date) }));
    personCreditsCache[personId] = { fetchedAt: Date.now(), data: directed };
    saveCache(CREDITS_CACHE_KEY, personCreditsCache);
    return directed;
  } catch (error) {
    console.warn('No se pudo obtener la filmografía del director', error);
    return [];
  }
}

export type { PersonDetails, DirectedMovie };
