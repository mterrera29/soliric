import type { LyricsResult, LyricsProvider } from './types'
import { geniusProvider } from './genius'
import { lyricsOvhProvider } from './lyrics-ovh'
import { musixmatchProvider } from './musixmatch'
import { lrclibProvider } from './lrclib'
import { searchCandidates } from './search'
export { searchCandidates }

const lyricsProviders: LyricsProvider[] = [geniusProvider, musixmatchProvider, lrclibProvider, lyricsOvhProvider]

function artistParts(name: string): string[] {
  const parts: string[] = [name]
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    parts.push(words[0], words[words.length - 1], words.slice(0, -1).join(' '))
    if (words.length > 2) parts.push(words.slice(-2).join(' '), words.slice(0, 2).join(' '))
  }
  return [...new Set(parts)]
}

/** Busca la letra de una canción en catálogos públicos (se usa para detectar copias antes de registrar). */
export async function fetchLyrics(searchTitle: string, searchArtist: string): Promise<LyricsResult | null> {
  if (searchArtist) {
    for (const a of artistParts(searchArtist)) {
      for (const provider of lyricsProviders) {
        const result = await provider.fetchLyrics(searchTitle, a)
        if (result) return result
      }
    }
  }
  for (const provider of lyricsProviders) {
    const result = await provider.fetchLyrics(searchTitle, '')
    if (result) return result
  }
  const { candidates } = await searchCandidates(searchTitle)
  for (const c of candidates) {
    for (const provider of lyricsProviders) {
      const result = await provider.fetchLyrics(c.title, c.artist)
      if (result) return result
    }
    for (const provider of lyricsProviders) {
      const result = await provider.fetchLyrics(searchTitle, c.artist)
      if (result) return result
    }
  }
  return null
}
