const BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem('quiz_access');
  const headers = new Headers(opts.headers);
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const { json, ...rest } = opts;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[]; error?: string };
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message || data.error || 'Ошибка запроса';
    throw new ApiError(message, res.status);
  }
  return data as T;
}
