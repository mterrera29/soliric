import { cache } from 'react';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workVersions, works } from '@/db/schema';
import { PROGRAM_ID, explorerAddr } from './client';
import { readWorkById, type SimilarWork } from './service';

export type MatchKind = 'exact' | 'similar' | 'fragment' | 'hash';

export const relatedView = (list: SimilarWork[]) =>
  list.slice(0, 4).map((w) => ({ label: w.label, score: Math.max(w.jaccard, w.queryInRegistered) }));

/** La huella de la letra apunta a la obra; la obra se lee de la blockchain. */
export async function describeRegistration(fingerprint: string, matchKind: MatchKind, score: number, related: SimilarWork[] = []) {
  const work = await readWorkById(fingerprint);
  if (!work) return { registered: false as const, fingerprint, related: relatedView(related) };
  const [record] = await db.select().from(works)
    .where(and(eq(works.fingerprint, fingerprint), isNotNull(works.workPda))).limit(1);
  const versions = record
    ? await db.select({ idx: workVersions.idx, contentHash: workVersions.contentHash, txSig: workVersions.txSig, createdAt: workVersions.createdAt })
        .from(workVersions).where(eq(workVersions.workId, record.id))
    : [];
  return {
    registered: true as const, matchKind, score, fingerprint, program: PROGRAM_ID.toBase58(),
    explorer: explorerAddr(work.pda), work,
    // el título y el autor solo se muestran si la canción es pública
    listing: record?.isPublic
      ? { id: record.id, title: record.title, artist: record.artist, author: record.displayName }
      : null,
    versions: versions.sort((a, b) => a.idx - b.idx),
    related: relatedView(related),
  };
}

/** Para páginas que piden lo mismo dos veces (página + imagen para compartir). */
export const getRegistration = cache((fingerprint: string) => describeRegistration(fingerprint, 'hash', 1));
