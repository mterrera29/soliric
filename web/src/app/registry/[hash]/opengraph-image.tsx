import { ImageResponse } from 'next/og';
import { STATUS_LABEL } from '@/lib/soliric/types';
import { getRegistration } from '@/lib/soliric/verify';
import { getT } from '@/lib/i18n/server';

export const alt = 'Autoría registrada en la blockchain de Solana';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const HASH = /^[0-9a-f]{64}$/i;

export default async function Image({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const { t } = await getT();
  const reg = HASH.test(hash) ? await getRegistration(hash.toLowerCase()).catch(() => null) : null;
  const ok = reg?.registered === true;
  const title = ok && reg.listing ? reg.listing.title : ok ? t('Letra registrada') : t('Obra no encontrada');
  const subtitle = ok && reg.listing ? [reg.listing.artist, reg.listing.author && t('por {author}', { author: reg.listing.author })].filter(Boolean).join(' · ') : '';
  const status = ok ? t(STATUS_LABEL[reg.work.status]) : '';
  const dot = ok && reg.work.status === 'final' ? '#A8C4A0' : ok && (reg.work.status === 'disputed' || reg.work.status === 'revoked') ? '#f87171' : '#FDB174';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(135deg, #1d1612 0%, #2b1d14 100%)', color: '#F5EDE3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#FDB174', fontSize: 30, letterSpacing: 4, textTransform: 'uppercase' }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: '#F58A45', display: 'flex' }} />
          Soliric · Fogón
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: title.length > 28 ? 72 : 92, fontWeight: 700, lineHeight: 1.05, display: 'flex' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 38, color: '#D4A373', display: 'flex' }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 34, color: dot }}>
            {ok && <div style={{ width: 16, height: 16, borderRadius: 8, background: dot, display: 'flex' }} />}
            {status}
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#9a8d83' }}>{t('Autoría registrada en Solana')}</div>
        </div>
      </div>
    ),
    size,
  );
}
