const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

type AdminHeaders = {
  apikey: string;
  Authorization: string;
  'Content-Type': string;
};

const getAdminToken = (req: any): string | null => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Basic ')) {
    return authHeader.slice(6).trim();
  }
  const token = req.headers?.['x-admin-token'];
  return typeof token === 'string' ? token : null;
};

export const isAdminAuthorized = (req: any): boolean => {
  if (!ADMIN_USER || !ADMIN_PASS) return false;
  const token = getAdminToken(req);
  if (!token) return false;
  const expected = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`, 'utf-8').toString('base64');
  return token === expected;
};

export const reject = (res: any, status: number, message: string) => {
  res.status(status).json({ error: message });
};

export const readJsonBody = async (req: any) => {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
};

export const supabaseRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase server credentials missing.');
  }
  const headers = new Headers(options.headers);
  headers.set('apikey', SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${SUPABASE_URL.replace(/\\/$/, '')}/rest/v1/${path}`, {
    ...options,
    headers
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
};
