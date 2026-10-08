import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { certificateData, loadWork, relationOf, type Actor } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  return handle(async () => {
    let actor: Actor | null = null;
    try { actor = await verifyFirebaseToken(request); } catch { /* visitante */ }
    const record = await loadWork((await params).workId);
    const relation = actor ? await relationOf(record, actor) : 'none';
    // el certificado incluye datos del autor: solo es público si la canción lo es
    if (!record.isPublic && relation === 'none') throw new ApiError(404, 'Canción no encontrada');
    if (!record.workPda) throw new ApiError(404, 'Esta canción todavía no está registrada.');
    return certificateData(record);
  });
}
