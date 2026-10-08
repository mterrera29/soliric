import type { LyricsResult, LyricsProvider } from './types'
import { clean } from './utils'

export const lyricsOvhProvider: LyricsProvider = {
  name: 'lyrics.ovh',
  async fetchLyrics(title: string, artist: string): Promise<LyricsResult | null> {
    if (!artist) return null
    try {
      const api = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      ).then((r) => r.json() as Promise<{ lyrics?: string }>)
      if (api.lyrics) {
        const text = clean(api.lyrics)
        if (text.length > 30) return { title, artist, lyrics: text }
      }
    } catch {}
    return null
  },
}
