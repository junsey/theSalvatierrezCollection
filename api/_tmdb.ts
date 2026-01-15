const API_BASE = 'https://api.themoviedb.org/3';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

type TmdbMediaType = 'movie' | 'tv';

type TmdbSearchResult = {
  id: number;
  mediaType: TmdbMediaType;
};

type TmdbDetails = {
  id: number;
  mediaType: TmdbMediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  rating: number | null;
  genres: string[];
  posterPath: string | null;
  plot: string | null;
  directors: Array<{ id: number; name: string; profilePath?: string | null }>;
};

const tmdbFetchJson = async <T>(path: string, params?: Record<string, string | number | null>) => {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY missing.');
  }
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', 'es-ES');
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value == null) return;
      url.searchParams.set(key, String(value));
    });
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TMDb error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
};

const parseYear = (value?: string | null): number | null => {
  if (!value) return null;
  const [yearStr] = value.split('-');
  const year = Number(yearStr);
  return Number.isFinite(year) ? year : null;
};

export const searchTmdb = async (title: string, year: number | null, mediaType: TmdbMediaType): Promise<TmdbSearchResult | null> => {
  const params: Record<string, string | number | null> = { query: title };
  if (mediaType === 'movie' && year) params.year = year;
  if (mediaType === 'tv' && year) params.first_air_date_year = year;
  const data = await tmdbFetchJson<{ results?: Array<{ id: number; release_date?: string; first_air_date?: string }> }>(
    `search/${mediaType}`,
    params
  );
  const results = data.results ?? [];
  if (results.length === 0) return null;
  if (!year) {
    return { id: results[0].id, mediaType };
  }
  const match = results.find((item) => parseYear(mediaType === 'movie' ? item.release_date : item.first_air_date) === year);
  return { id: (match ?? results[0]).id, mediaType };
};

export const fetchTmdbDetails = async (id: number, mediaType: TmdbMediaType): Promise<TmdbDetails> => {
  if (mediaType === 'movie') {
    const details = await tmdbFetchJson<{
      id: number;
      title: string;
      original_title?: string;
      release_date?: string | null;
      vote_average?: number | null;
      genres?: Array<{ name: string }>;
      poster_path?: string | null;
      overview?: string | null;
    }>(`movie/${id}`);
    const credits = await tmdbFetchJson<{ crew?: Array<{ id: number; name: string; job?: string; profile_path?: string | null }> }>(
      `movie/${id}/credits`
    );
    const directors = (credits.crew ?? [])
      .filter((member) => (member.job ?? '').toLowerCase() === 'director')
      .map((member) => ({ id: member.id, name: member.name, profilePath: member.profile_path ?? null }));
    return {
      id: details.id,
      mediaType,
      title: details.title,
      originalTitle: details.original_title ?? details.title,
      year: parseYear(details.release_date),
      rating: details.vote_average ?? null,
      genres: (details.genres ?? []).map((genre) => genre.name),
      posterPath: details.poster_path ?? null,
      plot: details.overview ?? null,
      directors
    };
  }

  const details = await tmdbFetchJson<{
    id: number;
    name: string;
    original_name?: string;
    first_air_date?: string | null;
    vote_average?: number | null;
    genres?: Array<{ name: string }>;
    poster_path?: string | null;
    overview?: string | null;
    created_by?: Array<{ id: number; name: string; profile_path?: string | null }>;
  }>(`tv/${id}`);
  const directors =
    details.created_by?.map((creator) => ({
      id: creator.id,
      name: creator.name,
      profilePath: creator.profile_path ?? null
    })) ?? [];
  return {
    id: details.id,
    mediaType,
    title: details.name,
    originalTitle: details.original_name ?? details.name,
    year: parseYear(details.first_air_date),
    rating: details.vote_average ?? null,
    genres: (details.genres ?? []).map((genre) => genre.name),
    posterPath: details.poster_path ?? null,
    plot: details.overview ?? null,
    directors
  };
};
