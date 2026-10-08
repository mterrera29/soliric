import assert from 'node:assert/strict';
import test from 'node:test';
import { KEY_PREFIX, externalUid, generateKey, hashKey, keyPrefixOf } from './partner-keys';

test('keys are long, prefixed and different every time', () => {
  const a = generateKey();
  const b = generateKey();
  assert.ok(a.startsWith(KEY_PREFIX));
  assert.ok(a.length > 40);
  assert.notEqual(a, b);
});

test('only the hash is derived from the key, and it is stable', () => {
  const k = generateKey();
  assert.equal(hashKey(k), hashKey(k));
  assert.match(hashKey(k), /^[0-9a-f]{64}$/);
  assert.ok(!hashKey(k).includes(k));
  assert.notEqual(hashKey(k), hashKey(generateKey()));
});

test('the visible prefix does not reveal the key', () => {
  const k = generateKey();
  assert.equal(keyPrefixOf(k).length, KEY_PREFIX.length + 4);
  assert.ok(k.length > keyPrefixOf(k).length + 30);
});

test('an author keeps the same synthetic uid per app, regardless of email case', () => {
  assert.equal(externalUid('p1', 'Ana@Example.com '), externalUid('p1', 'ana@example.com'));
  assert.notEqual(externalUid('p1', 'ana@example.com'), externalUid('p2', 'ana@example.com'));
  assert.notEqual(externalUid('p1', 'ana@example.com'), externalUid('p1', 'leo@example.com'));
  assert.match(externalUid('p1', 'ana@example.com'), /^ext:p1:[0-9a-f]{24}$/);
});
