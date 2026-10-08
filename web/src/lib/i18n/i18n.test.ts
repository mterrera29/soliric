import assert from 'node:assert/strict';
import test from 'node:test';
import { interpolate, parseLang, translate } from './index';

test('spanish returns the key itself, interpolated', () => {
  assert.equal(translate('es', 'Hola {name}', { name: 'Ana' }), 'Hola Ana');
});

test('english falls back to the spanish text when a translation is missing', () => {
  assert.equal(translate('en', 'texto que no existe'), 'texto que no existe');
});

test('language parsing defaults to english', () => {
  assert.equal(parseLang(undefined), 'en');
  assert.equal(parseLang('es'), 'es');
  assert.equal(parseLang('fr'), 'en');
});

test('interpolation leaves unknown params untouched', () => {
  assert.equal(interpolate('a {x} {y}', { x: 1 }), 'a 1 {y}');
});

test('interpolated server messages are matched against their template', () => {
  const es = 'Se parece en un 97 % a una obra registrada, que ya está registrada. Si es tu obra, no hace falta registrarla de nuevo.';
  assert.equal(
    translate('en', es),
    "It is 97 % similar to a registered work, which is already registered. If it's your work, there's no need to register it again.",
  );
});
