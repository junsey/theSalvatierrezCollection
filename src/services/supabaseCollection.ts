import { FetchMoviesResult, SheetMeta } from './googleSheets';
import { MovieRecord } from '../types/MovieRecord';

type CollectionRow = {
  id: string;
  Seccion?: string | null;
  'AAAño'?: number | null;
  'Año'?: number | null;
  Serie?: boolean | null;
  Temporada?: number | null;
  Saga?: string | null;
  Titulo?: string | null;
  'Titulo Original'?: string | null;
  Genero?: string | null;
  Director?: string | null;
  Grupo?: string | null;
  Vista?: boolean | null;
  Doblaje?: string | null;
  Formato?: string | null;
  'Puntuacion Rodrigo'?: number | null;
  'Puntuacion Gloria'?: number | null;
  Funciona?: string | boolean | null;
  'En depA3sito'?: boolean | string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let didLogConfig = false;

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function logConfigOnce() {
  if (!import.meta.env.DEV || didLogConfig) return;
  didLogConfig = true;
  console.log('Supabase collection config', {
    hasUrl: Boolean(SUPABASE_URL),
    hasAnonKey: Boolean(SUPABASE_ANON_KEY),
    url: SUPABASE_URL
  });
}

async function supabaseRequest<T>(path: string): Promise<T> {
  const url = `${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
    'Content-Type': 'application/json'
  };
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const text = await response.text();
    if (import.meta.env.DEV) {
      console.warn('Supabase collection request failed', {
        status: response.status,
        hasApiKey: Boolean(headers.apikey),
        apiKeyLength: headers.apikey.length,
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

const parseFunciona = (value: unknown): 'working' | 'damaged' | 'untested' => {
  const normalized = (typeof value === 'string' ? value : value == null ? '' : String(value))
    .trim()
    .toLowerCase();
  if (!normalized) return 'untested';

  const workingTokens = ['si', 'sA-', 'yes', 'y', 'true', 'ok', 'bueno', 'funciona', 'bien'];
  const damagedTokens = ['no', 'false', 'daAñado', 'daniado', 'malo', 'broken', 'defectuoso'];

  if (workingTokens.includes(normalized)) return 'working';
  if (damagedTokens.includes(normalized)) return 'damaged';
  return 'untested';
};

const parseEnDeposito = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
};

const toText = (value: unknown, fallback = ''): string => {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  return String(value);
};

function mapRow(row: CollectionRow): MovieRecord {
  return {
    id: row.id,
    seccion: toText(row.Seccion, 'Desconocida'),
    year: (row as any)['A\u00f1o'] ?? (row as any)['AA\u00f1o'] ?? (row as any)['AAA\u00f1o'] ?? null,
    saga: toText(row.Saga),
    title: toText(row.Titulo, 'Sin tA-tulo'),
    originalTitle: toText(row['Titulo Original']),
    genreRaw: toText(row.Genero),
    director: toText(row.Director),
    group: toText(row.Grupo),
    seen: row.Vista ?? false,
    series: row.Serie ?? undefined,
    season: row.Temporada ?? undefined,
    ratingGloria: row['Puntuacion Gloria'] ?? null,
    ratingRodrigo: row['Puntuacion Rodrigo'] ?? null,
    dubbing: toText(row.Doblaje),
    format: toText(row.Formato),
    enDeposito: parseEnDeposito((row as any)['En depósito']),
    funcionaStatus: parseFunciona(row.Funciona ?? '')
  };
}

export async function fetchCollectionFromSupabase(): Promise<FetchMoviesResult | null> {
  logConfigOnce();
  if (!isConfigured()) return null;
  const pageSize = 1000;
  let offset = 0;
  const rows: Record<string, unknown>[] = [];
  while (true) {
    const params = new URLSearchParams({
      select: '*',
      order: 'Titulo',
      limit: String(pageSize),
      offset: String(offset)
    });
    const chunk = await supabaseRequest<Record<string, unknown>[]>(`Coleccion_Salvatierrez?${params.toString()}`);
    if (chunk?.length) {
      rows.push(...chunk);
    }
    if (!chunk || chunk.length < pageSize) {
      break;
    }
    offset += pageSize;
  }
  const mapped = (rows ?? []).map((row) => {
    const record = row as CollectionRow & { [key: string]: unknown };
    if ((record as any)['A\u00f1o'] !== undefined) return mapRow(record);
    if ((record as any)['AA\u00f1o'] !== undefined) {
      return mapRow({ ...record, 'A\u00f1o': (record as any)['AA\u00f1o'] as number | null });
    }
    if ((record as any)['AAA\u00f1o'] !== undefined) {
      return mapRow({ ...record, 'A\u00f1o': (record as any)['AAA\u00f1o'] as number | null });
    }
    return mapRow(record);
  });
  const meta: SheetMeta = {
    source: 'supabase',
    fetchedAt: Date.now(),
    url: SUPABASE_URL
  };
  return { movies: mapped, meta };
}
