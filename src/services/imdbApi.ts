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

const OMDB_URL = import.meta.env.VITE_OMDB_URL ?? 'https://www.omdbapi.com/';

async function fetchOmdb(title: string, year?: number | null): Promise<ImdbResult | null> {
  const apiKey = import.meta.env.VITE_OMDB_API_KEY;
  if (!apiKey) {
    console.warn('OMDb key missing - skipping IMDb enrichment. Add VITE_OMDB_API_KEY to .env');
    return null;
  }
  const url = new URL(OMDB_URL);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('t', title);
  if (year) {
    url.searchParams.set('y', String(year));
  }
  url.searchParams.set('type', 'movie');
  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const data = (await response.json()) as { Response?: string } & ImdbResult;
  if (data.Response === 'False') return null;
  return data;
}

export async function enrichWithImdb(movie: MovieRecord): Promise<MovieRecord> {
  try {
    const data = await fetchOmdb(movie.title, movie.year);
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
    console.error('IMDb lookup failed for', movie.title, error);
    return movie;
  }
}
