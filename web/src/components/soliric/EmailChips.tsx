'use client';

import { useState } from 'react';
import { useT } from '@/hooks/useI18n';
import { isEmail } from '@/lib/soliric/validation';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };

/**
 * Lista de emails (coautores): se agregan de a uno y se pueden quitar. No usa <form> propio porque se
 * monta dentro de otros formularios (un <form> dentro de otro es HTML inválido): Enter agrega el email.
 */
export default function EmailChips({ value, onChange, max = 7 }: { value: string[]; onChange: (emails: string[]) => void; max?: number }) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  function add() {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    if (!isEmail(v)) return setInvalid(true);
    if (!value.includes(v)) onChange([...value, v]);
    setDraft(''); setInvalid(false);
  }

  return (
    <div className="space-y-2.5">
      {value.map((email) => (
        <div key={email} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm" style={card}>
          <span style={{ color: 'var(--text-primary)' }}>{email}</span>
          <button type="button" onClick={() => onChange(value.filter((e) => e !== email))} className="text-xs text-red-400 hover:underline">{t('Quitar')}</button>
        </div>
      ))}
      {value.length < max && (
        <div className="flex gap-2">
          <input type="email" value={draft} onChange={(e) => { setDraft(e.target.value); setInvalid(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={t('email@ejemplo.com')} aria-label={t('Email del coautor')} aria-invalid={invalid}
            className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ember/50"
            style={{ background: 'var(--input-bg)', border: `1px solid ${invalid ? '#f87171' : 'var(--border-color)'}`, color: 'var(--text-primary)' }} />
          <button type="button" onClick={add} className="shrink-0 rounded-xl px-4 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30">{t('Agregar')}</button>
        </div>
      )}
      {invalid && <p role="alert" className="text-xs text-red-400">{t('Ese email no parece válido.')}</p>}
    </div>
  );
}
