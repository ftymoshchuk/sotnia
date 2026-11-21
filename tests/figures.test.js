'use strict';
/* The figures, run headless: the same js files the page loads, in a VM context whose canvas is a recorder that notes
 * every rectangle painted. That is enough to check what the figures promise: that each level of weapon and armour a man
 * can buy changes his picture, that every pose fits the frame the cards and the field leave for it, and that a man who
 * faces left is his mirror image. Nothing here looks at colour values beyond telling pictures apart. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const RECORDER = `
function rec() {
  const calls = [], drawn = [];
  return { calls, drawn, fillStyle: '#000', globalAlpha: 1, imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
    fillRect(x, y, w, h) { calls.push([x, y, w, h, this.fillStyle]); }, drawImage(...a) { drawn.push(a); }, scale() {}, clearRect() {} };
}
// the canvases the figures ask the page for: each one a recorder, whose address is what was painted on it
const document = { createElement: () => { const g = rec(); return { width: 0, height: 0, getContext: () => g, toDataURL: () => 'data:' + JSON.stringify(g.calls) }; } };
const paint = fn => { const g = rec(); fn(g); return g.calls; };
`;
function figures() {
  const ctx = vm.createContext({});
  vm.runInContext(RECORDER, ctx);
  for (const f of ['js/core.js', 'js/journey.js', 'js/geo.js', 'js/art.js', 'js/figures.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return code => vm.runInContext(code, ctx);
}
// Values built inside the VM have its own Array and Object, which strict equality treats as different types.
const plain = (r, code) => JSON.parse(r('JSON.stringify(' + code + ')'));
const draw = (r, look, x = 0, y = 0) => plain(r, `paint(g => drawSoldier(g, ${x}, ${y}, ${JSON.stringify(look)}))`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CLASSES = ['pike', 'shot', 'sabre'];
const MODES = [{}, { moving: true, anim: 0 }, { moving: true, anim: 1 }, { mode: 'fight' }, { mode: 'fight', swing: 1 }, { mode: 'aim' }, { mode: 'aim', flash: 1 },
  { mode: 'reload', t: 0.3 }, { mode: 'rout' }, { level: true }, { dead: true }];

test('each level of weapon and each level of armour changes the picture, in every class', () => {
  const r = figures();
  for (const cls of CLASSES) for (const slot of ['wpn', 'arm']) for (let lv = 0; lv < 3; lv++) {
    const a = draw(r, { cls, skin: 'own', [slot]: lv }), b = draw(r, { cls, skin: 'own', [slot]: lv + 1 });
    assert.ok(!same(a, b), `${cls} ${slot} ${lv} looks the same as ${lv + 1}`);
  }
});

test('the weapon shows in the poses where it is in the hand: musket, pike and sabre at every level', () => {
  const r = figures();
  const poses = { pike: [{}, { mode: 'fight' }, { level: true }], shot: [{}, { mode: 'aim' }, { mode: 'reload', t: 0 }, { mode: 'fight' }], sabre: [{}, { mode: 'fight' }, { mode: 'fight', swing: 1 }] };
  for (const cls of CLASSES) for (const pose of poses[cls]) {
    const seen = new Set();
    for (let w = 0; w < 4; w++) seen.add(JSON.stringify(draw(r, { cls, skin: 'own', wpn: w, ...pose })));
    assert.equal(seen.size, 4, `${cls} ${JSON.stringify(pose)}: four weapons make ${seen.size} pictures`);
  }
});

test('the four muskets differ in length, as the matchlock, the Dutch musket and the wheel-lock do from the arquebus', () => {
  const r = figures();
  const lens = plain(r, 'MUSKET_LEN');
  assert.equal(lens.length, 4);
  assert.equal(new Set(lens).size > 2, true);
  assert.ok(lens[0] < lens[1] && lens[1] < lens[2], 'the arquebus is shortest and the Dutch musket longest of the matchlocks');
});

test('every pose of every class, in every kit, fits the frame left for it and paints something', () => {
  const r = figures();
  for (const cls of CLASSES) for (const m of MODES) for (const [wpn, arm] of [[0, 0], [3, 3], [1, 2]]) {
    const calls = draw(r, { cls, skin: 'own', wpn, arm, ...m });
    assert.ok(calls.length > (m.dead ? 10 : 20), `${cls} ${JSON.stringify(m)} painted ${calls.length} rectangles`);
    const S = 2, xs = calls.flatMap(c => [c[0] * S, (c[0] + c[2]) * S]), ys = calls.flatMap(c => [c[1] * S, (c[1] + c[3]) * S]);
    // the figure is measured in figure pixels from his feet: the halberd, held up, is the tallest thing there is, the levelled pike the longest
    assert.ok(Math.min(...xs) >= -26 && Math.max(...xs) <= 62, `${cls} ${JSON.stringify(m)} runs from ${Math.min(...xs)} to ${Math.max(...xs)} across`);
    assert.ok(Math.min(...ys) >= -66 && Math.max(...ys) <= 2, `${cls} ${JSON.stringify(m)} runs from ${Math.min(...ys)} to ${Math.max(...ys)} up and down`);
  }
});

test('a man facing left is the mirror of the same man facing right', () => {
  const r = figures();
  for (const cls of CLASSES) for (const m of MODES) {
    const R = draw(r, { cls, skin: 'own', wpn: 2, arm: 2, man: 4, ...m, face: 1 }), L = draw(r, { cls, skin: 'own', wpn: 2, arm: 2, man: 4, ...m, face: -1 });
    assert.equal(R.length, L.length);
    R.forEach((c, i) => {
      assert.equal(L[i][2], c[2]); assert.equal(L[i][3], c[3]); assert.equal(L[i][1], c[1]); assert.equal(L[i][4], c[4]);
      assert.equal(L[i][0] * 2, -(c[0] * 2) - c[2] * 2 + 1, `${cls} ${JSON.stringify(m)} rectangle ${i} is not mirrored`);
    });
  }
});

test('a man drawn again is the same man, and men differ from each other', () => {
  const r = figures();
  const look = { cls: 'pike', skin: 'own', wpn: 1, arm: 1, man: 7 };
  assert.ok(same(draw(r, look), draw(r, look)));
  const faces = new Set();
  for (let man = 0; man < 15; man++) faces.add(JSON.stringify(draw(r, { ...look, man })));
  assert.ok(faces.size >= 8, `fifteen men make ${faces.size} faces`);
  assert.equal(plain(r, 'manNo(12)'), 12);
  assert.ok(plain(r, 'manNo("e3")') !== plain(r, 'manNo("e4")'));
});

test('the same man at a different place in the scene is the same picture, moved', () => {
  const r = figures();
  const a = draw(r, { cls: 'shot', skin: 'swede', wpn: 2, arm: 1 }, 0, 0), b = draw(r, { cls: 'shot', skin: 'swede', wpn: 2, arm: 1 }, 24, 33);
  assert.equal(a.length, b.length);
  a.forEach((c, i) => { assert.equal(b[i][0], c[0] + 24); assert.equal(b[i][1], c[1] + 33); assert.equal(b[i][4], c[4]); });
});

test('every livery, and a man just hit, paint every class', () => {
  const r = figures();
  const skins = plain(r, 'Object.keys(SKINS)');
  assert.ok(skins.length >= 9);
  for (const skin of skins) for (const cls of CLASSES) assert.ok(draw(r, { cls, skin, wpn: 1, arm: 1 }).length > 20);
  const plainCoat = draw(r, { cls: 'sabre', skin: 'own' }), struck = draw(r, { cls: 'sabre', skin: 'own', hurt: 1 });
  assert.ok(!same(plainCoat, struck));
  assert.ok(struck.filter(c => c[4] === plain(r, 'PAL.white')).length > plainCoat.filter(c => c[4] === plain(r, 'PAL.white')).length, 'a man who is hit flashes white');
});

test('the camp poses and the hired hands paint, and a bandaged man differs from a whole one', () => {
  const r = figures();
  for (const cls of CLASSES) {
    for (const look of [{ pose: 'sit' }, { pose: 'sit', prop: 'bandura', strum: 1 }, { pose: 'sit', prop: 'pipe' }, { pose: 'lie' }, { pose: 'lie', bandage: false }, { pose: 'forage', anim: 1 }, { pose: 'stand' }]) {
      const calls = plain(r, `paint(g => drawCamper(g, 20, 30, ${JSON.stringify({ cls, skin: 'own', wpn: 2, arm: 2, ...look })}))`);
      assert.ok(calls.length > 15, `${cls} ${JSON.stringify(look)}`);
    }
    const whole = plain(r, `paint(g => drawCamper(g, 20, 30, ${JSON.stringify({ cls, skin: 'own' })}))`), hurt = plain(r, `paint(g => drawCamper(g, 20, 30, ${JSON.stringify({ cls, skin: 'own', bandage: true })}))`);
    assert.ok(!same(whole, hurt));
  }
  for (const k of ['surgeon', 'drill', 'qm', 'chaplain']) assert.ok(plain(r, `paint(g => drawCivilian(g, 20, 30, '${k}', 1))`).length > 30, k);
});

test('the pictures of gear differ at every level, for every weapon and for armour', () => {
  const r = figures();
  const pics = (slot, cls) => [0, 1, 2, 3].map(t => r(`gearArt('${slot}', '${cls}', ${t})`));
  for (const cls of CLASSES) assert.equal(new Set(pics('wpn', cls)).size, 4, `${cls} weapons`);
  assert.equal(new Set(pics('arm', 'pike')).size, 4, 'armour');
  assert.equal(r("gearArt('wpn', 'pike', 2)"), r("gearArt('wpn', 'pike', 2)"), 'a picture is drawn once and kept');
  // each is 44 by 32 figure pixels and the painting stays inside it
  for (const [slot, cls] of [['wpn', 'pike'], ['wpn', 'shot'], ['wpn', 'sabre'], ['arm', 'pike']]) for (let t = 0; t < 4; t++) {
    const calls = JSON.parse(r(`gearArt('${slot}', '${cls}', ${t})`).slice('data:'.length));
    for (const c of calls) assert.ok(c[0] * 2 >= 0 && (c[0] + c[2]) * 2 <= 44 && c[1] * 2 >= 0 && (c[1] + c[3]) * 2 <= 32, `${slot} ${cls} ${t} paints outside its picture: ${c}`);
  }
});

test('colours are toned lighter and darker, and a gear level is kept to 0 to 3', () => {
  const r = figures();
  assert.equal(r("tint('#808080', 0.5)"), '#404040');
  assert.equal(r("tint('#000000', 1.5)"), '#808080');
  assert.equal(r("tint('#336699', 1)"), '#336699');
  assert.deepEqual(plain(r, '[gearLv(), gearLv(-2), gearLv(1.9), gearLv(7)]'), [0, 0, 1, 3]);
});

test('a scene buffer goes on the canvas straight when the size is nearly a whole number of times its own, and blown up first when it is not', () => {
  const r = figures();
  const shown = (bufW, W) => plain(r, `(() => { const buf = { width: ${bufW}, height: 100 }, c = rec(); present(c, buf, ${W}, 50); return { smooth: c.imageSmoothingEnabled, drawn: c.drawn.map(a => a[0] === buf ? 'buffer' : 'blown up') }; })()`);
  assert.deepEqual(shown(600, 1228), { smooth: false, drawn: ['buffer'] }, 'a whole number of times as big, near enough');
  assert.deepEqual(shown(640, 924), { smooth: true, drawn: ['blown up'] }, 'one and a half times, not a whole number');
  assert.deepEqual(shown(600, 300), { smooth: true, drawn: ['buffer'] }, 'smaller than the buffer: shrunk smoothly');
});

test('a battle unit and a line of the report carry the gear the picture shows', () => {
  const r = figures();
  const out = plain(r, `(() => {
    const st = newGame('salt'), s = st.roster[0];
    s.wpn = 2; s.arm = 3;
    const c = makeContract(st, TEMPLATES[0], 'easy'), b = battleFor(st, c, [s.id], 'advance', false), u = b.units.find(x => x.sid === s.id);
    while (!b.over) stepBattle(b, 0.1);
    const rep = resolveBattle(st, c, b), line = rep.lines.find(l => l.id === s.id);
    const foe = c.units[0];
    return { unit: [u.wpn, u.arm], line: [line.wpn, line.arm], foe: [foe.wpn, foe.arm, foe.tier] };
  })()`);
  assert.deepEqual(out.unit, [2, 3]);
  assert.deepEqual(out.line, [2, 3]);
  assert.ok(out.foe[0] >= 0 && out.foe[0] <= 3 && out.foe[1] >= 0 && out.foe[1] <= 3, 'a foe has gear levels too');
});
