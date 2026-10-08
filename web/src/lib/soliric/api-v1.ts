import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { works, workChallenges } from '@/db/schema';
import { ApiError } from './http';
import type { Partner } from './partners';

export type WorkRecord = typeof works.$inferSelect;

export const siteUrl = (request: Request) => process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

/** Lo que la API le devuelve a una app asociada sobre una obra. */
export function workSummary(record: WorkRecord, request: Request) {
  const base = siteUrl(request);
  return {
    id: record.id,
    externalRef: record.externalRef,
    title: record.title,
    artist: record.artist,
    author: { name: record.displayName },
    isPublic: record.isPublic,
    status: record.onchainStatus ?? 'draft',
    fingerprint: record.fingerprint,
    workAddress: record.workPda,
    registeredAt: record.registeredAt,
    registryUrl: record.fingerprint ? `${base}/registry/${record.fingerprint}` : null,
  };
}

/** La obra tiene que pertenecer a la app que la consulta. */
export async function loadPartnerWork(partner: Partner, id: string): Promise<WorkRecord> {
  const [record] = await db.select().from(works).where(and(eq(works.id, id), eq(works.partnerId, partner.id))).limit(1);
  if (!record) throw new ApiError(404, 'Canción no encontrada');
  return record;
}

/** Disputa abierta sobre la obra, si la hay (lo que ve el autor para poder defenderse). */
export async function openDispute(record: WorkRecord) {
  const [c] = await db.select().from(workChallenges).where(and(eq(workChallenges.workId, record.id), eq(workChallenges.status, 'open'))).limit(1);
  return c ? { evidence: c.evidence, response: c.response, since: c.createdAt } : null;
}
