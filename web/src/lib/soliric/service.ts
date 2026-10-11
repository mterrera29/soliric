import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { BN } from '@anchor-lang/core';
import { Keypair, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { db } from '@/lib/db';
import {
  attestations, workChallenges, works, workVersions, workInvites,
} from '@/db/schema';
import {
  canRegisterOnchain, statementFor,
} from '@/lib/soliric/work-policy';
import { lyricsFor } from './text';
import {
  CLUSTER, challengePda, configPda, programFor, readProgram, treasury,
  versionPda, workPda, PROGRAM_ID,
} from './client';
import { checkAgainstCatalogs, type CatalogCheck } from './catalog-check';
import { compare, comparableText, contentHashOf, fingerprintOf, normalizeLyrics } from './fingerprint';
import { ApiError, chainError, isEmail } from './http';
import { freeRegistrationsLeft, sponsorWallet } from './sponsor';
import type { SponsoredAction } from './costs';
import { evaluateSubmission, validateChallengeInput, type ChallengeInput } from './challenge-policy';
import { buildMetadata, canonicalJson, hashMetadata, registrationMemo } from './metadata';
import { diffUnits } from './units';
import type { ChainStatus } from './types';
import { getOrCreateWallet, getWallet, getWalletPubkey, walletPubkeyToUid } from './wallets';

export type WorkRow = typeof works.$inferSelect;
export interface Actor { uid: string; email: string; name: string }

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const MIN_NORMALIZED_CHARS = 40;
export const DEFAULT_WINDOW_SECS = 7 * 24 * 3600;
const windowSecs = () => {
  const n = Number(process.env.SOLIRIC_WINDOW_SECS);
  return Number.isFinite(n) && n >= 0 && n <= DEFAULT_WINDOW_SECS ? Math.floor(n) : DEFAULT_WINDOW_SECS;
};

const hex = (b: Uint8Array | number[]) => Buffer.from(b).toString('hex');
const sha256 = (t: string) => createHash('sha256').update(t).digest();
const statusOf = (s: object) => Object.keys(s)[0].toLowerCase();

export type { ChainStatus };

export interface ChainWork {
  pda: string;
  creator: string;
  status: ChainStatus;
  versionCount: number;
  latestHash: string;
  createdAt: number;
  closesAt: number;
  contributors: { wallet: string; units: number; bps: number; signed: boolean; joined: boolean }[];
}

/* ---------- lectura ---------- */

export async function readWorkByPda(pda: PublicKey): Promise<ChainWork | null> {
  const accounts = readProgram().account as unknown as Record<string, { fetchNullable(p: PublicKey): Promise<unknown> }>;
  const w = await accounts.work.fetchNullable(pda) as null | {
    creator: PublicKey; status: object; versionCount: number; latestHash: number[]; createdAt: BN; closesAt: BN;
    contributors: { wallet: PublicKey; units: BN; bps: number; signed: boolean; joined: boolean }[];
  };
  if (!w) return null;
  return {
    pda: pda.toBase58(),
    creator: w.creator.toBase58(),
    status: statusOf(w.status) as ChainStatus,
    versionCount: w.versionCount,
    latestHash: hex(w.latestHash),
    createdAt: Number(w.createdAt),
    closesAt: Number(w.closesAt),
    contributors: w.contributors.map((c) => ({
      wallet: c.wallet.toBase58(), units: Number(c.units), bps: c.bps, signed: c.signed, joined: c.joined,
    })),
  };
}

export const readWorkById = (idHex: string) => readWorkByPda(workPda(Buffer.from(idHex, 'hex')));

async function mustReadWork(record: WorkRow): Promise<ChainWork> {
  if (!record.fingerprint || !record.workPda) throw new ApiError(400, 'La canción todavía no está registrada.');
  const w = await readWorkByPda(new PublicKey(record.workPda));
  if (!w) throw new ApiError(404, 'No encontramos la obra en la blockchain.');
  return w;
}

async function syncStatus(record: WorkRow, work: ChainWork) {
  if (record.onchainStatus !== work.status) {
    await db.update(works).set({ onchainStatus: work.status }).where(eq(works.id, record.id));
    record.onchainStatus = work.status;
  }
}

/* ---------- acceso ---------- */

export async function loadWork(workId: string): Promise<WorkRow> {
  const [record] = await db.select().from(works).where(eq(works.id, workId)).limit(1);
  if (!record) throw new ApiError(404, 'Canción no encontrada');
  return record;
}

export async function loadOwnedWork(workId: string, actor: Actor): Promise<WorkRow> {
  const record = await loadWork(workId);
  if (record.userId !== actor.uid) throw new ApiError(404, 'Canción no encontrada');
  return record;
}

/** El dueño o un coautor que ya aceptó (o fue invitado) puede ver el registro. */
export async function relationOf(record: WorkRow, actor: Actor): Promise<'owner' | 'coauthor' | 'invited' | 'none'> {
  if (record.userId === actor.uid) return 'owner';
  const [inv] = await db.select().from(workInvites)
    .where(and(eq(workInvites.workId, record.id), eq(workInvites.email, actor.email.toLowerCase()))).limit(1);
  if (!inv) return 'none';
  return inv.status === 'accepted' ? 'coauthor' : 'invited';
}

/* ---------- ejecución de instrucciones ---------- */

type ProgramApi = ReturnType<typeof programFor>;

/** Ejecuta una instrucción firmada por la wallet del usuario; la tesorería adelanta lo justo (con topes). */
async function run<T>(kp: Keypair, uid: string, action: SponsoredAction, build: (p: ProgramApi) => Promise<T>): Promise<T> {
  await sponsorWallet(uid, kp, action);
  return exec(kp, build);
}

/** Instrucciones que firma la tesorería (finalizar, resolver): paga ella misma. */
const runAsTreasury = <T,>(kp: Keypair, build: (p: ProgramApi) => Promise<T>): Promise<T> => exec(kp, build);

async function exec<T>(kp: Keypair, build: (p: ProgramApi) => Promise<T>): Promise<T> {
  try {
    return await build(programFor(kp));
  } catch (e) {
    throw new ApiError(400, chainError(e));
  }
}

const memoIx = (text: string) =>
  new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(text, 'utf8') });

