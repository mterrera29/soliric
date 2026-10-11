import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { handle } from '@/lib/soliric/http';
import { acceptInvite, declineInvite, loadWork } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    return acceptInvite(await loadWork((await params).workId), actor);
  });
}

export async function DELETE(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    return declineInvite(await loadWork((await params).workId), actor);
  });
}
