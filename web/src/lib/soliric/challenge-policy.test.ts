import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSubmission, validateChallengeInput } from './challenge-policy';

const ok = { sourceUrl: 'https://genius.com/artista-cancion-lyrics', matchedPart: 'el estribillo completo', sinceWhen: '2019', evidence: 'Es la canción de otro artista, publicada en 2019.' };

test('a complete challenge is accepted', () => {
  assert.equal(validateChallengeInput(ok), null);
});

test('each required field is enforced', () => {
  assert.match(validateChallengeInput({ ...ok, sourceUrl: 'https://' })!, /fuente/);
  assert.match(validateChallengeInput({ ...ok, sourceUrl: 'abc' })!, /fuente/);
  assert.match(validateChallengeInput({ ...ok, matchedPart: 'todo' })!, /parte/);
  assert.match(validateChallengeInput({ ...ok, sinceWhen: '' })!, /desde cuándo/);
  assert.match(validateChallengeInput({ ...ok, evidence: 'es mía' })!, /detalle/);
});

test('a concrete reference is accepted instead of a link', () => {
  assert.equal(validateChallengeInput({ ...ok, sourceUrl: 'Disco "Bajo el sol", 2018, tema 4' }), null);
});

test('one active challenge at a time, three per day', () => {
  const clean = { active: 0, last24h: 0, failed: 0, rejectedOnThisSong: false };
  assert.equal(evaluateSubmission(clean).ok, true);
  const active = evaluateSubmission({ ...clean, active: 1 });
  assert.equal(!active.ok && active.code, 'active');
  const rate = evaluateSubmission({ ...clean, last24h: 3 });
  assert.equal(!rate.ok && rate.code, 'rate');
});

test('two failed challenges block the account, a repeat on the same song is refused', () => {
  const blocked = evaluateSubmission({ active: 0, last24h: 0, failed: 2, rejectedOnThisSong: false });
  assert.equal(!blocked.ok && blocked.code, 'blocked');
  const repeat = evaluateSubmission({ active: 0, last24h: 0, failed: 1, rejectedOnThisSong: true });
  assert.equal(!repeat.ok && repeat.code, 'repeat');
});
