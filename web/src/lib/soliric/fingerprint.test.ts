import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintOf, normalizeLyrics, similarity } from './fingerprint';

test('same lyrics with different chords, case and punctuation share a fingerprint', () => {
  const a = fingerprintOf('Hoy desperté, con ganas\nde vivir.', '');
  const b = fingerprintOf('', '[Am]HOY desperté con [G]ganas\nde vivir');
  assert.equal(a.hash.toString('hex'), b.hash.toString('hex'));
});

test('accents are ignored', () => {
  assert.equal(normalizeLyrics('Canción de Amor'), normalizeLyrics('cancion de amor'));
});

test('different lyrics have different fingerprints', () => {
  assert.notEqual(
    fingerprintOf('una letra distinta por completo', '').hash.toString('hex'),
    fingerprintOf('otra letra bien diferente aca', '').hash.toString('hex'),
  );
});

test('similarity is 1 for identical and low for unrelated lyrics', () => {
  const a = normalizeLyrics('hoy desperté con ganas de vivir y cantar por la calle');
  assert.equal(similarity(a, a), 1);
  assert.ok(similarity(a, normalizeLyrics('nada que ver con eso otra historia muy distinta aca')) < 0.1);
});

import { compare, comparableText } from './fingerprint';

const LYRICS = `Hoy desperté con ganas de cantarle a la luna
y la calle vacía me ofreció su compañía
caminé sin rumbo por la orilla del río
buscando el eco de un verano ya perdido`;

test('title and artist lines on top are ignored', () => {
  const withHeader = comparableText(`Luna de calle - Los Autores\n${LYRICS}`, { title: 'Luna de calle', artist: 'Los Autores' });
  assert.equal(withHeader, comparableText(LYRICS));
});

test('section labels are removed but lyric lines starting with the same word are kept', () => {
  const t = comparableText(`[Estribillo]\nSolo quiero verte\nCoro:\nSolo`);
  assert.equal(t, 'solo quiero verte');
});

test('one extra or missing word still matches very closely', () => {
  const a = comparableText(LYRICS);
  const b = comparableText(LYRICS.replace('la orilla', 'la vieja orilla'));
  const c = comparableText(LYRICS.replace('y la calle vacía me ofreció su compañía\n', ''));
  assert.ok(compare(a, b).jaccard > 0.7);
  assert.ok(compare(a, c).bInA > 0.9); // la versión sin una línea queda dentro de la completa
});

test('a fragment is contained in the full lyric; unrelated lyrics do not match', () => {
  const full = comparableText(LYRICS);
  const part = comparableText('caminé sin rumbo por la orilla del río buscando el eco de un verano ya perdido');
  assert.ok(compare(part, full).aInB > 0.9);
  assert.ok(compare(full, comparableText('otra canción totalmente distinta que habla de otra cosa muy diferente aca')).jaccard < 0.1);
});
