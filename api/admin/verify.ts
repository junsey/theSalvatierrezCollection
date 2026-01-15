import { isAdminAuthorized, reject } from '../_admin';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return reject(res, 405, 'Metodo no permitido.');
  }
  if (!isAdminAuthorized(req)) {
    return reject(res, 401, 'Unauthorized.');
  }
  return res.status(200).json({ ok: true });
}
