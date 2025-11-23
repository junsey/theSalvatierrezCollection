export type MovieRecord = {
  id: string;
  seccion: string;
  year: number | null;
  saga: string;
  title: string;
  originalTitle?: string;
  genreRaw: string;
  director: string;
  directorTmdbId?: number | null;
  directorTmdbIds?: number[];
  group: string;
  seen: boolean;
  series?: boolean;
  season?: number | null;
  rating?: number | null;
  ratingGloria?: number | null;
  ratingRodrigo?: number | null;
  dubbing: string;
  format: string;
  enDeposito?: boolean;
  funcionaStatus: 'working' | 'damaged' | 'untested';
  tmdbId?: number;
  tmdbRating?: number | null;
  tmdbYear?: number | null;
  tmdbTitle?: string;
  tmdbOriginalTitle?: string;
  tmdbType?: 'movie' | 'tv';
  posterUrl?: string;
  plot?: string;
  tmdbGenres?: string[];
  tmdbSeasons?: {
    seasonNumber: number;
    name?: string | null;
    episodeCount?: number | null;
    airDate?: string | null;
  }[];
  tmdbStatus?: TmdbStatus;
};

export type TmdbStatus = {
  source: 'network' | 'cache' | 'stale-cache' | 'not-found' | 'error' | 'none';
  requestedTitles: string[];
  requestedYear?: number | null;
  matchedId?: number;
  matchedTitle?: string;
  matchedOriginalTitle?: string;
  fetchedAt?: number;
  message?: string;
  error?: string;
};

export type MovieFilters = {
  query: string;
  seccion: string | null;
  genre: string | null;
  saga: string | null;
  series: 'all' | 'series' | 'movies';
  seen: 'all' | 'seen' | 'unseen';
  view: 'grid' | 'list';
  sort:
    | 'title-asc'
    | 'title-desc'
    | 'year-asc'
    | 'year-desc'
    | 'tmdb-desc'
    | 'tmdb-asc'
    | 'rating-desc'
    | 'rating-asc';
};
