import { isAdminAuthorized, readJsonBody, reject, supabaseRequest } from '../lib/admin.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return reject(res, 405, 'Metodo no permitido.');
  }
  if (!isAdminAuthorized(req)) {
    return reject(res, 401, 'Unauthorized.');
  }
  try {
    const body = await readJsonBody(req);
    const toText = (value: any, fallback = '') => {
      if (value == null) return fallback;
      if (typeof value === 'string') return value;
      return String(value);
    };
    const toNullIfEmpty = (value: any) => {
      const text = toText(value, '').trim();
      return text ? text : null;
    };
    const toBoolOrNull = (value: any) => {
      if (typeof value === 'boolean') return value;
      if (value == null || value === '') return null;
      if (value === 1 || value === '1') return true;
      if (value === 0 || value === '0') return false;
      return null;
    };
    const payload = {
      Seccion: toNullIfEmpty(body.seccion),
      'Año': body.year ?? null,
      Serie: toBoolOrNull(body.series),
      Temporada: body.season ?? null,
      Saga: toText(body.saga),
      Titulo: toNullIfEmpty(body.title),
      'Titulo Original': toText(body.originalTitle),
      Genero: toText(body.genreRaw),
      Director: toText(body.director),
      Grupo: toText(body.group),
      Vista: toBoolOrNull(body.seen),
      Doblaje: toText(body.dubbing),
      Formato: toText(body.format),
      'Puntuacion Rodrigo': body.ratingRodrigo ?? null,
      'Puntuacion Gloria': body.ratingGloria ?? null,
      Funciona: toNullIfEmpty(body.funciona)
    } as Record<string, any>;
    Object.keys(payload).forEach((key) => {
      const value = payload[key];
      if (value === '' || value === undefined) {
        delete payload[key];
      }
      if (value === null && key === 'Vista') {
        delete payload[key];
      }
    });
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

