export type MovieRecord = {
  id: string;
  seccion: string;
  year: number | null;
  saga: string;
  title: string;
  originalTitle?: string;
  genreRaw: string;
  director: string;
  group: string;
  seen: boolean;
  rating?: number | null;
  dubbing: string;
  format: string;
  /**
   * Campo de compatibilidad heredado de la API antigua; no se usa con TMDb
   * pero evita errores de compilación si reaparecen datos legados.
   */
  imdbId?: string;
  tmdbId?: number;
  tmdbRating?: number | null;
  tmdbYear?: number | null;
  tmdbTitle?: string;
  tmdbOriginalTitle?: string;
  posterUrl?: string;
  plot?: string;
  tmdbGenres?: string[];
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
