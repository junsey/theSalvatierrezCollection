import { MovieRecord } from '../types/MovieRecord';

export type ImdbResult = {
  imdbID?: string;
  Title?: string;
  Year?: string;
  imdbRating?: string;
  Poster?: string;
  Plot?: string;
  Genre?: string;
};

// Use HTTPS by default to avoid mixed-content blocks in browsers.
const OMDB_URL = import.meta.env.VITE_OMDB_URL || 'https://www.omdbapi.com/';
// Default key provided by the user as a fallback so posters/ratings load out of the box.
const DEFAULT_OMDB_KEY = 'fd2b1d69';
const CACHE_KEY = 'salvatierrez-imdb-cache-v1';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 180;

type CachedImdbEntry = {
  fetchedAt: number;
  data: ImdbResult;
};

type ImdbCache = Record<string, CachedImdbEntry>;

function loadCache(): ImdbCache {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ImdbCache;
  } catch (err) {
    console.error('Failed to load IMDb cache', err);
    return {};
  }
}

function saveCache(cache: ImdbCache) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

const imdbCache: ImdbCache = loadCache();

const normalizeTitle = (title: string) => title.trim().toLowerCase();

function makeCacheKey(title: string, year?: number | null) {
  return `${normalizeTitle(title)}|${year ?? ''}`;
}

function getCachedResult(titles: string[], year?: number | null, allowStale = false): ImdbResult | null {
  for (const title of titles) {
    const key = makeCacheKey(title, year);
    const entry = imdbCache[key];
    if (!entry) continue;
    const age = Date.now() - entry.fetchedAt;
    if (allowStale || age <= SIX_MONTHS_MS) {
      return entry.data;
    }
  }
  return null;
}

function setCachedResult(titles: string[], year: number | null, data: ImdbResult) {
  titles.forEach((title) => {
    const key = makeCacheKey(title, year);
    imdbCache[key] = { fetchedAt: Date.now(), data };
  });
  saveCache(imdbCache);
}

async function fetchOmdb(candidateTitles: (string | undefined)[], year?: number | null): Promise<ImdbResult | null> {
  const titles = Array.from(
    new Set(
      candidateTitles
        .filter((t): t is string => Boolean(t && t.trim()))
        .map((t) => t.trim())
    )
  );

  if (titles.length === 0) return null;

  const cached = getCachedResult(titles, year ?? undefined);
  if (cached) return cached;

  const apiKey = import.meta.env.VITE_OMDB_API_KEY || DEFAULT_OMDB_KEY;

  const fetchByTitle = async (title: string, y?: number | null) => {
    const url = new URL(OMDB_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('t', title);
    url.searchParams.set('plot', 'short');
    if (y) {
      url.searchParams.set('y', String(y));
    }
    url.searchParams.set('type', 'movie');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = (await response.json()) as { Response?: string } & ImdbResult;
    if (data.Response === 'False') return null;
    return data;
  };

  const fetchById = async (id: string) => {
    const url = new URL(OMDB_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('i', id);
    url.searchParams.set('plot', 'short');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = (await response.json()) as { Response?: string } & ImdbResult;
    if (data.Response === 'False') return null;
    return data;
  };

  const searchByTitle = async (title: string) => {
    const url = new URL(OMDB_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('s', title);
    url.searchParams.set('type', 'movie');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = (await response.json()) as { Response?: string; Search?: { imdbID: string }[] };
    if (data.Response === 'False' || !data.Search?.length) return null;
    return fetchById(data.Search[0].imdbID);
  };

  for (const title of titles) {
    const withYear = await fetchByTitle(title, year ?? undefined);
    if (withYear) {
      setCachedResult(titles, year ?? null, withYear);
      return withYear;
    }
  }

  for (const title of titles) {
    const withoutYear = await fetchByTitle(title);
    if (withoutYear) {
      setCachedResult(titles, year ?? null, withoutYear);
      return withoutYear;
    }
  }

  const searched = await searchByTitle(titles[0]);
  if (searched) {
    setCachedResult(titles, year ?? null, searched);
    return searched;
  }

  const stale = getCachedResult(titles, year ?? undefined, true);
  if (stale) return stale;

  return null;
}

export async function enrichWithImdb(movie: MovieRecord): Promise<MovieRecord> {
  try {
    const lookupTitles = [movie.originalTitle, movie.title];
    const data = await fetchOmdb(lookupTitles, movie.year);
    if (!data) return movie;
    const imdbGenres = data.Genre?.split(',').map((g) => g.trim()).filter(Boolean);
    return {
      ...movie,
      imdbId: data.imdbID,
      imdbRating: data.imdbRating,
      posterUrl: data.Poster && data.Poster !== 'N/A' ? data.Poster : undefined,
      imdbYear: data.Year,
      imdbTitle: data.Title,
      plot: data.Plot,
      imdbGenres
    };
  } catch (error) {
    console.error('IMDb lookup failed for', movie.originalTitle || movie.title, error);
    return movie;
  }
}
