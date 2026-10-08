import { Keypair } from '@solana/web3.js';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { wallets } from '@/db/schema';
import { decryptSecret, encryptSecret } from './crypto';

/** Wallet custodial del usuario (se crea la primera vez). La clave secreta se guarda cifrada. */
export async function getOrCreateWallet(uid: string, email: string): Promise<Keypair> {
  const [row] = await db.select().from(wallets).where(eq(wallets.uid, uid)).limit(1);
  if (row) return Keypair.fromSecretKey(decryptSecret(row.walletSecretEnc));
  const kp = Keypair.generate();
  await db
    .insert(wallets)
    .values({ uid, email: email.toLowerCase(), walletPubkey: kp.publicKey.toBase58(), walletSecretEnc: encryptSecret(kp.secretKey) })
    .onConflictDoNothing();
  // por si dos requests crearon en paralelo: gana la fila que quedó guardada
  const [saved] = await db.select().from(wallets).where(eq(wallets.uid, uid)).limit(1);
  return Keypair.fromSecretKey(decryptSecret(saved.walletSecretEnc));
}

export async function walletPubkeyToUid(pubkey: string): Promise<string | null> {
  const [row] = await db.select().from(wallets).where(eq(wallets.walletPubkey, pubkey)).limit(1);
  return row?.uid ?? null;
}

/** Wallet ya existente (no crea): para vistas de solo lectura y para operar en nombre del creador. */
export async function getWallet(uid: string): Promise<Keypair> {
  const [row] = await db.select().from(wallets).where(eq(wallets.uid, uid)).limit(1);
  if (!row) throw new Error(`No hay wallet para ${uid}`);
  return Keypair.fromSecretKey(decryptSecret(row.walletSecretEnc));
}

export async function getWalletPubkey(uid: string): Promise<string | null> {
  const [row] = await db.select().from(wallets).where(eq(wallets.uid, uid)).limit(1);
  return row?.walletPubkey ?? null;
}