/* ---------- obras parecidas ---------- */

export interface SimilarWork {
  workId: string;
  pda: string;
  status: string;
  isPublic: boolean;
  /** Cómo nombrarla sin revelar canciones privadas. */
  label: string;
  /** Parecido global (0 a 1). */
  jaccard: number;
  /** Qué parte de la letra consultada está dentro de la obra registrada. */
  queryInRegistered: number;
  /** Qué parte de la obra registrada está dentro de la letra consultada. */
  registeredInQuery: number;
}

const MIN_WORDS_TO_COMPARE = 6;

/**
 * Busca obras registradas parecidas a un texto ya "limpio" (ver `comparableText`).
 * Tolera palabras de más o de menos, título/autor arriba y etiquetas de sección.
 */
export async function findSimilarRegistered(comparable: string, excludeSongId?: string): Promise<SimilarWork[]> {
  if (comparable.split(' ').filter(Boolean).length < MIN_WORDS_TO_COMPARE) return [];
  const rows = await db.select({
    id: works.id, title: works.title, artist: works.artist, author: works.displayName, isPublic: works.isPublic,
    lyrics: works.lyrics, chords: works.chords, pda: works.workPda, status: works.onchainStatus,
  }).from(works).where(isNotNull(works.workPda));

  const out: SimilarWork[] = [];
  for (const r of rows) {
    if (r.id === excludeSongId || !r.pda) continue;
    const other = comparableText(lyricsFor(r.lyrics ?? '', r.chords ?? ''), { title: r.title, artist: r.artist });
    const c = compare(comparable, other);
    if (c.jaccard < 0.5 && c.aInB < 0.8) continue;
    out.push({
      workId: r.id, pda: r.pda, status: r.status ?? 'open', isPublic: !!r.isPublic,
      label: r.isPublic ? `«${r.title}» de ${r.author ?? r.artist}` : 'una obra registrada',
      jaccard: c.jaccard, queryInRegistered: c.aInB, registeredInQuery: c.bInA,
    });
  }
  const rank = (w: SimilarWork) => Math.max(w.jaccard, w.queryInRegistered * 0.95);
  return out.sort((a, b) => rank(b) - rank(a));
}

