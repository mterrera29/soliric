import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { handle } from '@/lib/soliric/http';
import { myInvitations } from '@/lib/soliric/service';

export async function GET(request: Request) {
  return handle(async () => myInvitations(await verifyFirebaseToken(request)));
}
