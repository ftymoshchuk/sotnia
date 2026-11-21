'use strict';
/* Who leads the company, run headless: the captain, the four officers and the retainer, and what each changes in the rules (js/command.js and
 * the hooks it has in js/core.js and js/journey.js); the captain's order in a fight; and the camp that is the hub of the game (its page of
 * business, its dock, the light of a day passing over it), which is built from the same tables. A seeded Math.random makes every run repeat.
 * How the pages look, and how a day feels going by, are for the eye (the browser); what these check is the rules and the tables. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./canvas-stub');

const ROOT = path.join(__dirname, '..');
const SEEDED = seed => `Math.random = (() => { let a = ${seed}; return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;
function rules(seed = 1) {
  const ctx = vm.createContext({});
  vm.runInContext(SEEDED(seed), ctx);
  for (const f of ['js/core.js', 'js/journey.js', 'js/command.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return code => vm.runInContext(code, ctx);
}
const plain = (r, code) => JSON.parse(r('JSON.stringify(' + code + ')'));
// A company for tests: the payroll commission at Warsaw, with a captain of a kind chosen, a full chest and a name for the renown.
const NEW = (type = 'hauptmann', renown = 0) => `(() => { const st = newGame('payroll', { type: '${type}', name: 'Test Captain' }); st.thalers = 900; st.renown = ${renown}; genOfficers(st); return st; })()`;

test('every kind of officer, captain and retainer is made of things the game has: nations, lands, orders and modifiers', () => {
  const r = rules();
  const origins = new Set(plain(r, 'ORIGINS.map(o => o.id)')), lands = new Set(plain(r, 'Object.keys(LANDS)')), mods = plain(r, 'Object.keys(MODS)');
  const kinds = plain(r, 'Object.entries(SPECIALTIES).map(([id, s]) => ({ id, ...s }))');
  const stations = plain(r, 'STATIONS');
  assert.deepEqual(stations, ['surgeon', 'drill', 'qm', 'chaplain']);
  for (const st of stations) assert.ok(kinds.filter(k => k.station === st).length >= 3, `${st} has three men to choose from`);
  for (const k of kinds) {
    assert.ok(stations.includes(k.station), k.id);
    assert.ok(k.from.length && k.from.every(o => origins.has(o)), `${k.id}: the nations he comes from`);
    assert.ok(k.fee > 0 && k.wage > 0 && k.blurb.length > 20 && /^An? /.test(k.title), `${k.id}: fee, wage and words`);
    for (const m of k.mods) assert.ok(mods.includes(m.k), `${k.id}: ${m.k}`);
    assert.ok((k.mods.length > 0) !== (k.station === 'chaplain'), `${k.id}: a chaplain has a faith and no modifiers, everybody else has modifiers`);
    if (k.station === 'chaplain') assert.ok(plain(r, `FAITHS['${k.faith}']`).peoples.every(o => origins.has(o)), `${k.id}: his faith's peoples`);
  }
  for (const c of plain(r, 'Object.entries(CAPTAINS).map(([id, c]) => ({ id, ...c }))')) {
    assert.ok(origins.has(c.origin) && ['pike', 'shot', 'sabre'].includes(c.cls), c.id);
    assert.ok(plain(r, `ORDERS['${c.order}']`).secs > 0, `${c.id}: his order`);
    for (const m of [...c.perk.mods, ...c.flaw.mods]) assert.ok(mods.includes(m.k), `${c.id}: ${m.k}`);
    assert.ok(c.perk.mods.length && c.flaw.mods.length, `${c.id}: a perk and a flaw`);
  }
  for (const t of plain(r, 'Object.entries(RETAINERS).map(([id, t]) => ({ id, ...t }))')) {
    assert.ok(t.lands.length && t.lands.every(l => lands.has(l)), `${t.id}: lands`);
    assert.ok(t.names.length && t.mods.length && t.wage > 0 && t.offer.length > 20, t.id);
    for (const m of t.mods) assert.ok(mods.includes(m.k), `${t.id}: ${m.k}`);
  }
  assert.deepEqual(plain(r, 'RETAINER_EVENTS.map(e => e.id).sort()'), plain(r, 'Object.keys(RETAINERS).map(k => "retainer-" + k).sort()'), 'an event for each retainer');
  assert.equal(plain(r, 'RETAINER_EVENTS.every(e => eventOf(e.id) === e)'), true, 'each is found by eventOf');
});

test('three captains are offered, of three nations, and a campaign has the captain it was begun with, saved in the shape of version 3', () => {
  const r = rules(5);
  for (let i = 0; i < 20; i++) {
    const caps = plain(r, 'genCaptains()');
    assert.equal(caps.length, 3);
    assert.equal(new Set(caps.map(c => plain(r, `CAPTAINS['${c.type}'].origin`))).size, 3, 'three nations');
    assert.ok(caps.every(c => c.name.includes(' ')), 'a name');
  }
  const st = plain(r, NEW('colonel'));
  assert.equal(st.v, 3);
  assert.deepEqual(st.captain, { type: 'colonel', name: 'Test Captain' });
  assert.ok(st.officers && st.pool && 'retainer' in st && 'offered' in st && !('staff' in st), 'the new shape, and none of the old');
  assert.equal(plain(r, 'newGame("salt").captain.type in CAPTAINS'), true, 'a captain at random when none is named');
  // the captain brings one man of his own nation, of the arm he knows, where his nation fields it
  for (const [type, nation, cls] of [['colonel', 'Scottish', 'pike'], ['hussar', 'Hungarian', 'sabre'], ['swede', 'Swedish', 'shot'], ['rotmistrz', 'Polish', 'sabre']]) {
    const s = plain(r, NEW(type));
    assert.ok(s.roster.some(m => m.origin === nation && m.cls === cls), `${type}: a ${nation} ${cls} on the roll`);
  }
  // it survives being saved: the company goes on from the JSON, with the same effects
  const back = JSON.parse(JSON.stringify(st));
  assert.deepEqual(plain(r, `effectsOf(${JSON.stringify(back)})`), plain(r, `effectsOf(${JSON.stringify(st)})`));
});

test('what the people change adds up: nothing in post changes nothing but the captain, and each man changes what his kind says', () => {
  const r = rules();
  const fx = (st, extra = '') => plain(r, `(() => { const st = ${st}; ${extra}; return effectsOf(st); })()`);
  const bare = fx(NEW('swede'));
  assert.deepEqual(bare.edge, { pike: 0, shot: 2, sabre: 0 }, 'the Swedish captain drills his musketeers');
  assert.equal(bare.wage, 1.1);
  assert.equal(bare.faith, null);
  const full = fx(NEW('swede'), `for (const k of ['surgeon', 'drill', 'qm', 'chaplain']) { st.pool[k] = [makeOfficer(st, k === 'surgeon' ? 'barber' : k === 'drill' ? 'pikemaster' : k === 'qm' ? 'haggler' : 'orthodox', 'poland')]; st.officers[k] = st.pool[k][0]; }`);
  assert.equal(full.rest, 6); assert.equal(full.wounded, 3); assert.equal(full.mercy, 0.18);
  assert.equal(full.drill.pike, 1.6); assert.equal(full.drill.shot, 1.2);
  assert.ok(Math.abs(full.price - 0.8) < 1e-9, 'the haggler takes a fifth off');
  assert.equal(full.faith, 'orthodox');
  // a modifier for one class touches only it, and the same kind of modifier from two people multiplies (a multiplier) or adds (an amount)
  const two = fx(NEW('hauptmann'), `st.officers.qm = makeOfficer(st, 'fixer', 'poland'); st.officers.drill = makeOfficer(st, 'taskmaster', 'poland')`);
  assert.ok(Math.abs(two.hire - 0.88 * 0.9) < 1e-9, 'the captain and the fixer both lower the price of men');
  assert.ok(Math.abs(two.drill.pike - 1.45) < 1e-9 && two.spirit === -1, 'the taskmaster teaches everyone and wears them out');
  const arms = fx(NEW('colonel'));
  assert.deepEqual([arms.guard, arms.edge], [{ pike: 1, shot: 0, sabre: 0 }, { pike: 1, shot: 0, sabre: 0 }]);
});

test('the places for officers open with renown, and engaging one takes the fee, needs a place, and a man in post is replaced, not added to', () => {
  const r = rules();
  assert.deepEqual(plain(r, 'OFFICER_RENOWN'), [0, 0, 8, 20]);
  for (const [n, slots, next] of [[0, 2, 8], [7, 2, 8], [8, 3, 20], [19, 3, 20], [20, 4, null], [99, 4, null]]) {
    assert.equal(plain(r, `officerSlots({ renown: ${n} })`), slots, `${n} renown`);
    assert.equal(plain(r, `nextSlotRenown({ renown: ${n} })`), next, `${n} renown: the next place`);
  }
  const out = plain(r, `(() => {
    const st = ${NEW('hauptmann')}, log = [];
    const fee = k => st.pool[k][0].fee;
    log.push(hireOfficer(st, 'surgeon', 0), hireOfficer(st, 'drill', 0));
    log.push(hireOfficer(st, 'qm', 0)); // no third place at no renown
    st.renown = 8; log.push(hireOfficer(st, 'qm', 0));
    log.push(hireOfficer(st, 'chaplain', 0)); // and no fourth
    const held = officersOf(st).map(o => o.station);
    // replacing: the surgeon in post for another; the old one is let go, and the places held do not grow
    const was = st.officers.surgeon.name, other = st.pool.surgeon[0];
    st.thalers = 900; const before = st.thalers;
    log.push(hireOfficer(st, 'surgeon', 0));
    const replaced = st.officers.surgeon.name !== was && st.officers.surgeon === other && officersOf(st).length === 3 && before - st.thalers === other.fee;
    // too poor
    st.thalers = 1; const poor = hireOfficer(st, 'drill', 0);
    st.renown = 20; st.thalers = 900; const fourth = hireOfficer(st, 'chaplain', 0);
    const gone = dismissOfficer(st, 'chaplain'), none = dismissOfficer(st, 'chaplain');
    return { log, held, replaced, poor, fourth, gone, none, left: officersOf(st).map(o => o.station), wages: officerWages(st), expected: officersOf(st).reduce((n, o) => n + o.wage, 0) };
  })()`);
  assert.deepEqual(out.log, [true, true, false, true, false, true]);
  assert.deepEqual(out.held, ['surgeon', 'drill', 'qm']);
  assert.equal(out.replaced, true); assert.equal(out.poor, false); assert.equal(out.fourth, true);
  assert.equal(out.gone, true); assert.equal(out.none, false);
  assert.deepEqual(out.left, ['surgeon', 'drill', 'qm']);
  assert.equal(out.wages, out.expected);
});

test('the men to choose from are three of different kinds for every post, drawn from the land the company is in', () => {
  const r = rules(9);
  for (const k of ['surgeon', 'drill', 'qm', 'chaplain']) {
    const kinds = plain(r, `(() => { const st = ${NEW()}; return st.pool.${k}.map(o => o.kind); })()`);
    assert.equal(kinds.length, 3); assert.equal(new Set(kinds).size, 3, `${k}: three different kinds`);
    assert.ok(kinds.every(x => plain(r, `SPECIALTIES['${x}'].station`) === k), `${k}: of that post`);
  }
  // an Orthodox priest is far likelier in Ukraine than in Silesia, and a Lutheran pastor the other way
  const count = (land, kind) => plain(r, `(() => { let n = 0; const st = ${NEW()}; for (let i = 0; i < 400; i++) { st.at = ${JSON.stringify(land === 'ukraine' ? 'kyiv' : 'breslau')}; genOfficers(st); if (st.pool.chaplain.some(o => o.kind === '${kind}')) n++; } return n; })()`);
  assert.ok(count('ukraine', 'orthodox') > count('silesia', 'orthodox') + 40, 'Orthodox priests are met in Ukraine');
  assert.ok(count('silesia', 'lutheran') > count('ukraine', 'lutheran') + 40, 'Lutheran pastors are met in Silesia');
  // each man has a name of his nation
  assert.equal(plain(r, `(() => { const st = ${NEW()}; return Object.values(st.pool).flat().every(o => ORIGINS.find(x => x.id === o.origin).first.includes(o.name.split(' ')[0])); })()`), true);
});

test('the rules take the people into account: prices, bread, wages, recruits, pay and renown', () => {
  const r = rules();
  const out = plain(r, `(() => {
    const st = ${NEW('hauptmann')}, put = (k, kind) => { st.pool[k] = [makeOfficer(st, kind, 'poland')]; st.officers[k] = st.pool[k][0]; };
    const men = st.roster.length, base = { bread: breadPrice({ ...st, officers: {}, captain: { type: 'colonel' } }), eat: breadDue(st), wages: wagesDue(st), recruit: recruitPrice(st, st.recruits[0] || { fee: 40 }) };
    put('qm', 'haggler'); const afterHaggler = { bread: breadPrice(st), powder: powderPrice(st), gear: gearPrice(st, 0) };
    put('qm', 'provisioner'); const afterProv = breadDue(st);
    const c = { pay: 100, renown: 10 };
    const off = { pay: payFor(st, c), renown: renownFor(st, c) };
    put('qm', 'fixer'); const fixer = { pay: payFor(st, c), hire: recruitPrice(st, { fee: 100 }) };
    st.captain = { type: 'rotmistrz', name: 'R' }; const rot = { renown: renownFor(st, c), wage: wageOf(st.roster[0], st), plain: wageOf(st.roster[0]) };
    st.retainer = { type: 'engineer', name: 'E', wage: 8 };
    return { men, base, afterHaggler, afterProv, off, fixer, rot, wagesBy: wagesDue(st), expected: st.roster.reduce((n, s) => n + wageOf(s, st), 0) + officerWages(st), bread0: BREAD_COST };
  })()`);
  assert.equal(out.base.eat, out.men + 1, 'the Hauptmann likes his table: a loaf more');
  assert.equal(out.afterHaggler.bread, Math.round(out.bread0 * 0.8) , 'the haggler takes a fifth off the bread');
  assert.ok(out.afterHaggler.powder < 14 && out.afterHaggler.gear < 22);
  assert.equal(out.afterProv, Math.max(Math.ceil(out.men / 2), out.men + 1 - 2), 'the provisioner saves two loaves, the Hauptmann spends one');
  assert.deepEqual(out.off, { pay: 100, renown: 10 });
  assert.equal(out.fixer.pay, 112); assert.equal(out.fixer.hire, Math.round(100 * 0.88 * 0.9));
  assert.equal(out.rot.renown, 13, 'the rotmistrz’s name earns a quarter more (10 → 12.5 → 13)');
  assert.ok(out.rot.wage >= out.rot.plain && out.rot.wage <= Math.round(out.rot.plain * 1.1) + 0, 'and his tastes cost a tenth more in wages');
  assert.equal(out.wagesBy, out.expected, 'the pay day is the men’s wages as shown, the officers’ and the retainer’s');
});

test('a day in camp or on the road heals, teaches and cheers as the officers and the captain make it', () => {
  const r = rules(3);
  const day = (setup, mode = 'camp') => plain(r, `(() => {
    const st = ${NEW('hauptmann', 30)}; st.payDue = st.date + 90; st.bread = 999;
    for (const s of st.roster) { s.hp = 10; s.morale = 60; s.xp = 0; s.wound = 0; s.order = 'rest'; }
    ${setup}
    const dice = Math.random; Math.random = () => 0.5; // a forager finds two loaves
    passDay(st, '${mode}', []);
    Math.random = dice;
    return { hp: st.roster.map(s => s.hp), xp: st.roster.map(s => s.xp), morale: st.roster.map(s => s.morale), bread: st.bread, cls: st.roster.map(s => s.cls), origin: st.roster.map(s => s.origin) };
  })()`);
  const put = (k, kind) => `st.officers.${k} = makeOfficer(st, '${kind}', 'poland');`;
  const base = day('');
  assert.ok(base.hp.every(h => h === 20), 'rest mends ten without a surgeon');
  assert.ok(day(put('surgeon', 'barber')).hp.every(h => h === 26), 'and sixteen with a barber (the same as the old surgeon)');
  assert.ok(day(put('surgeon', 'herbalist')).hp.every(h => h === 23));
  // laid up: four, and three more with a barber
  assert.ok(day('for (const s of st.roster) s.wound = 3;').hp.every(h => h === 14) && day('for (const s of st.roster) s.wound = 3;' + put('surgeon', 'barber')).hp.every(h => h === 17));
  // on the road a man mends two, and a herbalist's patients two more
  assert.ok(day('', 'march').hp.every(h => h === 12) && day(put('surgeon', 'herbalist'), 'march').hp.every(h => h === 14));
  // drill: ten experience, by class
  const drill = (k) => day('for (const s of st.roster) s.order = "drill";' + put('drill', k));
  assert.ok(drill('veteran').xp.every(x => x === 16));
  const pm = drill('pikemaster');
  pm.cls.forEach((c, i) => assert.equal(pm.xp[i], c === 'pike' ? 16 : 12, `the pike-master teaches a ${c}`));
  // forage: bread, with the scrounger's two more from each forager (the Hauptmann's table does not feed the men: only the day's due is eaten)
  const f0 = day('for (const s of st.roster) s.order = "forage";'), f1 = day('for (const s of st.roster) s.order = "forage";' + put('qm', 'scrounger'));
  assert.equal(f1.bread - f0.bread, 2 * 4 + 1, 'two loaves more from each of the four foragers, and a loaf less eaten by the scrounger’s company');
  // spirit: a chaplain of the right faith lifts a man two a day (and the dead band's drift is on top); the wrong one does nothing
  const cath = day(put('chaplain', 'catholic')), orth = day(put('chaplain', 'orthodox')), open = day(put('chaplain', 'open'));
  cath.origin.forEach((o, i) => { const heart = ['Polish', 'Croat', 'German', 'Hungarian'].includes(o); assert.equal(cath.morale[i] - base.morale[i], heart ? 2 : 0, `a Catholic chaplain and a ${o}`); });
  orth.origin.forEach((o, i) => assert.equal(orth.morale[i] - base.morale[i], o === 'Zaporozhian' ? 2 : 0, `an Orthodox priest and a ${o}`));
  open.origin.forEach((o, i) => assert.equal(open.morale[i] - base.morale[i], o === 'Lipka Tatar' ? 0 : 1, `a chaplain of no party and a ${o}`));
  // and no chaplain lifts a man past 90
  assert.ok(plain(r, `(() => { const st = ${NEW()}; st.bread = 99; st.officers.chaplain = makeOfficer(st, 'open', 'poland'); for (const s of st.roster) s.morale = 95; passDay(st, 'camp', []); return st.roster.every(s => s.morale === 94); })()`));
});

test('the captain’s ways: a hussar is ambushed less, an ataman’s men are paid less gently, and a missed pay day hurts by the flaw', () => {
  const r = rules(2);
  const rate = type => plain(r, `(() => { const st = ${NEW(type)}; return effectsOf(st).ambush; })()`);
  assert.equal(rate('hussar'), 0.75); assert.equal(rate('hauptmann'), 1);
  const unpaid = type => plain(r, `(() => { const st = ${NEW(type)}; st.thalers = 0; st.cargo = 0; for (const s of st.roster) s.morale = 80; payDay(st, []); return st.roster.map(s => s.morale); })()`);
  assert.ok(unpaid('ataman').every((m, i) => m === unpaid('hauptmann')[i] - 10), 'ten more lost when the pay fails');
  const cargoCart = plain(r, `(() => { const st = ${NEW('hussar')}; st.retainer = { type: 'cartographer', name: 'C', wage: 4 }; return effectsOf(st).ambush; })()`);
  assert.ok(Math.abs(cargoCart - 0.75 * 0.7) < 1e-9, 'a map-maker and a hussar lower it together');
});

test('a retainer asks for a place now and then, in a town, in his own lands, at most once in a while, and the company takes him on or does not', () => {
  const r = rules(7);
  const out = plain(r, `(() => {
    const st = ${NEW()}, log = {};
    // at the start of the payroll quest the company stands in Warsaw, a town of the Crown
    st.at = 'warsaw'; st.day = 50; st.offered = -99; st.pending = null;
    let n = 0, e0 = null;
    for (let i = 0; i < 80 && !e0; i++) { st.offered = -99; e0 = rollRetainer(st, 1); n++; }
    log.event = e0 && e0.id; log.pending = st.pending && st.pending.id; log.offered = st.offered;
    log.again = rollRetainer(st, 1); // a pending offer: none
    st.pending = null; st.day = 52; log.gap = rollRetainer(st, 1); // too soon
    st.day = 60; st.at = 'sich'; log.host = rollRetainer(st, 1) ? 'offer' : 'none'; // the Sich is a host: recruits and market, no 'staff'; people are about
    st.pending = null; st.at = 'perekop'; log.fort = rollRetainer(st, 1); // a fort has nobody looking for a place
    // too poor for most: with five thalers only a retainer who asks no more than that is offered
    log.poor = []; st.at = 'warsaw'; st.thalers = 5; for (let i = 0; i < 60; i++) { st.pending = null; st.offered = -99; const e = rollRetainer(st, 1); if (e) log.poor.push(RETAINERS[e.id.slice(9)].fee); }
    // answer an offer: take him on
    st.thalers = 500; st.pending = { id: 'retainer-engineer' }; const t0 = st.thalers; const was = applyEvent(st, 0);
    log.took = { who: st.retainer && st.retainer.type, paid: t0 - st.thalers, text: was };
    // the next offer replaces him, and says so
    st.pending = { id: 'retainer-cartographer' }; applyEvent(st, 0); log.replaced = st.retainer.type;
    st.pending = { id: 'retainer-kobzar' }; const k0 = st.thalers; applyEvent(st, 1); log.declined = { type: st.retainer.type, thalers: st.thalers === k0 };
    log.wages = officerWages(st); log.dismiss = dismissRetainer(st) && st.retainer === null;
    return log;
  })()`);
  assert.ok(out.event && out.event.startsWith('retainer-'), 'an offer comes');
  assert.equal(out.pending, out.event); assert.equal(out.again, null); assert.equal(out.gap, null); assert.equal(out.fort, null);
  assert.ok(out.poor.length > 10 && out.poor.every(f => f <= 5), `only what the purse can pay: ${out.poor}`);
  assert.deepEqual(out.took, { who: 'engineer', paid: 40, text: out.took.text });
  assert.ok(out.took.text.includes('takes a place with the train'));
  assert.equal(out.replaced, 'cartographer');
  assert.deepEqual(out.declined, { type: 'cartographer', thalers: true });
  assert.equal(out.wages, 4); assert.equal(out.dismiss, true);
  // over many days in a town they do turn up, and not every day
  const n = plain(r, `(() => { const st = ${NEW()}; st.at = 'krakow'; let n = 0; for (let d = 0; d < 400; d++) { st.day = d; st.pending = null; st.thalers = 900; if (rollRetainer(st, RETAINER_ODDS_CAMP)) n++; } return n; })()`);
  assert.ok(n > 10 && n < 60, `a retainer in a town every so often: ${n} in 400 days`);
});

/* ---------- the captain's order in a fight ---------- */
const FIGHT = (order, extra = '') => `(() => {
  const st = ${NEW('hauptmann')}; st.roster.length = 0;
  for (const cls of ['pike', 'pike', 'shot', 'shot', 'sabre', 'sabre']) { const s = makeSoldier(st, cls, 2); s.trait = null; st.roster.push(s); }
  const c = { id: 1, tpl: 'road', title: 't', who: '', text: '', skin: 'bandit', foe: 'foes', units: [], ai: 'advance', grade: 'fair', weather: 'clear', ttl: 3, bonus: null, pay: 1, renown: 1, cap: 8 };
  for (let i = 0; i < 6; i++) c.units.push(enemyUnit(['sabre', 'pike', 'shot'][i % 3], 1, 'bandit'));
  const b = battleFor(st, c, st.roster.map(s => s.id), 'advance', true);
  b.order = ${JSON.stringify(order)};
  ${extra}
  return { st, c, b };
})()`;

