// Reglas de las obras: de dónde vienen, qué se puede registrar y cuándo hace falta revisar.

export const WORK_SOURCES = ['web', 'api', 'import'] as const;
export type WorkSource = (typeof WORK_SOURCES)[number];

/** Origen de una obra; lo desconocido cuenta como 'web'. */
export function normalizeWorkSource(value: unknown): WorkSource {
  return WORK_SOURCES.includes(value as WorkSource) ? (value as WorkSource) : 'web';
}

/** Lo importado de proveedores o catálogos es de otro autor: no se registra. */
export function canRegisterOnchain(source: unknown): boolean {
  return source !== 'import';
}

export const LIMITS = { title: 200, artist: 200, author: 120, lyrics: 20_000, chords: 20_000 } as const;

export interface WorkInput {
  title: unknown;
  artist?: unknown;
  authorName?: unknown;
  lyrics: unknown;
  chords?: unknown;
}

/** Devuelve el mensaje de error, o null si los datos de la obra son válidos. */
export function validateWorkInput(input: WorkInput): string | null {
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  if (typeof input.title !== 'string' || !input.title.trim()) return 'Falta el título de la obra.';
  if (input.title.length > LIMITS.title) return 'El título es demasiado largo.';
  if (text(input.artist).length > LIMITS.artist) return 'El nombre del artista es demasiado largo.';
  if (text(input.authorName).length > LIMITS.author) return 'El nombre del autor es demasiado largo.';
  if (typeof input.lyrics !== 'string' || !input.lyrics.trim()) return 'Falta la letra.';
  if (input.lyrics.length > LIMITS.lyrics) return 'La letra es demasiado larga.';
  if (text(input.chords).length > LIMITS.chords) return 'Los acordes son demasiado largos.';
  return null;
}

export const CATALOG_BLOCK_SCORE = 0.6;
export const CATALOG_REVIEW_SCORE = 0.3;
export type CatalogVerdict = 'ok' | 'review' | 'block';

/** `score` es la mayor similitud contra catálogos; `checked=false` si no se pudo comparar. */
export function catalogVerdict(score: number, checked: boolean): CatalogVerdict {
  if (!checked) return 'review';
  if (score >= CATALOG_BLOCK_SCORE) return 'block';
  if (score >= CATALOG_REVIEW_SCORE) return 'review';
  return 'ok';
}

/** Declaración que firma el autor; se guarda y se hashea en el idioma en que la vio. */
export const AUTHORSHIP_STATEMENTS = {
  es: 'Declaro que soy autor/a o coautor/a de esta letra, que no es obra de terceros y acepto que ' +
    'el registro se revoque si se prueba lo contrario.',
  en: 'I declare that I am the author or co-author of this lyric, that it is not the work of third parties, ' +
    'and I accept that the registration may be revoked if proven otherwise.',
} as const;
export const statementFor = (lang: 'en' | 'es') => AUTHORSHIP_STATEMENTS[lang];
