import type { LyricsResult, LyricsProvider } from './types'
import { slug, cleanHtml, fetchText } from './utils'

export const musixmatchProvider: LyricsProvider = {
  name: 'musixmatch',
  async fetchLyrics(title: string, artist: string): Promise<LyricsResult | null> {
    if (!artist) return null
    try {
      const url = `https://www.musixmatch.com/lyrics/${slug(artist)}/${slug(title)}`
      const html = await fetchText(url)

      if (html.length < 3000 || /page not found|404|not found/i.test(html)) return null

      // Musixmatch renders lyrics in divs with class lyrics__content__ok
      const blocks = html.match(
        /<div[^>]*class="[^"]*lyrics__content__ok[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
      )
      if (blocks) {
        const lines = blocks.map((b) => cleanHtml(b)).filter((l) => l.length > 0)
        if (lines.length > 0) {
          const lyrics = lines.join('\n\n')
          if (lyrics.length > 50) return { title, artist, lyrics }
        }
      }

      // Fallback: lyrics__content__warning (for explicit/incomplete lyrics)
      const warning = html.match(
        /<span[^>]*class="[^"]*lyrics__content__warning[^"]*"[^>]*>([\s\S]*?)<\/span>/i
      )
      if (warning) {
        const lyrics = cleanHtml(warning[1])
        if (lyrics.length > 50) return { title, artist, lyrics }
      }
    } catch {}

    return null
  },
}
