import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workChallenges, works } from '@/db/schema';
import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle, isAdmin } from '@/lib/soliric/http';

export async function GET(request: Request) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    if (!isAdmin(actor.uid)) throw new ApiError(403, 'Solo para administradores.');
    const rows = await db.select({
      id: workChallenges.id, status: workChallenges.status, evidence: workChallenges.evidence,
      sourceUrl: workChallenges.sourceUrl, matchedPart: workChallenges.matchedPart, sinceWhen: workChallenges.sinceWhen,
      challengerUid: workChallenges.challengerUid, challengerEmail: workChallenges.challengerEmail,
      createdAt: workChallenges.createdAt, txSig: workChallenges.txSig, workId: workChallenges.workId,
      response: workChallenges.response, respondedAt: workChallenges.respondedAt, rejectReason: workChallenges.rejectReason,
      title: works.title, artist: works.artist, owner: works.displayName,
    }).from(workChallenges).innerJoin(works, eq(works.id, workChallenges.workId)).orderBy(desc(workChallenges.createdAt));
    // historial de quien impugna: ayuda a distinguir una denuncia seria de un troll
    return rows.map((r) => {
      const others = rows.filter((o) => o.challengerUid === r.challengerUid && o.id !== r.id);
      return {
        ...r, challengerUid: undefined,
        history: {
          rejected: others.filter((o) => o.status === 'rejected').length,
          dismissed: others.filter((o) => o.status === 'dismissed').length,
          upheld: others.filter((o) => o.status === 'upheld').length,
        },
      };
    });
  });
}
