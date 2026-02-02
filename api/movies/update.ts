import { isAdminAuthorized, readJsonBody, reject, supabaseRequest } from '../lib/admin.js';

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
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
};

const toNumberOrNull = (value: any) => {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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
    const id = body.collectionId;
    if (!id) {
      return reject(res, 400, 'collectionId es obligatorio.');
    }

    const payload = {
      Seccion: toNullIfEmpty(body.seccion),
      'Año': toNumberOrNull(body.year),
      Serie: toBoolOrNull(body.series),
      Temporada: toNumberOrNull(body.season),
      Saga: toText(body.saga),
      Titulo: toNullIfEmpty(body.title),
      'Titulo Original': toText(body.originalTitle),
      Genero: toText(body.genreRaw),
      Director: toText(body.director),
      Grupo: toText(body.group),
      Vista: toBoolOrNull(body.seen),
      Doblaje: toBoolOrNull(body.dubbing),
      Formato: toText(body.format),
      Region: toNullIfEmpty(body.region),
      'Puntuacion Rodrigo': toNumberOrNull(body.ratingRodrigo),
      'Puntuacion Gloria': toNumberOrNull(body.ratingGloria),
      'En depósito': toBoolOrNull(body.enDeposito),
      'Capitulos de Serie': Array.isArray(body.seriesEpisodes) ? body.seriesEpisodes : undefined
    } as Record<string, any>;

    if (body.funcionaStatus) {
      if (body.funcionaStatus === 'working') payload.Funciona = true;
      if (body.funcionaStatus === 'damaged') payload.Funciona = false;
      if (body.funcionaStatus === 'untested') payload.Funciona = null;
    } else if (body.funciona !== undefined) {
      payload.Funciona = toBoolOrNull(body.funciona);
    }

    Object.keys(payload).forEach((key) => {
      const value = payload[key];
      if (value === '' || value === undefined) {
        delete payload[key];
      }
    });

    if (payload.Vista === true && payload.Funciona === undefined) {
      payload.Funciona = true;
    }
    if (!payload.Seccion || !payload.Titulo) {
      return reject(res, 400, 'Seccion y titulo son obligatorios.');
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
    console.error('Update movie failed', error);
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la pelicula.';
    return reject(res, 500, message);
  }
}
