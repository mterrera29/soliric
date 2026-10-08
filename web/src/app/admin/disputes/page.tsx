'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import Spinner from '@/components/Spinner';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { soliricFetch } from '@/lib/soliric/client-api';
import { useI18n } from '@/hooks/useI18n';

interface Dispute {
  id: string; status: string; evidence: string; createdAt: string | null; workId: string;
  title: string; artist: string; owner: string | null;
  sourceUrl: string | null; matchedPart: string | null; sinceWhen: string | null; challengerEmail: string | null;
  response: string | null; respondedAt: string | null; rejectReason: string | null;
  history: { rejected: number; dismissed: number; upheld: number };
}

type Pending =
  | { kind: 'admit'; id: string }
  | { kind: 'resolve'; id: string; upheld: boolean }
  | { kind: 'reject'; id: string };

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };
const label = 'text-xs font-semibold uppercase tracking-wider';
const SECTIONS: { title: string; hint: string; statuses: string[] }[] = [
  { title: 'Para revisar', hint: 'No tocan la blockchain: la obra sigue normal hasta que admitas la impugnación.', statuses: ['pending'] },
  { title: 'En disputa', hint: 'Admitidas. La obra está congelada hasta que resuelvas.', statuses: ['open'] },
  { title: 'Resueltas', hint: '', statuses: ['upheld', 'dismissed', 'rejected'] },
];
const STATUS_TEXT: Record<string, string> = {
  pending: 'en revisión', open: 'en disputa', upheld: 'revocada', dismissed: 'desestimada', rejected: 'rechazada',
};

