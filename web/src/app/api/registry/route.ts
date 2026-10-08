import { and, desc, eq, ilike, isNotNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { works } from '@/db/schema';
import { handle } from '@/lib/soliric/http';

const PAGE = 24;

/**
 * Listado público de obras registradas. La letra nunca se expone; el título, el artista y el autor
 * solo aparecen en las canciones que su dueño marcó como públicas, y solo ellas se pueden buscar por nombre.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const q = (params.get('q') ?? '').trim().slice(0, 80);
    const cursor = params.get('cursor');
    const cursorDate = cursor ? new Date(cursor) : null;

    const registered = and(isNotNull(works.workPda), isNotNull(works.fingerprint));
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const where = and(
      registered,
      cursorDate && !Number.isNaN(cursorDate.getTime()) ? lt(works.registeredAt, cursorDate) : undefined,
      q ? and(eq(works.isPublic, true), or(ilike(works.title, like), ilike(works.artist, like), ilike(works.displayName, like))) : undefined,
    );

    const [rows, [count]] = await Promise.all([
      db.select({
        fingerprint: works.fingerprint, status: works.onchainStatus, registeredAt: works.registeredAt, isPublic: works.isPublic,
        title: works.title, artist: works.artist, author: works.displayName,
      }).from(works).where(where).orderBy(desc(works.registeredAt)).limit(PAGE + 1),
      db.select({ n: sql<string>`count(*)` }).from(works).where(registered),
    ]);

    const page = rows.slice(0, PAGE).map((r) => (r.isPublic
      ? { fingerprint: r.fingerprint!, status: r.status, registeredAt: r.registeredAt, isPublic: true as const,
          title: r.title, artist: r.artist, author: r.author }
      : { fingerprint: r.fingerprint!, status: r.status, registeredAt: r.registeredAt, isPublic: false as const }));
    return {
      items: page,
      hasMore: rows.length > PAGE,
      nextCursor: rows.length > PAGE ? page[page.length - 1].registeredAt : null,
      total: Number(count?.n ?? 0),
    };
  });
}
