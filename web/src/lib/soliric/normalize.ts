// Sin dependencias de servidor: lo usa también el navegador (demo de la landing).
/** Saca los acordes escritos en línea entre corchetes ("Ho[Am]la"). */
export const stripInlineChords = (text: string) => text.replace(/\[[^\]\n]*\]/g, '');

/**
 * Texto base de la huella de una letra: sin acordes, en minúsculas, sin acentos ni puntuación y con
 * espacios colapsados. Dos pegados de la misma letra dan la misma huella aunque
 * cambien acordes, mayúsculas o signos. Es el `work_id` on-chain.
 */
export function normalizeLyrics(text: string): string {
  return text
    .replace(/\[[^\]\n]*\]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

