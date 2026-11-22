'use strict';
/* The terrain, run headless: the backdrops of the lands, drawn by the same scripts the page loads onto a canvas that records what is painted.
 * That is enough to check that each land has a picture of its own in every weather, that a piece of work puts its fight where it names, that
 * the camp and the cards take their scenery from the land, and that the rules of the weather the page quotes are the ones the battle plays
 * by. How the scenery looks is for the eye (docs/lands.html). What it is made of is checked, from the colours its canvas is told to paint with:
 * that every one is a step of the master palette, that the light is as the weather and the moon make it, and that the ground the men stand on is
 * mid-value, so that they read on it. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./canvas-stub');

const game = () => load(['core', 'journey', 'command', 'geo', 'art', 'figures', 'terrain']);
const LANDS = ['steppe', 'ukraine', 'poland', 'prussia', 'lithuania', 'front', 'silesia', 'saxony'], WEATHER = ['clear', 'rain', 'fog'];
const pic = (r, seed, weather, setting) => r(`makeBackdrop(${seed}, '${weather}', ${JSON.stringify(setting)}).toDataURL()`);

test('every land is drawn in every weather, each differently, and the same each time', () => {
  const r = game(), seen = new Set();
  assert.deepEqual(plain(r, 'Object.keys(LAND_ART)').sort(), [...LANDS].sort(), 'a drawing for each land of the game');
  assert.deepEqual(plain(r, 'Object.keys(TONES)').sort(), [...LANDS].sort(), 'and colours');
  for (const land of LANDS) for (const w of WEATHER) {
    const a = pic(r, 7, w, { land }), b = pic(r, 7, w, { land });
    assert.equal(a, b, `${land} in ${w} is drawn the same each time`);
    const rects = +a.split('-').pop();
    assert.ok(rects > 1500, `${land} in ${w}: more than a few rectangles`);
    assert.ok(rects < 30000, `${land} in ${w}: ${rects} rectangles is a picture made of pixels, not of runs (dither with a pattern, or in runs)`);
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
    const land = LANDS[sites.indexOf(site) % LANDS.length], bare = pic(r, 5, 'clear', { land });
    const [with_, x] = plain(r, `(() => { const c = makeBackdrop(5, 'clear', { land: '${land}', site: '${site}' }); return [c.toDataURL(), c.siteX]; })()`);
    assert.notEqual(bare, with_, `${site} in ${land} changes the picture`);
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

/* ---------- what the pictures are made of ---------- */
/**
 * Runs a drawing on a page of canvases that remember what they are told to paint with, in place of the recording ones, and returns what they took: every
 * colour set as a fill (a pattern's tile counts for its own colours), the patterns made, and the mean brightness (0 to 255) of what was painted in the rows
 * the men stand in, FY to FY + BD of the scene, a pattern counting as the mean of its tile and a stipple, which lays itself over what is there, not at all.
 */
function inspect(r, draw) {
  r(`
    globalThis.__seen = { colours: new Set(), sum: 0, area: 0, dithers: 0 };
    landPatterns.clear();
    globalThis.__bright = h => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
    document.createElement = () => {
      const tile = [], c = { width: 0, height: 0 };
      const g = {
        fillStyle: '#000', imageSmoothingEnabled: true, scale() {}, drawImage() {},
        createPattern() { __seen.dithers++; return { mean: tile.length === 16 ? tile.reduce((a, h) => a + __bright(h), 0) / 16 : null, setTransform() {} }; },
        fillRect(x, y, w, h) {
          const f = this.fillStyle;
          if (typeof f === 'string') { __seen.colours.add(f); if (c.width === 4) tile.push(f); }
          const overlap = Math.max(0, Math.min(y + h, FY + BD) - Math.max(y, FY)) * w;
          if (overlap > 0 && c.width !== 4) { const v = typeof f === 'string' ? __bright(f) : f.mean; if (v !== null) { __seen.sum += v * overlap; __seen.area += overlap; } }
        }
      };
      c.getContext = () => g; c.toDataURL = () => ''; return c;
    };
  `);
  r(draw);
  return plain(r, '({ colours: [...__seen.colours], mean: __seen.sum / __seen.area, dithers: __seen.dithers })');
}

