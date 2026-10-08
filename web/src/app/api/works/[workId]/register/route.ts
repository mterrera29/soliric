import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { loadOwnedWork, registerWork } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadOwnedWork((await params).workId, actor);
    const body = await request.json().catch(() => ({}));
    if (body.mode !== 'solo' && body.mode !== 'studio') throw new ApiError(400, 'Elegí registrar sola/o o con coautores.');
    return registerWork(record, actor, {
      mode: body.mode, attest: body.attest === true, reinforced: body.reinforced === true,
      authorName: typeof body.authorName === 'string' ? body.authorName : undefined,
      lang: body.lang === 'es' ? 'es' : 'en',
    });
  });
}
