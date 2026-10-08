import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import type { Keypair } from '@solana/web3.js';
import { db } from '@/lib/db';
import { funding, works } from '@/db/schema';
import { sendFromTreasury, topUpAmount } from './client';
import { requiredBalance, type SponsoredAction } from './costs';
import { ApiError, isAdmin } from './http';
import { evaluateSponsorship, limitsFromEnv, registrationsLeft } from './sponsor-policy';

const total = async (where: ReturnType<typeof eq>) => {
  const [row] = await db.select({ n: sql<string>`coalesce(sum(${funding.lamports}), 0)` }).from(funding).where(where);
  return Number(row?.n ?? 0);
};

export async function registeredCount(uid: string): Promise<number> {
  const [row] = await db.select({ n: sql<string>`count(*)` }).from(works).where(and(eq(works.userId, uid), isNotNull(works.workPda)));
  return Number(row?.n ?? 0);
}

/** Registros gratis que le quedan a la cuenta (Infinity para administradores). */
export async function freeRegistrationsLeft(uid: string): Promise<number> {
  return registrationsLeft(await registeredCount(uid), limitsFromEnv(), isAdmin(uid));
}

/**
 * La tesorería adelanta SOLO lo que la acción necesita, dentro de los topes (por cuenta y diario).
 * Si la wallet ya tiene saldo (por ejemplo, el usuario la fondeó), no hace nada.
 */
export async function sponsorWallet(uid: string, kp: Keypair, action: SponsoredAction): Promise<void> {
  const need = await topUpAmount(kp.publicKey, await requiredBalance(action));
  if (need === 0) return;

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [fundedToUser, fundedLast24h] = await Promise.all([
    total(eq(funding.uid, uid)),
    total(gt(funding.createdAt, since)),
  ]);
  const verdict = evaluateSponsorship({ need, fundedToUser, fundedLast24h, admin: isAdmin(uid), limits: limitsFromEnv() });
  if (!verdict.ok) {
    throw new ApiError(verdict.code === 'daily-budget' ? 503 : 402, verdict.message, { code: verdict.code });
  }
  await sendFromTreasury(kp.publicKey, need);
  await db.insert(funding).values({ id: randomUUID(), uid, lamports: need, reason: action });
}
