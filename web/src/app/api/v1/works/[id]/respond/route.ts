import { loadPartnerWork } from '@/lib/soliric/api-v1';
import { preflight, withCors } from '@/lib/soliric/cors';
import { handle } from '@/lib/soliric/http';
import { authenticatePartner } from '@/lib/soliric/partners';
import { respondToChallenge } from '@/lib/soliric/service';

export const OPTIONS = preflight;

/** El autor responde a una disputa abierta (la app envía su descargo). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withCors(await handle(async () => {
    const partner = await authenticatePartner(request);
    const record = await loadPartnerWork(partner, (await params).id);
    const body = await request.json().catch(() => ({}));
    return respondToChallenge(record, typeof body.response === 'string' ? body.response : '');
  }, { lang: 'en' }));
}
