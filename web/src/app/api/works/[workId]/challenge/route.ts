import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { loadWork, submitChallenge } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

/** Presenta una impugnación: queda en revisión, la obra NO se congela hasta que un administrador la admita. */
export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadWork((await params).workId);
    if (!record.isPublic || !record.workPda) throw new ApiError(404, 'Canción no encontrada');
    const body = await request.json().catch(() => ({}));
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    return submitChallenge(record, actor, {
      sourceUrl: str(body.sourceUrl), matchedPart: str(body.matchedPart), sinceWhen: str(body.sinceWhen), evidence: str(body.evidence),
    });
  });
}
