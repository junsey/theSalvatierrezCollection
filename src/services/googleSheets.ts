import { MovieRecord } from '../types/MovieRecord';
import embeddedSheetBackup from '../data/sheet-backup.csv?raw';

const SHEET_ID = '1_kDej_nXLnz1REls5jDyqjIZU5z_fsN4mHap60_uvCI';
const SHEET_CACHE_KEY = 'salvatierrez-sheet-cache-v1';
const SHEET_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

type SheetCachePayload = {
  fetchedAt: number;
  text: string;
  sourceUrl?: string;
};

export type SheetSource = 'network' | 'cache-fresh' | 'cache-stale' | 'embedded' | 'demo';

export type SheetMeta = {
  source: SheetSource;
  fetchedAt?: number;
  url?: string;
};

export type FetchMoviesResult = {
  movies: MovieRecord[];
  meta: SheetMeta;
};

type FetchOptions = {
  /**
   * Skip cache preference and try to hit the network immediately. Falls back to
   * any cached/embedded copies if the network fails.
   */
  forceNetwork?: boolean;
};

const buildSheetUrls = (): string[] => {
  const envUrl = import.meta.env.VITE_SHEETS_CSV_URL?.trim();
  const candidates = [
    envUrl,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/pub?output=csv`
  ].filter(Boolean) as string[];

  // Remove duplicates while preserving order.
  return Array.from(new Set(candidates));
};

const fallbackMovies: MovieRecord[] = [
  {
    id: 'demo-1',
    seccion: 'Accion - Aventura',
    year: 1981,
    saga: 'Demo Saga',
    title: 'Demo of the Tomb',
    originalTitle: 'Demo of the Tomb',
    genreRaw: 'Aventura; Fantasia',
    director: 'Demo Director',
    group: 'Coleccion',
    seen: false,
    rating: 7,
    dubbing: 'Español',
    format: 'Blu-ray',
    enDeposito: false,
    funcionaStatus: 'untested'
  }
];

function parseCsv(csvText: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  const cells: string[] = [];
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else if (char === '\n' && !inQuotes) {
      cells.push(current.trim());
      rows.push([...cells]);
      cells.length = 0;
      current = '';
    } else {
      current += char;
    }
  }
  if (current || cells.length) {
    cells.push(current.trim());
    rows.push([...cells]);
  }
  const [header, ...data] = rows;
  return data
    .filter((row) => row.length > 0)
    .map((row) => {
      const record: Record<string, string> = {};
      header.forEach((key, idx) => {
        record[key.trim()] = row[idx]?.trim() ?? '';
      });
      return record;
    });
}

const parseBoolean = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return normalized === 'si' || normalized === 'sí' || normalized === 'yes' || normalized === '1' || normalized === 'true';
};

const safeNumber = (value: string): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseNumberList = (value: string): number[] => {
  if (!value) return [];
  return value
    .split(/[,;/&]/g)
    .map((entry) => safeNumber(entry.trim()) ?? null)
    .filter((entry): entry is number => entry !== null);
};

const parseFunciona = (value: string): 'working' | 'damaged' | 'untested' => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'untested';

  const workingTokens = ['si', 'sí', 'yes', 'y', 'true', 'ok', 'bueno', 'funciona', 'bien'];
  const damagedTokens = ['no', 'dañado', 'daniado', 'malo', 'broken', 'defectuoso'];

  if (workingTokens.includes(normalized)) return 'working';
  if (damagedTokens.includes(normalized)) return 'damaged';
  return 'untested';
};

const parseEnDeposito = (value: string): boolean => {
  return value.trim().length > 0;
};

function mapToMovie(record: Record<string, string>, index: number): MovieRecord {
  const seriesValue = record['Serie'] ?? record['Series'] ?? '';
  const directorIdField =
    record['Director TMDb Id'] ?? record['DirectorTMDbId'] ?? record['DirectorTMDbID'] ?? '';
  const directorTmdbIds = parseNumberList(directorIdField);
  const tmdbIdFromSheet = safeNumber(
    record['TMDbId'] ?? record['TMDb ID'] ?? record['tmdbId'] ?? record['tmdbid'] ?? ''
  );
  const funcionaStatus = parseFunciona(record['Funciona'] ?? '');
  const enDeposito = parseEnDeposito(record['En depósito'] ?? record['En Deposito'] ?? '');
  return {
    id: `${record['Titulo'] ?? 'movie'}-${index}`,
    seccion: record['Seccion'] ?? 'Desconocida',
    year: safeNumber(record['Año'] ?? ''),
    saga: record['Saga'] ?? '',
    title: record['Titulo'] ?? 'Sin título',
    originalTitle: record['Titulo Original'] ?? '',
    genreRaw: record['Genero'] ?? '',
    director: record['Director'] ?? '',
    directorTmdbId: directorTmdbIds[0] ?? null,
    directorTmdbIds: directorTmdbIds.length > 0 ? directorTmdbIds : undefined,
    group: record['Grupo'] ?? '',
    seen: parseBoolean(record['Vista'] ?? ''),
    series: parseBoolean(seriesValue || 'no'),
    season: safeNumber(record['Temporada'] ?? ''),
    rating: safeNumber(record['Puntuacion'] ?? ''),
    ratingGloria: safeNumber(record['Puntuacion Gloria'] ?? ''),
    ratingRodrigo: safeNumber(record['Puntuacion Rodrigo'] ?? ''),
    dubbing: record['Doblaje'] ?? '',
    format: record['Formato'] ?? '',
    enDeposito,
    funcionaStatus,
    tmdbIdFromSheet: tmdbIdFromSheet ?? null
  };
}

function saveSheetCache(payload: SheetCachePayload) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      SHEET_CACHE_KEY,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.error('Failed to save sheet cache', error);
  }
}

function loadSheetCache(options?: { allowExpired?: boolean }): SheetCachePayload | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SHEET_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SheetCachePayload;
    if (!options?.allowExpired && Date.now() - parsed.fetchedAt > SHEET_CACHE_TTL) return null;
    return parsed;
  } catch (error) {
    console.error('Failed to read sheet cache', error);
    return null;
  }
}

async function tryNetwork(urls: string[]): Promise<SheetCachePayload | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        console.warn('Sheet fetch failed, trying next URL', url, response.status);
        continue;
      }
      const text = await response.text();
      const payload: SheetCachePayload = {
        fetchedAt: Date.now(),
        text,
        sourceUrl: url
      };
      saveSheetCache(payload);
      return payload;
    } catch (error) {
      console.warn('Sheet fetch threw, trying next URL', url, error);
      continue;
    }
  }
  return null;
}

function useCache(options?: { allowExpired?: boolean }): SheetCachePayload | null {
  const cached = loadSheetCache({ allowExpired: options?.allowExpired });
  if (!cached) return null;
  const age = Date.now() - cached.fetchedAt;
  if (age > SHEET_CACHE_TTL && !options?.allowExpired) return null;
  return cached;
}

function parsePayload(payload: SheetCachePayload): MovieRecord[] {
  const parsed = parseCsv(payload.text);
  return parsed.map(mapToMovie);
}

export async function fetchMovies(options?: FetchOptions): Promise<FetchMoviesResult> {
  const urls = buildSheetUrls();

  // Prefer fresh cache when not forcing a network pull.
  if (!options?.forceNetwork) {
    const freshCache = useCache();
    if (freshCache) {
      return {
        movies: parsePayload(freshCache),
        meta: { source: 'cache-fresh', fetchedAt: freshCache.fetchedAt, url: freshCache.sourceUrl }
      };
    }
  }

  const networkPayload = await tryNetwork(urls);
  if (networkPayload) {
    return {
      movies: parsePayload(networkPayload),
      meta: { source: 'network', fetchedAt: networkPayload.fetchedAt, url: networkPayload.sourceUrl }
    };
  }

  const staleCache = useCache({ allowExpired: true });
  if (staleCache) {
    return {
      movies: parsePayload(staleCache),
      meta: { source: 'cache-stale', fetchedAt: staleCache.fetchedAt, url: staleCache.sourceUrl }
    };
  }

  if (embeddedSheetBackup) {
    try {
      const parsed = parseCsv(embeddedSheetBackup);
      return {
        movies: parsed.map(mapToMovie),
        meta: { source: 'embedded' }
      };
    } catch (error) {
      console.error('Failed to parse embedded sheet backup', error);
    }
  }

  console.error('Falling back to demo data after sheet failures');
  return { movies: fallbackMovies, meta: { source: 'demo' } };
}

export function getSheetUrl(): string {
  const [primary] = buildSheetUrls();
  return primary;
}
