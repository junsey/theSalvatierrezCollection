import { MovieRecord, TmdbStatus } from '../types/MovieRecord';

export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
export const TMDB_BEARER = import.meta.env.VITE_TMDB_BEARER;

// Debug: verificar que las variables se carguen correctamente
if (import.meta.env.DEV) {
  console.log('Variables de entorno TMDb:', {
    hasApiKey: !!TMDB_API_KEY,
    hasBearer: !!TMDB_BEARER,
    apiKeyLength: TMDB_API_KEY?.length ?? 0,
    bearerLength: TMDB_BEARER?.length ?? 0
  });
}

if (!TMDB_API_KEY) {
  console.error('❌ Falta la variable VITE_TMDB_API_KEY. Asegúrate de que el archivo .env existe y contiene VITE_TMDB_API_KEY=tu_clave');
}

if (!TMDB_BEARER) {
  console.error('❌ Falta la variable VITE_TMDB_BEARER. Asegúrate de que el archivo .env existe y contiene VITE_TMDB_BEARER=tu_token');
}

const API_BASE = 'https://api.themoviedb.org/3';
const IMG_FALLBACK_BASE = 'https://image.tmdb.org/t/p/';
const CACHE_KEY = 'salvatierrez-tmdb-cache-v1';
const CONFIG_CACHE_KEY = 'salvatierrez-tmdb-config-v1';
const FAILED_CACHE_KEY = 'salvatierrez-tmdb-failed-v1';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 180;
const DEFAULT_MAX_RPS = 40;
const MIN_INTERVAL_MS = 1000 / DEFAULT_MAX_RPS;

export type TmdbEnrichment = {
  tmdbId: number;
  tmdbTitle: string;
  tmdbOriginalTitle: string;
  tmdbYear: number | null;
  tmdbRating: number | null;
  posterPath?: string | null;
  overview?: string | null;
  tmdbGenres?: string[];
};

type CacheEntry = {
  fetchedAt: number;
  data: TmdbEnrichment;
};

type CacheMap = Record<string, CacheEntry>;

type FailedCacheMap = Record<string, number>;

type ConfigCache = {
  fetchedAt: number;
  secureBaseUrl: string;
};

const normalizeTitle = (title: string) => title.trim().toLowerCase();
const cache: CacheMap = loadCache();
const failedCache: FailedCacheMap = loadFailedCache();

function loadCache(): CacheMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheMap;
  } catch (error) {
    console.error('Failed to load TMDb cache', error);
    return {};
  }
}

function saveCache(map: CacheMap) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(map));
}

function loadFailedCache(): FailedCacheMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FAILED_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FailedCacheMap;
  } catch (error) {
    console.warn('Failed to read TMDb failed cache', error);
    return {};
  }
}

function saveFailedCache(map: FailedCacheMap) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FAILED_CACHE_KEY, JSON.stringify(map));
}

function loadConfigCache(): ConfigCache | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConfigCache;
    if (Date.now() - parsed.fetchedAt > SIX_MONTHS_MS) return null;
    return parsed;
  } catch (error) {
    console.warn('Failed to read TMDb config cache', error);
    return null;
  }
}

function saveConfigCache(payload: ConfigCache) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(payload));
}

let lastRequestAt = 0;

