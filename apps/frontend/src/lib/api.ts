const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4020/api';

interface ApiError {
  statusCode: number;
  message: string;
}

class ApiRequestError extends Error {
  constructor(
    public statusCode: number,
    public details: string,
  ) {
    super(details);
    this.name = 'ApiRequestError';
  }
}

export async function api<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new ApiRequestError(401, 'Sesión expirada');
    }
    const body: unknown = await res.json().catch(() => null);
    const error: ApiError =
      body !== null && typeof body === 'object' && 'statusCode' in body
        ? (body as ApiError)
        : { statusCode: res.status, message: res.statusText };
    throw new ApiRequestError(error.statusCode, error.message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => api<T>(path);

export const apiPost = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: 'DELETE' });
