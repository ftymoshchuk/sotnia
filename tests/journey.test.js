'use strict';
/* The rules of the road, run headless: the same js/core.js and js/journey.js the
 * page loads, in a VM context with a seeded Math.random so every run repeats
 * exactly. Neither file touches the DOM, which is what makes this possible. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');
const SEEDED = seed => `Math.random = (() => { let a = ${seed}; return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;

function rules(seed) {
  const ctx = vm.createContext({});
  vm.runInContext(SEEDED(seed), ctx);
  for (const f of ['js/core.js', 'js/journey.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return code => vm.runInContext(code, ctx);
}
// Values built inside the VM have its own Array and Object, which strict equality
// treats as different types; JSON brings them across as plain values.
const plain = (r, code) => JSON.parse(r('JSON.stringify(' + code + ')'));

/* A careful player: buys bread for the stretch to the next market, sells cargo
 * when the purse runs low, keeps four men, fights every ambush it can and takes
 * the road with the fewest days left. Evaluated inside the game's own scope. */
const PLAYER = `(questId => {
  const st = newGame(questId);
  for (let step = 0; step < 400 && !st.over; step++) {
    if (stranded(st)) { st.over = 'dissolved'; break; }
    if (st.pending) applyEvent(st, 0);
    if (st.ambush) {
      const c = st.ambush, ids = defaultPick(st, c);
      if (ids.length) { const b = battleFor(st, c, ids, 'advance', false); while (!b.over) stepBattle(b, 0.1); resolveBattle(st, c, b); }
      else payOff(st, 'cargo');
      continue;
    }
    for (const s of st.roster) while (s.promos > 0) promote(st, s.id, 'vig');
    if (atEnd(st)) { deliver(st); break; }
    const best = roadsFrom(st).reduce((a, r) => (!a || r.days + daysToGo(st, r.to) < a.days + daysToGo(st, a.to) ? r : a), null);
    if (has(st, 'market')) {
      if (st.thalers < 40) sellCargo(st, 5);
      while (st.bread < breadDue(st) * (marketDays(st, best) + 4) && st.thalers >= breadPrice(st)) buy(st, 'bread');
    }
    if (has(st, 'recruits') && st.roster.length < 4) { const spare = st.roster.length ? 30 : 0, i = st.recruits.findIndex(r => r.price <= st.thalers - spare); if (i >= 0) hire(st, i); }
    if (!st.roster.length) { campDay(st); continue; }
    march(st, best.i, false);
  }
  return { over: st.over, cargo: st.cargo, late: st.result ? st.result.late : null, pay: st.result ? st.result.pay : 0 };
})`;

test('every road joins two places on the map, and every place is in a land', () => {
  const r = rules(1);
  assert.deepEqual(plain(r, 'ROADS.filter(x => !PLACES[x.a] || !PLACES[x.b]).map(x => x.a + "-" + x.b)'), []);
  assert.deepEqual(plain(r, 'Object.keys(PLACES).filter(id => !LANDS[PLACES[id].land])'), []);
  assert.deepEqual(plain(r, 'Object.keys(LANDS).flatMap(k => LANDS[k].ambush).filter(a => !AMBUSHES[a])'), []);
  assert.deepEqual(plain(r, 'TEMPLATES.flatMap(t => t.lands || []).filter(l => !LANDS[l])'), []);
});

test('every quest can be travelled, at a steady pace, before its date', () => {
  const r = rules(1);
  for (const q of plain(r, 'QUESTS.map(q => q.id)')) {
    const days = r(`daysToGo(newGame(${JSON.stringify(q)}))`), left = r(`(q => q.deadline - q.start)(QUESTS.find(q => q.id === ${JSON.stringify(q)}))`);
    assert.ok(Number.isFinite(days), `${q}: no road reaches the destination`);
    assert.ok(days <= left, `${q}: the shortest steady route takes ${days} days, with ${left} to spare`);
  }
});

test('dates are written in both styles, Julian first', () => {
  const r = rules(1);
  assert.equal(r('dateText(dayOf(9, 13))'), '3/13 September 1633');
  assert.equal(r('dateText(dayOf(6, 9))'), '30 May/9 June 1633');
  assert.equal(r('dateText(dayOf(10, 5), true)'), '25 Sept./5 Oct.');
});

test('a saved campaign carries on after a round trip through JSON', () => {
  const r = rules(7);
  const after = r(`(() => {
    const st = JSON.parse(JSON.stringify(newGame('oxen')));
    const road = roadsFrom(st)[0];
    march(st, road.i, false);
    return { at: st.at, to: road.to, days: st.day - 1 };
  })()`);
  assert.equal(after.at, after.to);
  assert.ok(after.days > 0);
});

test('a careful company completes every quest', () => {
  for (const q of plain(rules(1), 'QUESTS.map(q => q.id)')) {
    const runs = [11, 12, 13, 14, 15].map(seed => { const r = rules(seed); return plain(r, PLAYER + '(' + JSON.stringify(q) + ')'); });
    for (const run of runs) assert.ok(run.over, `${q}: a run never ended`);
    const arrived = runs.filter(run => run.over === 'arrived');
    assert.ok(arrived.length >= 3, `${q}: only ${arrived.length} of 5 runs arrived: ${JSON.stringify(runs)}`);
  }
});
