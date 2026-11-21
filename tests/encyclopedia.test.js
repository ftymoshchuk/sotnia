'use strict';
/* The encyclopedia, run headless: the same js files the page loads, in a VM context whose canvas is a recorder, so that the
 * pages it builds can be read as text and its pictures told apart. The encyclopedia is made from the game's own tables, so what
 * these check is that nothing in them is left out of it, that its words and numbers are the game's, that its pictures differ
 * where the things they show differ, and that small type on the colours of a nation can be read. How the pages look is for the
 * eye (docs/figures.html and the browser); the way in and out of them is the browser's too. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./canvas-stub');

const book = () => load(['core', 'journey', 'geo', 'art', 'figures', 'terrain', 'icons', 'screens', 'encyclopedia']);
const TABS = ['nations', 'units', 'foes', 'lands', 'goods'];
const page = (r, tab) => { r(`ui.codex = ${JSON.stringify(tab)}`); return r('codexHTML()'); };
// what a reader sees of a page: its words, one space apart
const words = html => html.replace(/<[^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const cards = (html, kind) => html.split('<article class="card ' + kind).slice(1);
const pictures = html => [...html.matchAll(/<img src="(data:[^"]*)"/g)].map(m => m[1]);
const num = n => String(+n.toFixed(2));

test('every nation of the company has a card, with its lands, its classes, its names and its colours', () => {
  const r = book(), html = page(r, 'nations'), text = words(html);
  const origins = plain(r, 'ORIGINS.map(o => ({ id: o.id, label: o.label, cls: o.cls, first: o.first, last: o.last, coat: NATIONS[o.id].coat, lands: Object.keys(LANDS).filter(l => LANDS[l].origins.includes(o.id)).map(l => LANDS[l].name) }))');
  assert.ok(origins.length >= 8);
  assert.equal(cards(html, 'cxnation').length, origins.length, 'a card for each nation, no more');
  for (const o of origins) {
    assert.ok(text.includes(o.label), `${o.label} is named`);
    assert.ok(o.lands.length > 0, `${o.label} signs on somewhere`);
    for (const l of o.lands) assert.ok(text.includes(l), `${o.label} signs on in ${l}`);
    for (const c of new Set(o.cls)) assert.ok(text.includes(plain(r, `CLS.${c}.name`)), `${o.label} fields ${c}`);
    assert.ok(text.includes(o.first[0] + ' ' + o.last[0]), `${o.label}: a sample name`);
    assert.ok(html.includes('background:' + o.coat), `${o.label}: its coat is a swatch`);
    assert.ok(html.includes('class="flag"') || html.includes('class="flag '), 'the flags are shown');
  }
});

test('the nations are named in the plural as people are: pikemen, not pikemans', () => {
  const r = book();
  for (const tab of TABS) assert.ok(!/pikemans|\bmans\b/i.test(words(page(r, tab))), tab);
  assert.ok(words(page(r, 'nations')).includes('pikemen'));
});

test('the Units tab has each class, each nation that fields it, and every weapon, armour and trait', () => {
  const r = book(), html = page(r, 'units'), text = words(html);
  const [origins, cls, gear] = [plain(r, 'ORIGINS.map(o => ({ label: o.label, cls: o.cls }))'), plain(r, 'CLS'), plain(r, '({ WPN, ARM, GEAR_COST, WPN_BLOW, WPN_BALL, ARM_PLATE, BALL_DMG })')];
  const pairs = origins.flatMap(o => [...new Set(o.cls)].map(c => [o, c]));
  assert.equal(cards(html, 'cxunit').length, pairs.length, 'a card for each nation and class');
  assert.equal(cards(html, 'cxclass').length, 3 + 2, 'a card for each class, one for the armour, one for the traits');
  for (const [o, c] of pairs) assert.ok(text.includes(`${o.label} ${cls[c].name}`), `${o.label} ${c}`);
  for (const c of Object.keys(cls)) {
    const k = cls[c];
    assert.ok(text.includes(`${k.reach} reach`), `${c} reach`);
    assert.ok(text.includes(c === 'shot' ? `${gear.BALL_DMG[0]}–${gear.BALL_DMG[1]} a ball` : `${k.dmg[0]}–${k.dmg[1]} a blow`), `${c} damage`);
    assert.ok(text.includes(`${k.cd} s between blows`), `${c} time between blows`);
    assert.ok(text.includes(`${k.arm} armour`), `${c} armour`);
    gear.WPN[c].forEach((w, i) => {
      assert.ok(text.includes(w), `${c} weapon ${w}`);
      assert.ok(text.includes(c === 'shot' ? (i ? `+${gear.WPN_BALL * i} to a ball, +${gear.WPN_BLOW * i} to a blow with the butt` : 'The old way') : (i ? `+${gear.WPN_BLOW * i} to a blow` : 'What a man starts with')), `${w}: what it does`);
    });
  }
  gear.ARM.forEach((a, i) => {
    assert.ok(text.includes(a), `armour ${a}`);
    if (i) assert.ok(text.includes(`−${num(gear.ARM_PLATE * i)} from a blow, −${num(gear.ARM_PLATE * i / 2)} from a ball`), `${a}: what it does`);
  });
  gear.GEAR_COST.forEach(c => assert.ok(new RegExp(`\\b${c}\\b`).test(text), `a level costs ${c}`));
  for (const [k, t] of Object.entries(plain(r, 'TRAITS'))) assert.ok(text.includes(k) && text.includes(t.desc), `trait ${k}`);
});

test('what the Units tab says of armour is what the rules do: each level takes ARM_PLATE more off a blow', () => {
  const r = book();
  const plate = plain(r, 'ARM_PLATE');
  for (const c of ['pike', 'shot', 'sabre']) {
    const men = [0, 1, 2, 3].map(a => plain(r, `toUnit({ cls: '${c}', arm: ${a}, wpn: 0, vig: 50, hp: 50, mel: 8, aim: 0, grd: 5, morale: 50 }, 0, 1).armv`));
    men.forEach((v, a) => assert.equal(v, men[0] + plate * a, `${c} in armour level ${a}`));
  }
});

test('each unit card has a picture of its own, and the nations of a class are told apart', () => {
  const r = book(), html = page(r, 'units');
  const unit = cards(html, 'cxunit').map(c => pictures(c)[0]);
  assert.ok(unit.every(p => p && /-\d+$/.test(p) && +p.split('-').pop() > 100), 'each is painted: more than a few rectangles');
  assert.equal(new Set(unit).size, unit.length, 'no two nations share a picture');
  assert.equal(cards(html, 'cxclass').filter(c => pictures(c).length).length, 4, 'the three classes and the armour are pictured; the traits are words');
  const nations = pictures(page(r, 'nations'));
  assert.equal(new Set(nations).size, nations.length, 'the nations page: all different');
  assert.ok(!nations.some(p => unit.includes(p)), 'a nation, and a unit of it, are not the same picture');
});

test('the Foes tab has every people the game can send against the company, where they are met, and every degree of drill', () => {
  const r = book(), html = page(r, 'foes'), text = words(html);
  const peoples = plain(r, 'Object.keys(FOE_TEXT).map(k => ({ k, name: FOE_TEXT[k].name }))');
  const used = plain(r, "[...new Set([...Object.values(AMBUSHES).map(a => a.skin), ...TEMPLATES.map(t => t.skin)].filter(s => s && s !== 'own'))]");
  for (const s of used) assert.ok(peoples.some(p => p.k === s), `${s} is met in the game and has a card`);
  assert.equal(cards(html, 'cxfoe').length, peoples.length);
  for (const p of peoples) assert.ok(text.includes(p.name), p.name);
  for (const l of plain(r, 'Object.values(AMBUSHES).map(a => a.skin && Object.keys(LANDS).filter(id => LANDS[id].ambush.some(x => AMBUSHES[x] === a)).map(id => LANDS[id].name)).flat()')) assert.ok(text.includes(l), `a train is waylaid in ${l}`);
  for (const t of plain(r, 'TEMPLATES.map(t => t.title)')) assert.ok(text.includes(t), `hired against in “${t}”`);
  plain(r, 'TIER').forEach((t, i) => {
    assert.ok(text.includes(t[0].toUpperCase() + t.slice(1)), `drill: ${t}`);
    assert.ok(text.includes(Math.round(100 * plain(r, `TVIG[${i}]`)) + '%'), `${t}: its vigour`);
  });
  assert.equal(cards(html, 'cxtier').length, plain(r, 'TIER.length'));
  const folk = cards(html, 'cxfoe').map(c => pictures(c)[0]), drill = cards(html, 'cxtier').map(c => pictures(c)[0]);
  assert.equal(new Set(folk).size, folk.length, 'every people has a picture of its own');
  // the men of the field are drawn from their degree of drill by the arms and armour it gives them (tier 0 and tier 1 give the same), and so are these
  assert.equal(new Set(drill).size, new Set(plain(r, 'TIER.map((_, t) => Math.max(0, t - 1))')).size, 'the degrees are told apart as far as the field tells them apart');
});

test('the Train and goods tab has every hand, both supplies and every commission, none of them to be started from here', () => {
  const r = book(), html = page(r, 'goods'), text = words(html);
  for (const [k, s] of Object.entries(plain(r, 'STAFF'))) {
    assert.ok(text.includes(s.name), `${k}: ${s.name}`);
    assert.ok(text.includes(`+${s.wage} a month`), `${s.name}: wage`);
    assert.ok(html.includes(`>${s.fee}</span>`) || new RegExp(`\\b${s.fee}\\b`).test(text), `${s.name}: fee`);
  }
  const [bread, powder] = plain(r, '[BREAD_COST, POWDER_COST]');
  for (const w of ['Bread', 'Powder', 'Each man eats one a day', 'One charge a shot']) assert.ok(text.includes(w), w);
  assert.ok(new RegExp(`\\b${bread}\\b`).test(text) && new RegExp(`\\b${powder}\\b`).test(text), 'the prices of ten');
  for (const q of plain(r, 'QUESTS')) assert.ok(text.includes(q.title), q.title);
  assert.ok(!html.includes('data-act="new"'), 'a commission can be raised only from the title');
  assert.ok(html.includes('class="pile"'), 'the supplies are in their piles, as in the market');
});

test('no page shows undefined, NaN, null or a stray object, and each tab opens its own page', () => {
  const r = book();
  const seen = TABS.map(t => { const h = page(r, t); assert.ok(!/undefined|NaN|\[object|\bnull\b/.test(words(h)), t); return h; });
  assert.equal(new Set(seen).size, TABS.length, 'a different page for each tab');
  TABS.forEach((t, i) => {
    const sel = [...seen[i].matchAll(/data-k="(\w+)" aria-selected="true"/g)].map(m => m[1]);
    assert.deepEqual(sel, [t], `${t} is the one tab selected`);
  });
  assert.deepEqual(plain(r, 'CODEX_TABS.map(t => t[0])'), TABS, 'the tabs, as the address of a page names them');
});

test('every screen the encyclopedia is opened from has its way back worded, and the tool is on every screen but the battle', () => {
  const r = book();
  const back = plain(r, 'BACK_WORD');
  for (const s of ['title', 'camp', 'muster', 'report', 'end']) {
    assert.ok(back[s], s);
    r(`ui.codex = 'nations'; ui.codexFrom = '${s}'`);
    assert.ok(words(r('codexHTML()')).includes(back[s]), `back from ${s}`);
  }
  for (const [screen, shown] of [['title', true], ['camp', true], ['muster', true], ['report', true], ['end', true], ['battle', false], ['codex', false]]) {
    r(`ui.screen = '${screen}'`);
    assert.equal(r('toolsHTML()').includes('data-act="codex"'), shown, `the tool on the ${screen} screen`);
  }
  r("ui.screen = 'title'");
  assert.ok(r('titleHTML()').includes('data-act="codex"'), 'the title offers it');
});

test('a bar in the colour of a nation, or of a people, can be read: its ink has contrast of 4.5 against it', () => {
  const r = book();
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const luma = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
  const contrast = (a, b) => { const x = luma(a), y = luma(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const coats = plain(r, "[...ORIGINS.map(o => NATIONS[o.id].coat), ...Object.keys(FOE_TEXT).map(k => SKINS[k].coat)]");
  assert.ok(coats.length >= 18);
  const html = page(r, 'nations') + page(r, 'foes');
  for (const coat of coats) {
    const b = plain(r, `cxBar('${coat}')`);
    assert.ok(contrast(b.bg, b.fg) >= 4.5, `${coat} is shown as ${b.bg} with ${b.fg}: ${contrast(b.bg, b.fg).toFixed(2)}`);
    // it is the colour itself where that reads, and where it does not, the nearest shade of it: no further than a half of the way to black or white
    const [x, y] = [coat, b.bg].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
    assert.ok(x.every((v, i) => Math.abs(v - y[i]) <= 0.5 * Math.max(v, 255 - v)), `${coat} is kept near itself in ${b.bg}`);
    assert.ok(html.includes(`--n:${b.bg};--nt:${b.fg}`), `${coat} is used as ${b.bg}`);
  }
});

test('the Lands tab has every land with its places, its men, its dangers and its work, the three weathers, and every site', () => {
  const r = book(), html = page(r, 'lands'), text = words(html), lower = text.toLowerCase();
  const lands = plain(r, `Object.keys(LANDS).map(id => ({ id, name: LANDS[id].name, danger: LANDS[id].danger, foes: LANDS[id].ambush.map(a => AMBUSHES[a].foe), men: LANDS[id].origins.map(o => ORIGINS.find(x => x.id === o).label),
    major: Object.keys(PLACES).filter(p => PLACES[p].land === id && PLACES[p].major).map(p => PLACES[p].name), work: TEMPLATES.filter(t => t.lands && t.lands.includes(id)).map(t => t.title) }))`);
  assert.equal(cards(html, 'cxland').length, lands.length, 'a card for each land');
  for (const l of lands) {
    assert.ok(lower.includes(l.name.toLowerCase()), l.name);
    for (const p of l.major) assert.ok(lower.includes(p.toLowerCase()), `${l.name}: ${p}`);
    for (const f of l.foes) assert.ok(text.includes(f), `${l.name}: waylaid by ${f}`);
    for (const m of l.men) assert.ok(text.includes(m), `${l.name}: ${m} sign on`);
    for (const w of l.work) assert.ok(text.includes(w), `${l.name}: work ${w}`);
    assert.ok(text.includes(plain(r, `DANGER[${l.danger}]`)), `${l.name}: danger`);
  }
  const [odds, misfire, range] = plain(r, '[WEATHER_ODDS, MISFIRE, MUSKET_RANGE]');
  assert.equal(cards(html, 'cxweather').length, 3);
  for (const w of ['clear', 'rain', 'fog']) {
    assert.ok(text.includes(`${Math.round(100 * odds[w])} days in a hundred`), `${w}: how often`);
    assert.ok(text.includes(`misfires ${Math.round(100 * misfire[w])} times in a hundred`), `${w}: misfires`);
    assert.ok(text.includes(`carries ${range[w]} paces`), `${w}: range`);
  }
  const sites = plain(r, 'Object.keys(SITE_TEXT)');
  assert.deepEqual([...sites].sort(), plain(r, 'Object.keys(SITE_ART)').sort(), 'every site that is drawn is described');
  assert.equal(cards(html, 'cxsite').length, sites.length, 'a card for each site');
  for (const id of sites) assert.ok(text.includes(plain(r, `SITE_TEXT.${id}.name`)), id);
  // every piece of work that names a site is on the card of that site
  for (const [tpl, site] of Object.entries(plain(r, 'SITE_OF'))) {
    const title = tpl === 'final' ? 'The Black Regiment at the ford' : plain(r, `(TEMPLATES.find(t => t.id === '${tpl}') || AMBUSHES['${tpl}']).title`);
    assert.ok(cards(html, 'cxsite').find(c => words(c).includes(plain(r, `SITE_TEXT.${site}.name`))).includes(title.replace(/&/g, '&amp;')) || words(cards(html, 'cxsite').find(c => words(c).includes(plain(r, `SITE_TEXT.${site}.name`)))).includes(title), `${tpl} at ${site}`);
  }
});

test('the pictures of the Lands tab differ: each land, each weather, each site', () => {
  const r = book(), html = page(r, 'lands');
  const land = cards(html, 'cxland').map(c => pictures(c)[0]), wx = cards(html, 'cxweather').map(c => pictures(c)[0]), site = cards(html, 'cxsite').map(c => pictures(c)[0]);
  for (const [name, set] of [['lands', land], ['weathers', wx], ['sites', site]]) { assert.ok(set.every(Boolean), name + ' have pictures'); assert.equal(new Set(set).size, set.length, `no two ${name} share a picture`); }
  assert.ok(!wx.slice(1).some(p => land.includes(p)), 'a rainy day or a foggy one is not a clear day in a land');
});

test('a nation is shown in a land of its own and a people in its home country, and the way the lands are listed does not run on over an "and"', () => {
  const r = book();
  assert.deepEqual(Object.keys(plain(r, 'NATION_HOME')).sort(), plain(r, 'ORIGINS.map(o => o.id)').sort());
  assert.deepEqual(Object.keys(plain(r, 'FOE_HOME')).sort(), Object.keys(plain(r, 'FOE_TEXT')).sort());
  assert.equal(r("cxList(['Silesia', 'Saxony and Lusatia'])"), 'Silesia; Saxony and Lusatia');
  assert.equal(r("cxList(['a', 'b', 'c'])"), 'a, b and c');
});
