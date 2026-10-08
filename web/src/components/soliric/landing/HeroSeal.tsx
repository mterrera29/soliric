'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useT } from '@/hooks/useI18n';
import { normalizeLyrics } from '@/lib/soliric/normalize';

const HEX = '0123456789abcdef';
const randomHex = () => Array.from({ length: 64 }, () => HEX[Math.floor(Math.random() * 16)]).join('');

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * La demo del hero: la huella que se calcula acá es la real (mismo texto base que usa Soliric al registrar).
 * Al cargar, la huella se "descifra" una vez; después, cada carácter que cambia se enciende un instante.
 * Se monta con `key={idioma}`: al cambiar de idioma vuelve a empezar con la letra de ejemplo traducida.
 */
export default function HeroSeal() {
  const t = useT();
  const sample = t('Hoy desperté con ganas de cantarle a la luna\ny la calle vacía me ofreció su compañía');
  const [text, setText] = useState(sample);
  const [original, setOriginal] = useState('');
  // valor inicial fijo: el servidor y el navegador tienen que renderizar lo mismo (el azar solo se usa al animar)
  const [shown, setShown] = useState('0'.repeat(64));
  const [real, setReal] = useState('');
  const [live, setLive] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const decoded = useRef(false);

  // Huella de la letra que hay en pantalla
  useEffect(() => {
    let cancelled = false;
    sha256Hex(normalizeLyrics(text))
      .then((h) => { if (!cancelled) setReal(h); })
      .catch(() => { if (!cancelled) setUnsupported(true); });
    return () => { cancelled = true; };
  }, [text]);

  // Huella de la letra original, para comparar
  useEffect(() => {
    sha256Hex(normalizeLyrics(sample)).then(setOriginal).catch(() => {});
  }, [sample]);

  // Una sola secuencia al cargar: la huella aparece carácter por carácter. Después se actualiza directo.
  useEffect(() => {
    if (!real) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (decoded.current || reduced) { setShown(real); setLive(true); decoded.current = true; return; }
      const revealed = Math.min(64, Math.floor(((now - t0) / 1100) * 64));
      setShown(real.slice(0, revealed) + randomHex().slice(revealed));
      if (revealed < 64) raf = requestAnimationFrame(tick);
      else { setShown(real); setLive(true); decoded.current = true; }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [real]);

  const same = !!real && !!original && real === original;
  const changeCase = () => setText(text.replace(/\n/g, ',\n').toUpperCase());
  const changeWord = () => {
    const from = t('luna'), to = t('playa');
    if (text.includes(from)) return setText(text.replace(from, to));
    const word = text.match(/\p{L}{5,}/u)?.[0];
    if (word) setText(text.replace(word, to));
  };

  const chip = 'rounded-full px-3.5 py-2 text-[13px] font-semibold border transition-colors hover:bg-white/5';

  return (
    <div className="sol-ring p-5 sm:p-7 space-y-5" role="region" aria-label={t('Probalo: esto es lo único que viaja a la cadena')}>
      <div className="space-y-1">
        <h2 className="font-heading text-xl sm:text-2xl leading-tight">{t('Probalo: esto es lo único que viaja a la cadena')}</h2>
        <p className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--l-muted)' }}>
          <Lock className="w-3.5 h-3.5" aria-hidden /> {t('Tu letra no sale de este navegador.')}
        </p>
      </div>

      <label className="block">
        <span className="block text-sm font-semibold mb-2">{t('Tu letra')}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} spellCheck={false}
          className="w-full resize-none rounded-2xl px-4 py-3 text-[15px] leading-relaxed"
          style={{ background: 'var(--l-bg)', border: '1px solid var(--l-line)', color: 'var(--l-text)' }} />
      </label>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Probá cambiarla')}>
        <button type="button" onClick={changeCase} className={chip} style={{ borderColor: 'var(--l-line)' }}>{t('Cambiar mayúsculas y comas')}</button>
        <button type="button" onClick={changeWord} className={chip} style={{ borderColor: 'var(--l-line)' }}>{t('Cambiar una palabra')}</button>
        <button type="button" onClick={() => setText(sample)} className={chip} style={{ borderColor: 'transparent', color: 'var(--l-muted)' }}>{t('Restaurar')}</button>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{t('Huella (SHA-256)')}</span>
          <span role="status" aria-live="polite" className={`text-[13px] font-semibold ${same ? 'text-[var(--sol-green)]' : 'text-[var(--ember-soft)]'}`}>
            {unsupported ? '' : same ? t('Misma huella que la original') : t('Huella distinta')}
          </span>
        </div>
        {unsupported ? (
          <p className="text-sm" style={{ color: 'var(--l-muted)' }}>{t('Tu navegador no permite calcular la huella en esta página.')}</p>
        ) : (
          <div className="mono grid gap-x-0 gap-y-1 text-[15px] sm:text-[17px] grid-cols-[repeat(8,minmax(0,1fr))] sm:grid-cols-[repeat(16,minmax(0,1fr))]"
            aria-label={real} style={{ color: 'var(--l-text)' }}>
            {shown.split('').map((ch, i) => (
              <span key={`${i}${ch}`} aria-hidden className={live ? 'sol-flash' : undefined}>{ch}</span>
            ))}
          </div>
        )}
      </div>

      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--l-muted)' }}>
        {t('Mayúsculas, acentos y puntuación no la cambian. Cambiar palabras sí, y entonces Soliric compara por similitud para detectar copias retocadas.')}
      </p>
    </div>
  );
}
