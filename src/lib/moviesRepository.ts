import { supabase } from './supabaseClient';
import { MovieRecord } from '../types/MovieRecord';

export type MovieRow = {
  id: number;
  tmdb_id: number | null;
  title_local: string;
  title_original: string | null;
  year: number | null;
  genero: string | null;
  serie: boolean | null;
  temporada: number | null;
  director: string | null;
  poster_path: string | null;
  runtime: number | null;
  media_type: string | null;
  created_at: string | null;
};

export async function getAllMovies() {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .order('title_local', { ascending: true });

  if (error) {
    console.error('Error fetching movies from Supabase', error);
    throw error;
  }

  return (data ?? []) as MovieRow[];
}

export async function getMoviesByDirector(directorName: string) {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .ilike('director', directorName);

  if (error) {
    console.error('Error fetching movies by director', error);
    throw error;
  }

  return (data ?? []) as MovieRow[];
}

export async function getMovieByTmdbId(tmdbId: number) {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('tmdb_id', tmdbId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching movie by TMDb ID', error);
    throw error;
  }

  return (data as MovieRow | null) ?? null;
}

export async function getOwnedTmdbIds(): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('movies')
    .select('tmdb_id');

  if (error) {
    console.error('Error fetching owned TMDb IDs', error);
    throw error;
  }

  const ids = new Set<number>();
  for (const row of data ?? []) {
    if (row.tmdb_id != null) {
      ids.add(row.tmdb_id);
    }
  }
  return ids;
}

export function mapRowToMovieRecord(row: MovieRow): MovieRecord {
  const tmdbId = row.tmdb_id ?? undefined;
  const requestedTitles = [row.title_original, row.title_local].filter(Boolean) as string[];
  const genreRaw = row.genero ?? '';
  const localTitle = row.title_local || 'Sin título';

  return {
    id: String(row.id),
    seccion: genreRaw || 'Colección',
    year: row.year,
    saga: '',
    title: localTitle,
    originalTitle: row.title_original ?? undefined,
    genreRaw,
    director: row.director ?? '',
    directorTmdbId: null,
    directorTmdbIds: undefined,
    group: '',
    seen: false,
    series: row.serie ?? false,
    season: row.temporada,
    rating: null,
    ratingGloria: null,
    ratingRodrigo: null,
    dubbing: '',
    format: '',
    enDeposito: false,
    funcionaStatus: 'untested',
    tmdbId,
    tmdbRating: null,
    tmdbYear: row.year,
    tmdbTitle: localTitle,
    tmdbOriginalTitle: row.title_original ?? undefined,
    tmdbType: row.media_type === 'tv' ? 'tv' : row.media_type === 'movie' ? 'movie' : undefined,
    posterUrl: row.poster_path ?? undefined,
    plot: undefined,
    tmdbGenres: genreRaw
      ? genreRaw
          .split(';')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : undefined,
    tmdbSeasons: undefined,
    tmdbStatus: { source: 'none', requestedTitles, requestedYear: row.year }
  };
}
