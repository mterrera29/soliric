// Lista los textos en español del código que todavía no están en el diccionario inglés.
//   npx tsx scripts/i18n-check.ts            → resumen por archivo
//   npx tsx scripts/i18n-check.ts --verbose  → cada texto con su línea
import fs from 'node:fs';
import path from 'node:path';
import { EN } from '../src/lib/i18n/en';

const ROOT = path.join(process.cwd(), 'src');
const SKIP = [/\.test\./, /\/i18n\//, /idl\.json/, /seed\.ts$/, /\/db\/schema\.ts$/];
// Palabras muy españolas: si un texto tiene alguna (o un acento/ñ/¿/¡), se considera español
const WORDS = new Set(('el la los las un una unos unas de del que para por con sin tu tus tuyo mi mis su sus se no es son está están '
  + 'esta este esto estos estas ya más muy como cuando donde también pero porque sobre entre desde hasta hay ser fue canción canciones letra letras acordes '
  + 'guardar guardá eliminar cancelar cancelá editar editá volver cargando iniciá sesión elegí pegá agregá abrí tocá escribí contá probá '
  + 'obra obras registro registrar registrada registrado autor autores coautor impugnación impugnar verificar huella reparto portada artista título '
  + 'público pública privada privado nueva nuevo nuevas todavía ahora cada solo sólo antes después otra otro').split(/\s+/));
const looksSpanish = (s: string) => {
  if (!/[a-záéíóúñ]/i.test(s) || /^[\w./:#@{}$%\-+=[\]()|<>,;!?'"`\\*&^~]*$/.test(s) && !/[áéíóúñ¿¡]/i.test(s) && !s.includes(' ')) return false;
  if (/[áéíóúñ¿¡ÁÉÍÓÚÑ]/.test(s)) return true;
  const words = s.toLowerCase().match(/[a-záéíóúñ]+/g) ?? [];
  return words.some((w) => WORDS.has(w));
};

const files: string[] = [];
(function walk(dir: string) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f.name) && !SKIP.some((r) => r.test(p))) files.push(p);
  }
})(ROOT);

const missing: Record<string, { line: number; text: string }[]> = {};
for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  fs.readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*') || line.startsWith('import ')) return;
    const found = new Set<string>();
    for (const m of raw.matchAll(/(['"`])((?:\\.|(?!\1).)+?)\1/g)) found.add(m[2]);
    for (const m of raw.matchAll(/>([^<>{}]*[A-Za-zÁ-ú][^<>{}]*)</g)) found.add(m[1].trim());
    const jsxLine = !/[=;(){}]/.test(line) && /[A-Za-zÁ-ú]/.test(line) ? [line] : [];
    for (const text of [...found, ...jsxLine]) {
      const clean = text.replace(/\\'/g, "'").trim();
      if (clean.length < 3 || !looksSpanish(clean) || EN[clean] !== undefined) continue;
      (missing[rel] ??= []).push({ line: i + 1, text: clean });
    }
  });
}

const entries = Object.entries(missing).sort((a, b) => b[1].length - a[1].length);
const total = entries.reduce((n, [, v]) => n + v.length, 0);
for (const [file, list] of entries) {
  console.log(`${String(list.length).padStart(4)}  ${file}`);
  if (process.argv.includes('--verbose')) for (const { line, text } of list) console.log(`        ${line}: ${text.slice(0, 110)}`);
}
console.log(`\n${total} textos sin traducir en ${entries.length} archivos · ${Object.keys(EN).length} traducciones en el diccionario`);
