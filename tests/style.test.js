'use strict';
/* The look of the game, as far as a test can hold it: the icon set, the sprite they are drawn from, and the rules of the stylesheet (every colour it uses
 * is a token it defines, a pair of text and ground can be read, and nothing is rounded or blurred, since this is a pixel game). How it looks on a screen
 * is for the eye (docs/ sheets and the browser); what is kept here is what a later change could quietly break. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load, plain } = require('./canvas-stub');
const { page } = require('./dom-stub');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'sotnia.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const icons = () => load(['icons']);

/* ---------- the icons ---------- */
test('every icon is eight rows of eight pixels in colours it names, in few colours', () => {
  const r = icons(), set = plain(r, 'ICON');
  const names = Object.keys(set);
  assert.ok(names.length >= 56, 'the whole set the game asks for');
  for (const n of names) {
    const { rows, pal } = set[n];
    assert.equal(rows.length, 8, `${n}: eight rows`);
    for (const row of rows) assert.match(row, /^[.a-z]{8}$/, `${n}: eight pixels in a row`);
    const used = new Set(rows.join('').replace(/\./g, '').split(''));
    assert.ok(used.size > 0, `${n}: something is drawn`);
    for (const ch of used) assert.match(pal[ch] || '', /^#[0-9a-f]{6}$/, `${n}: "${ch}" is a colour`);
    assert.ok(used.size <= 6, `${n}: ${used.size} colours`);
    for (const ch of Object.keys(pal)) assert.ok(used.has(ch), `${n}: its colour "${ch}" is used`);
  }
});

test('an icon has its edge round it, and the pixels that touch the picture are all there is', () => {
  const r = icons();
  const px = plain(r, "iconPixels(ICON.coin)"), edge = plain(r, 'ICON_EDGE');
  assert.ok(px.every(p => p.x >= 0 && p.x < 10 && p.y >= 0 && p.y < 10), 'on a ten by ten square');
  const drawn = new Set(px.filter(p => p.c !== edge).map(p => p.x + ',' + p.y));
  assert.ok(drawn.size > 20, 'the picture itself');
  for (const p of px.filter(q => q.c === edge)) {
    assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => drawn.has((p.x + dx) + ',' + (p.y + dy))), `the edge pixel ${p.x},${p.y} touches the picture`);
  }
  for (const k of drawn) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (x + dx) + ',' + (y + dy);
      assert.ok(drawn.has(n) || px.some(p => p.x === x + dx && p.y === y + dy), `${k} has an edge or a neighbour beside it`);
    }
  }
});

test('the icons are held in one sprite, and ic() points at it: a page of a hundred icons carries no hundred drawings', () => {
  const r = icons(), names = plain(r, 'Object.keys(ICON)'), sprite = r('iconSprite()');
  assert.equal((sprite.match(/<symbol /g) || []).length, names.length, 'a symbol for each icon');
  for (const n of names) assert.ok(sprite.includes(`<symbol id="i-${n}" viewBox="0 0 10 10">`), `${n} is in the sprite`);
  const quiet = r("ic('coin')"), said = r("ic('coin', 'Thalers')");
  assert.ok(quiet.includes('<use href="#i-coin"/>') && quiet.includes('aria-hidden="true"') && !quiet.includes('role='), 'decorative unless it is given a word');
  assert.ok(said.includes('role="img"') && said.includes('aria-label="Thalers"') && !said.includes('aria-hidden'), 'a labelled icon is a picture to a reader');
  assert.ok(quiet.length < 120, 'and a use of it is short');
});

test('the sprite is put in the page once, where there is a page, and the stylesheet draws icons at whole pixels', () => {
  const p = page();
  const holders = p.body.children.filter(c => c.id === 'icons');
  assert.equal(holders.length, 1, 'one holder for the sprite');
  assert.ok(holders[0].innerHTML.includes('<symbol id="i-coin"'), 'with the icons in it');
  assert.ok(/\.i \{[^}]*width: 20px; height: 20px/.test(css), 'an icon is 20 pixels: two to each of its ten');
  assert.ok(/shape-rendering: crispEdges/.test(css), 'and is not smoothed');
});

/* ---------- the markup the stylesheet is written for ---------- */
const screens = () => load(['core', 'journey', 'command', 'geo', 'art', 'figures', 'terrain', 'icons', 'screens']);

