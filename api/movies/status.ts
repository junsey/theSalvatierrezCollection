import { isAdminAuthorized, readJsonBody, reject, supabaseRequest } from '../lib/admin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'PATCH') {
    return reject(res, 405, 'Metodo no permitido.');
  }
  if (!isAdminAuthorized(req)) {
    return reject(res, 401, 'Unauthorized.');
  }
  try {
    const body = await readJsonBody(req);
    const id = body.collectionId;
    if (!id) {
      return reject(res, 400, 'collectionId es obligatorio.');
    }
    const toBoolOrNull = (value: any) => {
      if (typeof value === 'boolean') return value;
      if (value == null || value === '') return null;
      if (value === 1 || value === '1' || value === 'true') return true;
      if (value === 0 || value === '0' || value === 'false') return false;
      return null;
    };
    const payload = {} as Record<string, any>;
    if (body.seen !== undefined) {
      payload.Vista = body.seen;
    }
    if (body.ratingRodrigo !== undefined) {
      payload['Puntuacion Rodrigo'] = body.ratingRodrigo;
    }
    if (body.ratingGloria !== undefined) {
      payload['Puntuacion Gloria'] = body.ratingGloria;
    }
    if (body.enDeposito !== undefined) {
      payload['En depA3sito'] = toBoolOrNull(body.enDeposito);
    }
    if (body.funcionaStatus) {
      if (body.funcionaStatus === 'working') payload.Funciona = true;
      if (body.funcionaStatus === 'damaged') payload.Funciona = false;
      if (body.funcionaStatus === 'untested') payload.Funciona = null;
    } else if (body.funciona !== undefined) {
      payload.Funciona = toBoolOrNull(body.funciona);
    }
    if (Array.isArray(body.seriesEpisodes)) {
      payload['Capitulos de Serie  '] = body.seriesEpisodes;
    }
    if (payload.Vista === true && payload.Funciona === undefined) {
      payload.Funciona = true;
    }
    if (Object.keys(payload).length === 0) {
      return reject(res, 400, 'No hay campos para actualizar.');
    }
    const rows = await supabaseRequest<any[]>(
      `Coleccion_Salvatierrez?id=eq.${id}&select=*`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      }
    );
    return res.status(200).json({ movie: rows?.[0] ?? null });
  } catch (error) {
    console.error('Update status failed', error);
    return reject(res, 500, 'No se pudo actualizar la pelicula.');
  }
}
