import { createHash } from 'node:crypto';

/**
 * Datos de la obra que se "sellan" en la blockchain: se guarda el JSON en la base y solo su hash
 * va on-chain (en el memo del registro). Los datos personales no quedan en un registro público
 * y permanente, pero se pueden probar mostrando el JSON: cualquiera recalcula el hash.
 */
export interface WorkMetadata {
  v: 1;
  title: string;
  artist: string;
  /** Nombre con el que el autor quiere figurar. */
  authorName: string;
  /** Huella de la letra (work_id on-chain). */
  fingerprint: string;
  /** Fecha declarada al registrar (ISO). */
  registeredAt: string;
}

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

export function buildMetadata(input: Omit<WorkMetadata, 'v'>): WorkMetadata {
  return {
    v: 1,
    title: clean(input.title, 200),
    artist: clean(input.artist, 200),
    authorName: clean(input.authorName, 120),
    fingerprint: input.fingerprint,
    registeredAt: input.registeredAt,
  };
}

/** Serialización fija (claves en orden) para que el hash sea siempre el mismo. */
export function canonicalJson(m: WorkMetadata): string {
  return JSON.stringify({
    v: m.v, title: m.title, artist: m.artist, authorName: m.authorName,
    fingerprint: m.fingerprint, registeredAt: m.registeredAt,
  });
}

export const hashMetadata = (m: WorkMetadata): string =>
  createHash('sha256').update(canonicalJson(m)).digest('hex');

/** Texto del memo on-chain que acompaña al registro. */
export const registrationMemo = (statementHash: string, metadataHash: string): string =>
  `soliric:v1:attest:${statementHash}:meta:${metadataHash}`;
