'use client';

import { useState } from 'react';
import { useT } from '@/hooks/useI18n';
import { LIMITS } from '@/lib/soliric/work-policy';
import EmailChips from './EmailChips';

export interface WorkFormValues {
  title: string;
  artist: string;
  authorName: string;
  lyrics: string;
  isPublic: boolean;
  coauthors: string[];
}

const field = 'w-full rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder:opacity-40';
const fieldStyle = { background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' };
const label = 'block text-xs font-semibold uppercase tracking-wider mb-1.5';

interface Props {
  initial?: Partial<WorkFormValues>;
  /** Mostrar el campo de coautores (solo al crear una obra). */
  withCoauthors?: boolean;
  submitLabel: string;
  onSubmit: (values: WorkFormValues) => Promise<void>;
  onCancel?: () => void;
}

/** Datos de una obra: título, artista, autor, letra y coautores. Es el único "editor" de Soliric. */
export default function WorkForm({ initial, withCoauthors = false, submitLabel, onSubmit, onCancel }: Props) {
  const t = useT();
  const [v, setV] = useState<WorkFormValues>({
    title: '', artist: '', authorName: '', lyrics: '', isPublic: false, coauthors: [], ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<WorkFormValues>) => setV((cur) => ({ ...cur, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await onSubmit(v); } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={label} style={{ color: 'var(--text-secondary)' }}>{t('Título')}</span>
          <input required maxLength={LIMITS.title} value={v.title} onChange={(e) => set({ title: e.target.value })} className={field} style={fieldStyle} />
        </label>
        <label className="block">
          <span className={label} style={{ color: 'var(--text-secondary)' }}>{t('Artista')}</span>
          <input maxLength={LIMITS.artist} value={v.artist} onChange={(e) => set({ artist: e.target.value })} className={field} style={fieldStyle} placeholder={t('Opcional')} />
        </label>
        <label className="block">
          <span className={label} style={{ color: 'var(--text-secondary)' }}>{t('Nombre del autor')}</span>
          <input maxLength={LIMITS.author} value={v.authorName} onChange={(e) => set({ authorName: e.target.value })} className={field} style={fieldStyle} placeholder={t('Como querés figurar')} />
        </label>
      </div>

      <label className="block">
        <span className={label} style={{ color: 'var(--text-secondary)' }}>{t('Letra')}</span>
        <textarea required rows={14} maxLength={LIMITS.lyrics} value={v.lyrics} onChange={(e) => set({ lyrics: e.target.value })}
          className={`${field} leading-relaxed`} style={fieldStyle} placeholder={t('Pegá o escribí la letra acá…')} spellCheck={false} />
        <span className="block text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {t('La letra nunca se publica: en la blockchain solo queda su huella.')}
        </span>
      </label>

      <label className="flex items-start gap-2.5 rounded-xl p-4 cursor-pointer text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <input type="checkbox" checked={v.isPublic} onChange={(e) => set({ isPublic: e.target.checked })} className="mt-1 accent-orange-500" />
        <span style={{ color: 'var(--text-primary)' }}>
          {t('Mostrar el título y el autor en el registro público')}
          <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('Si no lo marcás, el registro aparece como "Letra privada".')}</span>
        </span>
      </label>

      {withCoauthors && (
        <div className="space-y-2.5">
          <span className={label} style={{ color: 'var(--text-secondary)' }}>{t('Coautores (opcional)')}</span>
          <EmailChips value={v.coauthors} onChange={(coauthors) => set({ coauthors })} />
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} className="btn-cozy bg-ember hover:bg-ember-light text-white px-7 py-3 font-semibold disabled:opacity-40 transition-all">
          {busy ? t('Guardando...') : submitLabel}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="px-4 py-3 rounded-xl text-sm text-warm-tan hover:bg-terracotta/20">{t('Cancelar')}</button>}
      </div>
    </form>
  );
}
