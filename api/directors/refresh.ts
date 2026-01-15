import { fetchTmdbPersonDetails, fetchTmdbPersonFilmography, searchTmdbPerson } from '../lib/tmdb.js';
import { isAdminAuthorized, readJsonBody, reject, supabaseRequest } from '../lib/admin.js';

const buildDirectorPayload = (details: { id: number; name: string; profilePath: string | null }) => ({
  tmdb_person_id: details.id,
  name: details.name,
  profile_path: details.profilePath ?? null,
  last_synced_at: new Date().toISOString()
});

const buildFilmographyPayload = (tmdbPersonId: number, items: Array<{ id: number; title: string; year: number | null; posterPath: string | null; mediaType: 'movie' | 'tv' }>) =>
  items
    .filter((item) => item.mediaType === 'movie')
    .map((item) => ({
      tmdb_person_id: tmdbPersonId,
      tmdb_movie_id: item.id,
      title: item.title,
      year: item.year ?? null,
      is_visible: true,
      poster_path: item.posterPath ?? null,
      last_synced_at: new Date().toISOString()
    }));

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return reject(res, 405, 'Metodo no permitido.');
  }
  if (!isAdminAuthorized(req)) {
    return reject(res, 401, 'Unauthorized.');
  }
  try {
    const body = await readJsonBody(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const providedId = body.tmdbId ? Number(body.tmdbId) : null;
    if (!name && !Number.isFinite(providedId)) {
      return reject(res, 400, 'Nombre o TMDb ID es obligatorio.');
    }

    let tmdbId = Number.isFinite(providedId) ? (providedId as number) : null;
    if (!tmdbId) {
      const match = await searchTmdbPerson(name);
      if (!match) {
        return reject(res, 404, 'No se encontro la persona en TMDb.');
      }
      tmdbId = match.id;
    }

    const details = await fetchTmdbPersonDetails(tmdbId);
    const credits = await fetchTmdbPersonFilmography(tmdbId);

    await supabaseRequest('tmdb_directors?on_conflict=tmdb_person_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(buildDirectorPayload(details))
    });

    const filmographyPayload = buildFilmographyPayload(tmdbId, credits);
    if (filmographyPayload.length > 0) {
      await supabaseRequest('tmdb_director_filmography?on_conflict=tmdb_person_id,tmdb_movie_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(filmographyPayload)
      });
    }

    return res.status(200).json({
      ok: true,
      tmdbId,
      name: details.name,
      biography: details.biography ?? null,
      profilePath: details.profilePath ?? null,
      filmographyCount: filmographyPayload.length
    });
  } catch (error) {
    console.error('Refresh director failed', error);
    return reject(res, 500, 'No se pudo actualizar el director.');
  }
}
