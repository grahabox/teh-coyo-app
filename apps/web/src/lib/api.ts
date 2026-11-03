export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'CENTRAL_ADMIN' | 'DC_ADMIN' | 'STAND_CASHIER' | 'PARTNER_ADMIN';
  locationId: string | null;
}
interface Session {
  accessToken: string;
  user: SessionUser;
}

let accessToken: string | null = null;
let refreshPromise: Promise<Session | null> | null = null;

function expireSession() {
  accessToken = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tehcoyo:session-expired'));
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof body?.message === 'string' ? body.message : 'Permintaan gagal. Coba kembali.',
      Array.isArray(body?.issues)
        ? body.issues.filter(
            (issue: unknown): issue is { field: string; message: string } =>
              typeof issue === 'object' &&
              issue !== null &&
              typeof (issue as { field?: unknown }).field === 'string' &&
              typeof (issue as { message?: unknown }).message === 'string',
          )
        : [],
    );
  }
  return body as T;
}

export async function restoreSession(): Promise<Session | null> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(async (response) => {
        if (response.status === 401) {
          expireSession();
          return null;
        }
        const session = await readResponse<Session>(response);
        accessToken = session.accessToken;
        return session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function login(email: string, password: string) {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await readResponse<Session>(response);
  accessToken = session.accessToken;
  return session.user;
}

export async function logout() {
  const response = await fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
  await readResponse(response);
  accessToken = null;
}

export async function api<T>(path: string, body?: unknown, retry = true): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 401 && retry) {
    const session = await restoreSession();
    if (session) return api<T>(path, body, false);
  }
  if (response.status === 401) expireSession();
  return readResponse<T>(response);
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Tidak dapat terhubung. Periksa koneksi dan API.';
}
