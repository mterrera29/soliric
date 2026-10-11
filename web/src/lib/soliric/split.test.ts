import test from 'node:test';
import assert from 'node:assert/strict';
import { autoBps, BPS_TOTAL } from './split';

test('el reparto automático siempre suma 100 %', () => {
  for (const units of [[1], [3, 1], [1, 1, 1], [7, 5, 3, 1], [10, 0], [2, 3]]) {
    const bps = autoBps(units)!;
    assert.equal(bps.reduce((a, b) => a + b, 0), BPS_TOTAL);
  }
});

test('el resto del redondeo va al mayor aportante', () => {
  assert.deepEqual(autoBps([1, 1, 1]), [3334, 3333, 3333]);
  assert.deepEqual(autoBps([3, 1]), [7500, 2500]);
});

test('sin aportes no hay reparto automático', () => {
  assert.equal(autoBps([]), null);
  assert.equal(autoBps([0, 0]), null);
});
