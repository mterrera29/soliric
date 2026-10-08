import { stripInlineChords } from './normalize';

/**
 * Texto de la letra para la huella: la letra misma o, si solo vinieron acordes en línea ("Ho[Am]la"),
 * ese texto sin los acordes.
 */
export function lyricsFor(lyrics: string | undefined, chords: string | undefined): string {
  if (lyrics && lyrics.trim()) return lyrics;
  return chords ? stripInlineChords(chords) : '';
}
