import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { works } from '@/db/schema';
import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { loadOwnedWork, loadWork, relationOf, type Actor } from '@/lib/soliric/service';
import { validateWorkInput } from '@/lib/soliric/work-policy';

type Ctx = { params: Promise<{ workId: string }> };

/** Datos de una obra. El texto solo lo ven el dueño y los coautores; el título, también si es pública. */
export async function GET(request: Request, { params }: Ctx) {
  return handle(async () => {
    let actor: Actor | null = null;
    try { actor = await verifyFirebaseToken(request); } catch { /* visitante */ }
    const record = await loadWork((await params).workId);
    const relation = actor ? await relationOf(record, actor) : 'none';
    const sees = relation === 'owner' || relation === 'coauthor';
    if (!record.isPublic && relation === 'none') throw new ApiError(404, 'Canción no encontrada');
    return {
      id: record.id, relation, isPublic: record.isPublic, registered: !!record.workPda, status: record.onchainStatus,
      fingerprint: record.fingerprint, createdAt: record.createdAt,
      title: record.isPublic || sees ? record.title : null,
      artist: record.isPublic || sees ? record.artist : null,
      authorName: record.isPublic || sees ? record.displayName : null,
      lyrics: sees ? record.lyrics : null, chords: sees ? record.chords : null,
    };
  });
}

/** Edita una obra. Una vez registrada, el texto cambia solo con versiones nuevas: acá solo se cambia la visibilidad. */
export async function PATCH(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadOwnedWork((await params).workId, actor);
    const body = await request.json().catch(() => ({}));
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    if (record.workPda) {
      if (typeof body.isPublic !== 'boolean') throw new ApiError(409, 'Esta obra está registrada: para cambiar la letra guardá una versión nueva.');
      await db.update(works).set({ isPublic: body.isPublic, updatedAt: new Date() }).where(eq(works.id, record.id));
      return { ok: true };
    }
    const next = {
      title: body.title ?? record.title, artist: body.artist ?? record.artist, authorName: body.authorName ?? record.displayName,
      lyrics: body.lyrics ?? record.lyrics, chords: body.chords ?? record.chords,
    };
    const invalid = validateWorkInput(next);
    if (invalid) throw new ApiError(400, invalid);
    await db.update(works).set({
      title: str(next.title, 200), artist: str(next.artist, 200), displayName: str(next.authorName, 120) || actor.name,
      lyrics: next.lyrics as string, chords: str(next.chords, 20_000),
      isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : record.isPublic, updatedAt: new Date(),
    }).where(eq(works.id, record.id));
    return { ok: true };
  });
}

/** Borra un borrador. Lo ya registrado queda en la blockchain y no se borra. */
export async function DELETE(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadOwnedWork((await params).workId, actor);
    if (record.workPda) throw new ApiError(409, 'Una obra registrada no se puede borrar.');
    await db.delete(works).where(and(eq(works.id, record.id), eq(works.userId, actor.uid)));
    return { ok: true };
  });
}
