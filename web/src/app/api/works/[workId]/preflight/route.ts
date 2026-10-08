import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { handle } from '@/lib/soliric/http';
import { loadOwnedWork, preflight } from '@/lib/soliric/service';

type Ctx = { params: Promise<{ workId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const record = await loadOwnedWork((await params).workId, actor);
    return preflight(record);
  });
}
