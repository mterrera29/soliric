import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { handle } from '@/lib/soliric/http';
import { myPending } from '@/lib/soliric/service';

/** Lo que tiene pendiente quien consulta: invitaciones por aceptar y repartos por firmar. */
export async function GET(request: Request) {
  return handle(async () => myPending(await verifyFirebaseToken(request)));
}
