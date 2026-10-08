import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMetadata, canonicalJson, hashMetadata, registrationMemo } from './metadata';

const base = { title: 'Después de las tres', artist: 'Mati', authorName: 'Matías Terrera', fingerprint: 'ab'.repeat(32), registeredAt: '2026-10-07T19:31:07.000Z' };

test('the hash does not depend on key order or extra spaces', () => {
  const a = buildMetadata(base);
  const b = buildMetadata({ ...base, title: '  Después   de las tres ' });
  assert.equal(hashMetadata(a), hashMetadata(b));
});

test('any change in the data changes the hash', () => {
  assert.notEqual(hashMetadata(buildMetadata(base)), hashMetadata(buildMetadata({ ...base, authorName: 'Otro' })));
});

test('canonical json keeps a fixed key order', () => {
  assert.ok(canonicalJson(buildMetadata(base)).startsWith('{"v":1,"title":'));
});

test('memo carries both hashes and fits well under the memo limit', () => {
  const memo = registrationMemo('a'.repeat(64), 'b'.repeat(64));
  assert.match(memo, /^soliric:v1:attest:[a]{64}:meta:[b]{64}$/);
  assert.ok(Buffer.byteLength(memo) < 200);
});
