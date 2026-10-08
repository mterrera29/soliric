import assert from 'node:assert/strict';
import test from 'node:test';
import { canRegisterOnchain, catalogVerdict, normalizeWorkSource, validateWorkInput } from './work-policy';

test('imported works cannot be registered on-chain', () => {
  assert.equal(canRegisterOnchain('import'), false);
  assert.equal(canRegisterOnchain('web'), true);
  assert.equal(canRegisterOnchain('api'), true);
});

test('unknown sources fall back to web', () => {
  assert.equal(normalizeWorkSource('api'), 'api');
  assert.equal(normalizeWorkSource('hacked'), 'web');
  assert.equal(normalizeWorkSource(undefined), 'web');
});

test('work input needs a title and a lyric within limits', () => {
  assert.equal(validateWorkInput({ title: 'Luna', lyrics: 'una letra' }), null);
  assert.match(validateWorkInput({ title: ' ', lyrics: 'x' })!, /título/);
  assert.match(validateWorkInput({ title: 'Luna', lyrics: '' })!, /letra/);
  assert.match(validateWorkInput({ title: 'x'.repeat(201), lyrics: 'x' })!, /título/);
  assert.match(validateWorkInput({ title: 'Luna', lyrics: 'x'.repeat(20_001) })!, /larga/);
  assert.match(validateWorkInput({ title: 123, lyrics: 'x' })!, /título/);
});

test('catalog verdict thresholds', () => {
  assert.equal(catalogVerdict(0.7, true), 'block');
  assert.equal(catalogVerdict(0.6, true), 'block');
  assert.equal(catalogVerdict(0.4, true), 'review');
  assert.equal(catalogVerdict(0.1, true), 'ok');
  assert.equal(catalogVerdict(0, false), 'review');
});
