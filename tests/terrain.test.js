'use strict';
/* The terrain, run headless: the backdrops of the lands, drawn by the same scripts the page loads onto a canvas that records what is painted.
 * That is enough to check that each land has a picture of its own in every weather, that a piece of work puts its fight where it names, that
 * the camp and the cards take their scenery from the land, and that the rules of the weather the page quotes are the ones the battle plays
 * by. How the scenery looks is for the eye (docs/lands.html); nothing here judges a colour. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./canvas-stub');

const game = () => load(['core', 'journey', 'geo', 'art', 'figures', 'terrain']);
const LANDS = ['steppe', 'ukraine', 'poland', 'prussia', 'lithuania', 'front', 'silesia', 'saxony'], WEATHER = ['clear', 'rain', 'fog'];
const pic = (r, seed, weather, setting) => r(`makeBackdrop(${seed}, '${weather}', ${JSON.stringify(setting)}).toDataURL()`);

test('every land is drawn in every weather, each differently, and the same each time', () => {
  const r = game(), seen = new Set();
  assert.deepEqual(plain(r, 'Object.keys(LAND_ART)').sort(), [...LANDS].sort(), 'a drawing for each land of the game');
  assert.deepEqual(plain(r, 'Object.keys(TONES)').sort(), [...LANDS].sort(), 'and colours');
  for (const land of LANDS) for (const w of WEATHER) {
    const a = pic(r, 7, w, { land }), b = pic(r, 7, w, { land });
    assert.equal(a, b, `${land} in ${w} is drawn the same each time`);
    assert.ok(+a.split('-').pop() > 1500, `${land} in ${w}: more than a few rectangles`);
    assert.ok(!seen.has(a), `${land} in ${w} looks like another picture`); seen.add(a);
  }
  assert.notEqual(pic(r, 1, 'clear', { land: 'poland' }), pic(r, 2, 'clear', { land: 'poland' }), 'another seed, another picture of the same land');
});

test('the picture is as fine as the figures, W by H of them', () => {
  const r = game();
  assert.deepEqual(plain(r, "(() => { const c = makeBackdrop(3, 'clear', { land: 'saxony' }); return [c.width, c.height, SS]; })()"), [600, 248, 2]);
  assert.deepEqual(plain(r, "(() => { const c = makeBackdrop(3, 'clear', { land: 'saxony' }, { width: 640, sky: false }); return [c.width, c.height]; })()"), [640, 248]);
  assert.notEqual(pic(r, 3, 'clear', { land: 'saxony' }), r("makeBackdrop(3, 'clear', { land: 'saxony' }, { width: 600, sky: false }).toDataURL()"), 'without its sky it is another picture');
});

test('a site is drawn over its land, and says where along the picture it stands', () => {
  const r = game(), sites = plain(r, 'Object.keys(SITE_ART)');
  assert.equal(sites.length, 14);
  for (const site of sites) {
    const land = LANDS[sites.indexOf(site) % LANDS.length], bare = pic(r, 5, 'clear', { land }), with_ = pic(r, 5, 'clear', { land, site });
    assert.notEqual(bare, with_, `${site} in ${land} changes the picture`);
    const x = plain(r, `makeBackdrop(5, 'clear', { land: '${land}', site: '${site}' }).siteX`);
    assert.ok(x >= 0 && x <= 600, `${site}: stands at ${x}`);
  }
});

test('every piece of work names its site, or is fought in the open', () => {
  const r = game(), of = plain(r, 'SITE_OF'), sites = new Set(plain(r, 'Object.keys(SITE_ART)'));
  const tpls = plain(r, 'TEMPLATES.map(t => t.id)'), ambushes = plain(r, 'Object.keys(AMBUSHES)');
  for (const [tpl, site] of Object.entries(of)) {
    assert.ok(sites.has(site), `${tpl}: ${site} is a site`);
    assert.ok(tpls.includes(tpl) || ambushes.includes(tpl) || tpl === 'final', `${tpl} is a piece of work`);
  }
  for (const t of tpls) assert.ok(of[t], `the contract ${t} names its site`);
  assert.deepEqual(ambushes.filter(a => !of[a]).sort(), ['croats', 'muscovites', 'tatars'], 'the ambushes fought in the open are the horse and the steppe raiders and the streltsy');
  for (const site of sites) assert.ok(Object.values(of).includes(site), `${site} is used by some work`);
});

test('a fight is where its contract says, and a contract saved before they said falls back on where the company stands', () => {
  const r = game();
  r("G = newGame('salt'); ui = { c: null };");
  for (const at of ['syvash', 'kyiv', 'krakow', 'danzig', 'vilnius', 'smolensk', 'breslau', 'leipzig']) {
    r(`G.at = '${at}'`);
    const here = r('here(G).land');
    assert.equal(r("makeContract(G, TEMPLATES[0], 'fair').land"), here, `a contract posted at ${at}`);
    assert.equal(r('makeDuel(G).land'), here, `a duel at ${at}`);
    assert.equal(r("settingOf(G, Object.assign(makeContract(G, TEMPLATES[2], 'fair'), { land: undefined })).land"), here, `an old contract at ${at}`);
  }
  for (const land of LANDS) assert.equal(r(`makeAmbush(G, '${land}', 'x').land`), land, `an ambush in ${land}`);
  assert.equal(r("settingOf(G, makeContract(G, TEMPLATES.find(t => t.id === 'ford'), 'fair')).site"), 'ford');
  assert.equal(r("settingOf(G, Object.assign(makeAmbush(G, 'ukraine', 'x'), { tpl: 'masterless' })).site"), 'ravine', 'an ambush in a ravine');
  assert.equal(r("settingOf(G, Object.assign(makeAmbush(G, 'steppe', 'x'), { tpl: 'tatars' })).site === undefined"), true, 'raiders on the steppe are met in the open');
});

test('the camp and the cards take their scenery from the land', () => {
  const r = game(), sky = LANDS.map(l => r(`skylineOf('${l}', 1, 320).toDataURL()`));
  assert.equal(new Set(sky).size, LANDS.length, 'a night skyline for each land');
  const card = LANDS.map(l => r(`artURL('t-' + '${l}', 48, 36, (g, W, H) => landscape(g, W, H, 2, '${l}'))`));
  assert.equal(new Set(card).size, LANDS.length, 'a card landscape for each land');
  const sited = r("artURL('t-site', 72, 36, (g, W, H) => landscape(g, W, H, 2, 'poland', 'ford'))"), bare = r("artURL('t-bare', 72, 36, (g, W, H) => landscape(g, W, H, 2, 'poland'))");
  assert.notEqual(sited, bare, 'a card that shows a site is not the bare land');
  r("G = newGame('salt');");
  const here = r('here(G).land'), other = LANDS.find(l => l !== here);
  assert.notEqual(r(`soldierArt(G.roster[0], undefined, '${here}')`), r(`soldierArt(G.roster[0], undefined, '${other}')`), 'a man stands in the land he is in');
  const a = r("(() => { const c = makeAmbush(G, 'silesia', 'x'); return foesArt(c); })()"), b = r("(() => { const c = makeAmbush(G, 'steppe', 'x'); c.id = G.roster[0].id + 999; return foesArt(c); })()");
  assert.notEqual(a, b, 'the foes of an ambush are met in the land of the road');
});

test('the rules of the weather the page quotes are those the battle plays by', () => {
  const r = game(), [odds, misfire, range] = plain(r, '[WEATHER_ODDS, MISFIRE, MUSKET_RANGE]');
  assert.ok(Math.abs(odds.clear + odds.rain + odds.fog - 1) < 1e-9, 'the odds of the days add up');
  for (const w of WEATHER) {
    assert.equal(plain(r, `makeBattle([], [], { weather: '${w}' }).range`), range[w], `${w}: the range of a musket`);
    assert.ok(misfire[w] >= 0 && misfire[w] < 1);
  }
  assert.ok(misfire.rain > misfire.clear && range.fog < range.clear, 'rain wets the powder and fog shortens the shot');
  // the weather is dealt by the odds
  let n = { clear: 0, rain: 0, fog: 0 };
  for (let i = 0; i < 4000; i++) n[r('rollWeather()')]++;
  for (const w of WEATHER) assert.ok(Math.abs(n[w] / 4000 - odds[w]) < 0.04, `${w} turns up about as often as it should (${n[w]} of 4000)`);
});
