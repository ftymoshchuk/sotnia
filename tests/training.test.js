'use strict';
/* The training commission and the guide that walks a captain through it (js/training.js), run headless: the quest on the rules alone (js/core.js, journey.js and
 * command.js, with a seeded random so that every run repeats), and the guide on the stand-in for the page (tests/dom-stub.js), with the game's own act() and render().
 * What these check is what the guide decides: which step it is at, what it says and rings, when it goes on, and that a captain who does what it says reaches the
 * end of the road, whatever the dice. How the strip looks, and how the ring shows on a card, are for the eye (the browser). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./dom-stub');

const ROOT = path.join(__dirname, '..');
const SEEDED = seed => `Math.random = (() => { let a = ${seed}; return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;
const CAPTAINS = ['ataman', 'rotmistrz', 'hauptmann', 'colonel', 'hussar', 'swede'];
const OTHERS = ['salt', 'oxen', 'grain', 'payroll'];

function rules(seed) {
  const ctx = vm.createContext({});
  vm.runInContext(SEEDED(seed), ctx);
  for (const f of ['js/core.js', 'js/journey.js', 'js/command.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return code => vm.runInContext(code, ctx);
}
// Values built inside the VM have its own Array and Object, which strict equality treats as different types; JSON brings them across as plain values.
const plain = (r, code) => JSON.parse(r('JSON.stringify(' + code + ')'));

/** The game on a stand-in page with a seeded random, and a training begun under a captain of a kind. */
function training(seed = 1, captain = 'hauptmann') {
  const p = page();
  p.run(SEEDED(seed));
  p.run(`act('captains', { q: 'training' })`);
  p.run(`ui.captains.list[0] = { type: '${captain}', name: 'Test Captain' }; act('new', { q: 'training', c: '0' })`);
  return {
    p,
    html: () => ['#view', '#panel', '#modal', '#coach'].map(k => (p.found[k] ? p.found[k].innerHTML : '')).join('\n'), // everything on the screen
    strip: () => (p.found['#coach'] ? p.found['#coach'].innerHTML : ''),
    step: () => p.run('G.training && TRAINING[G.training.step] ? TRAINING[G.training.step].id : null'),
    view: () => JSON.parse(p.run('JSON.stringify(coachView())'))
  };
}

