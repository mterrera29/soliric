import { createHash } from 'node:crypto';
import { lyricsFor } from './text';

import { normalizeLyrics } from './normalize';
export { normalizeLyrics };

export function fingerprintOf(lyrics: string | undefined, chords: string | undefined): { normalized: string; hash: Buffer } {
  const normalized = normalizeLyrics(lyricsFor(lyrics, chords));
  return { normalized, hash: createHash('sha256').update(normalized).digest() };
}

/** Hash del contenido completo de una versión (letra + acordes tal cual se guardan). */
export function contentHashOf(lyrics: string | undefined, chords: string | undefined): Buffer {
  return createHash('sha256').update(JSON.stringify({ lyrics: lyrics ?? '', chords: chords ?? '' })).digest();
}

const shingles = (normalized: string, n = 3): Set<string> => {
  const words = normalized.split(' ').filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
};

/** Similitud Jaccard de trigramas de palabras entre dos letras normalizadas (0 a 1). */
export function similarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  return inter / (A.size + B.size - inter);
}

// ── Comparación tolerante ──
// La huella exacta (work_id) cambia con cualquier palabra de más o de menos. Para verificar y para frenar
// copias con retoques mínimos se compara el texto "limpio" por similitud.

const SECTION_WORDS = '(?:intro|estrofa|verso|pre-?estribillo|estribillo|coro|coros|post-?estribillo|puente|interludio|final|outro|coda|solo|instrumental|riff|bis|rap|recitado)';
// Una línea es etiqueta solo si es la palabra sola, entre corchetes/paréntesis o con ":" (así "Solo quiero verte" queda)
const SECTION_LINE = new RegExp(`^\\s*[\\[(]?\\s*${SECTION_WORDS}(?:\\s*\\d+)?\\s*[\\])]?\\s*:?\\s*(?:(?:x|×)\\s*\\d+)?\\s*$`, 'i');
const REPEAT_LINE = /^\s*[\[(]?\s*(?:x|×)\s*\d+\s*[\])]?\s*$/i;

/**
 * Letra lista para comparar: sin etiquetas de sección ni marcas de repetición, y sin el título o el
 * artista si vienen como primeras líneas ("Mi canción - Los Autores").
 */
export function comparableText(text: string, opts: { title?: string; artist?: string } = {}): string {
  const title = normalizeLyrics(opts.title ?? '');
  const artist = normalizeLyrics(opts.artist ?? '');
  const headers = new Set([title, artist, `${title} ${artist}`, `${artist} ${title}`].filter(Boolean));
  let seen = 0;
  const kept = text.split('\n').filter((line) => {
    if (SECTION_LINE.test(line) || REPEAT_LINE.test(line)) return false;
    if (line.trim() && seen < 4) {
      seen++;
      if (headers.has(normalizeLyrics(line))) return false;
    }
    return true;
  });
  return normalizeLyrics(kept.join('\n'));
}

const grams = (normalized: string, n: number): Set<string> => {
  const words = normalized.split(' ').filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
};

export interface Comparison {
  /** Parecido global (0 a 1). */
  jaccard: number;
  /** Qué parte de A está dentro de B. */
  aInB: number;
  /** Qué parte de B está dentro de A. */
  bInA: number;
}

/** Compara dos textos ya normalizados. Con textos cortos usa pares de palabras en vez de tríos. */
export function compare(a: string, b: string): Comparison {
  const short = Math.min(a.split(' ').length, b.split(' ').length) < 12;
  const A = grams(a, short ? 2 : 3);
  const B = grams(b, short ? 2 : 3);
  if (A.size === 0 || B.size === 0) return { jaccard: 0, aInB: 0, bInA: 0 };
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return { jaccard: inter / (A.size + B.size - inter), aInB: inter / A.size, bInA: inter / B.size };
}
