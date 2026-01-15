import { isAdminAuthorized, readJsonBody, reject, supabaseRequest } from '../_admin';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return reject(res, 405, 'Metodo no permitido.');
  }
  if (!isAdminAuthorized(req)) {
    return reject(res, 401, 'Unauthorized.');
  }
  try {
    const body = await readJsonBody(req);
    const payload = {
      Seccion: body.seccion ?? null,
      'AAAño': body.year ?? null,
      Saga: body.saga ?? '',
      Titulo: body.title ?? null,
      'Titulo Original': body.originalTitle ?? '',
      Genero: body.genreRaw ?? '',
      Director: body.director ?? '',
      Grupo: body.group ?? '',
      Vista: body.seen ?? false,
      Doblaje: body.dubbing ?? '',
      Formato: body.format ?? '',
      'Puntuacion Rodrigo': body.ratingRodrigo ?? null,
      'Puntuacion Gloria': body.ratingGloria ?? null,
      Funciona: body.funciona ?? null
    };
    if (!payload.Seccion || !payload.Titulo) {
      return reject(res, 400, 'Seccion y titulo son obligatorios.');
    }
    const rows = await supabaseRequest<any[]>(
      'Coleccion_Salvatierrez?select=*',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      }
    );
    return res.status(200).json({ movie: rows?.[0] ?? null });
  } catch (error) {
    console.error('Create movie failed', error);
    return reject(res, 500, 'No se pudo crear la pelicula.');
  }
}
