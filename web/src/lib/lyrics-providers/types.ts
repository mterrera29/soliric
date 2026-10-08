export interface LyricsResult {
  title: string
  artist: string
  lyrics: string
}

export interface SongCandidate {
  title: string
  artist: string
}

export interface LyricsProvider {
  name: string
  fetchLyrics(title: string, artist: string): Promise<LyricsResult | null>
}

export interface SearchProvider {
  name: string
  search(query: string): Promise<SongCandidate[]>
}

export interface ChordsProvider {
  name: string
  fetchChords(title: string, artist: string): Promise<string | null>
}