async function rateLimit(maxRps: number = DEFAULT_MAX_RPS) {
  const interval = Math.max(MIN_INTERVAL_MS, 1000 / maxRps);
  const elapsed = Date.now() - lastRequestAt;
  const wait = Math.max(0, interval - elapsed);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

export async function tmdbFetchJson<T>(url: string, maxRps?: number): Promise<T> {
  if (!TMDB_BEARER || typeof TMDB_BEARER !== 'string' || TMDB_BEARER.trim() === '') {
    throw new Error('❌ TMDB_BEARER no está definida o está vacía. Configura VITE_TMDB_BEARER en tu archivo .env y reinicia el servidor de desarrollo');
  }
  await rateLimit(maxRps ?? DEFAULT_MAX_RPS);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_BEARER}`,
      'Content-Type': 'application/json;charset=utf-8'
    }
  });
  if (!response.ok) {
    throw new Error(`TMDb request failed ${response.status}`);
  }
  return (await response.json()) as T;
}

function makeCacheKey(titles: string[], year?: number | null) {
  const normalizedTitles = titles.map(normalizeTitle).join('|');
  return `${normalizedTitles}|${year ?? ''}`;
}

export function clearFailedCacheForMovie(movie: MovieRecord) {
  const titles = Array.from(new Set([movie.originalTitle, movie.title].filter(Boolean))) as string[];
  const cacheKey = makeCacheKey(titles, movie.year ?? null);
  if (failedCache[cacheKey]) {
    delete failedCache[cacheKey];
    saveFailedCache(failedCache);
  }
}

type CacheHit = {
  enrichment: TmdbEnrichment;
  fetchedAt: number;
  stale: boolean;
};

function getCached(titles: string[], year?: number | null, allowStale = false): CacheHit | null {
  const key = makeCacheKey(titles, year);
  const entry = cache[key];
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  const stale = age > SIX_MONTHS_MS;
  if (!allowStale && stale) return null;
  return { enrichment: entry.data, fetchedAt: entry.fetchedAt, stale };
}

function setCached(titles: string[], year: number | null, data: TmdbEnrichment) {
  const key = makeCacheKey(titles, year);
  cache[key] = { fetchedAt: Date.now(), data };
  saveCache(cache);
}

async function getImageBaseUrl(): Promise<string> {
  const cached = loadConfigCache();
  if (cached) return cached.secureBaseUrl;
  if (!TMDB_API_KEY || typeof TMDB_API_KEY !== 'string' || TMDB_API_KEY.trim() === '') {
    console.warn('⚠️ TMDB_API_KEY no está definida, usando URL de fallback para imágenes');
    return IMG_FALLBACK_BASE;
  }
  try {
    const url = `${API_BASE}/configuration?api_key=${TMDB_API_KEY}`;
    const data = await tmdbFetchJson<{ images?: { secure_base_url?: string } }>(url);
    const secureBaseUrl = data.images?.secure_base_url ?? IMG_FALLBACK_BASE;
    saveConfigCache({ fetchedAt: Date.now(), secureBaseUrl });
    return secureBaseUrl;
  } catch (error) {
    console.warn('TMDb config fetch failed, using fallback base url', error);
    return IMG_FALLBACK_BASE;
  }
}

type SearchResult = {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
};

type DetailResult = SearchResult & {
  overview?: string | null;
  genres?: { id: number; name: string }[];
};

function parseYear(date?: string | null): number | null {
  if (!date) return null;
  const [yearStr] = date.split('-');
  const year = Number(yearStr);
  return Number.isFinite(year) ? year : null;
}

function scoreResult(result: SearchResult, targetTitle: string, targetYear?: number | null): number {
  let score = 0;
  const normTitle = normalizeTitle(targetTitle);
  if (normalizeTitle(result.title) === normTitle || normalizeTitle(result.original_title) === normTitle) {
    score += 3;
  }
  const resultYear = parseYear(result.release_date);
  if (targetYear && resultYear === targetYear) score += 2;
  if (targetYear && resultYear && Math.abs(resultYear - targetYear) <= 1) score += 1;
  return score;
}

async function searchMovie(title: string, year?: number | null, maxRps?: number): Promise<SearchResult | null> {
  if (!TMDB_API_KEY || typeof TMDB_API_KEY !== 'string' || TMDB_API_KEY.trim() === '') {
    console.error('❌ TMDB_API_KEY no está definida o está vacía. No se puede buscar la película:', title);
    return null;
  }
  const url = new URL(`${API_BASE}/search/movie`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('query', title);
  url.searchParams.set('language', 'es-ES');
  if (year) url.searchParams.set('year', String(year));

  const data = await tmdbFetchJson<{ results?: SearchResult[] }>(url.toString(), maxRps);
  if (!data.results?.length) return null;

  if (!year) return data.results[0];
  const best = data.results
    .map((result) => ({ result, score: scoreResult(result, title, year) }))
    .sort((a, b) => b.score - a.score)[0];
  return best?.result ?? data.results[0];
}

async function fetchDetails(id: number, maxRps?: number): Promise<DetailResult | null> {
  if (!TMDB_API_KEY || typeof TMDB_API_KEY !== 'string' || TMDB_API_KEY.trim() === '') {
    console.error('❌ TMDB_API_KEY no está definida o está vacía. No se pueden obtener detalles para la película:', id);
    return null;
  }
  const url = `${API_BASE}/movie/${id}?api_key=${TMDB_API_KEY}&language=es-ES`;
  try {
    return await tmdbFetchJson<DetailResult>(url, maxRps);
  } catch (error) {
    console.warn('TMDb details fetch failed', error);
    return null;
  }
}

function buildPosterUrl(base: string, path?: string | null): string | undefined {
  if (!path) return undefined;
  return `${base}w500${path}`;
}

type EnrichOptions = {
  allowStaleCache?: boolean;
  forceNetwork?: boolean;
  maxRequestsPerSecond?: number;
  onProgress?: (current: number, total: number, movieTitle?: string) => void;
};

export async function enrichWithTmdb(movie: MovieRecord, options?: EnrichOptions): Promise<MovieRecord> {
  const titles = Array.from(new Set([movie.originalTitle, movie.title].filter(Boolean))) as string[];
  const cacheKey = makeCacheKey(titles, movie.year ?? null);
  const baseStatus: TmdbStatus = {
    source: 'none',
    requestedTitles: titles,
    requestedYear: movie.year ?? null,
    message: titles.length ? undefined : 'Sin títulos para consultar'
  };

  if (titles.length === 0) return { ...movie, tmdbStatus: baseStatus };

  const failedAt = options?.forceNetwork ? null : failedCache[cacheKey];
  if (failedAt && Date.now() - failedAt < SIX_MONTHS_MS) {
    return {
      ...movie,
      tmdbStatus: {
        ...baseStatus,
        source: 'error',
        fetchedAt: failedAt,
        message: 'Intento previo sin resultados; se omite nueva consulta'
      }
    };
  }

  const cached = options?.forceNetwork ? null : getCached(titles, movie.year ?? null, options?.allowStaleCache ?? true);
  if (cached) {
    const status: TmdbStatus = {
      ...baseStatus,
      source: cached.stale ? 'stale-cache' : 'cache',
      matchedId: cached.enrichment.tmdbId,
      matchedTitle: cached.enrichment.tmdbTitle,
      matchedOriginalTitle: cached.enrichment.tmdbOriginalTitle,
      fetchedAt: cached.fetchedAt,
      message: cached.stale ? 'Respuesta cacheada expirada reutilizada' : 'Respuesta cacheada'
    };
    return applyEnrichment(movie, cached.enrichment, await getImageBaseUrl(), status);
  }

  try {
    let found: SearchResult | null = null;
    for (const title of titles) {
      found = await searchMovie(title, movie.year, options?.maxRequestsPerSecond);
      if (found) break;
    }
    if (!found) {
      for (const title of titles) {
        found = await searchMovie(title, undefined, options?.maxRequestsPerSecond);
        if (found) break;
      }
    }

    if (!found) {
      const stale = getCached(titles, movie.year ?? null, true);
      if (stale) {
        const status: TmdbStatus = {
          ...baseStatus,
          source: 'stale-cache',
          matchedId: stale.enrichment.tmdbId,
          matchedTitle: stale.enrichment.tmdbTitle,
          matchedOriginalTitle: stale.enrichment.tmdbOriginalTitle,
          fetchedAt: stale.fetchedAt,
          message: 'Sin resultados actuales, usando caché expirada'
        };
        return applyEnrichment(movie, stale.enrichment, await getImageBaseUrl(), status);
      }
      failedCache[cacheKey] = Date.now();
      saveFailedCache(failedCache);
      return {
        ...movie,
        tmdbStatus: { ...baseStatus, source: 'not-found', message: 'TMDb no devolvió coincidencias', fetchedAt: failedCache[cacheKey] }
      };
    }

    const details = await fetchDetails(found.id, options?.maxRequestsPerSecond);
    const enrichment: TmdbEnrichment = {
      tmdbId: found.id,
      tmdbTitle: found.title,
      tmdbOriginalTitle: found.original_title,
      tmdbYear: parseYear(found.release_date),
      tmdbRating: found.vote_average ?? null,
      posterPath: found.poster_path,
      overview: details?.overview ?? null,
      tmdbGenres: details?.genres?.map((g) => g.name) ?? undefined
    };
    setCached(titles, movie.year ?? null, enrichment);
    if (failedCache[cacheKey]) {
      delete failedCache[cacheKey];
      saveFailedCache(failedCache);
    }
    const status: TmdbStatus = {
      ...baseStatus,
      source: 'network',
      matchedId: found.id,
      matchedTitle: found.title,
      matchedOriginalTitle: found.original_title,
      fetchedAt: Date.now(),
      message: 'Respuesta TMDb correcta'
    };
    return applyEnrichment(movie, enrichment, await getImageBaseUrl(), status);
  } catch (error) {
    console.error('TMDb lookup failed for', movie.originalTitle || movie.title, error);
    const stale = getCached(titles, movie.year ?? null, true);
    if (stale) {
      const status: TmdbStatus = {
        ...baseStatus,
        source: 'stale-cache',
        matchedId: stale.enrichment.tmdbId,
        matchedTitle: stale.enrichment.tmdbTitle,
        matchedOriginalTitle: stale.enrichment.tmdbOriginalTitle,
        fetchedAt: stale.fetchedAt,
        message: 'Error de red, se usa caché expirada',
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      return applyEnrichment(movie, stale.enrichment, await getImageBaseUrl(), status);
    }
    return {
      ...movie,
      tmdbStatus: {
        ...baseStatus,
        source: 'error',
        message: 'Error al consultar TMDb',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    };
  }
}

function applyEnrichment(
  movie: MovieRecord,
  enrichment: TmdbEnrichment,
  baseUrl: string,
  status?: TmdbStatus
): MovieRecord {
  return {
    ...movie,
    tmdbId: enrichment.tmdbId,
    tmdbTitle: enrichment.tmdbTitle,
    tmdbOriginalTitle: enrichment.tmdbOriginalTitle,
    tmdbYear: enrichment.tmdbYear ?? movie.year,
    tmdbRating: enrichment.tmdbRating,
    posterUrl: enrichment.posterPath ? buildPosterUrl(baseUrl, enrichment.posterPath) : movie.posterUrl,
    plot: enrichment.overview ?? movie.plot,
    tmdbGenres: enrichment.tmdbGenres ?? movie.tmdbGenres,
    originalTitle: movie.originalTitle || enrichment.tmdbOriginalTitle || enrichment.tmdbTitle,
    tmdbStatus: status ?? movie.tmdbStatus
  };
}

export async function enrichMoviesBatch(
  movies: MovieRecord[],
  options?: EnrichOptions
): Promise<MovieRecord[]> {
  const maxRps = options?.maxRequestsPerSecond ?? DEFAULT_MAX_RPS;
  const results: MovieRecord[] = [];
  const total = movies.length;

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    
    // Si forceNetwork está activo, limpiar el failedCache para esta película
    if (options?.forceNetwork) {
      clearFailedCacheForMovie(movie);
    }
    
    // Reutiliza caché (incluso expirada) salvo que se fuerce red a través de las opciones
    const enriched = await enrichWithTmdb(movie, {
      allowStaleCache: options?.allowStaleCache ?? true,
      forceNetwork: options?.forceNetwork,
      maxRequestsPerSecond: maxRps
    });
    results.push(enriched);
    
    // Reportar progreso con el título de la película
    if (options?.onProgress) {
      options.onProgress(i + 1, total, movie.title || movie.originalTitle);
    }
  }

  return results;
}
