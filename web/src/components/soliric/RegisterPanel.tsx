'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Users, User as UserIcon, AlertTriangle, Ban } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmailChips from './EmailChips';
import { useAuth } from '@/hooks/useAuth';
import { statementFor } from '@/lib/soliric/work-policy';
import { soliricFetch, SoliricError } from '@/lib/soliric/client-api';
import type { PreflightData } from '@/lib/soliric/types';
import { useI18n } from '@/hooks/useI18n';

interface Props {
  workId: string;
  /** Coautores cargados en el formulario: si hay, arranca en modo "con coautores". */
  initialInvites?: string[];
  /** Nombre del autor con el que se creó la obra. */
  defaultAuthorName?: string;
  onRegistered: () => void;
}

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };

/** Chequeo previo + declaración de autoría + registro on-chain (sola/o o con coautores). */
export default function RegisterPanel({ workId, initialInvites = [], defaultAuthorName, onRegistered }: Props) {
  const { t, lang } = useI18n();
  const { getToken } = useAuth();
  const [pf, setPf] = useState<PreflightData | null>(null);
  const [mode, setMode] = useState<'solo' | 'studio'>(initialInvites.length > 0 ? 'studio' : 'solo');
  const [invites, setInvites] = useState<string[]>(initialInvites);
  const { userDisplayName } = useAuth();
  const [authorName, setAuthorName] = useState(defaultAuthorName ?? userDisplayName ?? '');
  const [attest, setAttest] = useState(false);
  const [reinforced, setReinforced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    soliricFetch<PreflightData>(getToken, `works/${workId}/preflight`, { body: {} })
      .then((d) => { if (!cancelled) setPf(d); })
      .catch((e: SoliricError) => {
        if (cancelled) return;
        const preflight = e.data.preflight as PreflightData | undefined;
        if (preflight) setPf(preflight); else setError(e.message);
      });
    return () => { cancelled = true; };
  }, [workId, getToken]);

  async function register() {
    setBusy(true);
    setError('');
    try {
      await soliricFetch(getToken, `works/${workId}/register`, { body: { mode, attest, reinforced, authorName, lang, invites: mode === 'studio' ? invites : [] } });
      onRegistered();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!pf && !error) {
    return (
      <div className="p-6 text-center">
        <Spinner />
        <p className="text-sm -mt-12 pb-6" style={{ color: 'var(--text-secondary)' }}>{t('Revisando que la letra no exista en otros catálogos…')}</p>
      </div>
    );
  }

  const blocked = pf && !pf.registrable;
  const canSubmit = !!pf?.registrable && attest && (!pf.needsReinforced || reinforced) && !busy && (mode === 'solo' || invites.length > 0);

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center gap-3 pr-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ember/15 text-ember-light"><ShieldCheck className="w-5 h-5" /></span>
        <div>
          <h2 className="text-xl font-heading" style={{ color: 'var(--text-primary)' }}>{t('Registrar en Soliric')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('Deja constancia en Solana de que la escribiste, cuándo y con quién.')}</p>
        </div>
      </header>

      {blocked && (
        <div className="rounded-xl p-4 flex gap-3 text-sm" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--text-primary)' }}>
          <Ban className="w-5 h-5 shrink-0 text-red-400" />
          <p>{pf.reason ? t(pf.reason) : null}</p>
        </div>
      )}

      {pf?.registrable && (
        <>
          {pf.freeLeft !== null && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(245,138,69,.12)', color: 'var(--text-secondary)' }}>
              {pf.freeLeft === 1 ? t('Te queda 1 registro gratis.') : t('Te quedan {n} registros gratis.', { n: pf.freeLeft })}
            </p>
          )}
          {pf.needsReinforced && (
            <div className="rounded-xl p-4 flex gap-3 text-sm" style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', color: 'var(--text-primary)' }}>
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <div className="space-y-2">
                <p>
                  {pf.catalog.match
                    ? <>{t('Se parece en parte a «{title}» de {artist}.', { title: pf.catalog.match.title, artist: pf.catalog.match.artist })}</>
                    : <>{t('No pudimos comparar la letra con los catálogos.')}</>}{' '}
                  {t('Podés seguir, pero tiene que quedar claro que es tuya.')}
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={reinforced} onChange={(e) => setReinforced(e.target.checked)} className="mt-1 accent-orange-500" />
                  <span>{t('Confirmo que revisé y que esta letra no es de otro autor.')}</span>
                </label>
              </div>
            </div>
          )}

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">{t('Cómo registrar')}</legend>
            {([
              ['solo', t('Como mía'), t('Firmás sola/o. Hay un período público para impugnar antes de quedar registrada.'), <UserIcon key="u" className="w-5 h-5" />],
              ['studio', t('Con coautores'), t('Invitás a otras personas, el reparto sale de los aportes de cada una.'), <Users key="s" className="w-5 h-5" />],
            ] as const).map(([value, title, text, icon]) => (
              <label key={value} className="rounded-xl p-4 cursor-pointer transition-all"
                style={{ ...card, ...(mode === value ? { borderColor: '#F58A45', boxShadow: '0 0 0 1px #F58A45' } : {}) }}>
                <input type="radio" name="mode" className="sr-only" checked={mode === value} onChange={() => setMode(value)} />
                <span className="flex items-center gap-2 font-semibold text-sm text-warm-tan">{icon}{title}</span>
                <span className="block text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>{text}</span>
              </label>
            ))}
          </fieldset>

          {mode === 'studio' && (
            <div className="space-y-2.5" aria-label={t('Coautores')}>
              <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('Coautores')}</span>
              <EmailChips value={invites} onChange={setInvites} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('Cada persona recibe una invitación y entra con su cuenta de Google. El reparto sale de lo que aporta cada una.')}</p>
            </div>
          )}

          <label className="block text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('Nombre del autor')}</span>
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={120}
              className="w-full rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-ember/50"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
            <span className="block text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('Se sella junto al título y el artista. En la blockchain solo queda un código (hash): tus datos no se publican, pero los podés probar con el certificado.')}
            </span>
          </label>

          <label className="flex items-start gap-2.5 rounded-xl p-4 cursor-pointer text-sm" style={card}>
            <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-1 accent-orange-500" />
            <span style={{ color: 'var(--text-primary)' }}>{statementFor(lang)}</span>
          </label>
        </>
      )}

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {pf?.registrable && (
        <button onClick={register} disabled={!canSubmit}
          className="btn-cozy bg-ember hover:bg-ember-light text-white w-full py-3 disabled:opacity-40 transition-all">
          {busy ? t('Registrando en Solana…') : t('Registrar')}
        </button>
      )}
    </div>
  );
}
