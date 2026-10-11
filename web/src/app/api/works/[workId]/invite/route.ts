import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { handle } from '@/lib/soliric/http';
import { invite, loadOwnedWork, uninvite } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadOwnedWork((await params).workId, actor);
    const body = await request.json().catch(() => ({}));
    return invite(record, String(body.email ?? ''), typeof body.name === 'string' ? body.name : undefined);
  });
}

export async function DELETE(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadOwnedWork((await params).workId, actor);
    const body = await request.json().catch(() => ({}));
    return uninvite(record, String(body.email ?? ''));
  });
}
