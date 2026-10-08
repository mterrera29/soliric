'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, ShieldX, ExternalLink, Search } from 'lucide-react';
import Spinner from '@/components/Spinner';
import { soliricFetch, shortKey } from '@/lib/soliric/client-api';
import { STATUS_LABEL, type VerifyData } from '@/lib/soliric/types';
import StatusBadge from '@/components/soliric/StatusBadge';
import ChallengeBox from '@/components/soliric/ChallengeBox';
import { useI18n, useT } from '@/hooks/useI18n';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };

const pct = (n: number) => `${Math.round(n * 100)} %`;
type T = (key: string, params?: Record<string, string | number>) => string;

function matchText(t: T, kind: string | undefined, score: number | undefined) {
  if (kind === 'similar') return t('Es la misma letra con diferencias menores ({pct} de coincidencia).', { pct: pct(score ?? 0) });
  if (kind === 'fragment') return t('Es un fragmento de una letra registrada ({pct} del texto está en la obra).', { pct: pct(score ?? 0) });
  return kind === 'hash' ? t('Coincide con la obra registrada.') : t('Coincide con la letra registrada.');
}

function Related({ items }: { items?: { label: string; score: number }[] }) {
  const t = useT();
  if (!items?.length) return null;
  return (
    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('También se parece a')}</p>
      <ul className="space-y-0.5">
        {items.map((r, i) => <li key={i}>{r.label} · {pct(r.score)}</li>)}
      </ul>
    </div>
  );
}

export default function VerifyPage() {
  return <Suspense fallback={<Spinner />}><VerifyContent /></Suspense>;
}

function VerifyContent() {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  const hash = params.get('hash');
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [result, setResult] = useState<VerifyData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function verify(body?: { lyrics: string; title?: string; artist?: string }, hashParam?: string) {
    setBusy(true); setError(''); setResult(null);
    try {
      const noAuth = async () => null;
      setResult(hashParam
        ? await soliricFetch<VerifyData>(noAuth, `verify?hash=${encodeURIComponent(hashParam)}`)
        : await soliricFetch<VerifyData>(noAuth, 'verify', { body }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- verificación inicial por link /verify?hash=
  useEffect(() => { if (hash) verify(undefined, hash); }, [hash]);

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <p className="text-sm mb-2 text-warm-tan">{t('Sin cuenta, sin intermediarios')}</p>
          <h1 className="text-3xl font-heading mb-2" style={{ color: 'var(--text-primary)' }}>{t('Verificar autoría')}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{t('Pegá una letra y fijate si está registrada en Soliric, quién la firmó y cuándo. La respuesta sale directo de la blockchain.')}</p>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); verify({ lyrics, title, artist }); }} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {([[t('Título (opcional)'), title, setTitle], [t('Autor (opcional)'), artist, setArtist]] as const).map(([label, value, set]) => (
              <input key={label} aria-label={label} placeholder={label} value={value} onChange={(e) => set(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-ember/50"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('No hace falta que la letra sea idéntica: se ignoran mayúsculas, puntuación, etiquetas como [Coro] y el título o autor si van arriba. Una palabra de más o de menos tampoco cambia el resultado.')}
          </p>
          <textarea aria-label={t('Letra a verificar')} rows={8} value={lyrics} onChange={(e) => setLyrics(e.target.value)}
            placeholder={t('Pegá acá la letra…')} className="w-full rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ember/50"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
          <button disabled={busy || !lyrics.trim()} className="btn-cozy bg-ember hover:bg-ember-light text-white px-6 py-2.5 disabled:opacity-40 inline-flex items-center gap-2">
            <Search className="w-4 h-4" /> {busy ? t('Verificando…') : t('Verificar')}
          </button>
        </form>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        {result && !result.registered && (
          <div className="rounded-2xl p-5 flex gap-3" style={card}>
            <ShieldX className="w-6 h-6 shrink-0 text-warm-tan" />
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('No hay un registro de esta letra')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('Eso no prueba que sea de nadie: solo que nadie la registró en Soliric.')}</p>
              <div className="mt-3"><Related items={result.related} /></div>
            </div>
          </div>
        )}

        {result?.registered && result.work && (
          <div className="rounded-2xl p-5 space-y-4" style={card}>
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-soft-sage" />
              <div>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {result.listing ? t('«{title}» de {author}', { title: result.listing.title, author: result.listing.author ?? result.listing.artist }) : t('Letra registrada')}
                </p>
                <StatusBadge status={result.work.status} />
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{matchText(t, result.matchKind, result.score)}</p>
            <dl className="text-sm grid gap-2" style={{ color: 'var(--text-secondary)' }}>
              <div>{t('Registrada el {date}', { date: new Date(result.work.createdAt * 1000).toLocaleString(locale) })}</div>
              <div>{t('Estado: {status}', { status: t(STATUS_LABEL[result.work.status]) })}</div>
              {result.work.contributors.map((c) => (
                <div key={c.wallet}>{t('Autor/a {wallet} · {pct}%', { wallet: shortKey(c.wallet), pct: (c.bps / 100).toFixed(1) })}</div>
              ))}
            </dl>
            <Related items={result.related} />
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link href={`/registry/${result.fingerprint}`} className="inline-flex items-center gap-1.5 font-semibold text-warm-tan hover:underline">
                {t('Ver la página del registro')}
              </Link>
              {result.explorer && (
                <a href={result.explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-warm-tan hover:underline">
                  {t('Ver en el Explorer')} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {(result.work.status === 'closing' || result.work.status === 'final') && (
              <div className="pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                <ChallengeBox endpoint={`registry/${result.fingerprint}/challenge`} />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
