import { buildAdminToken, getAdminAuthHeader } from './adminSession';

const adminFetch = async (path: string, options: RequestInit = {}) => {
  const auth = getAdminAuthHeader();
  if (!auth) {
    throw new Error('No hay sesiA3n de admin activa.');
  }
  const headers = new Headers(options.headers);
  headers.set('Authorization', auth);
  headers.set('x-admin-token', auth.replace(/^Basic\s+/i, ''));
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Error ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
};

export async function verifyAdminCredentials(user: string, pass: string): Promise<boolean> {
  const token = buildAdminToken(user, pass);
  const response = await fetch('/api/admin/verify', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${token}`,
      'x-admin-token': token
    }
  });
  return response.ok;
}

export async function createMovie(payload: {
  seccion: string;
  title: string;
  year?: number | null;
  saga?: string;
  originalTitle?: string;
  genreRaw?: string;
  director?: string;
  group?: string;
  seen?: boolean;
  ratingGloria?: number | null;
  ratingRodrigo?: number | null;
  dubbing?: string;
  format?: string;
  funciona?: string;
}) {
  return adminFetch('/api/movies/create', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateMovieStatus(payload: {
  collectionId: string;
  seen?: boolean;
  ratingGloria?: number | null;
  ratingRodrigo?: number | null;
}) {
  return adminFetch('/api/movies/status', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function resolveMovieTmdb(payload: { collectionId: string; tmdbId?: number | null; mediaType?: 'movie' | 'tv' }) {
  return adminFetch('/api/movies/resolve-tmdb', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fixMovieTmdb(payload: {
  collectionId: string;
  tmdbId: number;
  mediaType?: 'movie' | 'tv';
  season?: number | null;
}) {
  return adminFetch('/api/movies/fix-tmdb', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function refreshDirectorTmdb(payload: { name: string; tmdbId?: number | null }) {
  return adminFetch('/api/directors/refresh', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
