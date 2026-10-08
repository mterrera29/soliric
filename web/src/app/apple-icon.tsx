import { ImageResponse } from 'next/og';
import { BRAND, LogoMark } from '@/components/Logo';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Ícono de la pantalla de inicio en iOS: cuadrado completo (el sistema le pone las esquinas).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.ground }}>
        <LogoMark size={116} />
      </div>
    ),
    size,
  );
}
