import { DirectedMovie } from './tmdbPeopleService';
import { getTmdbImageBaseUrl } from './tmdbApi';

type SupabaseDirectorRow = {
  id: string;
  tmdb_person_id: number;
  name: string;
  profile_path?: string | null;
};

type SupabaseFilmographyRow = {
  tmdb_movie_id: number;
  title: string;
  year?: number | null;
  is_visible?: boolean | null;
  poster_path?: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

async function supabaseRequest<T>(path: string): Promise<T> {
  const url = `${SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/${path}`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

export async function fetchDirectorByName(name: string) {
  if (!isConfigured() || !name) return null;
  const params = new URLSearchParams({
    select: 'id,tmdb_person_id,name,profile_path',
    limit: '1'
  });
  params.set('name', `ilike.*${name.replace(/%/g, '\\%')}*`);
  const rows = await supabaseRequest<SupabaseDirectorRow[]>(`tmdb_directors?${params.toString()}`);
  return rows?.[0] ?? null;
}

export async function fetchDirectorByPersonId(personId: number) {
  if (!isConfigured()) return null;
  const params = new URLSearchParams({
    select: 'id,tmdb_person_id,name,profile_path',
    limit: '1'
  });
  params.set('tmdb_person_id', `eq.${personId}`);
  const rows = await supabaseRequest<SupabaseDirectorRow[]>(`tmdb_directors?${params.toString()}`);
  return rows?.[0] ?? null;
}

export async function fetchDirectorFilmographyByPersonId(personId: number): Promise<DirectedMovie[]> {
  if (!isConfigured()) return [];
  const params = new URLSearchParams({
    select: 'tmdb_movie_id,title,year,is_visible,poster_path'
  });
  params.set('tmdb_person_id', `eq.${personId}`);
  params.set('is_visible', 'eq.true');
  const rows = await supabaseRequest<SupabaseFilmographyRow[]>(`tmdb_director_filmography?${params.toString()}`);
  const base = await getTmdbImageBaseUrl();
  return (rows ?? [])
    .map((movie) => ({
      id: Number(movie.tmdb_movie_id ?? 0),
      title: movie.title ?? 'Sin tA-tulo',
      year: movie.year ?? null,
      posterPath: movie.poster_path ?? null,
      posterUrl: movie.poster_path ? `${base}w300${movie.poster_path}` : undefined
    }))
    .filter((movie) => movie.id);
}

export async function buildDirectorProfileUrl(profilePath?: string | null): Promise<string | undefined> {
  if (!profilePath) return undefined;
  const base = await getTmdbImageBaseUrl();
  return `${base}w300${profilePath}`;
}

export async function fetchAllDirectorProfiles(): Promise<Record<string, string>> {
  if (!isConfigured()) return {};
  const params = new URLSearchParams({
    select: 'name,profile_path',
    limit: '2000'
  });
  const rows = await supabaseRequest<SupabaseDirectorRow[]>(`tmdb_directors?${params.toString()}`);
  const base = await getTmdbImageBaseUrl();
  const map: Record<string, string> = {};
  for (const row of rows ?? []) {
    if (!row.name || !row.profile_path) continue;
    map[row.name.toLowerCase()] = `${base}w300${row.profile_path}`;
  }
  return map;
}