test('the captain calls his order once, at a moment of the player’s choosing, and only where there is a fight to call it in', () => {
  const r = rules(4);
  assert.deepEqual(plain(r, 'Object.keys(ORDERS)'), ['rally', 'volley', 'stand', 'charge']);
  const out = plain(r, `(() => {
    const { st, c, b } = ${FIGHT('charge')}, log = {};
    log.vis = b.order; // battleFor with vis hands the captain's own order, which a hauptmann's is volley: charge was set after
    const fresh = battleFor(st, c, st.roster.map(s => s.id), 'advance', true); log.own = fresh.order;
    log.scouts = battleFor(st, c, st.roster.map(s => s.id), 'advance', false).order;
    log.duel = makeBattle([], [], { duel: true, order: 'rally' }).order;
    log.can0 = canOrder(b); log.first = giveOrder(b); log.can1 = canOrder(b); log.second = giveOrder(b); log.buffs = { ...b.buffs };
    for (let i = 0; i < 250; i++) stepBattle(b, 0.1);
    log.after = { ...b.buffs };
    const r2 = ${FIGHT('rally')}; orderRetreat(r2.b); log.retreat = giveOrder(r2.b);
    const none = ${FIGHT(null)}; log.none = giveOrder(none.b);
    return log;
  })()`);
  assert.equal(out.own, 'volley', 'the order is the captain’s own');
  assert.equal(out.scouts, null, 'the scouts’ odds do not count on it');
  assert.equal(out.duel, null, 'no order in a duel');
  assert.deepEqual([out.can0, out.first, out.can1, out.second], [true, true, false, false], 'once');
  assert.deepEqual(out.buffs, { charge: plain(r, 'ORDERS.charge.secs') });
  assert.deepEqual(out.after, {}, 'it wears off');
  assert.equal(out.retreat, false, 'not after the retreat is sounded'); assert.equal(out.none, false);
});

