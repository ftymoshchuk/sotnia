'use strict';
/* The music, run headless: the same js/music.js and js/score.js the page loads, in a VM context.
 * The composing needs no audio at all; the playing runs against tests/webaudio-stub.js, which
 * throws wherever a browser would. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { AudioContext } = require('./webaudio-stub.js');

const ROOT = path.join(__dirname, '..');
function music() {
  const ctx = vm.createContext({});
  for (const f of ['js/music.js', 'js/score.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
// The bars a cue plays over `minutes`, as plain values: { sec, rest, events }.
function bars(ctx, cue, seed, minutes) {
  ctx.args = { cue, seed, minutes };
  return JSON.parse(vm.runInContext(`(() => {
    const p = MUSIC.performer(SCORE, args.cue, args.seed, { opening: true }), out = [];
    for (let t = 0; t < args.minutes * 60;) {
      const b = p.next(), sec = b.rest != null ? b.rest : b.beats * 60 / b.bpm;
      out.push({ sec, rest: b.rest != null, beats: b.beats, piece: b.piece, events: b.events || [] });
      t += sec;
    }
    return JSON.stringify(out);
  })()`, ctx));
}
// What a bar plays, leaving out the small differences in time and loudness every performance has.
const notes = bar => (bar.rest ? 'rest' : JSON.stringify(bar.events.map(e => [e.ins, e.m, Math.round(e.at * 100), Math.round(e.d * 100)]).sort()));

test('the score reads: every bar fills its metre and every tune fits its ground', () => {
  const ctx = music();
  assert.doesNotThrow(() => vm.runInContext('MUSIC.compile(SCORE)', ctx));
  // And a mistake is caught, not played.
  assert.throws(() => vm.runInContext(`MUSIC.compile({ pieces: { p: Object.assign({}, SCORE.pieces.folia, { tunes: { a: 'D5:2' } }) }, cues: {} })`, ctx), /holds 2 beats, not 3/);
  assert.throws(() => vm.runInContext(`MUSIC.compile({ pieces: { p: Object.assign({}, SCORE.pieces.duma, { ground: 'Dm Dm E' }) }, cues: {} })`, ctx), /has 8 bars, and its ground 3/);
});

test('the same seed plays the same music, and another seed other music', () => {
  for (const cue of ['camp', 'muster', 'battle']) {
    const a = bars(music(), cue, 5, 4), b = bars(music(), cue, 5, 4), c = bars(music(), cue, 6, 4);
    assert.deepEqual(a, b, `${cue}: the same seed played differently`);
    assert.notDeepEqual(a.map(notes), c.map(notes), `${cue}: two seeds played the same`);
  }
});

test('every note is one its instrument can play, and lasts', () => {
  const ctx = music(), range = JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.entries(MUSIC.SOUNDS).map(([k, s]) => [k, s.range || [0, 127]])))', ctx));
  for (const [cue, minutes] of [['camp', 30], ['muster', 6], ['battle', 6]]) {
    for (const seed of [1, 2, 3]) {
      for (const bar of bars(ctx, cue, seed, minutes)) {
        for (const e of bar.events) {
          assert.ok(range[e.ins], `${cue}: no instrument ${e.ins}`);
          assert.ok(e.m >= range[e.ins][0] && e.m <= range[e.ins][1], `${cue}: ${e.ins} cannot play ${e.m}`);
          assert.ok(e.d > 0 || e.sec > 0, `${cue}: a note of no length`);
          assert.ok(e.at >= 0 && e.at < bar.beats, `${cue}: a note outside its bar`);
          assert.ok(e.v > 0 && e.v <= 1.2, `${cue}: a note at ${e.v}`);
        }
      }
    }
  }
});

test('a long journey never comes round to the same stretch of music soon, or for long', () => {
  // The old camp music was a 38-second loop. Now a whole pass of a piece (under a minute) may come
  // back note for note, but only minutes later, and nothing of 20 seconds or more within three minutes.
  for (const seed of [1, 2, 3]) {
    const b = bars(music(), 'camp', seed, 30), sig = b.map(notes), start = [];
    b.reduce((t, x, i) => { start[i] = t; return t + x.sec; }, 0);
    let prev = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= b.length; i++) {
      const cur = new Array(b.length + 1).fill(0);
      for (let j = i + 1; j <= b.length; j++) {
        if (b[i - 1].rest || sig[i - 1] !== sig[j - 1]) continue;
        cur[j] = prev[j - 1] + b[i - 1].sec;
        const gap = start[j - 1] - start[i - 1];
        assert.ok(cur[j] <= 60, `seed ${seed}: ${cur[j].toFixed(0)} s heard twice`);
        assert.ok(cur[j] < 20 || gap >= 180, `seed ${seed}: ${cur[j].toFixed(0)} s heard again after ${gap.toFixed(0)} s`);
      }
      prev = cur;
    }
  }
});

test('the camp music rests between pieces, briefly, and the fight never does', () => {
  for (const seed of [1, 2, 3]) {
    const camp = bars(music(), 'camp', seed, 30), total = camp.reduce((s, x) => s + x.sec, 0);
    const rests = camp.filter(x => x.rest);
    const share = rests.reduce((s, x) => s + x.sec, 0) / total;
    assert.ok(share > 0.04 && share < 0.15, `seed ${seed}: resting ${(100 * share).toFixed(1)}% of the time`);
    for (const x of rests) assert.ok(x.sec >= 8 && x.sec <= 20, `seed ${seed}: a rest of ${x.sec} s`);
    // Every piece of the suite comes round in half an hour, and never twice running.
    const order = camp.filter(x => !x.rest).map(x => x.piece).filter((p, i, a) => p !== a[i - 1]);
    assert.deepEqual([...new Set(order)].sort(), ['duma', 'folia', 'lament', 'taniec']);
    assert.equal(order[0], 'folia', 'the music opens on the folia');
    for (const cue of ['muster', 'battle']) assert.ok(bars(music(), cue, seed, 5).every(x => !x.rest), `${cue} rested`);
  }
});

test('chords move by the smallest steps they can', () => {
  const worst = JSON.parse(vm.runInContext(`(() => { const S = MUSIC.compile(SCORE), out = {};
    for (const [name, P] of Object.entries(S.pieces)) {
      let prev = null, w = 0;
      for (let k = 0; k < 2; k++) for (const bar of P.ground) for (const [, ch] of bar) {
        const v = MUSIC.voiceLead(ch, prev, 50, 67, 3);
        if (prev) w = Math.max(w, ...v.map((m, i) => Math.abs(m - prev[i])));
        prev = v;
      }
      out[name] = w;
    }
    return JSON.stringify(out); })()`, music()));
  for (const [name, w] of Object.entries(worst)) assert.ok(w <= 5, `${name}: a voice leaps ${w} semitones between chords`);
});

test('ten minutes of each cue schedule without anything a browser would refuse', () => {
  const ctx = music();
  for (const cue of ['camp', 'muster', 'battle', 'final']) {
    const ac = new AudioContext();
    ctx.ac = ac; ctx.cue = cue;
    vm.runInContext(`player = MUSIC.play(ac, SCORE, cue, { at: 0.1, fade: 2, level: 0.1, seed: 9, opening: true })`, ctx);
    for (let t = 0; t < 600; t += 0.05) { ac.currentTime = t; vm.runInContext('player.tick(ac.currentTime)', ctx); }
    assert.ok(ac.started.length > 300, `${cue}: only ${ac.started.length} sounds in ten minutes`);
    // Every note stops within a minute of starting, and none starts before the cue does. (The slow
    // swells under a pad or a drone run as long as the cue, and close() stops them.)
    const notes = ac.started.filter(s => s.stoppedAt !== undefined);
    assert.ok(ac.started.length - notes.length <= 4, `${cue}: ${ac.started.length - notes.length} sounds that never stop`);
    for (const s of notes) {
      assert.ok(s.startedAt >= 0.09, `${cue}: a note at ${s.startedAt}`);
      assert.ok(s.stoppedAt > s.startedAt && s.stoppedAt - s.startedAt < 60, `${cue}: a note of ${s.stoppedAt - s.startedAt} s`);
    }
    // Fading out and closing stops everything.
    vm.runInContext('player.stop(ac.currentTime, 0.7); player.close()', ctx);
    for (const s of ac.started) assert.ok(s.stoppedAt !== undefined, `${cue}: a sound left running`);
  }
  for (const s of ['won', 'lost']) {
    const ac = new AudioContext();
    ctx.ac = ac; ctx.s = s;
    assert.ok(vm.runInContext('MUSIC.sting(ac, SCORE, s, 0.05, 0.1).end', ctx) > 1);
  }
});

test('after the page has slept, the music carries on from now instead of playing all it missed', () => {
  const ctx = music(), ac = new AudioContext();
  ctx.ac = ac;
  vm.runInContext(`player = MUSIC.play(ac, SCORE, 'battle', { at: 0.1, level: 0.1, seed: 3 })`, ctx);
  for (let t = 0; t < 10; t += 0.05) { ac.currentTime = t; vm.runInContext('player.tick(ac.currentTime)', ctx); }
  const before = ac.started.length;
  ac.currentTime = 70;
  vm.runInContext('player.tick(ac.currentTime)', ctx);
  const burst = ac.started.slice(before);
  assert.ok(burst.length < 60, `${burst.length} sounds at once`);
  for (const s of burst) assert.ok(s.startedAt >= 69.9, `a missed sound played late, at ${s.startedAt}`);
});
