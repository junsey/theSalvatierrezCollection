import { MovieRecord } from '../types/MovieRecord';

export type GroupedSeason = {
  seasonNumber: number;
  owned: boolean;
  posterUrl?: string;
};

export type GroupedMovie = MovieRecord & {
  groupedSeasons?: GroupedSeason[];
  groupedDisplayTitle?: string;
  groupedIsSeriesCard?: boolean;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const isSeries = (movie: MovieRecord) => movie.series || movie.tmdbType === 'tv';

const getSeriesKey = (movie: MovieRecord) => {
  if (movie.tmdbId) return `tmdb:${movie.tmdbId}`;
  const baseTitle = movie.tmdbTitle ?? movie.title;
  const year = movie.tmdbYear ?? movie.year ?? '';
  return `title:${normalizeText(baseTitle)}|${year}`;
};

const pickSeasonSource = (group: MovieRecord[]) => {
  const withSeasons = group.filter((movie) => (movie.tmdbSeasons ?? []).length > 0);
  if (withSeasons.length === 0) return null;
  return withSeasons.sort((a, b) => (b.tmdbSeasons?.length ?? 0) - (a.tmdbSeasons?.length ?? 0))[0];
};

const buildGroupedSeasons = (group: MovieRecord[], seasonSource: MovieRecord | null): GroupedSeason[] => {
  const owned = new Set<number>();
  group.forEach((movie) => {
    if (Number.isFinite(movie.season)) owned.add(Number(movie.season));
  });

  const sourceSeasons = seasonSource?.tmdbSeasons ?? [];
  if (sourceSeasons.length > 0) {
    return sourceSeasons
      .map((season) => ({
        seasonNumber: season.seasonNumber,
        owned: owned.has(season.seasonNumber),
        posterUrl: season.posterUrl
      }))
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  return Array.from(owned)
    .sort((a, b) => a - b)
    .map((seasonNumber) => ({ seasonNumber, owned: true }));
};

export const groupSeriesForDisplay = (allMovies: MovieRecord[], filteredMovies: MovieRecord[]): GroupedMovie[] => {
  const allGroups = new Map<string, MovieRecord[]>();
  allMovies.forEach((movie) => {
    if (!isSeries(movie)) return;
    const key = getSeriesKey(movie);
    const bucket = allGroups.get(key) ?? [];
    bucket.push(movie);
    allGroups.set(key, bucket);
  });

  const output: GroupedMovie[] = [];
  const usedSeries = new Set<string>();

  filteredMovies.forEach((movie) => {
    if (!isSeries(movie)) {
      output.push(movie);
      return;
    }

    const key = getSeriesKey(movie);
    if (usedSeries.has(key)) return;
    usedSeries.add(key);

    const group = allGroups.get(key) ?? [movie];
    const sortedGroup = [...group].sort((a, b) => {
      const aSeason = a.season ?? Number.MAX_SAFE_INTEGER;
      const bSeason = b.season ?? Number.MAX_SAFE_INTEGER;
      if (aSeason !== bSeason) return aSeason - bSeason;
      return a.title.localeCompare(b.title);
    });
    const base = sortedGroup[0];
    const seasonSource = pickSeasonSource(group);
    const groupedSeasons = buildGroupedSeasons(group, seasonSource);
    const groupedDisplayTitle = base.tmdbTitle ?? base.title;

    output.push({
      ...base,
      groupedSeasons,
      groupedDisplayTitle,
      groupedIsSeriesCard: true
    });
  });

  return output;
};
