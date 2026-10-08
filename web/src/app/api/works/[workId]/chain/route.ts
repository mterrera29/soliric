import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { chainView, loadWork, relationOf, type Actor } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  return handle(async () => {
    let actor: Actor | null = null;
    try { actor = await verifyFirebaseToken(request); } catch { /* visitante */ }
    const record = await loadWork((await params).workId);
    const relation = actor ? await relationOf(record, actor) : 'none';
    // no revelamos canciones privadas a quien no participa
    if (!record.isPublic && relation === 'none') throw new ApiError(404, 'Canción no encontrada');
    if (!record.workPda) return { registered: false };
    return { registered: true, ...(await chainView(record, actor)) };
  });
}