/** Umbrales: arriba de esto es la misma letra con retoques. */
export const SAME_WORK_JACCARD = 0.75;
export const CONTAINS_WORK_RATIO = 0.9;

/* ---------- antes de registrar ---------- */

export interface PreflightResult {
  fingerprint: string;
  duplicate: boolean;
  catalog: CatalogCheck;
  registrable: boolean;
  needsReinforced: boolean;
  /** Registros gratis que le quedan a la cuenta (null = sin límite). */
  freeLeft: number | null;
  similarTo?: { label: string; score: number };
  reason?: string;
}

export async function preflight(record: WorkRow): Promise<PreflightResult> {
  const left = await freeRegistrationsLeft(record.userId);
  const freeLeft = Number.isFinite(left) ? left : null;
  const { normalized, hash } = fingerprintOf(record.lyrics ?? '', record.chords ?? '');
  const fingerprint = hash.toString('hex');
  const empty = { verdict: 'ok', score: 0, checked: true, match: null } as CatalogCheck;
  const base = { fingerprint, duplicate: false, catalog: empty, registrable: false, needsReinforced: false, freeLeft };

  if (!canRegisterOnchain(record.source)) {
    return { ...base, reason: 'Esta canción se importó de otra fuente: es de otro autor y no se puede registrar.' };
  }
  if (left === 0) {
    return { ...base, reason: 'Usaste tus registros gratuitos. Para registrar más obras hace falta un plan.' };
  }
  if (normalized.length < MIN_NORMALIZED_CHARS) {
    return { ...base, reason: 'La letra es demasiado corta para registrarla.' };
  }
  const onChain = await readWorkById(fingerprint);
  if (onChain) {
    return { ...base, duplicate: true, reason: 'Esta letra ya está registrada.' };
  }
  const comparable = comparableText(lyricsFor(record.lyrics ?? '', record.chords ?? ''), { title: record.title, artist: record.artist });
  const close = (await findSimilarRegistered(comparable, record.id))
    .find((w) => w.status !== 'revoked' && (w.jaccard >= SAME_WORK_JACCARD || w.registeredInQuery >= CONTAINS_WORK_RATIO));
  if (close) {
    const pct = Math.round(Math.max(close.jaccard, close.registeredInQuery) * 100);
    return {
      ...base, duplicate: true, similarTo: { label: close.label, score: close.jaccard },
      reason: `Se parece en un ${pct} % a ${close.label}, que ya está registrada. Si es tu obra, no hace falta registrarla de nuevo.`,
    };
  }
  const catalog = await checkAgainstCatalogs({
    title: record.title, artist: record.artist, lyrics: lyricsFor(record.lyrics ?? '', record.chords ?? ''),
  });
  if (catalog.verdict === 'block') {
    const m = catalog.match;
    return {
      ...base, catalog,
      reason: m ? `Se parece mucho a «${m.title}» de ${m.artist}. Si es de otro autor no se puede registrar.` : 'Coincide con una canción publicada.',
    };
  }
  return { ...base, catalog, registrable: true, needsReinforced: catalog.verdict === 'review' };
}

/* ---------- registrar ---------- */

