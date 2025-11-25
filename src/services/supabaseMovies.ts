import { getAllMovies, mapRowToMovieRecord } from '../lib/moviesRepository';
import { CollectionMeta } from '../types/CollectionMeta';
import { MovieRecord } from '../types/MovieRecord';

export type FetchMoviesResult = {
  movies: MovieRecord[];
  meta: CollectionMeta;
};

export async function fetchMoviesFromSupabase(): Promise<FetchMoviesResult> {
  const rows = await getAllMovies();
  const movies = rows.map(mapRowToMovieRecord);
  return {
    movies,
    meta: { source: 'supabase', fetchedAt: Date.now() }
  };
}
