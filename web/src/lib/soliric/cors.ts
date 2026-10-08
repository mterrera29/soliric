import { NextResponse } from 'next/server';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
  'Access-Control-Max-Age': '86400',
};

/** Agrega los encabezados CORS de la API pública (las apps asociadas pueden llamarla desde el navegador). */
export function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
  return res;
}

export const preflight = () => withCors(new NextResponse(null, { status: 204 }));