export async function registerWork(
  record: WorkRow, actor: Actor,
  opts: { mode: 'solo' | 'studio'; attest: boolean; reinforced: boolean; authorName?: string; lang?: 'en' | 'es'; invites?: { email: string; name?: string }[] },
) {
  if (record.workPda) throw new ApiError(409, 'Esta canción ya está registrada.');
  if (!opts.attest) throw new ApiError(400, 'Tenés que aceptar la declaración de autoría.');

  const pf = await preflight(record);
  if (pf.freeLeft === 0) throw new ApiError(402, pf.reason ?? 'Sin registros gratuitos.', { code: 'quota', preflight: pf });
  if (!pf.registrable) {
    const code = pf.duplicate ? 'duplicate' : pf.catalog.verdict === 'block' ? 'copy_detected' : 'not_registrable';
    throw new ApiError(pf.duplicate ? 409 : 422, pf.reason ?? 'No se puede registrar.', { code, preflight: pf, similarTo: pf.similarTo });
  }
  if (pf.needsReinforced && !opts.reinforced) {
    throw new ApiError(422, 'Confirmá de nuevo que la letra es tuya: no pudimos descartar que exista en un catálogo.', {
      code: 'needs_review', preflight: pf, needsReinforced: true,
    });
  }

  const solo = opts.mode === 'solo';
  const kp = await getOrCreateWallet(actor.uid, actor.email);
  const id = Buffer.from(pf.fingerprint, 'hex');
  const content = contentHashOf(record.lyrics ?? '', record.chords ?? '');
  const pda = workPda(id);
  const units = Math.max(1, normalizeLyrics(lyricsFor(record.lyrics ?? '', record.chords ?? '')).length);
  const statement = statementFor(opts.lang === 'es' ? 'es' : 'en');
  const statementHash = sha256(statement).toString('hex');
  // Título, autor y fecha se sellan: el JSON queda en la base y solo su hash va en el memo on-chain
  const metadata = buildMetadata({
    title: record.title, artist: record.artist, authorName: opts.authorName?.trim() || actor.name,
    fingerprint: pf.fingerprint, registeredAt: new Date().toISOString(),
  });
  const metadataHash = hashMetadata(metadata);

  const sig = await run(kp, actor.uid, 'register', (p) =>
    p.methods.createWork(Array.from(id), Array.from(content), new BN(units), solo, new BN(solo ? windowSecs() : 0))
      .accounts({ work: pda, version: versionPda(pda, 0), creator: kp.publicKey, systemProgram: SystemProgram.programId })
      .postInstructions([memoIx(registrationMemo(statementHash, metadataHash))])
      .rpc());

  const work = await mustReadWork({ ...record, fingerprint: pf.fingerprint, workPda: pda.toBase58() });
  await db.insert(workVersions).values({
    workId: record.id, idx: 0, contentHash: hex(content), txSig: sig, authorUid: actor.uid, units,
    lyrics: record.lyrics ?? '', chords: record.chords ?? '',
  });
  await db.insert(attestations).values({
    id: randomUUID(), workId: record.id, uid: actor.uid, statement, statementHash,
    catalogScore: pf.catalog.score, metadata: canonicalJson(metadata), metadataHash,
  });
  await db.update(works).set({
    fingerprint: pf.fingerprint, workPda: pda.toBase58(), onchainStatus: work.status,
    registeredAt: new Date(),
  }).where(eq(works.id, record.id));
  // Coautores: se invita a cada email (si alguno falla, el registro igual quedó hecho)
  const inviteErrors: { email: string; error: string }[] = [];
  if (!solo) {
    const registered = { ...record, fingerprint: pf.fingerprint, workPda: pda.toBase58(), onchainStatus: work.status };
    for (const { email, name } of opts.invites ?? []) {
      try { await invite(registered, email, name); } catch (e) { inviteErrors.push({ email, error: (e as Error).message }); }
    }
  }
  return { signature: sig, work, inviteErrors };
}

/* ---------- colaboración ---------- */

export async function invite(record: WorkRow, email: string, name?: string) {
  const e = email.trim().toLowerCase();
  if (!isEmail(e)) throw new ApiError(400, 'Ese email no parece válido.');
  const work = await mustReadWork(record);
  if (work.status !== 'open') throw new ApiError(400, 'Ya no se puede invitar a esta obra.');
  const existing = await db.select().from(workInvites).where(eq(workInvites.workId, record.id));
  if (work.contributors.length + existing.filter((i) => i.status === 'pending').length >= 8) {
    throw new ApiError(400, 'Máximo 8 autores.');
  }
  if (existing.some((i) => i.email === e)) throw new ApiError(400, 'Esa persona ya está invitada.');
  await db.insert(workInvites).values({ workId: record.id, email: e, name: name?.trim().slice(0, 80) || null });
  return { ok: true };
}