test('each order does what it says: rally turns the running back, volley fires the muskets, stand fast steadies the pikes, charge home sends the sabres', () => {
  const r = rules(6);
  const rally = plain(r, `(() => {
    const { b } = ${FIGHT('rally', 'for (const u of b.units) if (u.side === 0 && u.cls !== "pike") { u.routing = true; u.mor = 5; }')};
    const running = b.units.filter(u => u.side === 0 && u.routing).length, mor = b.units.filter(u => u.side === 0).map(u => u.mor);
    giveOrder(b);
    const after = b.units.filter(u => u.side === 0 && u.routing).length;
    for (let i = 0; i < 40; i++) stepBattle(b, 0.1); // 4 seconds: nobody breaks again while the standard is up
    return { running, after, held: b.units.filter(u => u.side === 0 && u.routing).length, min: Math.min(...b.units.filter(u => u.side === 0 && alive(u)).map(u => u.mor)) };
  })()`);
  assert.ok(rally.running >= 4 && rally.after === 0, 'the men who were running turn about');
  assert.equal(rally.held, 0, 'and do not break again while the order lasts');
  const volley = plain(r, `(() => {
    const { b } = ${FIGHT('volley', 'for (const u of b.units) if (u.cls === "shot") { u.x = 120; u.hx = 120; }; for (const u of b.units) if (u.side === 1) { u.x = 170; u.hx = 170; u.y = 20; }')};
    const shooters = b.units.filter(u => u.side === 0 && u.cls === 'shot');
    shooters.forEach(u => { u.loaded = true; u.aimT = 0; u.aimNeed = 5; });
    const before = b.shots; giveOrder(b); stepBattle(b, 0.1);
    return { shooters: shooters.length, fired: b.shots - before };
  })()`);
  assert.equal(volley.fired, volley.shooters, 'every musketeer who was loaded fires at once');
  const stand = plain(r, `(() => {
    // the same pikeman struck by the same sabreur: his guard is five higher while the order is up, so the blow lands less often
    const hits = order => { const { b } = ${FIGHT('stand')}; if (order) giveOrder(b); const t = b.units.find(u => u.side === 0 && u.cls === 'pike'), u = b.units.find(u => u.side === 1 && u.cls === 'sabre'); t.max = t.hp = 1e9; t.armv = 0; t.grd = 6; u.mel = 10; u.wpn = 0; let n = 0; for (let i = 0; i < 4000; i++) { const was = t.hp; strike(b, u, t, 5); if (t.hp < was) n++; } return n / 4000; };
    return { without: hits(false), with: hits(true) };
  })()`);
  assert.ok(stand.without - stand.with > 0.1, `the pikes are hit less often: ${stand.without.toFixed(2)} → ${stand.with.toFixed(2)}`);
  const charge = plain(r, `(() => {
    const { b } = ${FIGHT('charge', 'for (const u of b.units) { u.x = u.side ? 250 : 40; u.hx = u.x; }; b.stance[0] = "hold";')};
    const sab = b.units.filter(u => u.side === 0 && u.cls === 'sabre'), x0 = sab.map(u => u.x);
    giveOrder(b); for (let i = 0; i < 20; i++) stepBattle(b, 0.1);
    const pikes = b.units.filter(u => u.side === 0 && u.cls === 'pike');
    return { sabreMoved: sab.every((u, i) => u.x - x0[i] > 30), pikeMoved: pikes.some(u => Math.abs(u.x - u.hx) > 5) };
  })()`);
  assert.equal(charge.sabreMoved, true, 'the sabreurs go in even though the company was told to hold');
  assert.equal(charge.pikeMoved, false, 'and the pikes keep their ground');
});