/* An aim names one thing with an attribute, a class, an id or an attribute that is absent, joined. Whether a tag of the markup is what one names. */
function onScreen(markup, selector) {
  const tags = markup.match(/<[a-zA-Z][^>]*>/g) || [], parts = selector.match(/:not\(\[[\w-]+\]\)|\[[^\]]+\]|[.#][\w-]+/g);
  assert.equal(parts.join(''), selector, `${selector}: made of attributes, classes, ids and absent attributes only`);
  return tags.some(tag => parts.every(part => {
    let m;
    if ((m = /^:not\(\[([\w-]+)\]\)$/.exec(part))) return !new RegExp('\\s' + m[1] + '(=|\\s|>)').test(tag);
    if ((m = /^\[([\w-]+)="([^"]*)"\]$/.exec(part))) return tag.includes(' ' + m[1] + '="' + m[2] + '"');
    if (part[0] === '.') return new RegExp('class="([^"]* )?' + part.slice(1) + '( [^"]*)?"').test(tag);
    return tag.includes(' id="' + part.slice(1) + '"');
  }));
}

/* ---------- the commission ---------- */
test('the training is a short, quiet commission with days to spare, a market, men to hire and work at every stop, and a pay day on the road', () => {
  const r = rules(1), q = plain(r, `QUESTS.find(q => q.training)`);
  assert.equal(plain(r, 'QUESTS.filter(q => q.training).length'), 1, 'one training');
  assert.equal(q.id, 'training');
  assert.equal(q.kind, 'commission', 'it is a commission, with a chest to carry and a fee for it');
  assert.equal(plain(r, 'QUESTS[0].id'), 'salt', 'it is last, so that the quest an unknown id falls back to is still the salt');
  const route = plain(r, `(() => { const st = newGame('training'), legs = routeTo(st, questOf(st).to); return { legs: legs.map(l => ({ from: l.from, to: l.to, danger: l.danger })), days: daysToGo(st) }; })()`);
  assert.equal(route.legs.length, 2, 'two legs: one to march by hand and a course for the last');
  for (const l of route.legs) assert.ok(l.danger <= 1, `${l.from} to ${l.to}: a quiet road`);
  for (const place of [q.from, ...route.legs.map(l => l.to)]) {
    const has = plain(r, `SERVICES[PLACES[${JSON.stringify(place)}].kind]`);
    assert.ok(has.market && has.recruits && has.work, `${place}: a market, men to hire and work posted, which the lesson teaches at the first stop and uses at the second`);
  }
  assert.ok(q.deadline - q.start >= 2 * route.days, `${route.days} days of road with ${q.deadline - q.start} to spare: time for a fight, a rest and an event`);
  assert.ok(q.payIn > 0 && q.payIn < 30 && q.payIn <= route.days, 'the first pay day falls on the road, where a captain sees the men paid');
  assert.equal(plain(r, `(() => { const st = newGame('training'); return st.payDue - st.date; })()`), q.payIn);
  assert.equal(plain(r, `(() => { const st = newGame('salt'); return st.payDue - st.date; })()`), 30, 'and any other commission pays thirty days on, as it did');
  assert.ok(q.threatCap && q.threatCap <= 4, 'its foes stay those of the first days, where a road that short would climb to the last of them');
  assert.equal(plain(r, `(() => { const st = newGame('training'); st.at = questOf(st).to; return threat(st); })()`), q.threatCap, 'at the end of the road threat is its cap');
  assert.equal(plain(r, `(() => { const st = newGame('salt'); st.at = questOf(st).to; return threat(st); })()`), 24, 'and where a commission names none it is as it was');
  assert.deepEqual(plain(r, `newGame('training').training`), { step: 0 }, 'it has a guide, at the first step');
  for (const o of OTHERS) assert.equal(plain(r, `newGame('${o}').training === undefined`), true, `${o}: and no other has`);
});

test('what the guide asks, a company of any captain can afford, and so does the road: it delivers the chest on time, whole, and pays the first pay day', () => {
  // the path the lesson takes: the dearest man the purse allows, bread for each stretch, the easy job, then the road leg by leg, answering what comes up as a careful captain does
  const RUN = `(captain => {
    const st = newGame('training', { type: captain, name: 'Test' }), q = questOf(st), out = { ambushes: 0 };
    const dear = st.recruits.map((r, i) => ({ i, p: recruitPrice(st, r) })).filter(x => x.p <= st.thalers).sort((a, b) => b.p - a.p)[0];
    hire(st, dear.i);
    const stock = () => { const leg = routeTo(st, q.to)[0]; while (st.bread < breadDue(st) * leg.days && st.thalers >= breadPrice(st)) buy(st, 'bread'); };
    stock();
    const job = st.contracts.find(c => c.grade === 'easy'), ids = defaultPick(st, job), b = battleFor(st, job, ids, 'advance', false);
    while (!b.over) stepBattle(b, 0.1);
    resolveBattle(st, job, b); campDay(st);
    for (let step = 0; step < 30 && !st.over; step++) {
      if (st.pending) applyEvent(st, 0);
      if (st.ambush) { out.ambushes++; const a = st.ambush, ids2 = defaultPick(st, a), bb = battleFor(st, a, ids2, 'advance', false); while (!bb.over) stepBattle(bb, 0.1); resolveBattle(st, a, bb); continue; }
      if (atEnd(st)) { deliver(st); break; }
      stock();
      march(st, routeTo(st, q.to)[0].i, false);
    }
    out.unpaid = st.log.some(l => /cannot cover/.test(l.t)); out.paid = st.log.some(l => /^Pay day\\. /.test(l.t));
    return Object.assign(out, { over: st.over, late: st.result && st.result.late, pay: st.result && st.result.pay, men: st.roster.length });
  })`;
  for (const captain of CAPTAINS) for (const seed of [1, 2, 3, 4, 5, 6]) {
    const out = plain(rules(seed * 101), RUN + `(${JSON.stringify(captain)})`), who = `${captain}, seed ${seed}: ${JSON.stringify(out)}`;
    assert.equal(out.over, 'arrived', who);
    assert.equal(out.late, 0, who);
    assert.equal(out.pay, 60, `${who}: the whole fee, since nothing is missing from the chest`);
    assert.ok(out.paid && !out.unpaid, `${who}: the first pay day comes on the road and is paid`);
    assert.ok(out.men >= 3, who);
  }
});

/* ---------- the lesson ---------- */
test('the lesson is well made: its steps go in order from the commission to the farewell, and only what is read has no way of being done', () => {
  const { p } = training();
  const steps = JSON.parse(p.run(`JSON.stringify(TRAINING.map(s => ({ id: s.id, chapter: s.chapter, title: s.title, screens: s.screens, done: !!s.done, elsewhere: !!s.elsewhere })))`));
  const order = ['goal', 'camp', 'fight', 'road', 'end'], screens = ['title', 'captain', 'camp', 'muster', 'battle', 'report', 'end', 'codex'], chapter = s => order.indexOf(s.chapter);
  assert.equal(new Set(steps.map(s => s.id)).size, steps.length, 'each step has an id of its own');
  assert.deepEqual(steps.map(chapter), steps.map(chapter).sort((a, b) => a - b), 'the chapters follow one another');
  assert.deepEqual(steps.filter(s => s.chapter === 'goal').map(s => s.id), ['commission', 'ledger'], 'it begins with what the commission is for, and how the ledger keeps it');
  assert.deepEqual([steps.at(-1).id, steps.at(-1).screens], ['farewell', ['end']], 'and ends at the end of the road');
  assert.deepEqual(steps.filter(s => !s.done).map(s => s.id), ['commission', 'ledger', 'farewell'], 'the rest is done by doing it');
  for (const s of steps) {
    assert.ok(s.title.length > 0 && s.title.length <= 32, `${s.id}: a short title`);
    assert.ok(s.screens.length && s.screens.every(x => screens.includes(x)), `${s.id}: screens that there are`);
    // a step of the fight can be current while the captain is in the camp (he went back, or the page was loaded again): the guide must have something to say
    if (s.done && !s.screens.includes('camp') && s.id !== 'report') assert.ok(s.elsewhere, `${s.id}: a word for the camp, where it cannot be done`);
  }
});

test('every step says what it has to in a few lines, with the game’s own numbers, in every state it is read in', () => {
  const { p } = training();
  const n = p.run('TRAINING.length');
  for (let i = 0; i < n; i++) for (const panel of [null, 'roll', 'market', 'work', 'map']) {
    const out = JSON.parse(p.run(`(() => { G.training.step = ${i}; ui.panel = ${JSON.stringify(panel)}; const s = TRAINING[${i}]; return JSON.stringify({ id: s.id, text: s.text(G), aim: s.aim(G) }); })()`));
    const words = out.text.join(' ');
    assert.ok(out.text.length >= 1 && out.text.length <= 3 && out.text.every(l => typeof l === 'string' && l.length > 0), `${out.id}, ${panel}: one to three paragraphs`);
    assert.ok(words.length <= 340, `${out.id}, ${panel}: ${words.length} characters is more than a strip can hold`);
    assert.ok(!/undefined|NaN|\bnull\b|\[object/.test(words), `${out.id}, ${panel}: ${words}`);
    assert.ok(out.aim.every(a => typeof a === 'string' && a.length), `${out.id}, ${panel}: an aim is a selector`);
  }
});

test('the ledger step tells the days to the first pay day with their unit, and the bread step quotes what the company eats, has and pays', () => {
  const { p } = training(4);
  const ledger = JSON.parse(p.run(`JSON.stringify(TRAINING.find(s => s.id === 'ledger').text(G))`)).join(' ');
  assert.ok(/in 6 days\)/.test(ledger), ledger);
  assert.equal(p.run('G.payDue - G.date'), 6);
  p.run('G.date = G.payDue - 1');
  assert.ok(/in 1 day\)/.test(JSON.parse(p.run(`JSON.stringify(TRAINING.find(s => s.id === 'ledger').text(G))`)).join(' ')), 'and one day is a day');
  p.run("ui.panel = 'market'");
  const market = JSON.parse(p.run(`JSON.stringify(TRAINING.find(s => s.id === 'bread').text(G))`)).join(' ');
  assert.ok(market.includes(`${p.run('breadDue(G)')} loaves a day`) && market.includes(`You have ${p.run('G.bread')}.`) && market.includes(`${p.run('breadPrice(G)')} thalers`), 'the bread step quotes what the company eats, has and pays: ' + market);
  assert.ok(market.includes(`${p.run('breadDue(G) * trainLeg(G).days')} in all`), 'and what the road needs');
});

test('the words of the guide are escaped, with bold for what to look for and the icon of a thing the captain will see', () => {
  const { p } = training();
  const html = p.run(`coachMarkup('Press **Muster** on <b>it</b> & "go": {book} {nothing}')`);
  assert.ok(html.includes('<b>Muster</b>'), 'bold');
  assert.ok(/<svg class="i"/.test(html) && !html.includes('{book}'), 'an icon that there is');
  assert.ok(html.includes('{nothing}'), 'and a word in braces that is none stays as it was');
  assert.ok(!html.includes('<b>it</b>') && html.includes('&lt;b&gt;it&lt;/b&gt; &amp; &quot;go&quot;'), 'markup the guide was given is text');
});

/* ---------- the guide beside the captain ---------- */
test('the captain is guided from the choice of a captain to the end of the road, whatever the dice: each step is shown, rings things that are on the screen, and goes on when it is done', () => {
  // let a day go by, and answer whatever dialog turns up, as a captain would
  const settle = p => {
    for (let i = 0; i < 12; i++) {
      if (p.run('!!ui.pass')) { p.run('endPass()'); continue; }
      const m = p.run('ui.modal && ui.modal.type');
      if (!m) break;
      if (m === 'ambush') p.run("act('fightambush', {}); act('fight', {}); while (!ui.b.over) stepBattle(ui.b, 0.1); act('report', {}); act('camp', {})");
      else if (m === 'event') p.run("act('choice', { i: 0 })");
      else p.run("act('close', {})");
    }
  };
  // what a captain does at each step, with the game's own clicks
  const DO = {
    commission: "act('trainNext', {})", ledger: "act('trainNext', {})",
    roll: "act('panel', { k: 'roll' })",
    orders: "act('order', { id: G.roster[0].id, o: 'forage' })",
    close: "act('panelClose', {})",
    market: "act('panel', { k: 'market' })",
    hire: "act('hire', { i: G.recruits.findIndex(r => recruitPrice(G, r) <= G.thalers) })",
    bread: "while (G.bread < breadDue(G) * trainLeg(G).days) act('buy', { k: 'bread' })",
    work: "act('panelClose', {}); act('panel', { k: 'work' })",
    muster: "act('muster', { id: easyJob(G).id })",
    arms: "act('fight', {})",
    battle: "while (!ui.b.over) stepBattle(ui.b, 0.1); act('report', {})",
    report: "act('camp', {})",
    leg: "act('panelClose', {}); act('panel', { k: 'map' }); act('march', { r: trainLeg(G).i })",
    town: "act('panelClose', {}); act('panel', { k: 'market' }); while (G.bread < breadDue(G) * trainLeg(G).days) act('buy', { k: 'bread' })",
    course: "act('panelClose', {}); act('panel', { k: 'map' }); act('course', {})",
    deliver: "act('deliver', {})",
    farewell: "act('trainNext', {})"
  };
  const MUST = ['commission', 'ledger', 'roll', 'orders', 'close', 'market', 'hire', 'bread', 'work', 'muster', 'arms', 'battle', 'report', 'leg', 'course', 'deliver', 'farewell'];
  for (const [seed, captain] of [[3, 'hauptmann'], [8, 'ataman'], [21, 'swede'], [34, 'hussar']]) {
    const { p, html, strip, step, view } = training(seed, captain), seen = [], who = `seed ${seed}, ${captain}`;
    for (let guard = 0; guard < 40 && step(); guard++) {
      settle(p);
      const id = step(); if (!id) break;
      const at = `${who}, at ${id}`, v = view(), s = JSON.parse(p.run('JSON.stringify(TRAINING[G.training.step])'));
      seen.push(id);
      assert.ok(v, `${at}: the strip has something to say`);
      assert.equal(v.title, s.title, `${at}: it is the step's own`);
      assert.ok(s.screens.includes(p.run('ui.screen')), `${at}: and it is shown where it is to be done`);
      assert.ok(strip().includes('role="region"') && strip().includes(`<h2>${v.title}</h2>`), `${at}: the strip is a region and says its title`);
      assert.ok(v.n >= 1 && v.n <= v.of, `${at}: it says how far on it is`);
      assert.ok(v.aim.length > 0, `${at}: it rings something`);
      for (const a of v.aim) assert.ok(onScreen(html(), a), `${at}: ${a} is on the screen`);
      assert.equal(v.todo, !v.button, `${at}: it asks the captain to do something, or has a button that goes on`);
      p.run(DO[id]); settle(p);
      assert.notEqual(step(), id, `${at}: it goes on when the captain has done what it asked`);
    }
    assert.equal(p.run('G.over'), 'arrived', `${who}: the chest was delivered`);
    assert.equal(p.run('trainingOf(G)'), null, `${who}: and the guide is done`);
    assert.equal(strip(), '', `${who}: so the strip is gone`);
    for (const must of MUST) assert.ok(seen.includes(must), `${who}: ${must} was taught (${seen.join(', ')})`);
    assert.deepEqual(seen.map(id => p.run(`TRAINING.findIndex(s => s.id === '${id}')`)), seen.map(id => p.run(`TRAINING.findIndex(s => s.id === '${id}')`)).sort((a, b) => a - b), `${who}: in the order of the lesson`);
  }
});

test('the guide only watches: it goes on when what it asked is done, never before, and not for being drawn again', () => {
  const { p, step } = training(5);
  assert.equal(step(), 'commission');
  for (let i = 0; i < 4; i++) p.run('render()');
  assert.equal(step(), 'commission', 'drawing the screen again does not move it');
  p.run("act('panel', { k: 'roll' })");
  assert.equal(step(), 'commission', 'a step that is read waits for the captain, whatever he does ahead of it');
  p.run("act('trainNext', {}); act('trainNext', {})");
  assert.equal(step(), 'orders', 'and the step after, done already (the page is open), is passed at once');
  p.run("act('order', { id: G.roster[0].id, o: 'rest' })");
  assert.equal(step(), 'orders', 'an order that is not the one asked for is not it');
  p.run("act('order', { id: G.roster[1].id, o: 'forage' })");
  assert.equal(step(), 'close', 'any man sent to forage will do');
  p.run("act('panelClose', {}); act('panel', { k: 'market' })");
  assert.equal(step(), 'hire');
  // ahead of the guide: the bread is there before it asks for it, and a man is hired, so it passes both
  p.run("G.bread = 500; act('hire', { i: G.recruits.findIndex(r => recruitPrice(G, r) <= G.thalers) })");
  assert.equal(step(), 'work', 'a man hired and the bread there: both steps are done');
  // the way to the step is said when its page is not open, and what to do in it when it is
  p.run("act('panelClose', {}); act('panel', { k: 'work' })");
  assert.equal(step(), 'muster', 'with the noticeboard open the guide moves on to the job');
  p.run("act('panelClose', {})");
  const shut = JSON.parse(p.run('JSON.stringify(coachView())'));
  assert.ok(shut.lines.join(' ').includes('noticeboard') && shut.aim.join(' ').includes('data-k="work"'), 'with it shut, the step is the way to it, ringed');
  p.run("act('panel', { k: 'work' })");
  assert.ok(JSON.parse(p.run('JSON.stringify(coachView())')).aim[0].startsWith('[data-act="muster"][data-id="'), 'and open, the easy job’s button is what is ringed');
});

test('what the guide says in a dialog, and on a screen of a fight that is not its step, is for that dialog or screen, and rings nothing behind a dialog', () => {
  const { p, view } = training(2);
  p.run("G.training.step = TRAINING.findIndex(s => s.id === 'leg'); ui.modal = { type: 'ambush' }");
  let v = view();
  assert.equal(v.title, 'Raiders on the road');
  assert.deepEqual(v.aim, [], 'nothing is rung behind a dialog');
  assert.equal(v.skip, false, 'and there is no step to skip');
  p.run("ui.modal = { type: 'event' }");
  assert.equal(view().title, 'A camp event');
  p.run("ui.modal = { type: 'help', prev: null }");
  assert.equal(view().title, 'March a leg', 'the standing orders are no dialog of the road: the step stays');
  p.run("ui.modal = null");
  for (const [screen, title] of [['muster', 'At the muster'], ['battle', 'The fight'], ['report', 'The count']]) {
    p.run(`ui.screen = '${screen}'`);
    assert.equal(view().title, title, screen);
  }
  p.run("ui.screen = 'camp'; G.training.step = TRAINING.findIndex(s => s.id === 'arms')");
  v = view();
  assert.equal(v.title, 'To the fight', 'a step of the fight, met in the camp, says how to get to the fight');
  assert.ok(v.aim.join(' ').includes('data-k="work"'), 'and rings the noticeboard');
  p.run("G.training.step = TRAINING.findIndex(s => s.id === 'battle'); render()");
  assert.equal(view().title, 'To the fight', 'whichever step of the fight it is');
  p.run("ui.screen = 'codex'");
  assert.equal(view(), null, 'the encyclopedia is no place for a guide');
});

test('a step can be skipped, the guide folded to its heading or sent away, and what is not the guide goes on as it was', () => {
  const { p, step, strip } = training(9);
  p.run("act('trainSkip', {})");
  assert.equal(step(), 'ledger', 'skipped');
  p.run("act('trainMin', {})");
  assert.equal(p.run('ui.coachMin'), true);
  assert.ok(strip().includes('class="coach min"') && strip().includes('aria-expanded="false"'), 'folded, and says so to a reader of the screen');
  p.run("act('trainMin', {})");
  assert.ok(strip().includes('class="coach"') && strip().includes('aria-expanded="true"'), 'and unfolded');
  const day = p.run('G.day');
  p.run("act('trainLeave', {})");
  assert.equal(p.run('G.training.off'), true);
  assert.equal(strip(), '', 'sent away: no strip');
  assert.equal(p.run('trainingOf(G)'), null);
  p.run("act('halt', {}); while (ui.pass) endPass()");
  assert.ok(p.run('G.day') > day, 'and the campaign is still played');
  assert.equal(strip(), '', 'it does not come back');
});

test('a training that is saved carries on where the guide was, and one that was sent away stays away', () => {
  const { p, step } = training(12);
  p.run("act('trainNext', {}); act('trainNext', {}); act('panel', { k: 'roll' })");
  assert.equal(step(), 'orders');
  // what save() writes and loadSave() reads back
  const saved = p.run('JSON.stringify(G)');
  p.run(`G = JSON.parse(${JSON.stringify(saved)}); ui.panel = 'roll'; render()`);
  assert.equal(step(), 'orders', 'the same step');
  assert.ok(p.found['#coach'].innerHTML.includes('Give an order'), 'and its words');
  p.run("act('trainLeave', {}); G = JSON.parse(JSON.stringify(G)); render()");
  assert.equal(p.found['#coach'].innerHTML, '', 'a guide sent away stays away');
  // a save from before the guide has no state for it: that is every other commission
  p.run(`G = JSON.parse(JSON.stringify(newGame('payroll', { type: 'hussar', name: 'X' }))); ui.screen = 'camp'; ui.panel = null; render()`);
  assert.equal(p.run('G.training === undefined'), true);
  assert.equal(p.found['#coach'].innerHTML, '');
});

/* ---------- the title and the captain's choice ---------- */
test('the title offers the training apart from the commissions of the year, and first, with what it covers; and no other commission has a guide', () => {
  const p = page();
  const title = p.run('titleHTML()'), lesson = title.indexOf('new to the company? begin here'), year = title.indexOf('Commissions for the year 1633');
  assert.equal((title.match(/data-act="captains" data-q="training"/g) || []).length, 2, 'a button in the hero, and the button on its card');
  assert.ok(title.includes('Begin the training') && title.includes('class="badge moss"'), 'and it says it is a training');
  assert.ok(lesson > 0 && lesson < year, 'in a place of its own, before the commissions of the year');
  assert.ok(!title.slice(year).includes('data-q="training"'), 'which do not list it');
  for (const q of OTHERS) assert.ok(title.slice(year).includes(`data-q="${q}"`), `${q}: and still list the rest`);
  for (const t of JSON.parse(p.run(`JSON.stringify(TRAINING.filter(s => s.chapter !== 'end').map(s => s.title))`))) assert.ok(title.includes(t), `what it covers: ${t}`);
  // the choice of a captain has a word on it for the training, and none for the others
  p.run("act('captains', { q: 'training' })");
  const strip = p.found['#coach'].innerHTML;
  assert.ok(strip.includes('Choose a captain') && !strip.includes('trainLeave') && !strip.includes('trainSkip'), 'a captain to choose, and no company yet to leave or step to skip');
  assert.ok(JSON.parse(p.run('JSON.stringify(coachView().aim)')).includes('[data-act="new"]'), 'ringing the captains');
  p.run("act('title', {}); act('captains', { q: 'oxen' })");
  assert.equal(p.found['#coach'].innerHTML, '', 'none for another commission');
  for (const q of OTHERS) {
    p.run(`G = newGame('${q}', { type: 'hussar', name: 'X' }); ui.screen = 'camp'; ui.panel = null; render()`);
    assert.equal(p.run('G.training === undefined'), true, `${q}: no guide`);
    assert.equal(p.found['#coach'].innerHTML, '', `${q}: no strip`);
  }
});