export async function uninvite(record: WorkRow, email: string) {
  await db.delete(workInvites).where(and(
    eq(workInvites.workId, record.id), eq(workInvites.email, email.toLowerCase()), eq(workInvites.status, 'pending'),
  ));
  return { ok: true };
}

export async function acceptInvite(record: WorkRow, actor: Actor) {
  const [inv] = await db.select().from(workInvites)
    .where(and(eq(workInvites.workId, record.id), eq(workInvites.email, actor.email.toLowerCase()))).limit(1);
  if (!inv) throw new ApiError(404, 'No tenés una invitación para esta canción.');
  const work = await mustReadWork(record);
  const me = await getOrCreateWallet(actor.uid, actor.email);
  const mine = work.contributors.find((c) => c.wallet === me.publicKey.toBase58());
  if (!mine) {
    const creator = await getWallet(record.userId);
    await run(creator, record.userId, 'tx', (p) => p.methods.addCollaborator(me.publicKey)
      .accounts({ work: new PublicKey(work.pda), creator: creator.publicKey }).rpc());
  }
  if (!mine?.joined) {
    await run(me, actor.uid, 'tx', (p) => p.methods.acceptInvite()
      .accounts({ work: new PublicKey(work.pda), signer: me.publicKey }).rpc());
  }
  await db.update(workInvites).set({ status: 'accepted', wallet: me.publicKey.toBase58(), name: inv.name || actor.name || null })
    .where(and(eq(workInvites.workId, record.id), eq(workInvites.email, inv.email)));
  return { ok: true };
}

export async function commitVersion(record: WorkRow, actor: Actor, text: { lyrics: string; chords: string }) {
  const work = await mustReadWork(record);
  if (work.status !== 'open') throw new ApiError(400, 'La obra no está abierta a cambios.');
  const [latest] = await db.select().from(workVersions)
    .where(eq(workVersions.workId, record.id)).orderBy(desc(workVersions.idx)).limit(1);
  const prev = latest ? `${latest.lyrics}\n${latest.chords}` : '';
  const next = `${text.lyrics}\n${text.chords}`;
  if (prev === next) throw new ApiError(400, 'No hiciste cambios para guardar.');
  if (!normalizeLyrics(lyricsFor(text.lyrics, text.chords))) throw new ApiError(400, 'La letra no puede quedar vacía.');

  const kp = await getOrCreateWallet(actor.uid, actor.email);
  const content = contentHashOf(text.lyrics, text.chords);
  const units = Math.max(1, diffUnits(prev, next));
  const pda = new PublicKey(work.pda);
  const sig = await run(kp, actor.uid, 'version', (p) => p.methods.commitVersion(Array.from(content), new BN(units))
    .accounts({ work: pda, version: versionPda(pda, work.versionCount), author: kp.publicKey, systemProgram: SystemProgram.programId })
    .rpc());
  await db.insert(workVersions).values({
    workId: record.id, idx: work.versionCount, contentHash: hex(content), txSig: sig, authorUid: actor.uid, units,
    lyrics: text.lyrics, chords: text.chords,
  });
  await db.update(works).set({ lyrics: text.lyrics, chords: text.chords }).where(eq(works.id, record.id));
  return { signature: sig, units };
}

/** Reparto y firmas. `manual` mapea wallet → bps (debe sumar 10000). */
export async function proposeSplit(record: WorkRow, actor: Actor, manual: Record<string, number> | null, secs?: number) {
  const work = await mustReadWork(record);
  const kp = await getOrCreateWallet(actor.uid, actor.email);
  const bps = manual ? work.contributors.map((c) => Number(manual[c.wallet] ?? 0)) : null;
  const window = manual ? 0 : Math.min(Math.max(0, secs ?? windowSecs()), DEFAULT_WINDOW_SECS);
  const sig = await run(kp, actor.uid, 'tx', (p) => p.methods.proposeSplit(bps, new BN(window))
    .accounts({ work: new PublicKey(work.pda), creator: kp.publicKey }).rpc());
  await syncStatus(record, await mustReadWork(record));
  return { signature: sig };
}