test('an order at a fair moment raises the company’s chance in a close fight, on the average of all four, and no order is a gift', () => {
  const r = rules(12345);
  const res = plain(r, `(() => {
    const N = 90, when = { rally: 'rout', volley: 12, stand: 8, charge: 6 }, out = { none: 0, orders: 0 }, per = {};
    const fight = (order, ai, lv, foes) => {
      const st = newGame('payroll', { type: 'hauptmann', name: 'X' }); st.roster.length = 0;
      for (const cls of ['pike', 'pike', 'shot', 'shot', 'sabre']) { const s = makeSoldier(st, cls, lv); s.trait = null; st.roster.push(s); }
      const c = { id: 1, tpl: 'road', title: 't', who: '', text: '', skin: 'bandit', foe: 'foes', units: [], ai, grade: 'fair', weather: 'clear', ttl: 3, bonus: null, pay: 1, renown: 1, cap: 8 };
      for (let i = 0; i < foes; i++) c.units.push(enemyUnit(['sabre', 'pike', 'shot', 'sabre', 'pike', 'shot'][i % 6], 1, 'bandit'));
      const b = battleFor(st, c, st.roster.map(s => s.id), 'advance', false); b.order = order; let given = false;
      while (!b.over && b.t < 120) { stepBattle(b, 0.1); if (order && !given && (when[order] === 'rout' ? b.units.some(u => u.side === 0 && u.routing) : b.t >= when[order])) { giveOrder(b); given = true; } }
      return b.winner === 0 && !b.retreated ? 1 : 0;
    };
    for (const [ai, lv, foes] of [['advance', 2, 6], ['charge', 1, 6]]) {
      for (const order of [null, 'rally', 'volley', 'stand', 'charge']) { let w = 0; for (let i = 0; i < N; i++) w += fight(order, ai, lv, foes); per[ai + (order || 'none')] = w; if (order) out.orders += w; else out.none += w; }
    }
    return { none: out.none / (2 * N), orders: out.orders / (8 * N), per };
  })()`);
  assert.ok(res.none > 0.2 && res.none < 0.8, `the fights are close: ${res.none.toFixed(2)} without an order`);
  assert.ok(res.orders - res.none > 0.03, `an order helps: ${res.none.toFixed(2)} → ${res.orders.toFixed(2)}`);
  assert.ok(res.orders - res.none < 0.35, 'but does not win the fight by itself');
});

