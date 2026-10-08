'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useT } from '@/hooks/useI18n';

/** Bloque de código con botón para copiar. */
export default function CodeBlock({ code, label }: { code: string; label?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sin permiso */ }
  }
  return (
    <figure className="rounded-2xl overflow-hidden" style={{ background: 'var(--l-bg, #15100d)', border: '1px solid var(--l-line, rgba(247,239,229,0.12))' }}>
      <figcaption className="flex items-center justify-between px-4 py-2 text-xs" style={{ color: 'var(--l-faint, rgba(247,239,229,0.5))', borderBottom: '1px solid var(--l-line, rgba(247,239,229,0.12))' }}>
        <span>{label}</span>
        <button type="button" onClick={copy} aria-label={copied ? t('Copiado') : t('Copiar')} className="inline-flex items-center gap-1.5 p-1.5 -m-1.5 rounded-md hover:bg-white/10">
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--sol-green)]" /> : <Copy className="w-3.5 h-3.5" />} {copied ? t('Copiado') : t('Copiar')}
        </button>
      </figcaption>
      <pre className="mono overflow-x-auto p-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--l-text, #f7efe5)' }}><code>{code}</code></pre>
    </figure>
  );
}
