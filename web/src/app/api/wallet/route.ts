import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { CLUSTER, connection, explorerAddr } from '@/lib/soliric/client';
import { handle } from '@/lib/soliric/http';
import { freeRegistrationsLeft, sponsoredTo } from '@/lib/soliric/sponsor';
import { isAdmin } from '@/lib/soliric/http';
import { limitsFromEnv } from '@/lib/soliric/sponsor-policy';
import { getOrCreateWallet } from '@/lib/soliric/wallets';

export async function GET(request: Request) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const kp = await getOrCreateWallet(actor.uid, actor.email);
    const lamports = await connection().getBalance(kp.publicKey).catch(() => 0);
    const pubkey = kp.publicKey.toBase58();
    const left = await freeRegistrationsLeft(actor.uid).catch(() => NaN);
    const sponsored = await sponsoredTo(actor.uid).catch(() => NaN);
    const limits = limitsFromEnv();
    return {
      pubkey, balance: lamports / LAMPORTS_PER_SOL, cluster: CLUSTER, explorer: explorerAddr(pubkey),
      // null = sin límite (cuentas admin); undefined = no se pudo calcular
      freeLeft: Number.isNaN(left) ? undefined : Number.isFinite(left) ? left : null,
      freeTotal: limits.freeRegistrations,
      // cupo de comisiones y rentas que adelanta Soliric a esta cuenta (null = sin tope)
      sponsoredSol: Number.isNaN(sponsored) ? undefined : sponsored / LAMPORTS_PER_SOL,
      capSol: isAdmin(actor.uid) ? null : limits.perUserCapLamports / LAMPORTS_PER_SOL,
    };
  });
}