export default function DisputesPage() {
  const { t, locale } = useI18n();
  const { userId, loading, getToken, login } = useAuth();
  const [items, setItems] = useState<Dispute[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try { setItems(await soliricFetch<Dispute[]>(getToken, 'challenges')); } catch (e) { setError((e as Error).message); }
  }, [getToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
  useEffect(() => { if (userId) load(); }, [userId, load]);

  async function run(path: string, body: unknown, id: string) {
    setPending(null); setBusy(id); setError('');
    try {
      await soliricFetch(getToken, path, { body });
      setReason('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  function confirmAction() {
    if (!pending) return;
    if (pending.kind === 'admit') run(`challenges/${pending.id}/admit`, {}, pending.id);
    else if (pending.kind === 'resolve') run(`challenges/${pending.id}/resolve`, { upheld: pending.upheld }, pending.id);
  }

  if (loading) return <Spinner />;
  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
        <button onClick={login} className="btn-cozy bg-ember hover:bg-ember-light text-white px-6 py-2.5">{t('Iniciar sesión')}</button>
      </main>
    );
  }

  const confirmCopy = pending?.kind === 'admit'
    ? { title: t('Admitir la impugnación'), message: t('Se registra en la blockchain y la obra queda congelada hasta que la resuelvas. El autor podrá enviar su descargo.'), label: t('Admitir'), danger: false }
    : pending?.kind === 'resolve' && pending.upheld
      ? { title: t('Revocar el registro'), message: t('Revocar es definitivo y queda en la blockchain. La canción pasa a privada.'), label: t('Revocar'), danger: true }
      : { title: t('Desestimar la impugnación'), message: t('La obra vuelve al estado que tenía antes de la disputa.'), label: t('Desestimar'), danger: false };

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-heading flex items-center gap-3" style={{ color: 'var(--text-primary)' }}><Gavel className="w-7 h-7 text-ember-light" /> {t('Disputas')}</h1>
        {!items && !error && <Spinner />}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        {items && SECTIONS.map((section) => {
          const list = items.filter((d) => section.statuses.includes(d.status));
          return (
            <section key={section.title} className="space-y-3" aria-label={t(section.title)}>
              <header>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t(section.title)} · {list.length}</h2>
                {section.hint && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(section.hint)}</p>}
              </header>
              {list.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('Nada por acá.')}</p>}
              {list.map((d) => (
                <article key={d.id} className="rounded-2xl p-5 space-y-3" style={card}>
                  <header>
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{d.title} <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>· {d.artist}</span></h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t('Registrada por {owner}', { owner: d.owner ?? '—' })} · {t(STATUS_TEXT[d.status] ?? d.status)}
                      {d.challengerEmail ? ` · ${t('impugna')} ${d.challengerEmail}` : ''}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t('Historial de quien impugna: {ok} prosperaron · {bad} no prosperaron', { ok: d.history.upheld, bad: d.history.rejected + d.history.dismissed })}
                    </p>
                  </header>

                  <dl className="text-sm grid gap-2" style={{ color: 'var(--text-secondary)' }}>
                    {([[t('Fuente'), d.sourceUrl], [t('Parte que coincide'), d.matchedPart], [t('Existe desde'), d.sinceWhen]] as const).map(([k, v]) => v && (
                      <div key={k}>
                        <dt className={label} style={{ color: 'var(--text-muted)' }}>{k}</dt>
                        <dd className="break-words">
                          {k === t('Fuente') && /^https?:\/\//i.test(v)
                            ? <a href={v} target="_blank" rel="noreferrer noopener" className="text-warm-tan hover:underline">{v}</a>
                            : v}
                        </dd>
                      </div>
                    ))}
                    <div>
                      <dt className={label} style={{ color: 'var(--text-muted)' }}>{t('Explicación')}</dt>
                      <dd className="whitespace-pre-wrap">{d.evidence}</dd>
                    </div>
                  </dl>

                  {d.status !== 'pending' && d.status !== 'rejected' && (
                    <div className="text-sm space-y-1 rounded-xl p-3" style={{ background: 'var(--input-bg)' }}>
                      <p className={label} style={{ color: 'var(--text-muted)' }}>
                        {t('Descargo del autor')}{d.respondedAt ? ` · ${new Date(d.respondedAt).toLocaleString(locale)}` : ''}
                      </p>
                      <p className="whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{d.response ?? t('Todavía no respondió.')}</p>
                    </div>
                  )}
                  {d.status === 'rejected' && d.rejectReason && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('Motivo del rechazo: {reason}', { reason: d.rejectReason })}</p>
                  )}

                  {d.status === 'pending' && (
                    <div className="flex gap-2">
                      <button disabled={busy === d.id} onClick={() => setPending({ kind: 'admit', id: d.id })}
                        className="btn-cozy bg-ember hover:bg-ember-light text-white px-4 py-2 text-sm disabled:opacity-40">{t('Admitir')}</button>
                      <button disabled={busy === d.id} onClick={() => { setReason(''); setPending({ kind: 'reject', id: d.id }); }}
                        className="rounded-xl px-4 py-2 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30 disabled:opacity-40">{t('Rechazar')}</button>
                    </div>
                  )}
                  {d.status === 'open' && (
                    <div className="flex gap-2">
                      <button disabled={busy === d.id} onClick={() => setPending({ kind: 'resolve', id: d.id, upheld: true })}
                        className="rounded-xl px-4 py-2 text-sm font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-40">{t('Revocar registro')}</button>
                      <button disabled={busy === d.id} onClick={() => setPending({ kind: 'resolve', id: d.id, upheld: false })}
                        className="rounded-xl px-4 py-2 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30 disabled:opacity-40">{t('Desestimar')}</button>
                    </div>
                  )}
                </article>
              ))}
            </section>
          );
        })}
      </div>

      <ConfirmDialog
        open={pending?.kind === 'admit' || pending?.kind === 'resolve'}
        title={confirmCopy.title} message={confirmCopy.message} confirmLabel={confirmCopy.label} danger={confirmCopy.danger}
        onConfirm={confirmAction} onCancel={() => setPending(null)}
      />

      <Modal isOpen={pending?.kind === 'reject'} onClose={() => setPending(null)}>
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-heading pr-8" style={{ color: 'var(--text-primary)' }}>{t('Rechazar la impugnación')}</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('La obra no se toca. Quien impugnó ve el motivo. Con 2 rechazos su cuenta ya no puede presentar nuevas.')}</p>
          <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t('Motivo del rechazo')}
            placeholder={t('Motivo (opcional): por ejemplo, la fuente no contiene esa letra.')}
            className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/50"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setPending(null)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-warm-tan hover:bg-terracotta/20">{t('Cancelar')}</button>
            <button type="button" onClick={() => pending?.kind === 'reject' && run(`challenges/${pending.id}/reject`, { reason }, pending.id)}
              className="btn-cozy bg-ember hover:bg-ember-light text-white px-5 py-2.5">{t('Rechazar')}</button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
