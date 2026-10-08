import { loadPartnerWork, openDispute, workSummary } from '@/lib/soliric/api-v1';
import { preflight, withCors } from '@/lib/soliric/cors';
import { handle } from '@/lib/soliric/http';
import { authenticatePartner } from '@/lib/soliric/partners';
import { readWorkByPda } from '@/lib/soliric/service';
import { PublicKey } from '@solana/web3.js';

export const OPTIONS = preflight;

/** Estado de una obra de esta app, con el reparto leído de la blockchain y la disputa abierta, si la hay. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withCors(await handle(async () => {
    const partner = await authenticatePartner(request);
    const record = await loadPartnerWork(partner, (await params).id);
    const chain = record.workPda ? await readWorkByPda(new PublicKey(record.workPda)).catch(() => null) : null;
    return {
      ...workSummary(record, request),
      status: chain?.status ?? record.onchainStatus ?? 'draft',
      split: chain?.contributors.map((c) => ({ wallet: c.wallet, share: c.bps / 100 })) ?? [],
      dispute: await openDispute(record),
    };
  }, { lang: 'en' }));
}
