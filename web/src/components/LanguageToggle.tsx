'use client';

import { useI18n } from '@/hooks/useI18n';

/** Alterna entre inglés y español. */
export default function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t('Cambiar idioma')} className={`inline-flex rounded-lg p-0.5 text-xs font-semibold ${className}`}
      style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)' }}>
      {(['en', 'es'] as const).map((code) => (
        <button key={code} type="button" onClick={() => lang !== code && setLang(code)} aria-pressed={lang === code} lang={code}
          className={`min-w-9 px-2 py-1.5 rounded-md transition-colors ${lang === code ? 'bg-ember text-white' : 'text-warm-tan hover:bg-terracotta/20'}`}>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
