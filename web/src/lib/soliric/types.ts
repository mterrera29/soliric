// Tipos compartidos entre el servidor y la UI (sin imports de servidor).
export type ChainStatus = 'open' | 'proposed' | 'closing' | 'final' | 'disputed' | 'revoked';
export type Relation = 'owner' | 'coauthor' | 'invited' | 'none';

export interface ChainPerson {
  wallet: string; units: number; bps: number; signed: boolean; joined: boolean;
  label: string; isCreator: boolean; isMe: boolean;
}

export interface ChainViewData {
  registered: true;
  program: string;
  relation: Relation;
  /** Huella de la letra: identifica la obra y arma el link público /registry/<huella>. */
  fingerprint: string | null;
  title: string | null;
  text: { lyrics: string; chords: string } | null;
  work: {
    pda: string; creator: string; status: ChainStatus; versionCount: number;
    latestHash: string; createdAt: number; closesAt: number;
  };
  people: ChainPerson[];
  invites: { email: string; status: string }[];
  versions: { idx: number; contentHash: string; txSig: string; units: number; createdAt: string | null }[];
  challenges: {
    id: string; status: string; createdAt: string | null;
    /** Solo para autores. */
    evidence?: string; response?: string | null; respondedAt?: string | null;
  }[];
  /** La última impugnación que presentó quien mira (en revisión, rechazada, admitida…). */
  myChallenge: { status: string; rejectReason: string | null; createdAt: string | null } | null;
}

export interface PreflightData {
  fingerprint: string;
  duplicate: boolean;
  registrable: boolean;
  needsReinforced: boolean;
  /** Registros gratis que le quedan (null = sin límite). */
  freeLeft: number | null;
  reason?: string;
  catalog: { verdict: 'ok' | 'review' | 'block'; score: number; match: { title: string; artist: string; score: number } | null };
}

export interface VerifyData {
  registered: boolean;
  fingerprint: string;
  /** exact: misma letra; similar: misma letra con retoques; fragment: un trozo de una obra registrada. */
  matchKind?: 'exact' | 'similar' | 'fragment' | 'hash';
  score?: number;
  /** Otras obras registradas con parecido parcial. */
  related?: { label: string; score: number }[];
  explorer?: string;
  work?: ChainViewData['work'] & { contributors: { wallet: string; bps: number }[] };
  listing?: { id: string; title: string; artist: string; author: string | null } | null;
  versions?: { idx: number; contentHash: string; txSig: string }[];
}

export const STATUS_LABEL: Record<ChainStatus, string> = {
  open: 'Abierta',
  proposed: 'Acordando reparto',
  closing: 'En período de impugnación',
  final: 'Registrada',
  disputed: 'Disputada',
  revoked: 'Revocada',
};

export interface CertificateData {
  program: string;
  cluster: string;
  title: string;
  artist: string;
  status: ChainStatus;
  workPda: string;
  fingerprint: string | null;
  createdAt: number;
  people: { wallet: string; bps: number; label: string }[];
  metadata: { v: 1; title: string; artist: string; authorName: string; fingerprint: string; registeredAt: string } | null;
  metadataHash: string | null;
  statementHash: string | null;
  contentHash: string | null;
  txSig: string | null;
}

/** Una fila del listado público /registry: las privadas no traen título ni autor. */
export type RegistryItem = {
  fingerprint: string;
  status: ChainStatus | null;
  registeredAt: string | null;
} & (
  | { isPublic: true; title: string; artist: string; author: string | null }
  | { isPublic: false; title?: undefined; artist?: undefined; author?: undefined }
);

export interface RegistryPage {
  items: RegistryItem[];
  hasMore: boolean;
  nextCursor: string | null;
  total: number;
}
