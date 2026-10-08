import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { partners, works } from '@/db/schema';
import { ApiError } from './http';

export type Partner = typeof partners.$inferSelect;

const KEY_PREFIX = 'sol_live_';
export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** Una clave nueva: `sol_live_` + 32 bytes aleatorios. Se muestra una sola vez; en la base queda solo su hash. */
export function generateKey(): string {
  return KEY_PREFIX + randomBytes(32).toString('base64url');
}

export async function createPartner(ownerUid: string, name: string) {
  const clean = name.trim().slice(0, 80);
  if (clean.length < 2) throw new ApiError(400, 'Poné un nombre para la app (mín. 2 caracteres).');
  const existing = await db.select({ n: sql<string>`count(*)` }).from(partners).where(and(eq(partners.ownerUid, ownerUid), isNull(partners.revokedAt)));
  if (Number(existing[0]?.n ?? 0) >= 5) throw new ApiError(400, 'Llegaste al máximo de 5 claves activas. Revocá una para crear otra.');
  const key = generateKey();
  const id = randomUUID();
  await db.insert(partners).values({ id, ownerUid, name: clean, keyPrefix: key.slice(0, KEY_PREFIX.length + 4), keyHash: hashKey(key) });
  return { id, name: clean, key, keyPrefix: key.slice(0, KEY_PREFIX.length + 4) };
}

export const listPartners = (ownerUid: string) =>
  db.select({
    id: partners.id, name: partners.name, keyPrefix: partners.keyPrefix, createdAt: partners.createdAt,
    lastUsedAt: partners.lastUsedAt, revokedAt: partners.revokedAt,
  }).from(partners).where(eq(partners.ownerUid, ownerUid)).orderBy(desc(partners.createdAt));

export async function revokePartner(ownerUid: string, id: string) {
  const rows = await db.update(partners).set({ revokedAt: new Date() })
    .where(and(eq(partners.id, id), eq(partners.ownerUid, ownerUid), isNull(partners.revokedAt))).returning({ id: partners.id });
  if (!rows.length) throw new ApiError(404, 'Clave no encontrada.');
}

/** Identifica a la app asociada por su clave (`Authorization: Bearer sol_live_…` o `x-api-key`). */
export async function authenticatePartner(request: Request): Promise<Partner> {
  const auth = request.headers.get('authorization');
  const key = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : request.headers.get('x-api-key')?.trim();
  if (!key || !key.startsWith(KEY_PREFIX)) throw new ApiError(401, 'Falta la clave de API (Authorization: Bearer sol_live_…).', { code: 'missing_key' });
  const [partner] = await db.select().from(partners).where(and(eq(partners.keyHash, hashKey(key)), isNull(partners.revokedAt))).limit(1);
  if (!partner) throw new ApiError(401, 'La clave de API no es válida o fue revocada.', { code: 'invalid_key' });
  db.update(partners).set({ lastUsedAt: new Date() }).where(eq(partners.id, partner.id)).catch(() => {});
  return partner;
}

const dailyLimit = () => {
  const n = Number(process.env.SOLIRIC_PARTNER_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
};

/** Tope de obras por día y por app: protege la tesorería de una clave con fugas. */
export async function assertPartnerWithinLimit(partner: Partner) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [row] = await db.select({ n: sql<string>`count(*)` }).from(works).where(and(eq(works.partnerId, partner.id), gt(works.createdAt, since)));
  if (Number(row?.n ?? 0) >= dailyLimit()) {
    throw new ApiError(429, 'Esta app llegó al máximo de obras por día. Probá de nuevo mañana.', { code: 'partner_daily_limit' });
  }
}

/** Uid sintético del autor cuando la obra la crea una app asociada (identificado por su email). */
export const externalUid = (partnerId: string, email: string) =>
  `ext:${partnerId}:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24)}`;
