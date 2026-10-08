import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, handle, isAdmin } from '@/lib/soliric/http';
import { rejectChallenge } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    if (!isAdmin(actor.uid)) throw new ApiError(403, 'Solo para administradores.');
    const body = await request.json().catch(() => ({}));
    return rejectChallenge((await params).id, typeof body.reason === 'string' ? body.reason : '');
  });
}
