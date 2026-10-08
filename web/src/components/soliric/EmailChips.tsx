'use client';

import { useState } from 'react';
import { useT } from '@/hooks/useI18n';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };

/** Lista de emails (coautores): se agregan de a uno y se pueden quitar. */
export default function EmailChips({ value, onChange, max = 7 }: { value: string[]; onChange: (emails: string[]) => void; max?: number }) {
  const t = useT();
  const [draft, setDraft] = useState('');
  return (
    <div className="space-y-2.5">
      {value.map((email) => (
        <div key={email} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm" style={card}>
          <span style={{ color: 'var(--text-primary)' }}>{email}</span>
          <button type="button" onClick={() => onChange(value.filter((e) => e !== email))} className="text-xs text-red-400 hover:underline">{t('Quitar')}</button>
        </div>
      ))}
      {value.length < max && (
        <form className="flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          const v = draft.trim().toLowerCase();
          if (v && !value.includes(v)) onChange([...value, v]);
          setDraft('');
        }}>
          <input type="email" required value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('email@ejemplo.com')}
            aria-label={t('Email del coautor')}
            className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/50"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
          <button className="shrink-0 rounded-xl px-4 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30">{t('Agregar')}</button>
        </form>
      )}
    </div>
  );
}
