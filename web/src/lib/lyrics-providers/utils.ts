export function cleanHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim()
}

export function addSpacingBeforeSections(text: string): string {
  return text
    .replace(/\n*(\[[A-Za-zÁÉÍÓÚÑ][^\]]*\])/g, '\n\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-z0-9áéíóúñ]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function underscoreSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function fixCase(s: string): string {
  if (s.length < 2 || /[a-z]/.test(s)) return s
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B[A-Z]/g, (c) => c.toLowerCase())
}

export function clean(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function fixTitle(s: string): string {
  return s
    .replace(/ \(Letra.*$| - Letras.*$| Lyrics.*| \| Genius.*$/i, '')
    .trim()
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

export function fetchText(url: string): Promise<string> {
  return fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8' },
  }).then((r) => r.text())
}

export function fetchJson<T>(url: string): Promise<T> {
  return fetch(url, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.json())
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

// Deja una hoja de acordes lista para mostrarse en columnas: no recorta espacios
// al inicio de las líneas (eso desalinearía el acorde respecto de la letra).
export function normalizeChordSheet(text: string): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => expandTabs(line).replace(/\s+$/, ''))
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

function expandTabs(line: string, size = 8): string {
  if (!line.includes('\t')) return line
  let out = ''
  for (const ch of line) {
    if (ch === '\t') out += ' '.repeat(size - (out.length % size))
    else out += ch
  }
  return out
}

export function cleanChordHtml(html: string): string {
  return normalizeChordSheet(
    decodeEntities(
      html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
    )
  )
}
