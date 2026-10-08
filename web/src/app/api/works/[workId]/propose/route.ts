import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { loadOwnedWork, proposeSplit } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadOwnedWork((await params).workId, actor);
    const body = await request.json().catch(() => ({}));
    let manual: Record<string, number> | null = null;
    if (body.manual) {
      if (typeof body.manual !== 'object') throw new ApiError(400, 'Reparto manual inválido.');
      manual = Object.fromEntries(Object.entries(body.manual).map(([k, v]) => [k, Number(v)]));
    }
    return proposeSplit(record, actor, manual, typeof body.windowSecs === 'number' ? body.windowSecs : undefined);
  });
}
