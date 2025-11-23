import { MovieFilters, MovieRecord } from '../types/MovieRecord';
import { SheetMeta } from './googleSheets';

type StoredState = {
  seen: Record<string, boolean>;
  ratings: Record<string, number>;
  notes: Record<string, string>;
  filters: Partial<MovieFilters>;
};

const STORAGE_KEY = 'salvatierrez-collection-state-v1';
const MOVIE_CACHE_KEY = 'salvatierrez-movie-cache-v1';
const DIRECTOR_CACHE_KEY = 'salvatierrez-director-cache-v1';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 180;

type CachedMoviesPayload = {
  fetchedAt: number;
  movies: MovieRecord[];
  sheetMeta?: SheetMeta | null;
};

export type CachedDirector = {
  name: string;
  resolvedName?: string | null;
  tmdbId?: number | null;
  profileUrl?: string | null;
  fetchedAt?: number;
};

type CachedDirectorsPayload = {
  fetchedAt: number;
  directors: CachedDirector[];
};

function loadState(): StoredState {
  if (typeof localStorage === 'undefined') return { seen: {}, ratings: {}, notes: {}, filters: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { seen: {}, ratings: {}, notes: {}, filters: {} };
    return JSON.parse(raw) as StoredState;
  } catch (error) {
    console.error('Failed to load state', error);
    return { seen: {}, ratings: {}, notes: {}, filters: {} };
  }
}

function saveState(state: StoredState) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadState();

export function getSeenOverrides(): Record<string, boolean> {
  return state.seen;
}

export function setSeenOverride(id: string, value: boolean) {
  state.seen[id] = value;
  saveState(state);
}

export function getRatingOverrides(): Record<string, number> {
  return state.ratings;
}

export function setRating(id: string, value: number) {
  state.ratings[id] = value;
  saveState(state);
}

export function getNotes(): Record<string, string> {
  return state.notes;
}

export function setNote(id: string, text: string) {
  state.notes[id] = text;
  saveState(state);
}

export function getStoredFilters(): Partial<MovieFilters> {
  return state.filters;
}

export function setStoredFilters(filters: Partial<MovieFilters>) {
  state.filters = { ...state.filters, ...filters };
  saveState(state);
}

export function applyLocalOverrides(movies: MovieRecord[]): MovieRecord[] {
  return movies.map((movie) => ({
    ...movie,
    funcionaStatus: movie.funcionaStatus ?? 'untested',
    seen: state.seen[movie.id] ?? movie.seen,
    rating: state.ratings[movie.id] ?? movie.rating
  }));
}

export function saveMovieCache(movies: MovieRecord[], sheetMeta?: SheetMeta | null) {
  if (typeof localStorage === 'undefined') return;
  const payload: CachedMoviesPayload = {
    fetchedAt: Date.now(),
    movies,
    sheetMeta
  };
  try {
    localStorage.setItem(MOVIE_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to save movie cache', error);
  }
}

export function loadMovieCache(options?: { allowExpired?: boolean }): CachedMoviesPayload | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MOVIE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMoviesPayload;
    if (!options?.allowExpired && Date.now() - parsed.fetchedAt > SIX_MONTHS_MS) return null;
    return parsed;
  } catch (error) {
    console.error('Failed to read movie cache', error);
    return null;
  }
}

export function clearMovieCache() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(MOVIE_CACHE_KEY);
}

export function saveDirectorCache(directors: CachedDirector[]) {
  if (typeof localStorage === 'undefined') return;
  const payload: CachedDirectorsPayload = {
    fetchedAt: Date.now(),
    directors
  };
  try {
    localStorage.setItem(DIRECTOR_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to save director cache', error);
  }
}

export function loadDirectorCache(options?: { allowExpired?: boolean }): CachedDirectorsPayload | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DIRECTOR_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedDirectorsPayload;
    if (!options?.allowExpired && Date.now() - parsed.fetchedAt > SIX_MONTHS_MS) return null;
    return parsed;
  } catch (error) {
    console.error('Failed to read director cache', error);
    return null;
  }
}

export function clearDirectorCache() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(DIRECTOR_CACHE_KEY);
}