type SignerOp = 'signSplit' | 'object' | 'reopen' | 'finalize';
export async function signerAction(record: WorkRow, actor: Actor, op: SignerOp) {
  const work = await mustReadWork(record);
  const kp = await getOrCreateWallet(actor.uid, actor.email);
  const pda = new PublicKey(work.pda);
  const sig = await run(kp, actor.uid, 'tx', (p) => op === 'reopen'
    ? p.methods.reopen().accounts({ work: pda, creator: kp.publicKey }).rpc()
    : p.methods[op]().accounts({ work: pda, signer: kp.publicKey }).rpc());
  await syncStatus(record, await mustReadWork(record));
  return { signature: sig };
}

/** Deja final una obra cuya ventana venció (la paga la tesorería; cualquiera puede ejecutarlo). */
export async function finalizeIfDue(record: WorkRow): Promise<boolean> {
  const work = await mustReadWork(record);
  if (work.status !== 'closing' || Date.now() / 1000 < work.closesAt) {
    await syncStatus(record, work);
    return false;
  }
  const t = treasury();
  await runAsTreasury(t, (p) => p.methods.finalize().accounts({ work: new PublicKey(work.pda), signer: t.publicKey }).rpc());
  await syncStatus(record, await mustReadWork(record));
  return true;
}

/* ---------- impugnaciones ---------- */

/**
 * Presenta una impugnación. Va a la bandeja de revisión: NO toca la blockchain ni congela la obra
 * hasta que un administrador la admita. Así un troll solo genera un mensaje para rechazar.
 */
export async function submitChallenge(record: WorkRow, actor: Actor, input: ChallengeInput) {
  const invalid = validateChallengeInput(input);
  if (invalid) throw new ApiError(400, invalid);
  if ((await relationOf(record, actor)) !== 'none') {
    throw new ApiError(400, 'Sos autor de esta obra: si querés corregir algo, objetá el reparto.');
  }
  const work = await mustReadWork(record);
  if (work.status !== 'closing' && work.status !== 'final') {
    throw new ApiError(400, 'Esta obra no se puede impugnar en su estado actual.');
  }

  const mine = await db.select().from(workChallenges).where(eq(workChallenges.challengerUid, actor.uid));
  const since = Date.now() - 24 * 3600 * 1000;
  const verdict = evaluateSubmission({
    active: mine.filter((c) => c.status === 'pending' || c.status === 'open').length,
    last24h: mine.filter((c) => (c.createdAt?.getTime() ?? 0) > since).length,
    failed: mine.filter((c) => c.status === 'rejected' || c.status === 'dismissed').length,
    rejectedOnThisSong: mine.some((c) => c.workId === record.id && c.status === 'rejected'),
  });
  if (!verdict.ok) throw new ApiError(429, verdict.message, { code: verdict.code });

  const evidence = input.evidence.trim();
  const id = randomUUID();
  await db.insert(workChallenges).values({
    id, workId: record.id, challengerUid: actor.uid, challengerEmail: actor.email.toLowerCase(),
    evidence, evidenceHash: sha256(JSON.stringify(input)).toString('hex'), status: 'pending',
    sourceUrl: input.sourceUrl.trim(), matchedPart: input.matchedPart.trim(), sinceWhen: input.sinceWhen.trim(),
  });
  return { id, status: 'pending' as const };
}

/** El administrador admite la impugnación: recién ahora se registra en la blockchain y la obra se congela. */
export async function admitChallenge(challengeId: string) {
  const [ch] = await db.select().from(workChallenges).where(eq(workChallenges.id, challengeId)).limit(1);
  if (!ch || ch.status !== 'pending') throw new ApiError(404, 'Impugnación no encontrada o ya revisada.');
  const record = await loadWork(ch.workId);
  const work = await mustReadWork(record);
  if (work.status !== 'closing' && work.status !== 'final') {
    throw new ApiError(400, `La obra cambió de estado (${work.status}) y ya no se puede impugnar.`);
  }
  const kp = await getOrCreateWallet(ch.challengerUid, ch.challengerEmail ?? '');
  const pda = new PublicKey(work.pda);
  const sig = await run(kp, ch.challengerUid, 'challenge', (p) => p.methods.challenge(Array.from(Buffer.from(ch.evidenceHash, 'hex')))
    .accounts({ work: pda, challenge: challengePda(pda, kp.publicKey), challenger: kp.publicKey, systemProgram: SystemProgram.programId })
    .rpc());
  await db.update(workChallenges).set({ status: 'open', txSig: sig, reviewedAt: new Date() }).where(eq(workChallenges.id, ch.id));
  await syncStatus(record, await mustReadWork(record));
  return { signature: sig };
}

