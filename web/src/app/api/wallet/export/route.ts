import bs58 from 'bs58';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { wallets } from '@/db/schema';
import { verifyRecentFirebaseLogin } from '@/lib/firebase-admin';
import { handle } from '@/lib/soliric/http';
import { getOrCreateWallet } from '@/lib/soliric/wallets';

/** Devuelve la clave privada (base58, formato Phantom). Exige un login de los últimos 5 minutos. */
export async function POST(request: Request) {
  return handle(async () => {
    const actor = await verifyRecentFirebaseLogin(request);
    const kp = await getOrCreateWallet(actor.uid, actor.email);
    await db.update(wallets).set({ exportedAt: new Date() }).where(eq(wallets.uid, actor.uid));
    return { pubkey: kp.publicKey.toBase58(), secretKey: bs58.encode(kp.secretKey) };
  });
}
