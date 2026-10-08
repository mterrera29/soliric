'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useT } from '@/hooks/useI18n';

/** Muestra un valor en monoespaciada con un botón para copiarlo. */
export default function CopyText({ value, shown }: { value: string; shown?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* sin permiso para el portapapeles: no pasa nada */ }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <code className="mono text-[13px] break-all" title={value}>{shown ?? value}</code>
      <button type="button" onClick={copy} aria-label={copied ? t('Copiado') : t('Copiar')}
        className="p-2 -m-1 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--l-muted)' }}>
        {copied ? <Check className="w-4 h-4 text-[var(--sol-green)]" /> : <Copy className="w-4 h-4" />}
      </button>
    </span>
  );
}
