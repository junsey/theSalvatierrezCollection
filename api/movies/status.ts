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
    const payload = {
      Vista: body.seen ?? null,
      'Puntuacion Rodrigo': body.ratingRodrigo ?? null,
      'Puntuacion Gloria': body.ratingGloria ?? null
    };
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
