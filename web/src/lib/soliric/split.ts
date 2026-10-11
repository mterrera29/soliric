export const BPS_TOTAL = 10_000;

/** Reparto automático por aportes, en puntos base (10 000 = 100 %). El resto del redondeo va al mayor aportante. */
export function autoBps(units: number[]): number[] | null {
  const total = units.reduce((sum, u) => sum + u, 0);
  if (units.length === 0 || total <= 0) return null;
  let top = 0;
  units.forEach((u, i) => { if (u > units[top]) top = i; });
  const bps = units.map((u) => Math.floor((u * BPS_TOTAL) / total));
  bps[top] += BPS_TOTAL - bps.reduce((a, b) => a + b, 0);
  return bps;
}
