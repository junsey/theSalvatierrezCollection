import { MovieRecord } from '../types/MovieRecord';

export type CuratorMoviePayload = {
  id: string;
  title: string;
  originalTitle?: string;
  director: string;
  genreRaw: string;
  seccion: string;
  saga: string;
  group: string;
  series?: boolean;
  season?: number | null;
  year: number | null;
  seen: boolean;
  enDeposito?: boolean;
  funcionaStatus: MovieRecord['funcionaStatus'];
  ratingGloria?: number | null;
  ratingRodrigo?: number | null;
  tmdbRating?: number | null;
  tmdbGenres?: string[];
  format: string;
  region?: string;
  dubbing?: boolean | string | null;
  plot?: string;
  tmdbId?: number;
};

const shorten = (value: string | undefined, maxLength: number) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 1)}…`;
};

export const buildCuratorPayload = (movies: MovieRecord[]): CuratorMoviePayload[] =>
  movies.map((movie) => ({
    id: movie.id,
    title: movie.title,
    originalTitle: shorten(movie.originalTitle, 120),
    director: movie.director,
    genreRaw: movie.genreRaw,
    seccion: movie.seccion,
    saga: movie.saga,
    group: movie.group,
    series: movie.series,
    season: movie.season ?? null,
    year: movie.year ?? movie.tmdbYear ?? null,
    seen: movie.seen,
    enDeposito: movie.enDeposito,
    funcionaStatus: movie.funcionaStatus,
    ratingGloria: movie.ratingGloria ?? null,
    ratingRodrigo: movie.ratingRodrigo ?? null,
    tmdbRating: movie.tmdbRating ?? null,
    tmdbGenres: movie.tmdbGenres?.slice(0, 6),
    format: movie.format,
    region: movie.region,
    dubbing: movie.dubbing,
    plot: shorten(movie.plot, 360),
    tmdbId: movie.tmdbId
  }));
