export type CachedDirectorProfile = {
  key: string;
  name: string;
  displayName?: string;
  tmdbId?: number;
  profileUrl?: string;
  worksCountOwned: number;
  totalWorksDirected: number | null;
  totalWorksCreated?: number | null;
  updatedAt: string;
};

export type DirectorProfilesCache = {
  version: number;
  directors: Record<string, CachedDirectorProfile>;
};

const CACHE_KEY = 'directorProfilesCache_v1';
export const CACHE_VERSION = 1;
const MAX_AGE_DAYS = 7;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function loadDirectorCache(): DirectorProfilesCache | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DirectorProfilesCache;
    if (parsed.version !== CACHE_VERSION || !parsed.directors) return null;

    const now = Date.now();
    const freshEntries: Record<string, CachedDirectorProfile> = {};

    Object.entries(parsed.directors).forEach(([key, entry]) => {
      if (!entry) return;
      if (entry.key !== key) return;
      if (entry.updatedAt) {
        const age = now - new Date(entry.updatedAt).getTime();
        if (Number.isFinite(age) && age > MAX_AGE_MS) {
          return;
        }
      }
      freshEntries[key] = entry;
    });

    return { version: CACHE_VERSION, directors: freshEntries };
  } catch (error) {
    console.warn('No se pudo leer la caché de directores', error);
    return null;
  }
}

export function saveDirectorCache(cache: DirectorProfilesCache): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('No se pudo guardar la caché de directores', error);
  }
}

export function getCachedProfilesForKeys(
  keys: string[],
  cache: DirectorProfilesCache | null
): { found: Map<string, CachedDirectorProfile>; missing: string[] } {
  const found = new Map<string, CachedDirectorProfile>();
  const missing: string[] = [];

  keys.forEach((key) => {
    const cached = cache?.directors?.[key];
    if (cached) {
      found.set(key, cached);
    } else {
      missing.push(key);
    }
  });

  return { found, missing };
}
