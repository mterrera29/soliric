import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle } from '@/lib/soliric/http';
import { loadWork, relationOf, signerAction } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };
const OPS = { sign: 'signSplit', object: 'object', reopen: 'reopen' } as const;

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadWork((await params).workId);
    const body = await request.json().catch(() => ({}));
    const op = OPS[body.op as keyof typeof OPS];
    if (!op) throw new ApiError(400, 'Acción desconocida.');
    const relation = await relationOf(record, actor);
    const allowed = op === 'reopen' ? relation === 'owner' : relation === 'owner' || relation === 'coauthor';
    if (!allowed) throw new ApiError(403, 'No podés hacer esto en esta obra.');
    return signerAction(record, actor, op);
  });
}
