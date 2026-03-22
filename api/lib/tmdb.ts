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

const normalizePersonName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshteinDistance = (left: string, right: string) => {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
};

const scorePersonNameMatch = (query: string, candidate: string) => {
  const normalizedQuery = normalizePersonName(query);
  const normalizedCandidate = normalizePersonName(candidate);
  if (!normalizedQuery || !normalizedCandidate) return -Infinity;
  if (normalizedQuery === normalizedCandidate) return 1;
  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) return 0.94;

  const queryTokens = normalizedQuery.split(' ');
  const candidateTokens = normalizedCandidate.split(' ');
  const sharedTokens = queryTokens.filter((token) => candidateTokens.includes(token)).length;
  const tokenScore = sharedTokens / Math.max(queryTokens.length, candidateTokens.length);
  const distance = levenshteinDistance(normalizedQuery, normalizedCandidate);
  const distanceScore = 1 - distance / Math.max(normalizedQuery.length, normalizedCandidate.length, 1);

  return distanceScore * 0.75 + tokenScore * 0.25;
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
  character?: string;
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
  const candidates = new Map<number, TmdbPersonSearchResult>();
  const normalizedTokens = normalizePersonName(name).split(' ').filter((token) => token.length >= 3);
  const queries = Array.from(new Set([
    name,
    ...normalizedTokens,
    ...normalizedTokens.map((token) => token.slice(0, 4)).filter((token) => token.length >= 3)
  ]));

  for (const query of queries) {
    const data = await tmdbFetchJson<{ results?: TmdbPersonSearchResult[] }>('search/person', {
      query
    });
    (data.results ?? []).slice(0, 8).forEach((person) => {
      candidates.set(person.id, person);
    });
    if (candidates.size >= 8) break;
  }

  const scored = Array.from(candidates.values())
    .map((person) => ({ person, score: scorePersonNameMatch(name, person.name) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.58) return null;
  return best.person;
};


export const fetchTmdbPersonKnownTitles = async (id: number): Promise<Array<{
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: number | null;
  character?: string | null;
}>> => {
  const data = await tmdbFetchJson<{ cast?: TmdbPersonCredit[] }>(`person/${id}/combined_credits`);
  const matches = new Map<number, {
    id: number;
    mediaType: 'movie' | 'tv';
    title: string;
    year: number | null;
    character?: string | null;
  }>();
  (data.cast ?? [])
    .filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && isFeatureLengthProduction(item))
    .forEach((item) => {
      const title = (item.title ?? item.name ?? '').trim();
      if (!title) return;
      const year = parseYear(item.media_type === 'tv' ? item.first_air_date : item.release_date);
      matches.set(item.id, {
        id: item.id,
        mediaType: item.media_type === 'tv' ? 'tv' : 'movie',
        title,
        year,
        character: item.character?.trim() || null
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
