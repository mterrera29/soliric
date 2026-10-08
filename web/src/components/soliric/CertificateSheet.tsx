'use client';

import { useI18n } from '@/hooks/useI18n';
import Logo from '@/components/Logo';
import { STATUS_LABEL, type CertificateData } from '@/lib/soliric/types';
import { explorerAddr, explorerTx } from '@/lib/soliric/links';

const row = 'grid grid-cols-[9.5rem_1fr] gap-x-4 gap-y-0.5 text-[13px] leading-snug';
const mono = 'font-mono text-[11px] break-all';

/** Hoja del certificado (clara, para pantalla e impresión). */
export default function CertificateSheet({ data, qr }: { data: CertificateData; qr: string | null }) {
  const { t, locale } = useI18n();
  const authorName = data.metadata?.authorName;
  return (
    <article className="print-sheet mx-auto w-full max-w-[720px] rounded-2xl p-8 sm:p-10 space-y-6" aria-label={t('Certificado de registro de autoría')}>
      <header className="text-center space-y-1 pb-5" style={{ borderBottom: '2px solid #c2410c' }}>
        <div className="flex justify-center pb-1"><Logo size={30} variant="light" /></div>
        <h1 className="text-2xl font-heading">{t('Certificado de registro de autoría')}</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('Registrado en la blockchain de Solana ({cluster})', { cluster: data.cluster })}</p>
      </header>

      <section className="text-center space-y-1">
        <h2 className="text-3xl font-heading">{data.title}</h2>
        {data.artist && <p style={{ color: 'var(--text-secondary)' }}>{data.artist}</p>}
        {authorName && <p className="text-sm">{t('Autoría declarada por')} <strong>{authorName}</strong></p>}
      </section>

      <section className="space-y-1.5" aria-label={t('Autores')}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('Autores y reparto')}</h3>
        {data.people.map((p) => (
          <div key={p.wallet} className="flex justify-between text-sm">
            <span>{p.label} <span className={mono} style={{ color: 'var(--text-muted)' }}>{p.wallet.slice(0, 6)}…{p.wallet.slice(-6)}</span></span>
            <strong>{(p.bps / 100).toFixed(1)} %</strong>
          </div>
        ))}
      </section>

      <section className="space-y-1.5" aria-label={t('Datos del registro')}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('Datos del registro')}</h3>
        <div className={row}><span>{t('Estado')}</span><span>{t(STATUS_LABEL[data.status])}</span></div>
        <div className={row}><span>{t('Fecha on-chain')}</span><span>{new Date(data.createdAt * 1000).toLocaleString(locale)}</span></div>
        {data.metadata && <div className={row}><span>{t('Fecha declarada')}</span><span>{new Date(data.metadata.registeredAt).toLocaleString(locale)}</span></div>}
        <div className={row}><span>{t('Obra (cuenta)')}</span><a className={mono} href={explorerAddr(data.workPda, data.cluster)}>{data.workPda}</a></div>
        {data.txSig && <div className={row}><span>{t('Transacción')}</span><a className={mono} href={explorerTx(data.txSig, data.cluster)}>{data.txSig}</a></div>}
        <div className={row}><span>{t('Programa')}</span><span className={mono}>{data.program}</span></div>
        {data.fingerprint && <div className={row}><span>{t('Huella de la letra')}</span><span className={mono}>{data.fingerprint}</span></div>}
        {data.metadataHash && <div className={row}><span>{t('Hash de los datos')}</span><span className={mono}>{data.metadataHash}</span></div>}
        {data.statementHash && <div className={row}><span>{t('Hash de la declaración')}</span><span className={mono}>{data.statementHash}</span></div>}
      </section>

      <section className="flex gap-5 items-start" aria-label={t('Cómo verificar')}>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- QR generado en el cliente (data URL)
          <img src={qr} alt={t('Código QR para verificar la letra')} width={112} height={112} className="shrink-0" />
        )}
        <div className="text-[12px] leading-relaxed space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <p><strong style={{ color: 'var(--text-primary)' }}>{t('Cómo verificar.')}</strong> {t('Escaneá el código o abrí')} <span className={mono}>/verify</span> {t('y pegá la letra: la respuesta sale directo de la blockchain.')}</p>
          {data.metadata && (
            <p>
              {t('Los datos de esta obra (título, artista, autor y fecha) no están publicados en la blockchain: solo su hash, que queda en el memo de la transacción. El SHA-256 del siguiente JSON tiene que coincidir con el «Hash de los datos».')}
            </p>
          )}
        </div>
      </section>

      {data.metadata && (
        <pre className={`${mono} rounded-lg p-3 whitespace-pre-wrap`} style={{ background: '#f6f1ec' }}>{JSON.stringify(data.metadata)}</pre>
      )}
    </article>
  );
}
