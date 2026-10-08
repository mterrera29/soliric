import { withCors, preflight } from '@/lib/soliric/cors';
import { GET as verifyGet, POST as verifyPost } from '@/app/api/verify/route';

// Verificación pública: no necesita clave. Misma lógica que la web.
export const OPTIONS = preflight;
export async function GET(request: Request) { return withCors(await verifyGet(request)); }
export async function POST(request: Request) { return withCors(await verifyPost(request)); }