/* ---------- the camp as the hub ---------- */
const hub = () => {
  const r = load(['core', 'journey', 'command', 'geo', 'art', 'figures', 'terrain', 'icons', 'screens', 'encyclopedia']);
  return r;
};
const at = (r, place) => r(`(() => { G = newGame('oxen', { type: 'hussar', name: 'Janos' }); G.at = ${JSON.stringify(place)}; G.thalers = 500; G.renown = 12; arrive(G); ui.screen = 'camp'; ui.panel = null; return 1; })()`);

test('the camp is one screen: the scene with its things to click, and a dock, with the business of the day done in pages over it', () => {
  const r = hub();
  at(r, 'kamianets');
  const html = r('campHTML()');
  assert.ok(html.startsWith('<main class="hub">') && html.includes('<section class="stage">') && html.includes('class="dock"'), 'the hub');
  assert.ok(!html.includes('role="tablist"') && !html.includes('class="tabs"') && !html.includes('class="side"') && !html.includes('class="news"'), 'no tabs, no side card, no news list beneath the scene');
  for (const k of ['map', 'roll', 'market', 'work', 'command', 'log']) {
    assert.ok(html.includes(`class="spot" data-act="panel" data-k="${k}"`), `${k}: a thing in the camp to click`);
    assert.ok(html.includes(`<button data-act="panel" data-k="${k}"`), `${k}: a button in the dock, for the keyboard and for the phone`);
  }
  assert.ok(html.includes('data-act="halt"') && html.includes('data-act="course"'), 'rest and march are in the dock');
  assert.ok(html.includes('class="camper') && html.includes('data-act="sel"'), 'the men are clickable');
  assert.ok(html.includes('data-post="captain"') && !html.includes('data-post="surgeon"'), 'the captain stands in the camp; a post nobody holds has nobody');
  r('ui.open = G.roster[0].id');
  const picked = r('campHTML()');
  assert.ok(picked.includes('class="pop"') && (picked.match(/data-act="order"/g) || []).length === 3 && picked.includes('data-act="card"'), 'the man picked has his orders and his card at hand');
  r('ui.open = null');
  // at the salt lakes there is nothing to buy and no work posted
  at(r, 'syvash');
  const lakes = r('campHTML()');
  for (const k of ['market', 'work']) assert.ok(!lakes.includes(`data-k="${k}"`), `no ${k} at the lakes`);
  for (const k of ['map', 'roll', 'command', 'log']) assert.ok(lakes.includes(`data-k="${k}"`), `${k} is everywhere`);
});

