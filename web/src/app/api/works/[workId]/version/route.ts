import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { commitVersion, loadWork, relationOf } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadWork((await params).workId);
    const relation = await relationOf(record, actor);
    if (relation !== 'owner' && relation !== 'coauthor') throw new ApiError(403, 'No participás en esta obra.');
    const body = await request.json().catch(() => ({}));
    if (typeof body.lyrics !== 'string' || typeof body.chords !== 'string') throw new ApiError(400, 'Faltan la letra y los acordes.');
    return commitVersion(record, actor, { lyrics: body.lyrics, chords: body.chords });
  });
}
