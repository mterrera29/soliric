import { Music2 } from 'lucide-react';

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Ícono de una obra: un degradé cálido propio de cada título, sin portada ni imágenes externas. */
export default function WorkGlyph({ seed, size = 56, className = '' }: { seed: string; size?: number; className?: string }) {
  const h = hash(seed) % 360;
  const hue = 12 + (h % 40); // entre el rojo ladrillo y el ámbar
  return (
    <span aria-hidden className={`flex items-center justify-center shrink-0 text-white/90 ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 28) % 360} 60% 32%))` }}>
      <Music2 style={{ width: size * 0.42, height: size * 0.42 }} />
    </span>
  );
}
