import { ImageResponse } from 'next/og';
import { BRAND, LogoMark } from '@/components/Logo';
import { youngSerifFonts } from '@/lib/og-font';

export const alt = 'Soliric: prove your lyrics were yours first';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Vista previa por defecto al compartir cualquier link de Soliric que no tenga una propia.
export default async function Image() {
  const fonts = await youngSerifFonts('soliric');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, background: 'linear-gradient(135deg, #1d1612 0%, #2b1d14 100%)', color: '#F7EFE5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <LogoMark size={168} />
          <div style={{ display: 'flex', fontSize: 168, letterSpacing: -2, lineHeight: 1, fontFamily: fonts ? 'Young Serif' : undefined }}>soliric</div>
        </div>
        <div style={{ display: 'flex', fontSize: 40, color: 'rgba(247,239,229,0.74)' }}>Put on record that you wrote it, and when.</div>
        <div style={{ display: 'flex', fontSize: 28, color: BRAND.dark.chain }}>Authorship registered on Solana</div>
      </div>
    ),
    { ...size, fonts },
  );
}
