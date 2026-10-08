import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { works } from '@/db/schema';
import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { submitChallenge } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ hash: string }> };
const HASH = /^[0-9a-f]{64}$/i;

/**
 * Impugna una obra registrada a partir de su huella, sea pública o privada: quien la encuentra en
 * /verify o en /registry no necesita abrir la canción. No revela nada del texto.
 */
export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const { hash } = await params;
    if (!HASH.test(hash)) throw new ApiError(400, 'Hash inválido.');
    const [record] = await db.select().from(works)
      .where(and(eq(works.fingerprint, hash.toLowerCase()), isNotNull(works.workPda))).limit(1);
    if (!record) throw new ApiError(404, 'No hay una obra registrada con esa huella.');
    const body = await request.json().catch(() => ({}));
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    return submitChallenge(record, actor, {
      sourceUrl: str(body.sourceUrl), matchedPart: str(body.matchedPart), sinceWhen: str(body.sinceWhen), evidence: str(body.evidence),
    });
  });
}