export async function rejectChallenge(challengeId: string, reason: string) {
  const [ch] = await db.select().from(workChallenges).where(eq(workChallenges.id, challengeId)).limit(1);
  if (!ch || ch.status !== 'pending') throw new ApiError(404, 'Impugnación no encontrada o ya revisada.');
  await db.update(workChallenges)
    .set({ status: 'rejected', rejectReason: reason.trim().slice(0, 500) || null, reviewedAt: new Date() })
    .where(eq(workChallenges.id, ch.id));
  return { ok: true };
}

/** Descargo de los autores: se puede escribir y corregir mientras la obra siga en disputa. */
export async function respondToChallenge(record: WorkRow, response: string) {
  const text = response.trim();
  if (text.length < 20) throw new ApiError(400, 'Contá con detalle tu versión (mín. 20 caracteres).');
  if (text.length > 4000) throw new ApiError(400, 'El descargo es demasiado largo (máx. 4000 caracteres).');
  const [open] = await db.select().from(workChallenges)
    .where(and(eq(workChallenges.workId, record.id), eq(workChallenges.status, 'open'))).limit(1);
  if (!open) throw new ApiError(404, 'No hay una impugnación abierta para responder.');
  await db.update(workChallenges).set({ response: text, respondedAt: new Date() }).where(eq(workChallenges.id, open.id));
  return { ok: true };
}

export async function resolveChallenge(challengeId: string, upheld: boolean) {
  const [ch] = await db.select().from(workChallenges).where(eq(workChallenges.id, challengeId)).limit(1);
  if (!ch || ch.status !== 'open') throw new ApiError(404, 'Impugnación no encontrada o ya resuelta.');
  const record = await loadWork(ch.workId);
  const work = await mustReadWork(record);
  const challengerWallet = await getWalletPubkey(ch.challengerUid);
  if (!challengerWallet) throw new ApiError(404, 'No se encontró la wallet de quien impugnó.');
  const t = treasury();
  const pda = new PublicKey(work.pda);
  const sig = await runAsTreasury(t, (p) => p.methods.resolveChallenge(upheld)
    .accounts({
      config: configPda(), work: pda, challenge: challengePda(pda, new PublicKey(challengerWallet)), arbiter: t.publicKey,
    }).rpc());
  await db.update(workChallenges).set({ status: upheld ? 'upheld' : 'dismissed', resolveTxSig: sig })
    .where(eq(workChallenges.id, ch.id));
  if (upheld) await db.update(works).set({ isPublic: false }).where(eq(works.id, record.id));
  await syncStatus(record, await mustReadWork(record));
  return { signature: sig };
}

/* ---------- vista para la UI ---------- */

