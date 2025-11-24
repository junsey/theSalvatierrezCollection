import { MovieRecord } from '../types/MovieRecord';

export function normalizeTitle(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['"’]/g, '')
    .replace(/[:;,.!?¿¡()/\\\[\]\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || null;
}

export function buildOwnedTmdbIdSet(movies: MovieRecord[]): Set<number> {
  const ownedIds = new Set<number>();
  movies.forEach((movie) => {
    const tmdbId = Number(movie.tmdbId);
    if (Number.isFinite(tmdbId)) {
      ownedIds.add(tmdbId);
    }
  });
  return ownedIds;
}

export function buildOriginalTitleMap(movies: MovieRecord[]): Map<string, MovieRecord> {
  const map = new Map<string, MovieRecord>();

  const addEntry = (title?: string | null, movie?: MovieRecord) => {
    const key = normalizeTitle(title);
    if (!key || map.has(key) || !movie) return;
    map.set(key, movie);
  };

  movies.forEach((movie) => {
    addEntry(movie.originalTitle, movie);
    addEntry(movie.tmdbOriginalTitle, movie);
    addEntry(movie.tmdbTitle, movie);
    addEntry(movie.title, movie);
  });

  return map;
}

export function matchLocalMovieByTitle(
  credit: { title?: string | null; originalTitle?: string | null },
  lookup: Map<string, MovieRecord>
): MovieRecord | undefined {
  const preferred = normalizeTitle(credit.originalTitle);
  const fallback = normalizeTitle(credit.title);

  if (preferred && lookup.has(preferred)) return lookup.get(preferred);
  if (fallback && lookup.has(fallback)) return lookup.get(fallback);
  return undefined;
}

export function isCreditOwned(
  credit: { id: number; title?: string | null; originalTitle?: string | null },
  ownedIds: Set<number>,
  lookup: Map<string, MovieRecord>
): boolean {
  if (ownedIds.has(credit.id)) return true;
  return Boolean(matchLocalMovieByTitle(credit, lookup));
}
