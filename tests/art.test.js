'use strict';
/* The pictures of js/art.js, run headless: the dyes they are painted in, the camp (built pixel by pixel, so the recording canvas of canvas-stub.js notes the pixels put on it by a
 * hash), the pictures of goods and cargo, the map, and the light of the fire on a man. How they look is for the eye (the camp in a browser, docs/figures.html); what these
 * check is what the painters promise: every colour is a dye of the palette, a camp is the same each time and is not the same everywhere, each hour has its own, and the
 * fire lights a man near it and nobody by day. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./canvas-stub');

const game = () => load(['core', 'journey', 'command', 'geo', 'art', 'figures', 'terrain']);
const HEX = /^#[0-9a-f]{6}$/;

test('the palette is ramps of dyes, and everything that is graded or lit goes from one dye to another', () => {
  const r = game(), ramps = plain(r, 'RAMPS');
  assert.equal(Object.keys(ramps).length, 15, 'fifteen ramps');
  for (const [name, ramp] of Object.entries(ramps)) {
    assert.ok(ramp.length >= 5, `${name} has steps`);
    for (const c of ramp) assert.match(c, HEX, `${name}: ${c}`);
    const lights = ramp.map(c => parseInt(c.slice(1, 3), 16) * 0.3 + parseInt(c.slice(3, 5), 16) * 0.6 + parseInt(c.slice(5, 7), 16) * 0.1);
    for (let i = 1; i < lights.length; i++) assert.ok(lights[i] >= lights[i - 1] - 1, `${name} runs from dark to light at step ${i}`);
  }
  assert.equal(ramps.soot[1], plain(r, 'PAL.ink'), 'the darkest ink of the pictures is soot1, never black');
  assert.equal(r("D('soot3')"), parseInt('2a2018', 16));
  assert.throws(() => r("D('soot9')"), /no dye/);
  // the paper family of the palette is made of steps of the ramps
  const steps = new Set(Object.values(ramps).flat());
  for (const k of ['paper', 'paperHi', 'hill', 'ground', 'drab', 'grey', 'steel', 'helm', 'smoke', 'flash']) assert.ok(steps.has(plain(r, `PAL.${k}`)), `PAL.${k} is a step of a ramp`);
  // each hour's grade turns a dye into a dye; each level of firelight too
  for (const mode of ['night', 'day', 'warm']) for (const ground of [true, false]) {
    const luts = r(`lutsFor('${mode}', ${ground})`), n = plain(r, `lutsFor('${mode}', ${ground}).length`);
    assert.equal(n, ground ? 7 : 5, `${mode}: the ground has six levels of firelight and what stands four, and the grade of the hour besides`);
    assert.ok(luts);
  }
  const dyes = new Set(plain(r, 'Object.values(DYE)'));
  for (const k of [0, 1, 2, 3, 4]) for (const to of plain(r, `[...lutsFor('night', false)[${k}].values()]`)) assert.ok(dyes.has(to), `level ${k} of firelight makes a dye of every dye`);
});

test('noise is the same each time for a seed, differs between seeds, and stays between 0 and 1', () => {
  const r = game();
  const sample = seed => plain(r, `(() => { const f = noiseOf(${seed}, 9, 3.2, 3); const out = []; for (let i = 0; i < 40; i++) out.push(f(i * 7.3, i * 3.1)); return out; })()`);
  assert.deepEqual(sample(5), sample(5));
  assert.notDeepEqual(sample(5), sample(6));
  for (const v of sample(5)) assert.ok(v >= 0 && v <= 1);
  assert.equal(r('fbm(10, 20, 3, 8, 8, 2)'), r('fbm(10, 20, 3, 8, 8, 2)'), 'the cached noise of a call is the noise');
});

test('the camp is the same each time, is not the same in every land, and shows what the company carries and where the roads go', () => {
  const r = game(), back = (quest, at) => r(`(() => { G = newGame('${quest}', { type: 'hussar', name: 'Janos' }); ${at ? `G.at = '${at}'; arrive(G);` : ''} return campBack(G).toDataURL(); })()`);
  const salt = back('salt'), again = back('salt');
  assert.equal(salt, again, 'the same camp, the same picture');
  const places = ['kyiv', 'krakow', 'danzig', 'vilnius', 'smolensk', 'breslau', 'leipzig'].map(p => back('salt', p));
  assert.equal(new Set([salt, ...places]).size, places.length + 1, 'every place has its camp: its land, its sky line, its signs and its notices');
  const carts = ['salt', 'oxen', 'grain', 'payroll'].map(q => back(q, 'kamianets'));
  assert.equal(new Set(carts).size, 4, 'ox-cart, herd, raft and chest each have their camp');
  // the notices: a paper for each piece of work posted, and the cart's load is what is left of the cargo
  const posted = r("(() => { G = newGame('salt', { type: 'hussar', name: 'Janos' }); G.at = 'kamianets'; arrive(G); const a = campBack(G).toDataURL(); G.contracts.length = 1; return a !== campBack(G).toDataURL(); })()");
  assert.ok(posted, 'one paper fewer on the board changes the picture');
  const lighter = r("(() => { G = newGame('salt', { type: 'hussar', name: 'Janos' }); const a = campBack(G).toDataURL(); G.cargo = Math.floor(G.cargo0 / 5); return a !== campBack(G).toDataURL(); })()");
  assert.ok(lighter, 'a lighter load, fewer barrels');
  // the night sky has its stars, which are the same for a night and differ from night to night
  const stars = seed => plain(r, `campStars(${seed}).map(s => [s.x, s.y])`);
  assert.deepEqual(stars(7), stars(7));
  assert.notDeepEqual(stars(7), stars(8));
  assert.ok(stars(7).length > 90 && stars(7).every(([x, y]) => x >= 0 && x < 320 && y >= 0 && y < 70), 'a hundred stars or so, in the sky');
});

test('each hour has its own camp, from the same layers: night, dusk and day', () => {
  const r = game();
  r("G = newGame('salt', { type: 'hussar', name: 'Janos' }); globalThis.B = campBack(G);");
  const hours = ['night', 'warm', 'day'].map(m => r(m === 'night' ? 'B.toDataURL()' : `campVariant(B, '${m}').toDataURL()`));
  assert.equal(new Set(hours).size, 3);
  assert.equal(r("campVariant(B, 'day') === campVariant(B, 'day')"), true, 'an hour is made once');
  // the sky has an hour of its own too, and a sky is kept for the light it was made for
  const skies = [0, 0.22, 0.3, 0.5].map(q => r(`skyCanvas(lightAt(${q})).toDataURL()`));
  assert.equal(new Set(skies).size, 4);
  assert.equal(r('skyCanvas(lightAt(0.22)) === skyCanvas(lightAt(0.78))'), true, 'dawn and dusk have the same glow, and so the same sky');
  assert.equal(r('skyCanvas(lightAt(0)) === skyCanvas(NIGHT_LIGHT)'), true);
  // the night camp, as it is when the fire flares, lights some of its pixels one level more
  assert.ok(r('campFlare(B)') && r('campFlare(B) === campFlare(B)'));
});

test('the fire lights a man near it, a man far from it less, and nobody by day', () => {
  const r = game();
  const paint = (x, y, strength, foot = 100) => plain(r, `(() => { const calls = [], g = { fillStyle: '#000000', fillRect(a, b, w, h) { calls.push(this.fillStyle); } }; const m = firelit(g, ${foot}, ${strength}); m.fillStyle = '#3f6aa8'; m.fillRect(${x}, ${y}, 1, 1); return calls; })()`);
  const near = new Set(), far = new Set();
  for (let i = 0; i < 16; i++) { near.add(paint(150 + i * 0.5, 96 + (i % 4) * 0.5, 1)[0]); far.add(paint(10 + i * 0.5, 96 + (i % 4) * 0.5, 1)[0]); }
  assert.ok([...near].some(c => c !== '#3f6aa8'), 'by the fire a coat is lit');
  assert.deepEqual([...far], ['#3f6aa8'], 'far from it, not');
  assert.deepEqual(paint(150, 96, 0), ['#3f6aa8'], 'and by day the fire lights nobody');
  const lit = [...near].find(c => c !== '#3f6aa8');
  assert.match(lit, HEX);
  assert.ok(parseInt(lit.slice(1, 3), 16) > 0x3f, 'lit, a blue coat has more red in it: the light is warm');
  assert.equal(paint(150, 96, 1, 100)[0] === '#3f6aa8', false);
  assert.deepEqual(plain(r, "(() => { const calls = []; const g = { fillStyle: '', fillRect() { calls.push(this.fillStyle); } }; const m = firelit(g, 100, 1); m.fillStyle = 'rgba(28,26,23,.22)'; m.fillRect(160, 100, 1, 1); return calls; })()"), ['rgba(28,26,23,.22)'], 'a colour that is not a dye of a man (a shadow) is left as it is');
});

test('goods and cargo are pictures of their own, in every kind, and are painted once', () => {
  const r = game();
  assert.notEqual(r("supplyArt('bread')"), r("supplyArt('powder')"));
  assert.equal(r("supplyArt('bread')"), r("supplyArt('bread')"));
  assert.notEqual(r('eventArt()'), r("supplyArt('bread')"));
  const cargo = ['oxcart', 'chest', 'herd', 'raft'].map(k => r(`(() => { const c = document.createElement('canvas'); const g = c.getContext('2d'); drawCargo(g, '${k}', 20, 27, 0.8, false); drawCargo(g, '${k}', 20, 27, 0.8, true); return c.toDataURL(); })()`));
  assert.equal(new Set(cargo).size, 4, 'the cart, the chest, the herd and the raft differ');
  const day = r("(() => { const c = document.createElement('canvas'); drawCargo(c.getContext('2d'), 'oxcart', 20, 27, 0.8, false); return c.toDataURL(); })()"), night = r("(() => { const c = document.createElement('canvas'); drawCargo(c.getContext('2d'), 'oxcart', 20, 27, 0.8, true); return c.toDataURL(); })()");
  assert.notEqual(day, night, 'by night the cart is another picture than by day');
  const ox = [[true, 1], [true, -1], [false, 1], [false, -1]].map(([l, f]) => r(`(() => { const c = document.createElement('canvas'); drawOx(c.getContext('2d'), 30, 30, ${f}, ${l}, '#6b5338'); return c.toDataURL(); })()`));
  assert.equal(new Set(ox).size, 4, 'an ox lies or stands, and faces either way');
  assert.notEqual(r(`(() => { const c = document.createElement('canvas'); drawOx(c.getContext('2d'), 30, 30, 1, true, '#6b5338'); return c.toDataURL(); })()`), r(`(() => { const c = document.createElement('canvas'); drawOx(c.getContext('2d'), 30, 30, 1, true, '#8a6c4a'); return c.toDataURL(); })()`), 'the hide is the colour it is asked for');
});

test('the map is drawn for every place, and leaves where each is for a click to find', () => {
  const r = game();
  r("window = { devicePixelRatio: 1 }; G = newGame('salt', { type: 'hussar', name: 'Janos' });");
  const out = plain(r, `(() => { const cv = document.createElement('canvas'); cv.style = {}; cv.clientWidth = 900; drawMap(cv, G, routeTo(G, 'leipzig')); return [cv.hits.length, Object.keys(PLACES).length, placeAt(cv, cv.hits[3].x + 2, cv.hits[3].y - 1) === cv.hits[3].id, cv.style.aspectRatio > 0]; })()`);
  assert.equal(out[0], out[1]);
  assert.ok(out[2] && out[3]);
});
