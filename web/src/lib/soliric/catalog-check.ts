import { geniusSearch, type Candidate } from '@/lib/genius-search';
import { fetchLyrics } from '@/lib/lyrics-providers';
import { catalogVerdict, type CatalogVerdict } from '@/lib/soliric/work-policy';
import { normalizeLyrics, similarity } from './fingerprint';

export interface CatalogMatch { title: string; artist: string; score: number }
export interface CatalogCheck {
  verdict: CatalogVerdict;
  score: number;
  /** false si Genius reconoció la letra pero no se pudo comparar (el veredicto pasa a "review"). */
  checked: boolean;
  match: CatalogMatch | null;
}

const MAX_CANDIDATES = 4;
const PER_LOOKUP_MS = 8000;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);

function firstLines(normalized: string, words = 18): string {
  return normalized.split(' ').slice(0, words).join(' ');
}

/**
 * Compara la letra contra catálogos públicos (Genius, lrclib, Musixmatch, lyrics.ovh).
 * Candidatos: título/artista declarados y lo que Genius encuentra buscando las primeras líneas.
 */
export async function checkAgainstCatalogs(input: {
  title: string;
  artist: string;
  lyrics: string;
}): Promise<CatalogCheck> {
  const mine = normalizeLyrics(input.lyrics);
  if (!mine) return { verdict: 'review', score: 0, checked: false, match: null };

  const [byTitle, byLyrics] = await Promise.all([
    input.title.trim() ? geniusSearch('song', `${input.title} ${input.artist}`.trim()) : Promise.resolve<Candidate[]>([]),
    geniusSearch('lyric', firstLines(mine)),
  ]);

  const seen = new Set<string>();
  const candidates: { title: string; artist: string }[] = [];
  for (const c of [{ title: input.title, artist: input.artist }, ...byTitle, ...byLyrics]) {
    const key = `${c.title}|${c.artist}`.toLowerCase();
    if (!c.title.trim() || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ title: c.title, artist: c.artist });
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  let best: CatalogMatch | null = null;
  let fetched = false;
  const results = await Promise.all(
    candidates.map((c) => withTimeout(fetchLyrics(c.title, c.artist), PER_LOOKUP_MS)),
  );
  results.forEach((res, i) => {
    if (!res) return;
    fetched = true;
    const score = similarity(mine, normalizeLyrics(res.lyrics));
    if (!best || score > best.score) best = { title: res.title || candidates[i].title, artist: res.artist || candidates[i].artist, score };
  });

  const score = (best as CatalogMatch | null)?.score ?? 0;
  // Genius reconoce las primeras líneas pero no pudimos bajar ningún texto para comparar:
  // no se puede descartar, queda en "review". Si nadie las reconoce, el inédito pasa limpio.
  const checked = fetched || byLyrics.length === 0;
  return { verdict: catalogVerdict(score, checked), score, checked, match: best };
}
