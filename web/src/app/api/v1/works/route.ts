import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { works } from '@/db/schema';
import { workSummary } from '@/lib/soliric/api-v1';
import { preflight, withCors } from '@/lib/soliric/cors';
import { ApiError, Created, handle, isEmail } from '@/lib/soliric/http';
import { assertPartnerWithinLimit, authenticatePartner, externalUid } from '@/lib/soliric/partners';
import { loadWork, registerWork } from '@/lib/soliric/service';
import { validateWorkInput } from '@/lib/soliric/work-policy';

export const OPTIONS = preflight;

/**
 * Registra una obra en nombre de un autor y la deja firmada en Solana.
 * Es idempotente por `externalRef`: repetir la llamada devuelve la misma obra.
 */
export async function POST(request: Request) {
  return withCors(await handle(async () => {
    const partner = await authenticatePartner(request);
    const body = await request.json().catch(() => ({}));
    const author = (body.author ?? {}) as { name?: unknown; email?: unknown };
    const email = typeof author.email === 'string' ? author.email.trim().toLowerCase() : '';
    if (!isEmail(email)) throw new ApiError(400, 'author.email es obligatorio y tiene que ser un email válido.', { code: 'invalid_author' });
    const invalid = validateWorkInput({ title: body.title, artist: body.artist, authorName: author.name, lyrics: body.lyrics, chords: body.chords });
    if (invalid) throw new ApiError(400, invalid, { code: 'invalid_work' });
    if (body.attestation !== true) {
      throw new ApiError(400, 'attestation: true es obligatorio: el autor tiene que aceptar la declaración de autoría.', { code: 'attestation_required' });
    }
    if (body.origin === 'imported') {
      throw new ApiError(422, 'Esta canción se importó de otra fuente: es de otro autor y no se puede registrar.', { code: 'imported' });
    }

    const externalRef = typeof body.externalRef === 'string' && body.externalRef.trim() ? body.externalRef.trim().slice(0, 200) : null;
    if (externalRef) {
      const [existing] = await db.select().from(works).where(and(eq(works.partnerId, partner.id), eq(works.externalRef, externalRef))).limit(1);
      if (existing) return workSummary(existing, request);
    }
    await assertPartnerWithinLimit(partner);

    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const name = str(author.name, 120) || email.split('@')[0];
    const uid = externalUid(partner.id, email);
    const id = randomUUID();
    await db.insert(works).values({
      id, userId: uid, title: str(body.title, 200), artist: str(body.artist, 200), displayName: name, lyrics: body.lyrics,
      chords: str(body.chords, 20_000), isPublic: body.isPublic === true, source: 'api', sourceRef: partner.name,
      partnerId: partner.id, externalRef,
    });
    try {
      const record = await loadWork(id);
      const result = await registerWork(record, { uid, email, name }, {
        mode: 'solo', attest: true, reinforced: body.acknowledgeCatalogReview === true, authorName: name, lang: body.lang === 'es' ? 'es' : 'en',
      });
      const fresh = await loadWork(id);
      return new Created({ ...workSummary(fresh, request), signature: result.signature });
    } catch (e) {
      // si no se pudo registrar, no queda una obra a medias: la app puede reintentar
      await db.delete(works).where(eq(works.id, id));
      throw e;
    }
  }, { lang: 'en' }));
}

/** Obras de esta app (las últimas 50), o la que tenga ese `externalRef`. */
export async function GET(request: Request) {
  return withCors(await handle(async () => {
    const partner = await authenticatePartner(request);
    const ref = new URL(request.url).searchParams.get('externalRef');
    const rows = await db.select().from(works)
      .where(ref ? and(eq(works.partnerId, partner.id), eq(works.externalRef, ref)) : eq(works.partnerId, partner.id))
      .orderBy(desc(works.createdAt)).limit(50);
    return { items: rows.map((r) => workSummary(r, request)) };
  }, { lang: 'en' }));
}
