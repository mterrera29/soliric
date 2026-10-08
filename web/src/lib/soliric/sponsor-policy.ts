// Reglas puras de patrocinio: cuánto adelanta la tesorería y cuándo se corta. Sin base ni red (testeable).

export interface SponsorLimits {
  /** Obras que cada cuenta puede registrar gratis. */
  freeRegistrations: number;
  /** Máximo que la tesorería adelanta a una cuenta en toda su vida (lamports). */
  perUserCapLamports: number;
  /** Máximo que adelanta en total en 24 horas (lamports). */
  dailyBudgetLamports: number;
}

export const LAMPORTS_PER_SOL = 1_000_000_000;

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function limitsFromEnv(env: Record<string, string | undefined> = process.env): SponsorLimits {
  return {
    freeRegistrations: Math.floor(num(env.SOLIRIC_FREE_REGISTRATIONS, 3)),
    perUserCapLamports: Math.round(num(env.SOLIRIC_USER_CAP_SOL, 0.05) * LAMPORTS_PER_SOL),
    dailyBudgetLamports: Math.round(num(env.SOLIRIC_DAILY_BUDGET_SOL, 1) * LAMPORTS_PER_SOL),
  };
}

export type SponsorVerdict =
  | { ok: true }
  | { ok: false; code: 'quota' | 'user-cap' | 'daily-budget'; message: string };

/** ¿Puede esta cuenta registrar otra obra sin pagar? Las cuentas admin no tienen tope. */
export function registrationsLeft(registered: number, limits: SponsorLimits, admin: boolean): number {
  return admin ? Number.POSITIVE_INFINITY : Math.max(0, limits.freeRegistrations - registered);
}

export function evaluateSponsorship(input: {
  /** Lo que se adelantaría ahora (lamports). */
  need: number;
  /** Lo adelantado a esta cuenta hasta hoy. */
  fundedToUser: number;
  /** Lo adelantado a todas las cuentas en las últimas 24 h. */
  fundedLast24h: number;
  admin: boolean;
  limits: SponsorLimits;
}): SponsorVerdict {
  const { need, fundedToUser, fundedLast24h, admin, limits } = input;
  if (need <= 0) return { ok: true };
  if (!admin && fundedToUser + need > limits.perUserCapLamports) {
    return {
      ok: false, code: 'user-cap',
      message: 'Llegaste al límite de uso gratuito de esta cuenta. Para seguir hace falta un plan.',
    };
  }
  if (fundedLast24h + need > limits.dailyBudgetLamports) {
    return {
      ok: false, code: 'daily-budget',
      message: 'El cupo gratuito de hoy se agotó. Probá de nuevo mañana.',
    };
  }
  return { ok: true };
}
