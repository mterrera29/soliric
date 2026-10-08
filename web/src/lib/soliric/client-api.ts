// Llamadas de la UI a /api/soliric. Se pasa getToken de useAuth.
import { clientLang, translate } from '@/lib/i18n';

export class SoliricError extends Error {
  constructor(message: string, public data: Record<string, unknown> = {}, public status = 0) {
    super(message);
  }
}

export async function soliricFetch<T>(
  getToken: () => Promise<string | null>,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`/api/${path}`, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SoliricError(translate(clientLang(), data.error || 'No se pudo completar la acción'), data, res.status);
  return data as T;
}

export const shortKey = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
