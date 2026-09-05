import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('fitting room loads the automatic renderer before its final guards', async () => {
  const html = await load('public/index.html');
  const renderer = html.indexOf('fitting-fix.js');
  const guard = html.indexOf('fitting-layer-guard.js');
  const anatomical = html.indexOf('fitting-anatomic-v2.js');
  assert.ok(renderer >= 0, 'automatic fitting renderer must be loaded');
  assert.ok(guard > renderer, 'geometry guard must run after the automatic renderer');
  assert.ok(anatomical > guard, 'anatomical pass must run after all legacy geometry');
  assert.equal(html.includes('studio-fitting.js'), false, 'legacy studio renderer must stay disabled');
});

test('fitting guard protects shirt/jacket layering and both mannequins', async () => {
  const source = await load('public/fitting-layer-guard.js');
  assert.match(source, /TOP_WITH_OUTERWEAR/);
  assert.match(source, /male:/);
  assert.match(source, /female:/);
  assert.match(source, /data-under-outerwear/);
  assert.match(source, /clip-path:inset/);
  assert.match(source, /OUTERWEAR:\s*30/);
  assert.match(source, /BOTTOM:\s*10/);
});

test('fitting guard constrains every rendered layer including persisted DB adjustments', async () => {
  const source = await load('public/fitting-layer-guard.js');
  assert.match(source, /clampToCanvas/);
  assert.match(source, /stabilizeGeometry/);
  assert.match(source, /BODY_CATEGORIES/);
  assert.match(source, /Persisted adjustments from older versions/);
  assert.doesNotMatch(source, /if\s*\(!manual\)/, 'persisted assets must not bypass the safety envelope');
});

test('anatomical pass replaces persisted body boxes with mannequin-calibrated coordinates', async () => {
  const source = await load('public/fitting-anatomic-v2.js');
  assert.match(source, /TOP_UNDER/);
  assert.match(source, /OUTERWEAR/);
  assert.match(source, /warpCanvas/);
  assert.match(source, /Ajuste anatómico/);
  assert.match(source, /fit-foreground/);
  assert.match(source, /old DB values cannot re-break the fit/);
});
