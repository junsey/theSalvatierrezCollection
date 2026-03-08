const DIRECTOR_FAVORITES_KEY = 'salvatierrez-director-favorites-v1';

const isStorageAvailable = () => typeof localStorage !== 'undefined';

export const getFavoriteDirectorKeys = (): string[] => {
  if (!isStorageAvailable()) return [];

  try {
    const raw = localStorage.getItem(DIRECTOR_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch (error) {
    console.warn('No se pudieron leer los directores favoritos', error);
    return [];
  }
};

const saveFavoriteDirectorKeys = (keys: string[]) => {
  if (!isStorageAvailable()) return;
  localStorage.setItem(DIRECTOR_FAVORITES_KEY, JSON.stringify(Array.from(new Set(keys))));
};

export const toggleFavoriteDirectorKey = (key: string, isFavorite: boolean) => {
  const current = new Set(getFavoriteDirectorKeys());

  if (isFavorite) {
    current.add(key);
  } else {
    current.delete(key);
  }

  saveFavoriteDirectorKeys(Array.from(current));
};
