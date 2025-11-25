import { buildOwnedTmdbIdSet } from './directors';
import { MovieRecord } from '../types/MovieRecord';
import { tmdbFetchJson } from './tmdbApi';

const API_BASE = 'https://api.themoviedb.org/3';

export const movieRuntimeCache = new Map<number, number | null>();

export async function fetchTMDB<T = any>(path: string): Promise<T> {
  return tmdbFetchJson<T>(`${API_BASE}${path}`);
}

export async function getMovieRuntime(id: number): Promise<number | null> {
  if (movieRuntimeCache.has(id)) {
    return movieRuntimeCache.get(id)!;
  }

  try {
    const details = await fetchTMDB<{ runtime?: number | null }>(`/movie/${id}?language=es-ES`);
    const runtime = typeof details.runtime === 'number' ? details.runtime : null;
    movieRuntimeCache.set(id, runtime);
    return runtime;
  } catch {
    movieRuntimeCache.set(id, null);
    return null;
  }
}

export async function isShortMovie(item: any): Promise<boolean> {
  if (item.media_type !== 'movie') return false;
  const runtime = await getMovieRuntime(item.id);
  if (!runtime) return false;
  return runtime > 0 && runtime < 60;
}

export type DirectorWorks = {
  directorList: any[];
  creatorList: any[];
  directorCount: number;
  creatorCount: number;
  totalCount: number;
};

const directorWorksCache = new Map<number, DirectorWorks>();

let ownedIds = new Set<number>();

export const setDirectorOwnedIds = (ids: Set<number>) => {
  ownedIds = ids;
};

export const setDirectorOwnedIdsFromMovies = (movies: MovieRecord[]) => {
  ownedIds = buildOwnedTmdbIdSet(movies);
};

function splitOwned(list: any[]) {
  const owned: any[] = [];
  const unowned: any[] = [];
  for (const c of list) {
    if (ownedIds.has(c.id)) owned.push(c);
    else unowned.push(c);
  }
  return { owned, unowned };
}

function byDate(a: any, b: any) {
  const da = new Date(a.release_date ?? a.first_air_date ?? '1900-01-01');
  const db = new Date(b.release_date ?? b.first_air_date ?? '1900-01-01');
  return da.getTime() - db.getTime();
}

export async function getDirectorWorks(personId: number): Promise<DirectorWorks> {
  if (directorWorksCache.has(personId)) {
    return directorWorksCache.get(personId)!;
  }

  const combined = await fetchTMDB<{ crew?: any[] }>(`/person/${personId}/combined_credits?language=es-ES`);

  const rawDirectorCredits = (combined.crew ?? []).filter(
    (c: any) =>
      c.job === 'Director' &&
      (c.media_type === 'movie' || c.media_type === 'tv') &&
      c.video !== true
  );

  const rawCreatorCredits = (combined.crew ?? []).filter(
    (c: any) =>
      c.job === 'Creator' &&
      (c.media_type === 'movie' || c.media_type === 'tv') &&
      c.video !== true
  );

  const dir = splitOwned(rawDirectorCredits);
  const cre = splitOwned(rawCreatorCredits);

  const filteredDirectorUnowned: any[] = [];
  for (const item of dir.unowned) {
    if (await isShortMovie(item)) continue;
    if ((item.vote_count ?? 0) < 30) continue;
    filteredDirectorUnowned.push(item);
  }

  const filteredCreatorUnowned: any[] = [];
  for (const item of cre.unowned) {
    if (await isShortMovie(item)) continue;
    if ((item.vote_count ?? 0) < 30) continue;
    filteredCreatorUnowned.push(item);
  }

  const directorList = [...dir.owned, ...filteredDirectorUnowned].sort(byDate);
  const creatorList = [...cre.owned, ...filteredCreatorUnowned].sort(byDate);

  const seenDirector = new Set<number>();
  const seenCreator = new Set<number>();

  const uniqueDirectorList = directorList.filter((entry) => {
    if (seenDirector.has(entry.id)) return false;
    seenDirector.add(entry.id);
    return true;
  });

  const uniqueCreatorList = creatorList.filter((entry) => {
    if (seenCreator.has(entry.id)) return false;
    seenCreator.add(entry.id);
    return true;
  });

  const directorCount = uniqueDirectorList.length;
  const creatorCount = uniqueCreatorList.length;
  const totalCount = directorCount + creatorCount;

  const works: DirectorWorks = {
    directorList: uniqueDirectorList,
    creatorList: uniqueCreatorList,
    directorCount,
    creatorCount,
    totalCount
  };

  directorWorksCache.set(personId, works);
  return works;
}

export function clearDirectorWorksCache() {
  directorWorksCache.clear();
}
