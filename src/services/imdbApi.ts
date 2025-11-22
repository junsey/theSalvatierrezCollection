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
// Default key provided by the user as a fallback so posters/ratings load out of the box.
const DEFAULT_OMDB_KEY = 'fd2b1d69';

async function fetchOmdb(title: string, year?: number | null): Promise<ImdbResult | null> {
  const apiKey = import.meta.env.VITE_OMDB_API_KEY ?? DEFAULT_OMDB_KEY;

  const fetchByTitle = async (y?: number | null) => {
    const url = new URL(OMDB_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('t', title);
    url.searchParams.set('plot', 'short');
    if (y) {
      url.searchParams.set('y', String(y));
    }
    url.searchParams.set('type', 'movie');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = (await response.json()) as { Response?: string } & ImdbResult;
    if (data.Response === 'False') return null;
    return data;
  };

  const fetchById = async (id: string) => {
    const url = new URL(OMDB_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('i', id);
    url.searchParams.set('plot', 'short');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = (await response.json()) as { Response?: string } & ImdbResult;
    if (data.Response === 'False') return null;
    return data;
  };

  const searchByTitle = async () => {
    const url = new URL(OMDB_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('s', title);
    url.searchParams.set('type', 'movie');
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = (await response.json()) as { Response?: string; Search?: { imdbID: string }[] };
    if (data.Response === 'False' || !data.Search?.length) return null;
    return fetchById(data.Search[0].imdbID);
  };

  const withYear = await fetchByTitle(year ?? undefined);
  if (withYear) return withYear;

  const withoutYear = await fetchByTitle();
  if (withoutYear) return withoutYear;

  return searchByTitle();
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
