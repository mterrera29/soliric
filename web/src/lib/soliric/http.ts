import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
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
export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof NextResponse) return e;
    if (e instanceof ConfigError) {
      console.error('[soliric] configuración', e.message);
      return NextResponse.json({ error: `El registro on-chain no está configurado: ${e.message}` }, { status: 503 });
    }
    if (e instanceof ApiError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
    console.error('[soliric]', e);
    return NextResponse.json({ error: 'Error inesperado en el registro on-chain' }, { status: 500 });
  }
}

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

const adminUids = () => (process.env.SOLIRIC_ADMIN_UIDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
export const isAdmin = (uid: string) => adminUids().includes(uid);