export async function chainView(record: WorkRow, actor: Actor | null) {
  await finalizeIfDue(record).catch((e) => console.error('[soliric] finalizeIfDue', e));
  const work = await mustReadWork(record);
  const relation = actor ? await relationOf(record, actor) : 'none';
  const myWallet = actor ? await getWalletPubkey(actor.uid) : null;

  const invites = await db.select().from(workInvites).where(eq(workInvites.workId, record.id));
  const people = await Promise.all(work.contributors.map(async (c) => {
    const uid = await walletPubkeyToUid(c.wallet);
    const label = uid === record.userId ? (record.displayName ?? 'Autor') : (invites.find((i) => i.wallet === c.wallet)?.name || `${c.wallet.slice(0, 4)}…${c.wallet.slice(-4)}`);
    return { ...c, label, isCreator: c.wallet === work.creator, isMe: c.wallet === myWallet };
  }));
  const versions = await db.select({
    idx: workVersions.idx, contentHash: workVersions.contentHash, txSig: workVersions.txSig,
    authorUid: workVersions.authorUid, units: workVersions.units, createdAt: workVersions.createdAt,
  }).from(workVersions).where(eq(workVersions.workId, record.id));
  const sees = relation === 'owner' || relation === 'coauthor';
  const challengeRows = await db.select().from(workChallenges).where(eq(workChallenges.workId, record.id));
  // La evidencia y el descargo los ven solo los autores; quien impugnó queda anónimo para ellos
  // Las que están en la bandeja o se rechazaron no existen para los autores: no se los molesta
  const challenges = challengeRows.filter((c) => ['open', 'upheld', 'dismissed'].includes(c.status)).map((c) => ({
    id: c.id, status: c.status, createdAt: c.createdAt, txSig: c.txSig,
    ...(sees ? { evidence: c.evidence, response: c.response, respondedAt: c.respondedAt } : {}),
  }));
  const mineRow = actor ? challengeRows.filter((c) => c.challengerUid === actor.uid)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0] : undefined;
  const myChallenge = mineRow ? { status: mineRow.status, rejectReason: mineRow.rejectReason, createdAt: mineRow.createdAt } : null;
  return {
    program: PROGRAM_ID.toBase58(), work, relation, people, fingerprint: record.fingerprint,
    title: record.isPublic || sees ? record.title : null,
    // el texto de trabajo solo lo ven quienes participan (la canción puede ser privada)
    text: sees ? { lyrics: record.lyrics ?? '', chords: record.chords ?? '' } : null,
    invites: relation === 'owner' ? invites : invites.filter((i) => actor && i.email === actor.email.toLowerCase()),
    versions: versions.sort((a, b) => a.idx - b.idx), challenges, myChallenge,
  };
}

export async function myInvitations(actor: Actor) {
  const rows = await db.select().from(workInvites).where(and(
    eq(workInvites.email, actor.email.toLowerCase()), inArray(workInvites.status, ['pending', 'accepted']),
  ));
  if (!rows.length) return [];
  const list = await db.select().from(works).where(inArray(works.id, rows.map((r) => r.workId)));
  return list.map((s) => ({
    workId: s.id, title: s.title, owner: s.displayName, status: rows.find((r) => r.workId === s.id)!.status,
  }));
}

/* ---------- certificado ---------- */

/** Datos para el certificado imprimible: obra, autores, hashes sellados y transacción del registro. */
export async function certificateData(record: WorkRow) {
  const work = await mustReadWork(record);
  const [att] = await db.select().from(attestations)
    .where(eq(attestations.workId, record.id)).orderBy(desc(attestations.createdAt)).limit(1);
  const [v0] = await db.select().from(workVersions)
    .where(and(eq(workVersions.workId, record.id), eq(workVersions.idx, 0))).limit(1);
  const invitedRows = await db.select().from(workInvites).where(eq(workInvites.workId, record.id));
  const people = await Promise.all(work.contributors.map(async (c) => {
    const uid = await walletPubkeyToUid(c.wallet);
    return {
      wallet: c.wallet, bps: c.bps,
      label: uid === record.userId ? (record.displayName ?? 'Autor') : (invitedRows.find((i) => i.wallet === c.wallet)?.name || `${c.wallet.slice(0, 4)}…${c.wallet.slice(-4)}`),
    };
  }));
  return {
    program: PROGRAM_ID.toBase58(), cluster: CLUSTER,
    title: record.title, artist: record.artist,
    status: work.status, workPda: work.pda, fingerprint: record.fingerprint,
    createdAt: work.createdAt,
    people,
    metadata: att?.metadata ? JSON.parse(att.metadata) : null,
    metadataHash: att?.metadataHash ?? null,
    statementHash: att?.statementHash ?? null,
    contentHash: v0?.contentHash ?? null,
    txSig: v0?.txSig ?? null,
  };
}