test('a card carries its kind after its own classes, so that the rule under its name has a colour', () => {
  const r = screens();
  const card = r("cardHTML({ cls: 'soldier', title: 'Ostap', type: { look: 'madder', text: 'Sabreur', coin: 8, coinLabel: 'Wage', lvl: 'II' } })");
  assert.ok(card.startsWith('<article class="card soldier k-madder"'), card.slice(0, 60));
  assert.ok(card.includes('<span class="coin" title="Wage"><svg class="i"') && card.includes('<use href="#i-coin"/>'), 'a price has its coin');
  assert.ok(/class="type [a-z ]*levelled/.test(card) && card.includes('<span class="lvl" title="Level">II'), 'a level is in the foot, for the stylesheet to lift to the top of the card');
  const plain_ = r("cardHTML({ title: 'T' })");
  assert.ok(!/ k-/.test(plain_), 'a card with no foot has no kind');
  const nation = r("cardHTML({ cls: 'cxnation', title: 'Polish', type: { look: 'nation', style: '--n:#8f3328;--nt:#f4edd6', text: 'Pikemen' } })");
  assert.ok(nation.startsWith('<article class="card cxnation k-nation" style="--n:#8f3328;--nt:#f4edd6"'), 'a nation lends its colours to the card as well as to its foot');
  assert.ok(nation.includes('<span class="type nation" style="--n:#8f3328;--nt:#f4edd6">'), 'and the foot keeps them');
});

test('a meter says its fill as a percentage the stylesheet can round to a whole segment', () => {
  const r = screens();
  assert.equal(r("meter('hp', 30, 60)"), '<span class="meter hp"><i style="--v:50"></i></span>');
  assert.equal(r("meter('mo', 99, 100)"), '<span class="meter mo"><i style="--v:99"></i></span>');
  assert.ok(/\.meter i \{[^}]*width: calc\(var\(--v, 0\) \* 1%\)/.test(css), 'a width from --v');
  assert.ok(/@supports \(width: round\(nearest[^)]*\)[^{]*\{[^}]*round\(nearest, calc\(var\(--v, 0\) \* 1%\), 8px\)/.test(css), 'and, where the browser can, a whole number of segments');
});

/* ---------- the stylesheet ---------- */
const tokens = (() => { const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root'))); return Object.fromEntries([...root.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()])); })();
// custom properties the page sets as it draws (see the styles built in src/screens.ts and src/encyclopedia.ts), and ones a rule sets for the things inside it
const SET_ELSEWHERE = new Set(['n', 'nt', 'bar-h', 'v', 'rule']);

test('every colour and type token the stylesheet uses is one it defines', () => {
  const used = new Set([...css.matchAll(/var\(--([a-z0-9-]+)/g)].map(m => m[1]));
  const defined = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m => m[1]));
  for (const u of used) assert.ok(defined.has(u) || SET_ELSEWHERE.has(u), `--${u} is used and never defined`);
  const hex = h => h.replace('#', '');
  for (const [k, v] of Object.entries(tokens)) if (/^#/.test(v)) assert.match(hex(v), /^[0-9a-f]{6}$/i, `--${k} is a colour`);
});

const luma = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = luma(tokens[a]), y = luma(tokens[b]); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test('type on its ground can be read: the pairs the stylesheet sets are at 4.5 to 1 or better', () => {
  // [ink, ground, where]
  const pairs = [
    ['b4', 's3', 'text on a plaque'], ['b5', 's3', 'a name on a plaque'], ['b3', 's3', 'a line of a plaque'], ['b2', 's3', 'the small print of a plaque'], ['b2', 's2', 'the date in the bar'], ['b2', 's1', 'a note on the table'],
    ['br4', 's3', 'a trait or a heading'], ['br5', 's3', 'a bronze figure'], ['br5', 's1', 'the wordmark'], ['md5', 's3', 'the price there'], ['md6', 's1', 'a warning on the table'], ['md6', 's3', 'a warning on a plaque'],
    ['s0', 'br3', 'a price, a chosen button'], ['s2', 'br3', 'the small print of a chosen button'], ['b5', 'md3', 'a primary button'], ['b4', 'md3', 'what a cost says'], ['b4', 'wd3', 'what a gain says'], ['b5', 'ms3', 'a hired man'],
    ['s1', 'p3', 'ink on a notice'], ['s3', 'p3', 'the small print of a notice'], ['s4', 'p3', 'a date on the chronicle'], ['s5', 'p3', 'what a road lacks'], ['md2', 'p3', 'danger on a notice'], ['s1', 'p4', 'a level on its square'], ['s2', 'p4', 'ink on a stamp']
  ];
  for (const [ink, ground, where] of pairs) assert.ok(contrast(ink, ground) >= 4.5, `${where}: --${ink} on --${ground} is ${contrast(ink, ground).toFixed(2)}`);
});

// the pieces of a declaration's value, split where the commas are not inside brackets
const parts = v => { const out = []; let d = 0, cur = ''; for (const ch of v) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; };

test('this is a pixel game: nothing is rounded, no shadow is blurred, no gradient is soft where it is a meter', () => {
  const sheet = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("[^"]*"\)/g, 'url()');
  for (const m of sheet.matchAll(/border-radius:\s*([^;}]+)/g)) assert.equal(m[1].trim(), '0', `border-radius: ${m[1]}`);
  for (const m of sheet.matchAll(/(box-shadow|text-shadow):\s*([^;}]+)/g)) {
    if (m[2].trim() === 'none') continue;
    for (const s of parts(m[2])) {
      const nums = s.replace(/^inset\s+/, '').replace(/var\([^)]*\)|#[0-9a-f]{3,8}|currentColor|rgba?\([^)]*\)/gi, '').trim().split(/\s+/).filter(Boolean);
      assert.ok(nums.length >= 2 && nums.length <= 4, `${m[1]}: ${s}`);
      if (nums.length >= 3) assert.equal(parseFloat(nums[2]), 0, `${m[1]} is blurred: ${s}`);
    }
  }
  assert.ok(!/drop-shadow|backdrop-filter|blur\(/.test(sheet), 'no soft effects');
});

test('the fonts the stylesheet names are the ones the page loads', () => {
  const link = decodeURIComponent((html.match(/fonts\.googleapis\.com\/css2\?([^"]+)"/) || [])[1] || '').replace(/\+/g, ' ');
  for (const k of ['display', 'caps', 'body', 'num']) {
    const first = (tokens[k].match(/'([^']+)'/) || [])[1];
    assert.ok(first && link.includes('family=' + first), `--${k} starts with ${first}, which the page loads`);
  }
});

test('the colours of the stylesheet are the ramps the pictures are painted from', () => {
  const r = load(['core', 'journey', 'command', 'geo', 'art']), ramps = plain(r, 'RAMPS');
  const NAMES = { s: 'soot', b: 'bone', p: 'paper', br: 'bronze', md: 'madder', wd: 'woad', ms: 'moss', oc: 'ochre', ir: 'iron' };
  let checked = 0;
  for (const [k, v] of Object.entries(tokens)) {
    const m = /^(s|b|p|br|md|wd|ms|oc|ir)(\d)$/.exec(k);
    if (!m) continue;
    const step = ramps[NAMES[m[1]]][+m[2]];
    assert.equal(v.toLowerCase(), step.toLowerCase(), `--${k} is ${v}, and ${NAMES[m[1]]} ${m[2]} is ${step}`);
    checked++;
  }
  assert.ok(checked >= 50, 'most of the ramps are tokens');
  // and the dyes of the figures are steps of them too
  const dyes = new Set(Object.values(ramps).flat().map(h => h.toLowerCase()));
  for (const skin of ['own', 'tatar', 'croat', 'muscovite', 'swede', 'raider', 'champion']) {
    const { coat } = plain(r, `SKINS.${skin}`);
    assert.ok(dyes.has(coat.toLowerCase()), `the coat of ${skin} (${coat}) is a dye of the ramps`);
  }
  for (const id of ['cossack', 'pole', 'german', 'swede', 'scot', 'magyar']) {
    const r2 = load(['core', 'journey', 'command', 'geo', 'art', 'figures']);
    const coat = plain(r2, `NATIONS.${id}.coat`);
    assert.ok(dyes.has(coat.toLowerCase()), `the coat of the ${id} (${coat}) is a dye of the ramps`);
  }
});
