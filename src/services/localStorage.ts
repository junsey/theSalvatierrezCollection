import { MovieFilters, MovieRecord } from '../types/MovieRecord';

type StoredState = {
  seen: Record<string, boolean>;
  ratings: Record<string, number>;
  notes: Record<string, string>;
  filters: Partial<MovieFilters>;
};

const STORAGE_KEY = 'catacombs-movie-state-v1';

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
    seen: state.seen[movie.id] ?? movie.seen
  }));
}
