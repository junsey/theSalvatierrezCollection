import { MovieRecord } from '../types/MovieRecord';

export const splitDirectors = (value: string) =>
  value
    .split(/[,;/&]/g)
    .map((d) => d.trim())
    .filter(Boolean);

export const normalizeDirectorName = (value: string) => value.trim().toLowerCase();

export const buildDirectorOverrideMap = (movies: MovieRecord[]): Map<string, number> => {
  const overrides = new Map<string, number>();

  movies.forEach((movie) => {
    const ids = movie.directorTmdbIds?.filter((id) => Number.isFinite(id)) ?? [];
    if (ids.length === 0 && movie.directorTmdbId != null && Number.isFinite(movie.directorTmdbId)) {
      ids.push(movie.directorTmdbId);
    }
    if (ids.length === 0) return;

    const names = splitDirectors(movie.director);
    names.forEach((name, index) => {
      const normalized = normalizeDirectorName(name);
      if (overrides.has(normalized)) return;
      const chosenId = ids[index] ?? ids[0];
      if (chosenId != null) {
        overrides.set(normalized, chosenId);
      }
    });
  });

  return overrides;
};
