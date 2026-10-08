'use client';

import { useState } from 'react';
import { Flag, Send, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { soliricFetch } from '@/lib/soliric/client-api';
import { useT } from '@/hooks/useI18n';

const input = 'w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/50';
const inputStyle = { background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' };
const FIELDS = [
  ['sourceUrl', 'Fuente (link o referencia)', 'https://… o disco, libro, año'],
  ['matchedPart', 'Qué parte coincide', 'Ej.: el estribillo completo'],
  ['sinceWhen', 'Desde cuándo existe', 'Ej.: 2019 o 14/03/2021'],
] as const;

interface Props {
  /** Ruta de la API de impugnación, relativa a /api/soliric (por canción o por huella). */
  endpoint: string;
  /** La última impugnación de quien mira, si se conoce. */
  mine?: { status: string; rejectReason: string | null } | null;
  onSent?: () => void;
}

/**
 * Impugnar un registro. Queda en revisión: la obra no se bloquea hasta que un administrador la admite.
 * Se usa en el panel de la obra, en /verify y en /registry.
 */
export default function ChallengeBox({ endpoint, mine, onSent }: Props) {
  const t = useT();
  const { userId, getToken, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ sourceUrl: '', matchedPart: '', sinceWhen: '', evidence: '' });

  async function submit() {
    setBusy(true); setError('');
    try {
      await soliricFetch(getToken, endpoint, { body: form });
      setSent(true); setOpen(false);
      onSent?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const note = (text: string) => <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</p>;

  if (sent || mine?.status === 'pending') {
    return note(t('Tu impugnación está en revisión. La obra no se bloquea hasta que un administrador la admita.'));
  }
  if (mine?.status === 'rejected') {
    return note(mine.rejectReason ? t('Tu impugnación fue rechazada: {reason}', { reason: mine.rejectReason }) : t('Tu impugnación fue rechazada.'));
  }
  if (!userId) {
    return (
      <button type="button" onClick={login} className="inline-flex items-center gap-1.5 text-sm text-warm-tan hover:underline">
        <LogIn className="w-3.5 h-3.5" /> {t('Iniciá sesión para impugnar este registro')}
      </button>
    );
  }
  if (!open) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setOpen(true)} className="text-sm text-red-400 hover:underline inline-flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5" /> {t('Impugnar: esta letra es de otro autor')}
        </button>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('Una impugnación seria se puede verificar: indicá dónde existe ya esta letra. La revisa un administrador antes de que la obra se bloquee.')}
      </p>
      {FIELDS.map(([key, label, placeholder]) => (
        <input key={key} aria-label={t(label)} placeholder={`${t(label)} · ${t(placeholder)}`} className={input} style={inputStyle}
          value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      ))}
      <textarea rows={4} className={input} style={inputStyle} aria-label={t('Explicación')} placeholder={t('Explicá por qué esta letra es de otro autor.')}
        value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} />
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={submit}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-40 inline-flex items-center justify-center gap-2">
          <Send className="w-4 h-4" /> {busy ? t('Enviando…') : t('Enviar impugnación')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 rounded-xl text-sm text-warm-tan hover:bg-terracotta/20">{t('Cancelar')}</button>
      </div>
    </div>
  );
}
