import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { ApiError, Created, handle } from '@/lib/soliric/http';
import { createPartner, listPartners, revokePartner } from '@/lib/soliric/partners';

/** Claves de API del usuario con sesión. */
export async function GET(request: Request) {
  return handle(async () => listPartners((await verifyFirebaseToken(request)).uid));
}

/** Crea una clave: se devuelve completa una sola vez. */
export async function POST(request: Request) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const body = await request.json().catch(() => ({}));
    return new Created(await createPartner(actor.uid, typeof body.name === 'string' ? body.name : ''));
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const actor = await verifyFirebaseToken(request);
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== 'string') throw new ApiError(400, 'Falta el id de la clave.');
    await revokePartner(actor.uid, body.id);
    return { ok: true };
  });
}
