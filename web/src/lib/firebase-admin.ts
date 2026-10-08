import { NextResponse } from 'next/server';

let adminAuth: import('firebase-admin/auth').Auth | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require('firebase-admin');
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountRaw) {
    if (admin.apps.length === 0) {
      const serviceAccount = JSON.parse(
        // Support both base64-encoded and raw JSON
        Buffer.from(serviceAccountRaw, 'base64').toString('utf-8') !== serviceAccountRaw
          ? Buffer.from(serviceAccountRaw, 'base64').toString('utf-8')
          : serviceAccountRaw
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    adminAuth = admin.auth();
  } else {
    console.warn('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY not set — Firebase Admin not initialized');
  }
} catch (err) {
  console.error('[firebase-admin] Failed to initialize Firebase Admin SDK:', err);
}

export { adminAuth };

/**
 * Extract and verify a Firebase ID token from the Authorization header.
 * Returns the decoded token payload on success.
 * Throws a NextResponse (401) on invalid/missing token.
 */
export async function verifyFirebaseToken(
  request: Request
): Promise<{ uid: string; email: string; name: string }> {
  if (!adminAuth) {
    throw new NextResponse(
      JSON.stringify({ error: 'Firebase Admin not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new NextResponse(
      JSON.stringify({ error: 'Token de autenticación requerido' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || decoded.email?.split('@')[0] || 'Usuario',
    };
  } catch {
    throw new NextResponse(
      JSON.stringify({ error: 'Token inválido o expirado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Verify Firebase token AND assert the token's uid matches the expected userId.
 * Returns the decoded payload on success, throws 401/403 on failure.
 */
export async function requireOwnership(
  request: Request,
  expectedUserId: string
): Promise<{ uid: string; email: string; name: string }> {
  const decoded = await verifyFirebaseToken(request);
  if (decoded.uid !== expectedUserId) {
    throw new NextResponse(
      JSON.stringify({ error: 'No tienes permisos para realizar esta acción' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return decoded;
}

/**
 * Como `verifyFirebaseToken` pero exige un login reciente (`auth_time`): para acciones
 * sensibles como exportar la clave de la wallet.
 */
export async function verifyRecentFirebaseLogin(request: Request, maxAgeSeconds = 300): Promise<{ uid: string; email: string; name: string }> {
  const user = await verifyFirebaseToken(request);
  const token = request.headers.get('authorization')!.slice(7);
  const decoded = await adminAuth!.verifyIdToken(token);
  const authTime = Number(decoded.auth_time ?? 0);
  if (!authTime || Date.now() / 1000 - authTime > maxAgeSeconds) {
    throw new NextResponse(
      JSON.stringify({ error: 'Volvé a iniciar sesión para hacer esto', code: 'reauth' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return user;
}
