import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle, isAdmin } from '@/lib/soliric/http';
import { admitChallenge } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    if (!isAdmin(actor.uid)) throw new ApiError(403, 'Solo para administradores.');
    return admitChallenge((await params).id);
  });
}
