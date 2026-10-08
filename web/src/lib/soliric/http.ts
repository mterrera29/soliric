import { NextResponse } from 'next/server';
import { translate, type Lang } from '@/lib/i18n';

export class ApiError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

/** Respuesta con un código distinto de 200 (por ejemplo 201 al crear). */
export class Created<T> {
  constructor(public body: T, public status = 201) {}
}

/** Falta configuración del servidor (variables de entorno): se informa tal cual, no como error genérico. */
export class ConfigError extends Error {}

/** Mensaje legible de un error de Anchor/Solana (usa el "Error Message" del log del programa). */
export function chainError(e: unknown): string {
  const err = e as { error?: { errorMessage?: string }; message?: string; logs?: string[] };
  const log = (err?.logs ?? []).find((l) => l.includes('Error Message:'));
  if (log) return log.split('Error Message:')[1].trim();
  return err?.error?.errorMessage || err?.message || String(e);
}

/** Envuelve un handler: traduce ApiError, respuestas lanzadas (auth) y errores inesperados. */
export async function handle(fn: () => Promise<unknown>, opts: { lang?: Lang; omit?: string[] } = {}): Promise<NextResponse> {
  const msg = (m: string) => (opts.lang ? translate(opts.lang, m) : m);
  try {
    const out = await fn();
    if (out instanceof Created) return NextResponse.json(out.body, { status: out.status });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof NextResponse) return e;
    if (e instanceof ConfigError) {
      console.error('[soliric] configuración', e.message);
      return NextResponse.json({ error: msg(`El registro on-chain no está configurado: ${e.message}`) }, { status: 503 });
    }
    if (e instanceof ApiError) {
      const extra = Object.fromEntries(Object.entries(e.extra).filter(([k]) => !opts.omit?.includes(k)));
      return NextResponse.json({ error: msg(e.message), ...extra }, { status: e.status });
    }
    console.error('[soliric]', e);
    return NextResponse.json({ error: msg('Error inesperado en el registro on-chain') }, { status: 500 });
  }
}

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

const adminUids = () => (process.env.SOLIRIC_ADMIN_UIDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
export const isAdmin = (uid: string) => adminUids().includes(uid);
