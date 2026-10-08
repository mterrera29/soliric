import type { LyricsResult, LyricsProvider } from './types'
import { cleanHtml, addSpacingBeforeSections, slug, fetchText, fetchJson, clean, fixCase } from './utils'

async function trySite(url: string, pattern: RegExp): Promise<string | null> {
  try {
    const html = await fetchText(url)
    if (html.length > 5000 && !/page not found|não encontrada|404|Page Not Found/i.test(html)) {
      const m = html.match(pattern)
      if (m) {
        const lyrics = clean(m[1])
        return lyrics.length > 50 ? lyrics : null
      }
    }
  } catch {}
  return null
}

async function getMeta(url: string): Promise<{ title: string; artist: string } | null> {
  try {
    const html = await fetchText(url)
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (!match) return null
    const t = match[1]
      .replace(/ - (Letras\.com|LETRAS\.COM|Letras\.mus\.br|Genius|lyrics).*$/i, '')
      .replace(/ \| (Genius|Genius Lyrics).*$/i, '')
      .trim()
    const parts = t.split(' - ')
    if (parts.length >= 2) {
      return { title: fixCase(parts[0].trim()), artist: fixCase(parts.slice(1).join(' - ').trim()) }
    }
    return { title: t, artist: '' }
  } catch {
    return null
  }
}

async function tryLyricsFromSites(title: string, artist: string): Promise<LyricsResult | null> {
  const sites = [
    {
      name: 'letras.com',
      url: (a: string, t: string) => `https://www.letras.com/${slug(a)}/${slug(t)}/`,
      pattern: /<div[^>]*class="[^"]*lyric-original[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    },
    {
      name: 'letras.mus.br',
      url: (a: string, t: string) => `https://www.letras.mus.br/${slug(a)}/${slug(t)}/`,
      pattern: /<div[^>]*class="[^"]*lyric-original[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    },
    {
      name: 'genius.com',
      url: (a: string, t: string) => `https://genius.com/${slug(a)}-${slug(t)}-lyrics`,
      pattern: /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/i,
    },
  ]

  for (const site of sites) {
    const url = site.url(artist, title)
    const lyrics = await trySite(url, site.pattern)
    if (lyrics) {
      const meta = await getMeta(url)
      return { title: meta?.title || title, artist: meta?.artist || artist, lyrics }
    }
  }

  return null
}

export const geniusProvider: LyricsProvider = {
  name: 'genius',
  async fetchLyrics(title: string, artist: string): Promise<LyricsResult | null> {
    // Try without artist first via Genius direct URL
    if (!artist) {
      const url = `https://genius.com/${slug(title)}-lyrics`
      const lyrics = await trySite(url, /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/i)
      if (lyrics) {
        const meta = await getMeta(url)
        return { title: meta?.title || title, artist: meta?.artist || '', lyrics }
      }
    }

    // Try then with artist name + variations
    if (artist) {
      const result = await tryLyricsFromSites(title, artist)
      if (result) return result
    }

    // Try via Genius internal API
    try {
      const pageUrl = artist
        ? `https://genius.com/${slug(artist)}-${slug(title)}-lyrics`
        : `https://genius.com/${slug(title)}-lyrics`
      const html = await fetchText(pageUrl)
      const workId = html.match(/"apiPath":"\/songs\/(\d+)"/)
      if (workId) {
        const api = await fetchJson<{ response: { song: { title: string; artist_names: string; embed_content?: string } } }>(
          `https://genius.com/api/works/${workId[1]}`
        )
        const s = api?.response?.song
        if (s?.embed_content) {
          const lyrics = cleanHtml(s.embed_content)
          if (lyrics.length > 50) {
            return {
              title: s.title,
              artist: s.artist_names,
              lyrics: addSpacingBeforeSections(lyrics),
            }
          }
        }
        if (s) {
          return { title: s.title, artist: s.artist_names, lyrics: '' }
        }
      }
    } catch {}

    return null
  },
}
