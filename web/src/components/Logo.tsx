// Marca de Soliric: un sello con tres líneas de letra. Las dos primeras (la letra, lo humano) son brasa;
// la tercera se deshace en cuatro píxeles verdes: la letra convirtiéndose en huella en la cadena.

export const BRAND = {
  dark: { main: '#F58A45', chain: '#14F195', word: '#F7EFE5' },
  light: { main: '#C2501A', chain: '#0E9F6E', word: '#1B120C' },
  ground: '#15100D',
} as const;

export type LogoVariant = keyof Pick<typeof BRAND, 'dark' | 'light'>;

/** Solo el sello. Es JSX puro, así que también se usa dentro de las imágenes para compartir. */
export function LogoMark({ size = 28, variant = 'dark' }: { size?: number; variant?: LogoVariant }) {
  const c = BRAND[variant];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Soliric" style={{ flexShrink: 0 }}>
      <circle cx="32" cy="32" r="29" fill="none" stroke={c.main} strokeWidth="3.5" />
      <rect x="17" y="21" width="30" height="4.5" rx="2.25" fill={c.main} />
      <rect x="17" y="29.75" width="22" height="4.5" rx="2.25" fill={c.main} />
      {[17, 24.5, 32, 39.5].map((x) => <rect key={x} x={x} y="38.5" width="4.5" height="4.5" rx="1" fill={c.chain} />)}
    </svg>
  );
}

/** Sello + nombre. `size` es el alto del sello y el cuerpo del nombre (en la dirección elegida van iguales). */
export default function Logo({ size = 28, variant = 'dark' }: { size?: number; variant?: LogoVariant }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.28) }}>
      <LogoMark size={size} variant={variant} />
      <span className="font-heading" style={{ fontSize: size, lineHeight: 1, letterSpacing: '-0.012em', color: BRAND[variant].word }}>soliric</span>
    </span>
  );
}
