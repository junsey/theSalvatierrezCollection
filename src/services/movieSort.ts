import { MovieRecord } from '../types/MovieRecord';

const shelfCollator = new Intl.Collator('es', { sensitivity: 'base' });

const getShelfKey = (movie: MovieRecord) => {
  const saga = movie.saga?.trim();
  return saga ? saga : movie.title.trim();
};

export const compareShelfSort = (a: MovieRecord, b: MovieRecord) => {
  const keyCompare = shelfCollator.compare(getShelfKey(a), getShelfKey(b));
  if (keyCompare !== 0) return keyCompare;
  return shelfCollator.compare(a.title, b.title);
};
