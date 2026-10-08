import assert from 'node:assert/strict';
import test from 'node:test';
import { LAMPORTS_PER_SOL, evaluateSponsorship, limitsFromEnv, registrationsLeft } from './sponsor-policy';

const limits = limitsFromEnv({});

test('defaults: 3 free registrations, 0.05 SOL per user, 1 SOL per day', () => {
  assert.equal(limits.freeRegistrations, 3);
  assert.equal(limits.perUserCapLamports, 0.05 * LAMPORTS_PER_SOL);
  assert.equal(limits.dailyBudgetLamports, LAMPORTS_PER_SOL);
});

test('env overrides and invalid values fall back to defaults', () => {
  const l = limitsFromEnv({ SOLIRIC_FREE_REGISTRATIONS: '10', SOLIRIC_USER_CAP_SOL: 'abc', SOLIRIC_DAILY_BUDGET_SOL: '2' });
  assert.equal(l.freeRegistrations, 10);
  assert.equal(l.perUserCapLamports, 0.05 * LAMPORTS_PER_SOL);
  assert.equal(l.dailyBudgetLamports, 2 * LAMPORTS_PER_SOL);
});

test('registrations left counts down and admins are unlimited', () => {
  assert.equal(registrationsLeft(0, limits, false), 3);
  assert.equal(registrationsLeft(2, limits, false), 1);
  assert.equal(registrationsLeft(5, limits, false), 0);
  assert.equal(registrationsLeft(99, limits, true), Number.POSITIVE_INFINITY);
});

test('a user over their cap is refused, an admin is not', () => {
  const base = { need: 6_000_000, fundedToUser: 48_000_000, fundedLast24h: 0, limits };
  const r = evaluateSponsorship({ ...base, admin: false });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.code, 'user-cap');
  assert.equal(evaluateSponsorship({ ...base, admin: true }).ok, true);
});

test('the daily budget stops everybody, admins included', () => {
  const r = evaluateSponsorship({ need: 6_000_000, fundedToUser: 0, fundedLast24h: LAMPORTS_PER_SOL - 1_000_000, admin: true, limits });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.code, 'daily-budget');
});

test('nothing to fund is always fine', () => {
  assert.equal(evaluateSponsorship({ need: 0, fundedToUser: 1e12, fundedLast24h: 1e12, admin: false, limits }).ok, true);
});
