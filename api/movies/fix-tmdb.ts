import { fetchTmdbDetails } from '../lib/tmdb.js';
import { isAdminAuthorized, readJsonBody, reject, supabaseRequest } from '../lib/admin.js';

const buildTmdbPayload = (collectionId: string, details: any) => ({
  collection_id: collectionId,
  tmdb_id: details.id,
  tmdb_title: details.title,
  tmdb_original_title: details.originalTitle,
  tmdb_year: details.year ?? null,
  tmdb_rating: details.rating ?? null,
  tmdb_genres: details.genres ?? [],
  poster_path: details.posterPath ?? null,
  plot: details.plot ?? null,
  last_synced_at: new Date().toISOString(),
  source: 'tmdb'
});

const upsertDirectors = async (details: any) => {
  if (!details.directors || details.directors.length === 0) return;
  const directors = details.directors.map((director: any) => ({
    tmdb_person_id: director.id,
    name: director.name,
    profile_path: director.profilePath ?? null
  }));
  await supabaseRequest('tmdb_directors?on_conflict=tmdb_person_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(directors)
  });

  if (details.mediaType !== 'movie') return;
  const filmography = details.directors.map((director: any) => ({
    tmdb_person_id: director.id,
    tmdb_movie_id: details.id,
    title: details.title,
    year: details.year ?? null,
    is_visible: true,
    poster_path: details.posterPath ?? null
  }));
  await supabaseRequest('tmdb_director_filmography?on_conflict=tmdb_person_id,tmdb_movie_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(filmography)
  });
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'PATCH') {
    return reject(res, 405, 'Metodo no permitido.');
  }
  if (!isAdminAuthorized(req)) {
    return reject(res, 401, 'Unauthorized.');
  }
  try {
    const body = await readJsonBody(req);
    const collectionId = body.collectionId;
    const tmdbId = Number(body.tmdbId);
    const mediaType = body.mediaType === 'tv' ? 'tv' : 'movie';
    if (!collectionId || !Number.isFinite(tmdbId)) {
      return reject(res, 400, 'collectionId y tmdbId son obligatorios.');
    }
    const details = await fetchTmdbDetails(tmdbId, mediaType);
    const payload = buildTmdbPayload(collectionId, details);
    await supabaseRequest('tmdb_movies?on_conflict=collection_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(payload)
    });
    await upsertDirectors(details);
    return res.status(200).json({ ok: true, tmdbId: details.id, mediaType: details.mediaType });
  } catch (error) {
    console.error('Fix TMDb failed', error);
    return reject(res, 500, 'No se pudo corregir TMDb.');
  }
}
