"use strict";
/* ===== SOTNIA interface: sound effects and synthesised music ===== */
/* ---------- sound ---------- */
let AC = null, sfxT = 0, sfxN = 0;
function audio() {
  if (!ui.sound && !ui.music) return null;
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      AC.master = AC.createGain(); AC.master.gain.value = 0.45; AC.master.connect(AC.destination);
      AC.noise = mkNoise(AC);
    } catch (e) { AC = null; }
  }
  return AC;
}
function wake() { const ac = audio(); if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); }
function tone(ac, type, f0, f1, dur, vol, at) {
  const o = ac.createOscillator(), g = ac.createGain(), t = at || ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(ac.master); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(ac, type, f0, f1, dur, vol) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
  s.buffer = ac.noise; f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(ac.master); s.start(t); s.stop(t + dur + 0.02);
}
function sfx(kind) {
  if (!ui.sound) return;
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;
  if (now - sfxT > 0.07) { sfxT = now; sfxN = 0; }
  if (++sfxN > 4) return;
  try {
    if (kind === 'shot') { hiss(ac, 'lowpass', 2200, 260, 0.34, 0.9); tone(ac, 'sine', 120, 42, 0.14, 0.7); }
    else if (kind === 'fizz') hiss(ac, 'highpass', 3200, 5200, 0.12, 0.22);
    else if (kind === 'hit') hiss(ac, 'bandpass', 900, 500, 0.07, 0.4);
    else if (kind === 'clang') { tone(ac, 'square', 1900, 1700, 0.06, 0.13); tone(ac, 'square', 2850, 2600, 0.05, 0.09); }
    else if (kind === 'fall') tone(ac, 'sine', 170, 55, 0.24, 0.5);
    else if (kind === 'drum') { for (let i = 0; i < 4; i++) tone(ac, 'sine', 96, 48, 0.16, 0.8, now + [0, 0.22, 0.44, 0.58][i]); }
  } catch (e) { /* sound is optional */ }
}

