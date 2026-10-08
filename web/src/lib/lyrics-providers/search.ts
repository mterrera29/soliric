import type { SongCandidate, SearchProvider } from './types'
import { fixCase } from './utils'

async function deezerSearch(query: string): Promise<SongCandidate[]> {
  const res = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error(`deezer search error: ${res.status}`)
  const data = await res.json() as { data?: { title?: string; artist?: { name?: string } }[] }
  const seen = new Set<string>()
  return (data.data || [])
    .map((t) => ({
      title: fixCase(t.title || ''),
      artist: fixCase(t.artist?.name || ''),
    }))
    .filter((c) => {
      const key = `${c.title}|${c.artist}`
      if (seen.has(key)) return false
      seen.add(key)
      return c.title && c.artist
    })
}

async function itunesSearch(query: string): Promise<SongCandidate[]> {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error(`itunes search error: ${res.status}`)
  const data = await res.json() as { results?: { trackName?: string; artistName?: string }[] }
  const seen = new Set<string>()
  return (data.results || [])
    .map((t) => ({
      title: fixCase(t.trackName || ''),
      artist: fixCase(t.artistName || ''),
    }))
    .filter((c) => {
      const key = `${c.title}|${c.artist}`
      if (seen.has(key)) return false
      seen.add(key)
      return c.title && c.artist
    })
}

const providers: SearchProvider[] = [
  { name: 'deezer', search: deezerSearch },
  { name: 'itunes', search: itunesSearch },
]

export async function searchCandidates(
  query: string,
  trySource?: number
): Promise<{ candidates: SongCandidate[]; hasMore: boolean }> {
  if (trySource !== undefined && trySource >= 0) {
    const result = await providers[trySource].search(query)
    return { candidates: result, hasMore: trySource + 1 < providers.length }
  }
  for (let i = 0; i < providers.length; i++) {
    const result = await providers[i].search(query)
    if (result.length > 0) {
      return { candidates: result, hasMore: i + 1 < providers.length }
    }
  }
  return { candidates: [], hasMore: false }
}
