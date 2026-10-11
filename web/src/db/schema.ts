import { pgTable, text, timestamp, integer, bigint, real, boolean, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Obras (letras) registradas o por registrar. Una obra puede crearse desde la web de Soliric
 * o desde una app asociada por la API (`partnerId` y `externalRef`).
 */
export const works = pgTable('works', {
  id: text('id').primaryKey(),
  // Dueño: uid de Firebase (web) o un uid sintético `ext:<partner>:<hash>` (alta por API, hasta que lo reclame)
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  artist: text('artist').notNull().default(''),
  // Nombre con el que figura el autor
  displayName: text('display_name'),
  lyrics: text('lyrics').notNull().default(''),
  // Opcional: acordes tal como los guarda la app de origen (entran en el hash de contenido, no en la huella)
  chords: text('chords').notNull().default(''),
  isPublic: boolean('is_public').notNull().default(false),
  // 'web' | 'api' | 'import' (lo importado de otras fuentes es de otro autor y no se registra)
  source: text('source').notNull().default('web'),
  sourceRef: text('source_ref'),
  partnerId: text('partner_id'),
  // Id de la obra en la app asociada: evita registrar dos veces lo mismo
  externalRef: text('external_ref'),
  // Huella de la letra normalizada (hex): es el work_id on-chain
  fingerprint: text('fingerprint'),
  workPda: text('work_pda'),
  onchainStatus: text('onchain_status'),
  registeredAt: timestamp('registered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('works_user_idx').on(t.userId),
  index('works_fingerprint_idx').on(t.fingerprint),
  uniqueIndex('works_partner_ref_idx').on(t.partnerId, t.externalRef),
]);

export const wallets = pgTable('wallets', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull(),
  walletPubkey: text('wallet_pubkey').notNull(),
  // AES-256-GCM (iv.tag.ciphertext en base64); la clave vive en WALLET_ENC_KEY
  walletSecretEnc: text('wallet_secret_enc').notNull(),
  exportedAt: timestamp('exported_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [index('wallets_email_idx').on(t.email)]);

export const workVersions = pgTable('work_versions', {
  workId: text('work_id').notNull(),
  idx: integer('idx').notNull(),
  contentHash: text('content_hash').notNull(),
  txSig: text('tx_sig').notNull(),
  authorUid: text('author_uid').notNull(),
  units: integer('units').notNull().default(0),
  lyrics: text('lyrics').notNull().default(''),
  chords: text('chords').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [primaryKey({ columns: [t.workId, t.idx] }), index('work_versions_hash_idx').on(t.contentHash)]);

export const workInvites = pgTable('work_invites', {
  workId: text('work_id').notNull(),
  email: text('email').notNull(),
  status: text('status').notNull().default('pending'), // pending | accepted
  // Nombre con el que se muestra al coautor: el que escribió quien invitó, o el de su cuenta de Google al aceptar
  name: text('name'),
  // Wallet que se le creó al aceptar: vincula el nombre con la dirección que aparece en la cadena
  wallet: text('wallet'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [primaryKey({ columns: [t.workId, t.email] })]);

export const attestations = pgTable('attestations', {
  id: text('id').primaryKey(),
  workId: text('work_id').notNull(),
  uid: text('uid').notNull(),
  statement: text('statement').notNull(),
  statementHash: text('statement_hash').notNull(),
  catalogScore: real('catalog_score'),
  // Datos de la obra sellados al registrar (JSON canónico) y su hash, que va en el memo on-chain
  metadata: text('metadata'),
  metadataHash: text('metadata_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const workChallenges = pgTable('work_challenges', {
  id: text('id').primaryKey(),
  workId: text('work_id').notNull(),
  challengerUid: text('challenger_uid').notNull(),
  evidence: text('evidence').notNull(),
  evidenceHash: text('evidence_hash').notNull(),
  // pending: en la bandeja (no toca la blockchain) · rejected: descartada ·
  // open: admitida y en disputa on-chain · upheld / dismissed: resuelta
  status: text('status').notNull().default('pending'),
  sourceUrl: text('source_url'),
  matchedPart: text('matched_part'),
  sinceWhen: text('since_when'),
  challengerEmail: text('challenger_email'),
  rejectReason: text('reject_reason'),
  reviewedAt: timestamp('reviewed_at'),
  txSig: text('tx_sig'),
  resolveTxSig: text('resolve_tx_sig'),
  // Descargo del autor (se puede editar mientras la disputa siga abierta)
  response: text('response'),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Lo que la tesorería adelantó a cada wallet (para los topes de uso gratuito)
export const funding = pgTable('funding', {
  id: text('id').primaryKey(),
  uid: text('uid').notNull(),
  lamports: bigint('lamports', { mode: 'number' }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('funding_uid_idx').on(t.uid), index('funding_created_idx').on(t.createdAt)]);

/** Apps asociadas que usan la API. La clave se muestra una sola vez; acá solo se guarda su hash. */
export const partners = pgTable('partners', {
  id: text('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
  revokedAt: timestamp('revoked_at'),
}, (t) => [index('partners_owner_idx').on(t.ownerUid)]);
