import type { LyricsResult, LyricsProvider } from './types'

export const lrclibProvider: LyricsProvider = {
  name: 'lrclib',
  async fetchLyrics(title: string, artist: string): Promise<LyricsResult | null> {
    if (!artist) return null
    try {
      const data = await fetch(
        `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
        {
          headers: {
            'User-Agent': 'lyrics-app/1.0 (https://github.com/mterrera29/cancionero)',
            Accept: 'application/json',
          },
        }
      ).then((r) => {
        if (!r.ok) throw new Error(`lrclib: ${r.status}`)
        return r.json() as Promise<{
          plainLyrics?: string
          syncedLyrics?: string
        }>
      })

      const text = (data.plainLyrics || data.syncedLyrics || '').trim()
      if (text.length > 30) return { title, artist, lyrics: text }
    } catch {}
    return null
  },
}
