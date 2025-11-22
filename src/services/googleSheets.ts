import { MovieRecord } from '../types/MovieRecord';

const SHEET_CSV_URL =
  import.meta.env.VITE_SHEETS_CSV_URL ??
  'https://docs.google.com/spreadsheets/d/1_kDej_nXLnz1REls5jDyqjIZU5z_fsN4mHap60_uvCI/export?format=csv';

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

export async function fetchMovies(): Promise<MovieRecord[]> {
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) {
      throw new Error('Failed to load sheet');
    }
    const text = await response.text();
    const parsed = parseCsv(text);
    return parsed.map(mapToMovie);
  } catch (error) {
    console.error('Falling back to demo data', error);
    return fallbackMovies;
  }
}

export function getSheetUrl(): string {
  return SHEET_CSV_URL;
}
