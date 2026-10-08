import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, FileSearch, ShieldCheck, ShieldAlert, ShieldX, Hourglass } from 'lucide-react';
import ChallengeBox from '@/components/soliric/ChallengeBox';
import ShareButton from '@/components/soliric/ShareButton';
import StatusBadge from '@/components/soliric/StatusBadge';
import { explorerAddr, explorerTx } from '@/lib/soliric/links';
import { CLUSTER } from '@/lib/soliric/client';
import { STATUS_LABEL, type ChainStatus } from '@/lib/soliric/types';
import { getRegistration } from '@/lib/soliric/verify';
import { getT } from '@/lib/i18n/server';
import { localeOf } from '@/lib/i18n';

type Props = { params: Promise<{ hash: string }> };
const HASH = /^[0-9a-f]{64}$/i;
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };
const short = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
const fmt = (unix: number, locale: string) => new Date(unix * 1000).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

const SUMMARY: Record<ChainStatus, string> = {
  open: 'Los autores todavía están trabajando en esta obra.',
  proposed: 'Los autores están acordando el reparto.',
  closing: 'Está en período público de impugnación. Si nadie la impugna, queda registrada de forma definitiva.',
  final: 'Su autoría quedó registrada de forma definitiva en la blockchain de Solana.',
  disputed: 'Alguien impugnó este registro y está en revisión.',
  revoked: 'Este registro fue revocado: la impugnación prosperó.',
};
const ICON: Record<ChainStatus, React.ReactNode> = {
  open: <Hourglass className="w-7 h-7" />, proposed: <Hourglass className="w-7 h-7" />, closing: <Hourglass className="w-7 h-7" />,
  final: <ShieldCheck className="w-7 h-7" />, disputed: <ShieldAlert className="w-7 h-7" />, revoked: <ShieldX className="w-7 h-7" />,
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  const { t, lang } = await getT();
  const reg = HASH.test(hash) ? await getRegistration(hash.toLowerCase()) : null;
  const base = { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000') };
  if (!reg?.registered) return { ...base, title: t('Obra no registrada · Soliric') };
  const title = reg.listing ? t('«{title}» · autoría registrada', { title: reg.listing.title }) : t('Letra registrada en Solana');
  const description = t('{status} desde el {date}. Verificable por cualquiera en la blockchain de Solana.', { status: t(STATUS_LABEL[reg.work.status]), date: fmt(reg.work.createdAt, localeOf(lang)) });
  return {
    ...base, title, description,
    openGraph: { title, description, type: 'website', siteName: 'Soliric', url: `/registry/${reg.fingerprint}` },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function RegistrationPage({ params }: Props) {
  const { hash } = await params;
  const { t, lang } = await getT();
  const locale = localeOf(lang);
  if (!HASH.test(hash)) notFound();
  const reg = await getRegistration(hash.toLowerCase());
  if (!reg.registered) notFound();

  const { work, listing, versions } = reg;
  const v0 = versions.find((v) => v.idx === 0);
  const challengeable = work.status === 'closing' || work.status === 'final';

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/registry" className="inline-flex items-center gap-2 min-h-11 px-2 -ml-2 rounded-lg hover:bg-terracotta/10" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" /> {t('Obras registradas')}
        </Link>

        <article className="rounded-3xl p-6 sm:p-8 space-y-6" style={card} aria-label={t('Registro de autoría')}>
          <header className="flex gap-4 items-start">
            <span className={`shrink-0 flex h-14 w-14 items-center justify-center rounded-2xl ${work.status === 'final' ? 'bg-soft-sage/20 text-soft-sage' : work.status === 'disputed' || work.status === 'revoked' ? 'bg-red-500/15 text-red-400' : 'bg-ember/15 text-ember-light'}`}>
              {ICON[work.status]}
            </span>
            <div className="min-w-0 space-y-2">
              <h1 className="text-3xl font-heading leading-tight break-words" style={{ color: 'var(--text-primary)' }}>
                {listing ? listing.title : t('Letra registrada')}
              </h1>
              {listing && (
                <p style={{ color: 'var(--text-secondary)' }}>{[listing.artist, listing.author && t('por {author}', { author: listing.author })].filter(Boolean).join(' · ')}</p>
              )}
              <StatusBadge status={work.status} />
            </div>
          </header>

          <p style={{ color: 'var(--text-secondary)' }}>{t(SUMMARY[work.status])}</p>
          {!listing && (
            <p className="text-sm rounded-xl p-3.5" style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)' }}>
              {t('Su autor eligió no publicar la letra ni el título. El registro igual se puede comprobar: quien tenga el texto lo pega en el verificador.')}
            </p>
          )}

          <section aria-label={t('Autores')} className="space-y-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('Autores y reparto')}</h2>
            {work.contributors.map((c) => (
              <div key={c.wallet} className="space-y-1.5">
                <div className="flex justify-between gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <span className="truncate">
                    {c.wallet === work.creator && listing?.author ? listing.author : t('Autor/a')} <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{short(c.wallet)}</span>
                  </span>
                  <strong className="text-warm-tan shrink-0">{work.status === 'open' ? '—' : `${(c.bps / 100).toFixed(1)} %`}</strong>
                </div>
                {work.status !== 'open' && (
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
                    <div className="h-full bg-ember" style={{ width: `${c.bps / 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </section>

          <dl className="grid gap-3 text-sm sm:grid-cols-2" style={{ color: 'var(--text-secondary)' }}>
            <div><dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('Registrada el')}</dt><dd>{fmt(work.createdAt, locale)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('Versiones')}</dt><dd>{work.versionCount}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('Huella de la letra')}</dt><dd className="font-mono text-xs break-all">{reg.fingerprint}</dd></div>
          </dl>

          <div className="flex flex-wrap gap-3 pt-1">
            <ShareButton path={`/registry/${reg.fingerprint}`} title={listing ? t('«{title}» · autoría registrada', { title: listing.title }) : t('Letra registrada en Solana')}
              text={t('Autoría registrada en la blockchain de Solana')} />
            <Link href="/verify" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30 transition-colors">
              <FileSearch className="w-4 h-4" /> {t('Verificar una letra')}
            </Link>
          </div>

          <footer className="flex flex-wrap gap-x-5 gap-y-2 pt-4 text-xs" style={{ borderTop: '1px solid var(--border-color)' }}>
            <a href={explorerAddr(work.pda, CLUSTER)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-warm-tan hover:underline">
              {t('Obra en el Explorer')} <ExternalLink className="w-3 h-3" />
            </a>
            {v0 && (
              <a href={explorerTx(v0.txSig, CLUSTER)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-warm-tan hover:underline">
                {t('Transacción del registro')} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </footer>
        </article>

        {challengeable && (
          <section className="rounded-2xl p-5 space-y-3" style={card} aria-label={t('Impugnar')}>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('¿Esta letra es de otro autor?')}</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('Si ya existe publicada o registrada por otra persona, podés impugnar este registro. Lo revisa un administrador antes de bloquear nada.')}
            </p>
            <ChallengeBox endpoint={`registry/${reg.fingerprint}/challenge`} />
          </section>
        )}
      </div>
    </main>
  );
}
