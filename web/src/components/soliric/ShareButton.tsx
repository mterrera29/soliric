'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { useT } from '@/hooks/useI18n';

interface Props {
  /** Ruta de la página a compartir (se completa con el origen actual). */
  path: string;
  title: string;
  text?: string;
  className?: string;
}

/** Comparte el link: usa el menú del sistema si existe (celulares) y si no copia al portapapeles. */
export default function ShareButton({ path, title, text, className }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // el usuario cerró el menú de compartir: no es un error
    }
  }

  return (
    <button type="button" onClick={share}
      className={className ?? 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-terracotta/20 text-warm-tan hover:bg-terracotta/30 transition-colors'}>
      {copied ? <Check className="w-4 h-4 text-soft-sage" /> : <Share2 className="w-4 h-4" />}
      <span aria-live="polite">{copied ? t('Link copiado') : t('Compartir')}</span>
    </button>
  );
}
