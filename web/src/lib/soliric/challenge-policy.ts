// Reglas puras de las impugnaciones: qué se exige para presentarla y cuándo se frena a una cuenta.

export interface ChallengeInput {
  /** Link o referencia a la fuente donde ya existe la letra. */
  sourceUrl: string;
  /** Qué parte de la letra coincide. */
  matchedPart: string;
  /** Desde cuándo existe esa fuente (fecha o referencia). */
  sinceWhen: string;
  /** Explicación libre. */
  evidence: string;
}

export const CHALLENGE_LIMITS = {
  /** Impugnaciones que una cuenta puede tener esperando revisión o en disputa a la vez. */
  maxActive: 1,
  /** Presentadas por cuenta en 24 horas. */
  maxPer24h: 3,
  /** Rechazadas o desestimadas tras las que se bloquea a la cuenta. */
  maxFailed: 2,
} as const;

const isHttpUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Devuelve el mensaje de error, o null si la impugnación está completa. */
export function validateChallengeInput(input: ChallengeInput): string | null {
  const source = input.sourceUrl.trim();
  // un link tiene que ser válido; si no es link se acepta una referencia concreta (libro, disco, año…)
  if (/^https?:/i.test(source) ? !isHttpUrl(source) : source.length < 8) {
    return 'Indicá la fuente: un link (https://…) o una referencia concreta (disco, libro, año).';
  }
  if (input.matchedPart.trim().length < 10) return 'Indicá qué parte de la letra coincide (por ejemplo, el estribillo o los primeros versos).';
  if (input.sinceWhen.trim().length < 4) return 'Indicá desde cuándo existe esa fuente (fecha o año).';
  if (input.evidence.trim().length < 20) return 'Contá con detalle por qué la obra es de otro autor (mín. 20 caracteres).';
  if (input.evidence.length > 4000) return 'La explicación es demasiado larga (máx. 4000 caracteres).';
  return null;
}

export type SubmissionVerdict = { ok: true } | { ok: false; code: 'active' | 'rate' | 'blocked' | 'repeat'; message: string };

export function evaluateSubmission(stats: {
  active: number;
  last24h: number;
  failed: number;
  /** Esta misma cuenta ya presentó una impugnación rechazada sobre esta obra. */
  rejectedOnThisSong: boolean;
}): SubmissionVerdict {
  if (stats.failed >= CHALLENGE_LIMITS.maxFailed) {
    return { ok: false, code: 'blocked', message: 'Tus impugnaciones anteriores no prosperaron: esta cuenta ya no puede presentar nuevas.' };
  }
  if (stats.rejectedOnThisSong) {
    return { ok: false, code: 'repeat', message: 'Ya presentaste una impugnación sobre esta obra y fue rechazada.' };
  }
  if (stats.active >= CHALLENGE_LIMITS.maxActive) {
    return { ok: false, code: 'active', message: 'Ya tenés una impugnación en revisión. Esperá la respuesta para presentar otra.' };
  }
  if (stats.last24h >= CHALLENGE_LIMITS.maxPer24h) {
    return { ok: false, code: 'rate', message: 'Llegaste al máximo de impugnaciones por día. Probá mañana.' };
  }
  return { ok: true };
}
