'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, UserPlus, Hash, Check, FileText } from 'lucide-react';
import Spinner from '@/components/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { soliricFetch, shortKey } from '@/lib/soliric/client-api';
import type { ChainViewData } from '@/lib/soliric/types';
import StatusBadge from './StatusBadge';
import ChallengeBox from './ChallengeBox';
import ShareButton from './ShareButton';
import { useT } from '@/hooks/useI18n';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };
const input = 'w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/50';
const inputStyle = { background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' };
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
const explorerTx = (s: string) => `https://explorer.solana.com/tx/${s}${CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`}`;
const explorerAddr = (a: string) => `https://explorer.solana.com/address/${a}${CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`}`;

function Countdown({ to }: { to: number }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() / 1000), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.floor(to - now));
  if (left === 0) return <>{t('vencido: se cierra en breve')}</>;
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60);
  return <>{d > 0 ? `${d} d ` : ''}{h} h {m} min</>;
}

interface Props {
  workId: string;
  onChanged?: () => void;
}

export default function RegistryPanel({ workId, onChanged }: Props) {
  const t = useT();
  const { getToken } = useAuth();
  const [data, setData] = useState<ChainViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [manual, setManual] = useState<Record<string, string> | null>(null);
  const [draftLyrics, setDraftLyrics] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await soliricFetch<ChainViewData | { registered: false }>(getToken, `works/${workId}/chain`);
      setData(d.registered ? d : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getToken, workId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { load(); }, [load]);

  async function act(key: string, path: string, body: unknown, ok: string, method?: string) {
    setBusy(key); setError(''); setNotice('');
    try {
      await soliricFetch(getToken, `works/${workId}/${path}`, { body, method });
      setNotice(ok);
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  const me = data?.people.find((p) => p.isMe);
  const isOwner = data?.relation === 'owner';
  const isMember = isOwner || data?.relation === 'coauthor';
  const status = data?.work.status;
  const manualTotal = useMemo(
    () => manual ? Object.values(manual).reduce((s, v) => s + (Number(v) || 0), 0) : 0, [manual],
  );

  if (loading) return <Spinner />;
  if (!data) return <p className="p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>{error || t('Esta canción todavía no está registrada.')}</p>;

  const pendingInvite = data.relation === 'invited';
  const waitingForCoauthors = isOwner ? data.invites.filter((i) => i.status === 'pending').length : 0;
  const needsMySignature = status === 'proposed' && me && !me.signed;
  const canChallenge = !isMember && (status === 'closing' || status === 'final');
  const latestText = draftLyrics ?? data.text?.lyrics ?? '';

  return (
    <div className="p-6 space-y-5">
      <header className="space-y-2 pr-8">
        <h2 className="text-xl font-heading" style={{ color: 'var(--text-primary)' }}>{data.title ?? t('Obra registrada')}</h2>
        <StatusBadge status={data.work.status} />
      </header>

      {status === 'closing' && (
        <p className="text-sm rounded-xl p-3.5" style={{ ...card, color: 'var(--text-secondary)' }}>
          {t('Período público de impugnación: quedan')} <strong style={{ color: 'var(--text-primary)' }}><Countdown to={data.work.closesAt} /></strong>.
          {t('Si nadie la impugna, queda registrada de forma definitiva.')}
        </p>
      )}
      {status === 'final' && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('La autoría quedó registrada de forma definitiva en Solana.')}</p>}
      {status === 'disputed' && <p className="text-sm text-red-400">{t('Alguien impugnó esta obra. Está en revisión y no se puede licenciar hasta que se resuelva.')}</p>}
      {status === 'revoked' && <p className="text-sm text-red-400">{t('La impugnación prosperó: este registro fue revocado.')}</p>}

      {status === 'disputed' && isMember && (() => {
        const open = data.challenges.find((c) => c.status === 'open');
        if (!open) return null;
        return (
          <section aria-label={t('Impugnación')} className="rounded-xl p-4 space-y-3" style={{ ...card, borderColor: 'rgba(239,68,68,.4)' }}>
            <h3 className="text-sm font-semibold text-red-400">{t('Alguien impugnó esta obra')}</h3>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{open.evidence}</p>
            <label className="block text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('Tu descargo')}</span>
              <textarea rows={5} className={input} style={inputStyle} value={reply ?? open.response ?? ''} onChange={(e) => setReply(e.target.value)}
                placeholder={t('Explicá cómo creaste la letra y aportá lo que tengas: borradores, fechas, audios, mensajes.')} />
            </label>
            <button disabled={!!busy || (reply ?? open.response ?? '').trim().length < 20}
              onClick={() => act('respond', 'respond', { response: reply ?? open.response }, t('Descargo enviado: el árbitro lo va a leer.'))}
              className="w-full btn-cozy bg-ember hover:bg-ember-light text-white py-2.5 disabled:opacity-40">
              {busy === 'respond' ? t('Enviando…') : open.response ? t('Actualizar descargo') : t('Enviar descargo')}
            </button>
          </section>
        );
      })()}

      <section aria-label={t('Autores')} className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('Autores')}</h3>
        {data.people.map((p) => (
          <div key={p.wallet} className="rounded-xl p-3" style={card}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span style={{ color: 'var(--text-primary)' }}>
                {p.label}{p.isMe ? t(' (vos)') : ''}{p.isCreator ? t(' · creó la obra') : ''}{!p.joined ? t(' · invitación pendiente') : ''}
              </span>
              <span className="font-semibold text-warm-tan">{status === 'open' ? t('{n} u.', { n: p.units }) : `${(p.bps / 100).toFixed(1)}%`}</span>
            </div>
            {status !== 'open' && (
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
                <div className="h-full bg-ember" style={{ width: `${p.bps / 100}%` }} />
              </div>
            )}
          </div>
        ))}
        {isOwner && data.invites.filter((i) => i.status === 'pending').map((i) => (
          <div key={i.email} className="rounded-xl p-3 flex items-center justify-between text-sm" style={card}>
            <span style={{ color: 'var(--text-secondary)' }}>{i.email} · esperando que acepte</span>
            <button disabled={!!busy} onClick={() => act('uninvite', 'invite', { email: i.email }, t('Invitación retirada.'), 'DELETE')}
              className="text-xs text-red-400 hover:underline">{t('Retirar')}</button>
          </div>
        ))}
      </section>

      {pendingInvite && status !== 'open' && (
        <p className="text-sm rounded-xl p-3" style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)' }}>
          {t('Esta obra ya se cerró sin vos: no se puede aceptar la invitación. Pedile a quien la creó que registre una nueva y que espere a que te sumes antes de repartir.')}
        </p>
      )}
      {pendingInvite && status === 'open' && (
        <button disabled={!!busy} onClick={() => act('accept', 'accept', {}, t('Ya sos coautor/a de esta obra.'))}
          className="btn-cozy bg-ember hover:bg-ember-light text-white w-full py-3 disabled:opacity-40">
          {busy === 'accept' ? t('Aceptando…') : t('Aceptar la invitación')}
        </button>
      )}

      {status === 'open' && isMember && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('Versiones')}</h3>
          {data.text && (
            <textarea aria-label={t('Letra')} rows={8} className={input} style={inputStyle} value={latestText}
              onChange={(e) => setDraftLyrics(e.target.value)} />
          )}
          <button disabled={!!busy}
            onClick={() => {
              if (!data.text) return setError(t('No hay texto para guardar.'));
              act('version', 'version', { lyrics: latestText, chords: data.text.chords }, t('Versión guardada en la blockchain.')).then(() => setDraftLyrics(null));
            }}
            className="w-full rounded-xl py-2.5 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30 disabled:opacity-40 inline-flex items-center justify-center gap-2">
            <Hash className="w-4 h-4" /> {busy === 'version' ? t('Guardando…') : t('Guardar versión on-chain')}
          </button>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('Editá la letra y guardá la versión: cada aporte suma al reparto.')}</p>
        </section>
      )}

      {status === 'open' && isOwner && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('Invitar coautores')}</h3>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act('invite', 'invite', { email: inviteEmail }, t('Invitación enviada.')).then(() => setInviteEmail('')); }}>
            <input type="email" required placeholder={t('email@ejemplo.com')} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={input} style={inputStyle} />
            <button disabled={!!busy} className="shrink-0 rounded-xl px-3.5 bg-terracotta/20 text-warm-tan hover:bg-terracotta/30" aria-label={t('Invitar')}><UserPlus className="w-4 h-4" /></button>
          </form>

          <h3 className="text-xs font-semibold uppercase tracking-wider pt-2" style={{ color: 'var(--text-secondary)' }}>{t('Cerrar y repartir')}</h3>
          {waitingForCoauthors > 0 && (
            <p className="text-sm rounded-xl p-3" style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)' }}>
              {t('Esperá a que tus coautores acepten la invitación antes de repartir: si cerrás ahora, la obra queda sin ellos. También podés retirar la invitación.')}
            </p>
          )}
          {manual ? (
            <div className="space-y-2">
              {data.people.map((p) => (
                <label key={p.wallet} className="flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                  {p.label}
                  <span className="flex items-center gap-1">
                    <input type="number" min={0} max={100} step={0.01} value={manual[p.wallet] ?? ''} onChange={(e) => setManual({ ...manual, [p.wallet]: e.target.value })} className={`${input} w-24 text-right`} style={inputStyle} /> %
                  </span>
                </label>
              ))}
              <p className={`text-xs ${Math.abs(manualTotal - 100) < 0.005 ? 'text-soft-sage' : 'text-red-400'}`}>{t('Suma: {n}% (tiene que dar 100)', { n: manualTotal.toFixed(2) })}</p>
              <div className="flex gap-2">
                <button disabled={!!busy || Math.abs(manualTotal - 100) >= 0.005}
                  onClick={() => act('propose', 'propose', { manual: Object.fromEntries(Object.entries(manual).map(([w, v]) => [w, Math.round(Number(v) * 100)])) }, t('Reparto propuesto: falta que todos firmen.'))}
                  className="flex-1 btn-cozy bg-ember hover:bg-ember-light text-white py-2.5 disabled:opacity-40">{t('Proponer reparto')}</button>
                <button onClick={() => setManual(null)} className="px-4 rounded-xl text-sm text-warm-tan hover:bg-terracotta/20">{t('Cancelar')}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <button disabled={!!busy || waitingForCoauthors > 0} onClick={() => act('propose', 'propose', {}, t('Reparto automático propuesto.'))}
                className="flex-1 btn-cozy bg-ember hover:bg-ember-light text-white py-2.5 disabled:opacity-40">
                {busy === 'propose' ? t('Cerrando…') : t('Repartir según aportes')}
              </button>
              {data.people.length > 1 && (
                <button disabled={waitingForCoauthors > 0} onClick={() => setManual(Object.fromEntries(data.people.map((p) => [p.wallet, String(100 / data.people.length)])))}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30">{t('Repartir a mano')}</button>
              )}
            </div>
          )}
        </section>
      )}

      {needsMySignature && (
        <button disabled={!!busy} onClick={() => act('sign', 'action', { op: 'sign' }, t('Firmaste el reparto.'))}
          className="btn-cozy bg-ember hover:bg-ember-light text-white w-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
          <Check className="w-4 h-4" /> {t('Firmar el reparto')}
        </button>
      )}
      {status === 'proposed' && isOwner && (
        <button disabled={!!busy} onClick={() => act('reopen', 'action', { op: 'reopen' }, t('Obra reabierta.'))} className="text-sm text-warm-tan hover:underline">{t('Reabrir para cambiar el reparto')}</button>
      )}
      {status === 'closing' && isMember && (
        <button disabled={!!busy} onClick={() => act('object', 'action', { op: 'object' }, t('Objetaste: la obra volvió a edición.'))} className="text-sm text-warm-tan hover:underline">
          {busy === 'object' ? t('Objetando…') : isOwner && data.people.length === 1 ? t('Volver a editar (cancela el registro en curso)') : t('Objetar el reparto')}
        </button>
      )}

      {canChallenge && (
        <section className="pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
          <ChallengeBox endpoint={`works/${workId}/challenge`} mine={data.myChallenge} onSent={load} />
        </section>
      )}

      {notice && <p role="status" className="text-sm text-soft-sage">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <section aria-label={t('Historial')} className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{t('En la blockchain')}</h3>
        {data.versions.map((v) => (
          <a key={v.idx} href={explorerTx(v.txSig)} target="_blank" rel="noreferrer"
            className="flex items-center justify-between gap-2 rounded-xl p-3 text-xs hover:bg-white/5" style={card}>
            <span style={{ color: 'var(--text-primary)' }}>{t('Versión {n}', { n: v.idx + 1 })} · {v.contentHash.slice(0, 10)}…</span>
            <ExternalLink className="w-3.5 h-3.5 text-warm-tan" />
          </a>
        ))}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <a href={explorerAddr(data.work.pda)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-warm-tan hover:underline">
            {t('Obra {key}', { key: shortKey(data.work.pda) })} <ExternalLink className="w-3 h-3" />
          </a>
          {data.fingerprint && (
            <ShareButton path={`/registry/${data.fingerprint}`} title={data.title ?? t('Obra registrada en Soliric')}
              text={t('Autoría registrada en la blockchain de Solana')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-warm-tan hover:underline" />
          )}
          {(isMember || data.title) && (
            <a href={`/certificate/${workId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-warm-tan hover:underline">
              <FileText className="w-3.5 h-3.5" /> {t('Ver certificado')}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
