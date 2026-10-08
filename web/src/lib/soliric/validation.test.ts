import assert from 'node:assert/strict';
import test from 'node:test';
import { isEmail } from './validation';

test('emails need an @ and a domain with a dot', () => {
  assert.equal(isEmail('ana@example.com'), true);
  assert.equal(isEmail('ana@example'), false);
  assert.equal(isEmail('ana example.com'), false);
  assert.equal(isEmail('@example.com'), false);
});