/* ---------- music: every note is synthesised here, there are no recordings ---------- */
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const MUSIC_LEVEL = 0.46;
const LV = { timp: 0.22, snare: 0.6, strings: 0.22, brass: 0.2, choir: 0.2, lute: 0.16, fife: 0.1, bow: 0.09 };
const MU = { name: null, cue: null, gain: null, step: 0, next: 0, timer: 0, quiet: 0 };
function mkNoise(ac) {
  const len = ac.sampleRate * 0.5 | 0, nb = ac.createBuffer(1, len, ac.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return nb;
}
function musicBus(ac) {
  if (ac.mbus) return ac.mbus;
  const bus = ac.createGain(); bus.gain.value = MUSIC_LEVEL;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
  const len = ac.sampleRate * 2.6 | 0, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
  const hall = ac.createConvolver(); hall.buffer = ir;
  const wet = ac.createGain(); wet.gain.value = 0.3;
  bus.connect(comp); bus.connect(hall); hall.connect(wet); wet.connect(comp); comp.connect(ac.destination);
  return (ac.mbus = bus);
}
function osc(ac, type, f, t, end, det) {
  const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
  if (det) o.detune.value = det;
  o.start(t); o.stop(end + 0.05);
  return o;
}
function noiseHit(ac, out, t, type, freq, dur, v) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = ac.noise; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
}
const INS = {
  // kettle drum, tuned
  timp(ac, out, t, m, v) {
    const f = mf(m), g = ac.createGain();
    ['sine', 'triangle'].forEach(type => {
      const o = ac.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f * 1.7, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      o.connect(g); o.start(t); o.stop(t + 0.8);
    });
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.72); g.connect(out);
    noiseHit(ac, out, t, 'lowpass', 320, 0.08, v * 0.7);
  },
  // field drum
  snare(ac, out, t, v) {
    noiseHit(ac, out, t, 'bandpass', 1700, 0.09, v);
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.06);
    g.gain.setValueAtTime(v * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1);
  },
  // short low strokes that drive the battle
  strings(ac, out, t, m, dur, v) {
    const f = mf(m), end = t + dur, g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(480, end);
    osc(ac, 'sawtooth', f, t, end, -6).connect(lp); osc(ac, 'sawtooth', f, t, end, 6).connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, end);
    lp.connect(g); g.connect(out);
  },
  brass(ac, out, t, m, dur, v) {
    const f = mf(m), end = t + dur, g = ac.createGain(), lp = ac.createBiquadFilter(), hold = Math.max(t + 0.2, end - 0.03);
    lp.type = 'lowpass'; lp.Q.value = 1.4; lp.frequency.setValueAtTime(350, t);
    lp.frequency.linearRampToValueAtTime(Math.min(4200, f * 5), t + 0.07); lp.frequency.linearRampToValueAtTime(Math.min(2600, f * 3), t + 0.25);
    osc(ac, 'sawtooth', f, t, hold + 0.15, -7).connect(lp); osc(ac, 'sawtooth', f, t, hold + 0.15, 7).connect(lp);
    const sub = ac.createGain(); sub.gain.value = 0.4; osc(ac, 'square', f / 2, t, hold + 0.15).connect(sub); sub.connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.045); g.gain.linearRampToValueAtTime(v * 0.8, t + 0.2);
    g.gain.setValueAtTime(v * 0.8, hold); g.gain.linearRampToValueAtTime(0.0001, hold + 0.12);
    lp.connect(g); g.connect(out);
  },
  // men's voices on an open vowel
  choir(ac, out, t, ms, dur, v) {
    const end = t + dur, g = ac.createGain(), mix = ac.createGain();
    [[650, 4, 1], [1080, 5, 0.6], [2500, 6, 0.2]].forEach(fm => {
      const bp = ac.createBiquadFilter(), bg = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = fm[0]; bp.Q.value = fm[1]; bg.gain.value = fm[2];
      mix.connect(bp); bp.connect(bg); bg.connect(g);
    });
    ms.forEach((m, i) => osc(ac, 'sawtooth', mf(m), t, end + 0.55, i % 2 ? 9 : -9).connect(mix));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.35);
    g.gain.setValueAtTime(v, end - 0.1); g.gain.linearRampToValueAtTime(0.0001, end + 0.5);
    g.connect(out);
  },
  // lute or bandura
  pluck(ac, out, t, m, dur, v) {
    const f = mf(m), end = t + dur, g = ac.createGain(), lp = ac.createBiquadFilter(), ga = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(6000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + dur * 0.6);
    ga.gain.value = 0.35; osc(ac, 'sawtooth', f, t, end, -4).connect(ga); ga.connect(lp); osc(ac, 'triangle', f, t, end, 5).connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, end);
    lp.connect(g); g.connect(out);
  },
  fife(ac, out, t, m, dur, v) {
    const f = mf(m), end = t + dur, g = ac.createGain(), g2 = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
    const o = osc(ac, 'sine', f, t, end + 0.1), o2 = osc(ac, 'triangle', f * 2, t, end + 0.1);
    g2.gain.value = 0.18; l.frequency.value = 5.2;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.35, dur));
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end + 0.15);
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.035);
    g.gain.setValueAtTime(v, Math.max(t + 0.04, end - 0.04)); g.gain.linearRampToValueAtTime(0.0001, Math.max(t + 0.04, end - 0.04) + 0.09);
    g.connect(out); noiseHit(ac, out, t, 'highpass', 4000, 0.05, v * 0.25);
  },
  // a bowed bass under the lute
  bow(ac, out, t, m, dur, v) {
    const f = mf(m), end = t + dur, g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(1800, f * 6);
    osc(ac, 'sawtooth', f, t, end + 0.3, -5).connect(lp); osc(ac, 'sawtooth', f, t, end + 0.3, 5).connect(lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.25, dur / 3));
    g.gain.setValueAtTime(v, end - 0.05); g.gain.linearRampToValueAtTime(0.0001, end + 0.25);
    lp.connect(g); g.connect(out);
  }
};
const CH = {
  Dm: { bass: 38, arp: [50, 57, 62, 65], pad: [50, 57, 62, 65] },
  A: { bass: 33, arp: [52, 57, 61, 64], pad: [45, 52, 57, 61] },
  C: { bass: 36, arp: [52, 55, 60, 64], pad: [48, 55, 60, 64] },
  F: { bass: 41, arp: [53, 57, 60, 65], pad: [41, 53, 57, 60] },
  Bb: { bass: 34, arp: [53, 58, 62, 65], pad: [46, 53, 58, 62] }
};
const CUES = {
  // Camp: a lute over the folia ground, the common dance bass of the century, in sarabande time. A fife joins for the second half.
  camp: {
    bpm: 76, div: 2, len: 96, fade: 1.8,
    ground: ['Dm', 'A', 'Dm', 'C', 'F', 'C', 'Dm', 'A', 'Dm', 'A', 'Dm', 'C', 'F', 'C', 'Dm', 'Dm'],
    mel: [[[0, 74, 2], [2, 77, 3], [5, 76, 1]], [[0, 76, 2], [2, 73, 3], [5, 74, 1]], [[0, 74, 2], [2, 77, 3], [5, 79, 1]], [[0, 79, 2], [2, 76, 3], [5, 77, 1]],
      [[0, 81, 2], [2, 77, 3], [5, 76, 1]], [[0, 76, 2], [2, 72, 3], [5, 74, 1]], [[0, 77, 2], [2, 74, 2], [4, 73, 2]], [[0, 74, 6]]],
    play(ac, out, st, t, s) {
      const bar = Math.floor(st / 6), k = st % 6;
      let ch = CH[this.ground[bar]];
      if (bar === 14 && k >= 4) ch = CH.A;
      if (k === 0) { INS.pluck(ac, out, t, ch.bass + 12, s * 5, LV.lute * 1.5); INS.bow(ac, out, t, ch.bass, s * 5.6, LV.bow); }
      if (bar === 14 && k === 4) INS.pluck(ac, out, t, 45, s * 2, LV.lute * 1.5);
      INS.pluck(ac, out, t + (k ? 0 : 0.02), ch.arp[[3, 1, 2, 3, 2, 1][k]], s * 3.2, LV.lute * (k === 2 ? 1.3 : 1));
      if (bar >= 8) for (const n of this.mel[bar - 8]) if (n[0] === k) INS.fife(ac, out, t, n[1], n[2] * s * 0.96, LV.fife * 1.7);
    }
  },
  // Muster: field drum, kettle drums and a fife in the raised-fourth minor heard across Ukraine and Hungary.
  muster: {
    bpm: 96, div: 4, len: 64, fade: 0.4,
    mel: [[[0, 74, 3], [3, 76, 1], [4, 77, 4], [8, 80, 4], [12, 81, 4]], [[0, 81, 6], [6, 80, 2], [8, 77, 4], [12, 76, 4]],
      [[0, 77, 3], [3, 76, 1], [4, 74, 4], [8, 72, 4], [12, 74, 4]], [[0, 69, 8], [8, 74, 8]]],
    play(ac, out, st, t, s) {
      const bar = Math.floor(st / 16), k = st % 16;
      if (k === 0) { INS.timp(ac, out, t, 38, LV.timp); INS.bow(ac, out, t, 38, s * 15.5, LV.bow * 0.6); INS.bow(ac, out, t, 45, s * 15.5, LV.bow * 0.4); }
      if (k === 8) INS.timp(ac, out, t, 33, LV.timp * 0.75);
      const a = [1, 0, 0, 0.35, 1, 0, 0.35, 0.35, 1, 0, 0, 0.35, 1, 0.4, 0.5, 0.6][k];
      if (a) INS.snare(ac, out, t, a * LV.snare);
      for (const n of this.mel[bar]) if (n[0] === k) INS.fife(ac, out, t, n[1], n[2] * s * 0.92, LV.fife);
    }
  },
  // Battle: war drums in a 3-3-2 pulse, driving low strings, a brass theme, and voices. Two bars of drums, then a sixteen-bar loop.
  battle: {
    bpm: 132, div: 4, len: 288, loopTo: 32, fade: 0.15, tr: 0,
    prog: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'],
    mel: [[[0, 62, 10], [12, 69, 4]], [[0, 69, 8], [8, 67, 4], [12, 65, 4]], [[0, 65, 10], [12, 67, 4]], [[0, 64, 12], [12, 60, 2], [14, 64, 2]],
      [[0, 62, 4], [4, 65, 4], [8, 69, 8]], [[0, 74, 10], [12, 72, 4]], [[0, 70, 8], [8, 69, 4], [12, 68, 4]], [[0, 69, 14]]],
    play(ac, out, st, t, s) {
      const bar = Math.floor(st / 16), k = st % 16, lb = bar - 2, pb = ((lb % 8) + 8) % 8, tr = this.tr, ch = CH[this.prog[pb]], turn = pb % 4 === 3, full = lb % 16 >= 8;
      const d = [1, 0, 0, 0.55, 0, 0, 0.75, 0, 1, 0, 0, 0.55, 0, 0, 0.75, 0.5][k];
      if (d) INS.timp(ac, out, t, (turn && k >= 14 ? 45 : 38) + tr, d * LV.timp);
      if (k === 4 || k === 12) INS.snare(ac, out, t, LV.snare);
      else if (lb >= 0 && k % 2 === 1 && lb % 2 === 1) INS.snare(ac, out, t, LV.snare * 0.3);
      if (turn && k >= 12) { INS.snare(ac, out, t, LV.snare * (0.4 + (k - 12) * 0.2)); INS.snare(ac, out, t + s / 2, LV.snare * (0.35 + (k - 12) * 0.2)); }
      if (k % 2 === 0) INS.strings(ac, out, t, ch.bass + [0, 0, 12, 0, 0, 12, 0, 7][k / 2] + tr, s * 1.7, LV.strings);
      if (lb < 0) return;
      if (k === 0) INS.choir(ac, out, t, ch.pad.map(m => m + tr), s * 16, LV.choir * (full ? 1 : 0.6));
      for (const n of this.mel[pb]) if (n[0] === k) {
        INS.brass(ac, out, t, n[1] + tr, n[2] * s, LV.brass);
        if (full) INS.brass(ac, out, t, n[1] - 12 + tr, n[2] * s, LV.brass * 0.7);
      }
    }
  }
};
CUES.final = Object.assign({}, CUES.battle, { bpm: 144, tr: 2 });

