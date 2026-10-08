import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { works } from '@/db/schema';
import { finalizeIfDue } from '@/lib/soliric/service';

/** Cron (Vercel): deja finales las obras cuya ventana de impugnación venció. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const closing = await db.select().from(works).where(eq(works.onchainStatus, 'closing'));
  let finalized = 0;
  for (const record of closing) {
    try { if (await finalizeIfDue(record)) finalized++; } catch (e) { console.error('[soliric cron]', record.id, e); }
  }
  return NextResponse.json({ checked: closing.length, finalized });
}
