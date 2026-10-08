import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workVersions, works } from '@/db/schema';
import { comparableText, fingerprintOf } from '@/lib/soliric/fingerprint';
import { ApiError, handle } from '@/lib/soliric/http';
import { CONTAINS_WORK_RATIO, SAME_WORK_JACCARD, findSimilarRegistered } from '@/lib/soliric/service';
import { describeRegistration as describe, relatedView, type MatchKind } from '@/lib/soliric/verify';

const HASH = /^[0-9a-f]{64}$/i;

export async function GET(request: Request) {
  return handle(async () => {
    const hash = new URL(request.url).searchParams.get('hash') ?? '';
    if (!HASH.test(hash)) throw new ApiError(400, 'Hash inválido.');
    const h = hash.toLowerCase();
    // puede ser la huella de la obra o el hash de una versión concreta
    const direct = await describe(h, 'hash', 1);
    if (direct.registered) return direct;
    const [v] = await db.select({ workId: workVersions.workId }).from(workVersions).where(eq(workVersions.contentHash, h)).limit(1);
    if (!v) return direct;
    const [record] = await db.select().from(works).where(eq(works.id, v.workId)).limit(1);
    return record?.fingerprint ? describe(record.fingerprint, 'hash', 1) : direct;
  });
}

/**
 * Verifica una letra pegada. Primero busca la huella exacta; si no, compara por similitud ignorando
 * título y autor arriba, etiquetas de sección, puntuación y retoques de palabras sueltas.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.lyrics !== 'string' || !body.lyrics.trim()) throw new ApiError(400, 'Pegá una letra para verificar.');
    const title = typeof body.title === 'string' ? body.title : '';
    const artist = typeof body.artist === 'string' ? body.artist : '';

    const exact = await describe(fingerprintOf(body.lyrics, '').hash.toString('hex'), 'exact', 1);
    if (exact.registered) return exact;

    const similar = await findSimilarRegistered(comparableText(body.lyrics, { title, artist }));
    const top = similar[0];
    const kind: MatchKind | null = !top ? null
      : top.jaccard >= SAME_WORK_JACCARD ? 'similar'
      : top.queryInRegistered >= CONTAINS_WORK_RATIO ? 'fragment'
      : null;
    if (top && kind) {
      const [record] = await db.select({ fingerprint: works.fingerprint }).from(works).where(eq(works.id, top.workId)).limit(1);
      if (record?.fingerprint) {
        return describe(record.fingerprint, kind, kind === 'similar' ? top.jaccard : top.queryInRegistered, similar.slice(1));
      }
    }
    return { registered: false, fingerprint: exact.fingerprint, related: relatedView(similar) };
  });
}
