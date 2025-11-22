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
  imdbId?: string;
  imdbRating?: string;
  imdbYear?: string;
  imdbTitle?: string;
  posterUrl?: string;
  plot?: string;
  imdbGenres?: string[];
};

export type MovieFilters = {
  query: string;
  seccion: string | null;
  genre: string | null;
  seen: 'all' | 'seen' | 'unseen';
  view: 'grid' | 'list';
  sort: 'title-asc' | 'title-desc' | 'year-asc' | 'year-desc' | 'imdb-desc' | 'imdb-asc' | 'rating-desc' | 'rating-asc';
};
