import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { loadWork, relationOf, respondToChallenge } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadWork((await params).workId);
    const relation = await relationOf(record, actor);
    if (relation !== 'owner' && relation !== 'coauthor') throw new ApiError(403, 'Solo los autores pueden responder.');
    const body = await request.json().catch(() => ({}));
    return respondToChallenge(record, String(body.response ?? ''));
  });
}