test('every page of the business has its content, and the command page lists the people, offers the men in a town and none out of one', () => {
  const r = hub();
  at(r, 'kamianets');
  for (const k of ['map', 'roll', 'market', 'work', 'command', 'log']) {
    r(`ui.panel = '${k}'`);
    const p = r('panelHTML()');
    assert.ok(p.startsWith('<div class="pveil">') && p.includes(`class="drawer p-${k}"`) && p.includes('data-act="panelClose"') && p.includes('class="dbody"'), `${k}: a drawer with a way out`);
    assert.ok(!/undefined|NaN|\[object|\bnull\b/.test(p.replace(/<[^>]*>/g, ' ')), `${k}: no stray words`);
  }
  r("ui.panel = 'command'; ui.post = 'surgeon'");
  const town = r('panelHTML()');
  assert.equal((town.match(/data-act="engage"/g) || []).length, 3, 'three men looking for the post');
  assert.ok(town.includes('role="tab"') && town.includes('data-act="post"'), 'a rail to the other posts');
  r("G.officers.surgeon = G.pool.surgeon[0]; G.pool.surgeon.shift()");
  const held = r('panelHTML()');
  assert.ok(held.includes('data-act="letgo"') && held.includes('Or in his place') && (held.match(/data-act="engage"/g) || []).length === 2, 'the man in post can be let go, or replaced');
  at(r, 'syvash');
  r("ui.panel = 'command'; ui.post = 'qm'");
  assert.ok(!r('panelHTML()').includes('data-act="engage"') && r('panelHTML()').includes('found in the towns'), 'officers are not hired at the lakes');
  r("ui.post = 'retainer'");
  assert.ok(r('panelHTML()').includes('Nobody rides with the train'));
  r("G.retainer = { type: 'kobzar', name: 'Old Ivan', wage: 3 }");
  assert.ok(r('panelHTML()').includes('Old Ivan') && r('panelHTML()').includes('data-act="letgoR"'));
  r("ui.post = 'captain'");
  assert.ok(r('panelHTML()').includes('Janos') && r('panelHTML()').includes('Reads the road'));
  r("ui.panel = null");
  assert.equal(r('panelHTML()'), '');
});

test('the title raises a banner in two steps, a commission and then a captain from three, and the bar tells a day’s changes once', () => {
  const r = hub();
  assert.ok(r('titleHTML()').includes('data-act="captains"') && !r('titleHTML()').includes('data-act="new"'), 'the title’s button goes to the captains');
  r("ui.captains = { q: 'salt', list: genCaptains() }; ui.screen = 'captain'");
  const html = r('captainsHTML()');
  assert.equal((html.match(/data-act="new" data-q="salt" data-c="\d"/g) || []).length, 3, 'three to choose from');
  for (const c of JSON.parse(r('JSON.stringify(ui.captains.list)'))) assert.ok(html.includes(c.name), c.name);
  assert.ok(!r('barHTML()').includes('data-act="panel"') && !r('barHTML()').includes('class="stats"'), 'no ledger before there is a company');
  at(r, 'kamianets');
  r("ui.screen = 'camp'; ui.deltas = { bread: -5, thalers: 12 }");
  const bar = r('barHTML()');
  assert.ok(bar.includes('delta down') && bar.includes('−5') && bar.includes('delta up') && bar.includes('+12'), 'what changed, once');
  r('ui.deltas = null');
  assert.ok(!r('barHTML()').includes('class="delta'));
  assert.equal(r('SAVE'), 'sotnia-save-3');
  for (const f of ['screens', 'main']) assert.ok(/\.v === 3/.test(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8')), `${f}.js loads only saves of version 3`);
});

test('a day passing over the camp: the light goes from the night the camp is drawn at, through dawn and noon and dusk, and back, and the pictures differ', () => {
  const r = hub();
  const l = q => JSON.parse(r(`JSON.stringify(lightAt(${q}))`));
  assert.deepEqual(l(0), { d: 0, w: 0, sun: null, moon: 1 }, 'the camp is drawn at night');
  assert.deepEqual(l(1), l(0), 'and a day ends where it began');
  assert.ok(l(0.5).d === 1 && l(0.5).sun > 0.4 && l(0.5).sun < 0.6 && l(0.5).moon === 0, 'noon: full light, the sun at the top of its arc, no moon');
  assert.ok(l(0.22).w > 0.9 && l(0.78).w > 0.9 && l(0.5).w === 0, 'the glow is at dawn and at dusk');
  assert.ok(l(0.2).d < l(0.3).d && l(0.7).d > l(0.8).d, 'the light comes up and goes down');
  assert.ok(l(0.1).sun === null && l(0.9).sun === null, 'the sun is up for most of the day');
  // the pictures: a camp view on the recording canvas, drawn at night, at noon, at dusk, and again at night
  at(r, 'kamianets');
  const draw = (t, dur = 1) => r(`(() => {
    if (!globalThis.V) { const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }; const buf = sceneCanvas(CW, CH); V = { cv: mk(0, 0), ctx: document.createElement('canvas').getContext('2d'), buf, g: buf.getContext('2d'), sel: sceneCanvas(44, 44), back: null, key: '', pos: {}, parts: [], t: 0, btns: null }; }
    V.buf = sceneCanvas(CW, CH); V.g = V.buf.getContext('2d');
    drawCamp(V, G, null, 0, true, ${t === null ? 'null' : `{ kind: 'rest', days: 1, t: ${t}, dur: ${dur}, res: { lines: [], event: null }, ledger: ledgerOf(G), oldBack: null, swapped: false }`});
    return V.buf.toDataURL();
  })()`);
  const night = draw(null), n0 = draw(0), noon = draw(0.5), dusk = draw(0.78), n1 = draw(1);
  assert.equal(n0, night, 'a day just begun is the night camp');
  assert.equal(n1, night, 'and one just ended is too');
  assert.equal(new Set([night, noon, dusk]).size, 3, 'noon, dusk and night are told apart');
});
