import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { works } from '@/db/schema';
import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { validateWorkInput } from '@/lib/soliric/work-policy';

/** Mis obras (borradores y registradas). */
export async function GET(request: Request) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    return db.select({
      id: works.id, title: works.title, artist: works.artist, isPublic: works.isPublic,
      status: works.onchainStatus, workPda: works.workPda, registeredAt: works.registeredAt, createdAt: works.createdAt,
    }).from(works).where(eq(works.userId, actor.uid)).orderBy(desc(works.createdAt));
  });
}

/** Crea una obra como borrador: todavía no está registrada. */
export async function POST(request: Request) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const body = await request.json().catch(() => ({}));
    const invalid = validateWorkInput(body);
    if (invalid) throw new ApiError(400, invalid);
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const id = randomUUID();
    await db.insert(works).values({
      id, userId: actor.uid, title: str(body.title, 200), artist: str(body.artist, 200),
      displayName: str(body.authorName, 120) || actor.name, lyrics: body.lyrics, chords: str(body.chords, 20_000),
      isPublic: body.isPublic === true, source: 'web',
    });
    return { id };
  });
}