function musicTick() {
  const ac = AC, c = MU.cue;
  if (!ac || !c || !MU.gain || ac.state !== 'running') return;
  const s = 60 / c.bpm / c.div, now = ac.currentTime;
  if (MU.next < now) MU.next = now + 0.06;
  while (MU.next < now + 0.2) {
    c.play(ac, MU.gain, MU.step, MU.next, s);
    MU.step++; if (MU.step >= c.len) MU.step = c.loopTo || 0;
    MU.next += s;
  }
}
function setCue(name) {
  if (!ui.music) name = null;
  if (MU.name === name) return;
  const ac = audio();
  MU.name = name;
  if (MU.gain && ac) {
    const g = MU.gain, t = ac.currentTime;
    try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.7); } catch (e) { /* fine */ }
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone already */ } }, 5000);
  }
  MU.gain = null; MU.cue = null;
  if (!name || !ac) return;
  try {
    const g = ac.createGain(), c = CUES[name], t = Math.max(ac.currentTime + 0.08, MU.quiet);
    g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + c.fade);
    g.connect(musicBus(ac));
    MU.gain = g; MU.cue = c; MU.step = 0; MU.next = t;
    if (!MU.timer) MU.timer = setInterval(musicTick, 30);
  } catch (e) { MU.cue = null; }
}
function sting(won) {
  if (!ui.music) return;
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  try {
    const out = ac.createGain(); out.connect(musicBus(ac));
    const t = ac.currentTime + 0.05;
    if (won) {
      [[0, 62, 0.16], [0.2, 66, 0.16], [0.4, 69, 0.16], [0.6, 74, 1.7], [0.6, 66, 1.7], [0.6, 69, 1.7]].forEach(n => INS.brass(ac, out, t + n[0], n[1], n[2], LV.brass));
      INS.timp(ac, out, t, 38, LV.timp); INS.timp(ac, out, t + 0.6, 38, LV.timp * 1.1); INS.timp(ac, out, t + 0.6, 45, LV.timp * 0.7);
      for (let i = 0; i < 6; i++) INS.snare(ac, out, t + 0.3 + i * 0.05, LV.snare * (0.3 + i * 0.1));
      INS.choir(ac, out, t + 0.6, [50, 57, 62, 66], 2.2, LV.choir);
    } else {
      [[0, 62, 0.65], [0.7, 60, 0.65], [1.4, 58, 0.65], [2.1, 57, 1.9]].forEach(n => INS.brass(ac, out, t + n[0], n[1] - 12, n[2], LV.brass));
      INS.timp(ac, out, t, 38, LV.timp); INS.timp(ac, out, t + 2.1, 33, LV.timp * 1.1);
      INS.choir(ac, out, t + 2.1, [45, 52, 57], 2.4, LV.choir);
    }
    MU.quiet = t + (won ? 2.8 : 4);
    setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone already */ } }, 9000);
  } catch (e) { /* music is optional */ }
}
const cueForScreen = () => (ui.screen === 'battle' ? (ui.b && ui.b.over ? null : ui.c && ui.c.final ? 'final' : 'battle') : ui.screen === 'muster' ? 'muster' : 'camp');