test('every colour a backdrop is painted in is a step of the master palette, however far, wet, foggy or moonlit it is', () => {
  const r = game(), dyes = new Set(plain(r, 'LAND_DYES'));
  assert.equal(dyes.size, 100, 'the palette has its hundred steps');
  // the colours the page is told to paint with: the lands in every weather, every site in some land and weather, and the night skylines
  const drawn = [];
  for (const land of LANDS) for (const w of WEATHER) drawn.push(`makeBackdrop(3, '${w}', { land: '${land}' })`);
  for (const [i, site] of plain(r, 'Object.keys(SITE_ART)').entries()) drawn.push(`makeBackdrop(4, '${WEATHER[i % 3]}', { land: '${LANDS[i % LANDS.length]}', site: '${site}' })`);
  for (const land of LANDS) drawn.push(`skylineOf('${land}', 2, 320)`);
  const seen = inspect(r, drawn.join(';\n') + ';');
  assert.ok(seen.dithers > 100 && seen.colours.length > 60, 'it is painted in dither, and in a great many of the palette\'s colours');
  assert.deepEqual(seen.colours.filter(c => !dyes.has(c)), [], 'and in none that is not one of them');
  // what a grade does to a dye (the rain, the fog, the moon) is another dye
  for (const grade of ['RAIN_GRADE', 'FOG_GRADE', 'MOON_GRADE']) for (const c of dyes) assert.ok(dyes.has(r(`${grade}('${c}')`)), `${grade} of ${c}`);
  // and the colours of the lands, in each weather, and what buildings and water are made of, are dyes
  const tones = plain(r, `(() => { const o = []; for (const l of ${JSON.stringify(LANDS)}) for (const w of ${JSON.stringify(WEATHER)}) o.push(JSON.stringify(weatherTone(TONES[l], w))); return o; })()`);
  for (const t of tones) for (const c of t.match(/#[0-9a-f]{6}/g)) assert.ok(dyes.has(c), `a tone of the land is a dye: ${c}`);
  for (const m of Object.values(plain(r, 'STUFF'))) for (const c of Object.values(m)) assert.ok(dyes.has(c), `a material is made of dyes: ${c}`);
});

test('the dither is the ordered one of a Bayer matrix, so that it is a pattern and never speckle', () => {
  const r = game(), bayer = plain(r, 'LAND_BAYER');
  assert.deepEqual(bayer.flat().sort((a, b) => a - b), [...Array(16).keys()], 'each of sixteen levels once');
  for (let n = 0; n <= 16; n++) assert.equal(bayer.flat().filter(v => v < n).length, n, `level ${n} sets ${n} of the sixteen pixels`);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) assert.equal(bayer[y][x] < 8, (x + y) % 2 === 0, 'half-way is a checkerboard');
  // a ramp is laid in sixteen levels between each pair of its colours
  const ramp = plain(r, "(() => { const s = makeScene(document.createElement('canvas').getContext('2d'), 1, 'clear', TONES.poland); const f = s.ramp(['#000000', '#ffffff', '#ff0000']); return [f.levels, f(0), f(1), f(0.5), f.at(8).n, f.at(24).a, f.at(24).n]; })()");
  assert.deepEqual(ramp, [32, '#000000', '#ff0000', '#ffffff', 8, '#ffffff', 8], 'two steps of sixteen levels');
});

test('the light is the weather\'s: rain darkens a land and fog pales it, and the camp\'s skyline is moonlit', () => {
  const r = game(), mean = (land, w) => inspect(r, `makeBackdrop(3, '${w}', { land: '${land}' })`).mean;
  for (const land of LANDS) {
    const clear = mean(land, 'clear'), rain = mean(land, 'rain'), fog = mean(land, 'fog');
    assert.ok(rain < clear - 3, `${land}: rain (${rain.toFixed(0)}) is darker than a clear day (${clear.toFixed(0)}) where the men stand`);
    assert.ok(fog > clear + 3, `${land}: fog (${fog.toFixed(0)}) is paler than a clear day (${clear.toFixed(0)}) where the men stand`);
  }
  const night = new Set(plain(r, '[...rNight, rFire[3], rFire[4], rFire[5], rBronze[5], rBronze[6]]'));
  for (const land of LANDS) assert.deepEqual(inspect(r, `skylineOf('${land}', 3, 320)`).colours.filter(c => !night.has(c)), [], `${land} by night is painted in the night's blues, with here and there a fire or a gold`);
});

test('the ground the men stand on is mid-value in every land, in every weather, so that dark-edged, bright-dyed men read on it', () => {
  const r = game();
  for (const land of LANDS) for (const w of WEATHER) {
    const m = inspect(r, `makeBackdrop(5, '${w}', { land: '${land}' })`).mean;
    assert.ok(m > 62 && m < 185, `${land} in ${w}: the rows the men stand in are ${m.toFixed(0)} bright, of 255 (a man's own darks are about 20 and his dyes 70 to 200)`);
  }
});
