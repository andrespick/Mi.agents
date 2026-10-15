const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBranding } = require('../skills/brainstorming/scripts/server.cjs');

test('companion branding preserves attribution without loading a third-party resource', () => {
  const html = renderBranding('<!doctype html><body><!-- BRANDING --></body>');
  assert.match(html, /github\.com\/obra\/superpowers/);
  assert.match(html, /Superpowers/);
  assert.doesNotMatch(html, /<img\b|\bsrc\s*=|primeradiant\.com|\?v=/i);
  assert.doesNotMatch(html, /<!-- BRANDING -->/);
});
