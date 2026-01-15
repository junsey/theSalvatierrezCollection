export type AdminSession = {
  user: string;
  token: string;
  loggedAt: number;
};

const ADMIN_SESSION_KEY = 'salvatierrez-admin-session-v1';

const isBrowser = typeof window !== 'undefined';

const encodeBase64 = (value: string) => {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(value)));
  }
  throw new Error('Base64 encoder unavailable.');
};

export function buildAdminToken(user: string, pass: string): string {
  return encodeBase64(`${user}:${pass}`);
}

export function loadAdminSession(): AdminSession | null {
  if (!isBrowser) return null;
  try {
    const raw = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminSession;
  } catch (error) {
    console.warn('Failed to load admin session', error);
    return null;
  }
}

export function saveAdminSession(user: string, pass: string): AdminSession {
  const session: AdminSession = {
    user,
    token: buildAdminToken(user, pass),
    loggedAt: Date.now()
  };
  if (isBrowser) {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

export function clearAdminSession() {
  if (!isBrowser) return;
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function getAdminToken(): string | null {
  return loadAdminSession()?.token ?? null;
}

export function getAdminAuthHeader(): string | null {
  const token = getAdminToken();
  return token ? `Basic ${token}` : null;
}
