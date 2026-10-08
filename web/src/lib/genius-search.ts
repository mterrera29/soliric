import { fetchJson } from '@/lib/lyrics-providers/utils';

interface GeniusHit {
  result?: {
    title?: string;
    artist_names?: string;
    song_art_image_thumbnail_url?: string;
  };
}
interface GeniusSearch {
  response?: { sections?: { type: string; hits?: GeniusHit[] }[] };
}
export interface Candidate { title: string; artist: string; cover?: string }

// Genius indexa traducciones y listas como si fueran canciones: las salteamos
const NOT_A_SONG = /genius|traducci|translation|romanized|playlist/i;

export async function geniusSearch(kind: 'lyric' | 'song', q: string): Promise<Candidate[]> {
  try {
    const data = await fetchJson<GeniusSearch>(`https://genius.com/api/search/${kind}?q=${encodeURIComponent(q)}`);
    return (data.response?.sections ?? [])
      .flatMap(s => s.hits ?? [])
      .map(h => ({
        title: h.result?.title ?? '',
        artist: h.result?.artist_names ?? '',
        cover: h.result?.song_art_image_thumbnail_url,
      }))
      .filter(c => c.title && c.artist && !NOT_A_SONG.test(c.artist) && !NOT_A_SONG.test(c.title));
  } catch {
    return [];
  }
}

