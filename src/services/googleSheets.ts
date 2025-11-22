import { MovieRecord } from '../types/MovieRecord';

const SHEET_ID = '1_kDej_nXLnz1REls5jDyqjIZU5z_fsN4mHap60_uvCI';
const SHEET_CACHE_KEY = 'salvatierrez-sheet-cache-v1';
const SHEET_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

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
    genreRaw: 'Aventura; Fantasia',
    director: 'Demo Director',
    group: 'Coleccion',
    seen: false,
    rating: 7,
    dubbing: 'Español',
    format: 'Blu-ray'
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

function mapToMovie(record: Record<string, string>, index: number): MovieRecord {
  return {
    id: `${record['Titulo'] ?? 'movie'}-${index}`,
    seccion: record['Seccion'] ?? 'Desconocida',
    year: safeNumber(record['Año'] ?? ''),
    saga: record['Saga'] ?? '',
    title: record['Titulo'] ?? 'Sin título',
    genreRaw: record['Genero'] ?? '',
    director: record['Director'] ?? '',
    group: record['Grupo'] ?? '',
    seen: parseBoolean(record['Vista'] ?? ''),
    rating: safeNumber(record['Puntuacion'] ?? ''),
    dubbing: record['Doblaje'] ?? '',
    format: record['Formato'] ?? ''
  };
}

function saveSheetCache(text: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      SHEET_CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), text })
    );
  } catch (error) {
    console.error('Failed to save sheet cache', error);
  }
}

function loadSheetCache(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SHEET_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt: number; text: string };
    if (Date.now() - parsed.fetchedAt > SHEET_CACHE_TTL) return null;
    return parsed.text;
  } catch (error) {
    console.error('Failed to read sheet cache', error);
    return null;
  }
}

export async function fetchMovies(): Promise<MovieRecord[]> {
  const urls = buildSheetUrls();

  for (const url of urls) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        console.warn('Sheet fetch failed, trying next URL', url, response.status);
        continue;
      }
      const text = await response.text();
      saveSheetCache(text);
      const parsed = parseCsv(text);
      return parsed.map(mapToMovie);
    } catch (error) {
      console.warn('Sheet fetch threw, trying next URL', url, error);
      continue;
    }
  }

  const cached = loadSheetCache();
  if (cached) {
    try {
      const parsed = parseCsv(cached);
      return parsed.map(mapToMovie);
    } catch (error) {
      console.error('Failed to parse cached sheet', error);
    }
  }

  console.error('Falling back to demo data after sheet failures');
  return fallbackMovies;
}

export function getSheetUrl(): string {
  const [primary] = buildSheetUrls();
  return primary;
}
