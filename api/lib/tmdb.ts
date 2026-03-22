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

const tmdbFetchJson = async <T>(
  path: string,
  params?: Record<string, string | number | null>,
  options?: { language?: string }
) => {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY missing.');
  }
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', options?.language ?? 'es-ES');
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

type TmdbPersonDetails = {
  id: number;
  name: string;
  biography?: string | null;
  profile_path?: string | null;
};

type TmdbPersonSearchResult = {
  id: number;
  name: string;
};

type TmdbPersonCredit = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  job?: string;
  release_date?: string | null;
  first_air_date?: string | null;
  poster_path?: string | null;
  popularity?: number | null;
  video?: boolean | null;
  genre_ids?: number[];
};

const isFeatureLengthProduction = (item: { title?: string | null; name?: string | null; video?: boolean | null }) => {
  const title = (item.title ?? item.name ?? '').toLowerCase();
  const isMarkedVideo = item.video === true;
  const looksLikeShort = /\bshort\b|\bcorto\b/.test(title);
  return !isMarkedVideo && !looksLikeShort;
};

export const searchTmdbPerson = async (name: string): Promise<TmdbPersonSearchResult | null> => {
  const data = await tmdbFetchJson<{ results?: TmdbPersonSearchResult[] }>('search/person', {
    query: name
  });
  return data.results?.[0] ?? null;
};


export const fetchTmdbPersonKnownTitles = async (id: number): Promise<Array<{ id: number; mediaType: 'movie' | 'tv' }>> => {
  const data = await tmdbFetchJson<{ cast?: TmdbPersonCredit[]; crew?: TmdbPersonCredit[] }>(`person/${id}/combined_credits`);
  const matches = new Map<number, { id: number; mediaType: 'movie' | 'tv' }>();
  [...(data.cast ?? []), ...(data.crew ?? [])]
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .forEach((item) => {
      matches.set(item.id, {
        id: item.id,
        mediaType: item.media_type === 'tv' ? 'tv' : 'movie'
      });
    });
  return Array.from(matches.values());
};

export const fetchTmdbPersonDetails = async (id: number): Promise<{ id: number; name: string; biography: string | null; profilePath: string | null }> => {
  const primary = await tmdbFetchJson<TmdbPersonDetails>(`person/${id}`);
  const needsFallback = !primary?.biography || primary.biography.trim() === '';
  const fallback = needsFallback ? await tmdbFetchJson<TmdbPersonDetails>(`person/${id}`, undefined, { language: 'en-US' }) : null;
  const chosen = primary ?? fallback;
  return {
    id: chosen.id,
    name: chosen.name,
    biography: (needsFallback ? fallback?.biography ?? primary?.biography : primary?.biography) ?? null,
    profilePath: chosen.profile_path ?? fallback?.profile_path ?? null
  };
};

export const fetchTmdbPersonFilmography = async (id: number): Promise<Array<{
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  job?: string;
  mediaType: 'movie' | 'tv';
}> > => {
  const data = await tmdbFetchJson<{ crew?: TmdbPersonCredit[] }>(`person/${id}/combined_credits`);
  const directedMovies = new Map<number, { id: number; title: string; year: number | null; posterPath: string | null; job?: string; mediaType: 'movie' | 'tv' }>();
  (data.crew ?? [])
    .filter((item) => {
      if (item.media_type !== 'movie' && item.media_type !== 'tv') return false;
      const job = (item.job ?? '').trim().toLowerCase();
      const isDirector = job === 'director' || job === 'series director' || job === 'director de la serie';
      const isCreator = job === 'creator' || job === 'series creator';
      if (!isDirector && !isCreator) return false;
      if (item.media_type === 'movie' && !isFeatureLengthProduction(item)) return false;
      return true;
    })
    .forEach((item) => {
      const title = item.title ?? item.name ?? 'Produccion sin titulo';
      const year = parseYear(item.media_type === 'tv' ? item.first_air_date : item.release_date);
      const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
      directedMovies.set(item.id, {
        id: item.id,
        title,
        year,
        posterPath: item.poster_path ?? null,
        job: item.job ?? undefined,
        mediaType
      });
    });
  return Array.from(directedMovies.values());
};
