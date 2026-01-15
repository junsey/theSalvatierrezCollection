import { MovieRecord, TmdbStatus } from '../types/MovieRecord';
import { getTmdbImageBaseUrl } from './tmdbApi';

type TmdbMovieRow = {
  collection_id: string;
  tmdb_id: number | null;
  tmdb_title: string | null;
  tmdb_original_title: string | null;
  tmdb_year: number | null;
  tmdb_rating: number | null;
  tmdb_genres: string[] | null;
  poster_path: string | null;
  plot: string | null;
  last_synced_at: string | null;
  source: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SUPABASE_ACCESS_TOKEN = import.meta.env.VITE_SUPABASE_ACCESS_TOKEN as string | undefined;
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 180;
const MAX_IDS_PER_QUERY = 200;
let didLogConfig = false;

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function logConfigOnce() {
  if (!import.meta.env.DEV || didLogConfig) return;
  didLogConfig = true;
  console.log('Supabase TMDb config', {
    hasUrl: Boolean(SUPABASE_URL),
    hasAnonKey: Boolean(SUPABASE_ANON_KEY),
    hasAccessToken: Boolean(SUPABASE_ACCESS_TOKEN),
    url: SUPABASE_URL
  });
}

function getAuthToken() {
  return SUPABASE_ACCESS_TOKEN || SUPABASE_ANON_KEY || '';
}

async function supabaseRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/${path}`;
  const headers = new Headers(options.headers);
  headers.set('apikey', SUPABASE_ANON_KEY ?? '');
  headers.set('Authorization', `Bearer ${getAuthToken()}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    if (import.meta.env.DEV) {
      console.warn('Supabase TMDb request failed', {
        status: response.status,
        hasApiKey: headers.has('apikey'),
        apiKeyLength: headers.get('apikey')?.length ?? 0,
        url
      });
    }
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

function chunkIds(ids: string[], size: number) {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

function formatInList(ids: string[]) {
  return ids.map((id) => `"${id.replace(/"/g, '""')}"`).join(',');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getPosterPathFromUrl(posterUrl?: string | null): string | null {
  if (!posterUrl) return null;
  const match = posterUrl.match(/\/t\/p\/[^/]+(\/.+)$/);
  return match ? match[1] : null;
}

function buildStatus(movie: MovieRecord, row: TmdbMovieRow): TmdbStatus {
  const titles = Array.from(new Set([movie.originalTitle, movie.title].filter(Boolean))) as string[];
  const fetchedAt = row.last_synced_at ? Date.parse(row.last_synced_at) : undefined;
  const stale = fetchedAt ? Date.now() - fetchedAt > SIX_MONTHS_MS : false;
  return {
    source: stale ? 'stale-cache' : 'cache',
    requestedTitles: titles,
    requestedYear: movie.year ?? null,
    matchedId: row.tmdb_id ?? undefined,
    matchedTitle: row.tmdb_title ?? undefined,
    matchedOriginalTitle: row.tmdb_original_title ?? undefined,
    fetchedAt: fetchedAt ?? undefined,
    message: stale ? 'Respuesta cacheada expirada reutilizada' : 'Respuesta cacheada'
  };
}

export async function hydrateFromSupabase(
  movies: MovieRecord[]
): Promise<{ movies: MovieRecord[]; hydratedIds: Set<string> }> {
  logConfigOnce();
  if (!isConfigured() || movies.length === 0) {
    return { movies, hydratedIds: new Set() };
  }

  try {
    const ids = movies.map((movie) => movie.id).filter(isUuid);
    if (ids.length === 0) {
      return { movies, hydratedIds: new Set() };
    }
    const rowsByCollection = new Map<string, TmdbMovieRow>();

    for (const chunk of chunkIds(ids, MAX_IDS_PER_QUERY)) {
      const params = new URLSearchParams({
        select:
          'collection_id,tmdb_id,tmdb_title,tmdb_original_title,tmdb_year,tmdb_rating,tmdb_genres,poster_path,plot,last_synced_at,source'
      });
      params.set('collection_id', `in.(${formatInList(chunk)})`);
      const rows = await supabaseRequest<TmdbMovieRow[]>(`tmdb_movies?${params.toString()}`);
      for (const row of rows ?? []) {
        rowsByCollection.set(row.collection_id, row);
      }
    }

    if (rowsByCollection.size === 0) {
      return { movies, hydratedIds: new Set() };
    }

    const hydratedIds = new Set<string>();
    const needsPoster = Array.from(rowsByCollection.values()).some((row) => row.poster_path);
    const basePosterUrl = needsPoster ? await getTmdbImageBaseUrl() : undefined;

    const enriched = await Promise.all(
      movies.map(async (movie) => {
        const row = rowsByCollection.get(movie.id);
        if (!row || !row.tmdb_id) return movie;
        hydratedIds.add(movie.id);
        const posterPath = row.poster_path ?? movie.posterPath ?? getPosterPathFromUrl(movie.posterUrl);
        const posterUrl = posterPath && basePosterUrl ? `${basePosterUrl}w500${posterPath}` : movie.posterUrl;

        return {
          ...movie,
          tmdbId: row.tmdb_id ?? movie.tmdbId,
          tmdbTitle: row.tmdb_title ?? movie.tmdbTitle,
          tmdbOriginalTitle: row.tmdb_original_title ?? movie.tmdbOriginalTitle,
          tmdbYear: row.tmdb_year ?? movie.tmdbYear ?? movie.year,
          tmdbRating: row.tmdb_rating ?? movie.tmdbRating,
          tmdbGenres: row.tmdb_genres ?? movie.tmdbGenres,
          posterPath,
          posterUrl,
          plot: row.plot ?? movie.plot,
          tmdbStatus: buildStatus(movie, row)
        };
      })
    );

    return { movies: enriched, hydratedIds };
  } catch (error) {
    console.warn('Supabase TMDb hydrate failed; falling back to local data', error);
    return { movies, hydratedIds: new Set() };
  }
}

export async function persistSupabaseTmdb(movies: MovieRecord[]) {
  logConfigOnce();
  if (!isConfigured() || movies.length === 0) return;
  if (!SUPABASE_ACCESS_TOKEN) {
    console.warn('Supabase access token missing; skipping TMDb upsert.');
    return;
  }

  const payload = movies
    .filter((movie) => movie.tmdbId)
    .map((movie) => ({
      collection_id: movie.id,
      tmdb_id: movie.tmdbId ?? null,
      tmdb_title: movie.tmdbTitle ?? null,
      tmdb_original_title: movie.tmdbOriginalTitle ?? null,
      tmdb_year: movie.tmdbYear ?? movie.year ?? null,
      tmdb_rating: movie.tmdbRating ?? null,
      tmdb_genres: movie.tmdbGenres ?? [],
      poster_path: movie.posterPath ?? getPosterPathFromUrl(movie.posterUrl),
      plot: movie.plot ?? null,
      last_synced_at: new Date().toISOString(),
      source: movie.tmdbStatus?.source ?? 'tmdb'
    }));

  if (payload.length === 0) return;

  try {
    const params = new URLSearchParams({ on_conflict: 'collection_id' });
    await supabaseRequest(`tmdb_movies?${params.toString()}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn('Supabase TMDb upsert failed', error);
  }
}
