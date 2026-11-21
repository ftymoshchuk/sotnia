"use strict";
/* ===== SOTNIA interface: sound effects, and starting and stopping the music (js/music.js) ===== */
/* ---------- sound ---------- */
let AC = null, sfxT = 0, sfxN = 0;
function audio() {
    if (!ui.sound && !ui.music)
        return null;
    if (!AC) {
        try {
            AC = new (window.AudioContext || window.webkitAudioContext)();
            AC.master = AC.createGain();
            AC.master.gain.value = 0.45;
            AC.master.connect(AC.destination);
            AC.noise = mkNoise(AC);
        }
        catch (e) {
            AC = null;
        }
    }
    return AC;
}
function mkNoise(ac) {
    const len = ac.sampleRate * 0.5 | 0, nb = ac.createBuffer(1, len, ac.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++)
        d[i] = Math.random() * 2 - 1;
    return nb;
}
function wake() { const ac = audio(); if (ac && ac.state === 'suspended')
    ac.resume().catch(() => { }); }
function tone(ac, type, f0, f1, dur, vol, at) {
    const o = ac.createOscillator(), g = ac.createGain(), t = at || ac.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(ac.master);
    o.start(t);
    o.stop(t + dur + 0.02);
}
function hiss(ac, type, f0, f1, dur, vol) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
    s.buffer = ac.noise;
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(ac.master);
    s.start(t);
    s.stop(t + dur + 0.02);
}
function sfx(kind) {
    if (!ui.sound)
        return;
    const ac = audio();
    if (!ac || ac.state !== 'running')
        return;
    const now = ac.currentTime;
    if (now - sfxT > 0.07) {
        sfxT = now;
        sfxN = 0;
    }
    if (++sfxN > 4)
        return;
    try {
        if (kind === 'shot') {
            hiss(ac, 'lowpass', 2200, 260, 0.34, 0.9);
            tone(ac, 'sine', 120, 42, 0.14, 0.7);
        }
        else if (kind === 'fizz')
            hiss(ac, 'highpass', 3200, 5200, 0.12, 0.22);
        else if (kind === 'hit')
            hiss(ac, 'bandpass', 900, 500, 0.07, 0.4);
        else if (kind === 'clang') {
            tone(ac, 'square', 1900, 1700, 0.06, 0.13);
            tone(ac, 'square', 2850, 2600, 0.05, 0.09);
        }
        else if (kind === 'fall')
            tone(ac, 'sine', 170, 55, 0.24, 0.5);
        else if (kind === 'drum') {
            for (let i = 0; i < 4; i++)
                tone(ac, 'sine', 96, 48, 0.16, 0.8, now + [0, 0.22, 0.44, 0.58][i]);
        }
    }
    catch (e) { /* sound is optional */ }
}
/* ---------- music: js/music.js composes and plays js/score.js; this is where the game starts and stops it ---------- */
// How loud the music plays. The cues are balanced against each other in js/score.js.
const MUSIC_LEVEL = 0.1;
// `piece` is the camp piece heard last, which the camp music does not start on again.
const MU = { name: null, player: null, piece: null, timer: 0, quiet: 0, opened: false };
function musicTick() {
    const ac = AC;
    if (!ac || !MU.player || ac.state !== 'running')
        return;
    try {
        MU.player.tick(ac.currentTime);
        if (MU.name === 'camp')
            MU.piece = MU.player.piece || MU.piece;
    }
    catch (e) {
        MU.player = null;
    }
}
// Changes what plays: the cue for the screen, or nothing. The old cue fades as the new one comes in;
// camp music begins on a new piece each time, never the one that played last.
function setCue(name) {
    if (!ui.music)
        name = null;
    if (MU.name === name)
        return;
    const ac = audio();
    MU.name = name;
    if (MU.player && ac) {
        const p = MU.player;
        try {
            p.stop(ac.currentTime, 0.7);
        }
        catch (e) { /* fine */ }
        setTimeout(() => p.close(), 1500);
    }
    MU.player = null;
    if (!name || !ac)
        return;
    try {
        const at = Math.max(ac.currentTime + 0.08, MU.quiet);
        MU.player = MUSIC.play(ac, SCORE, name, { at, fade: name === 'camp' ? 2 : 0.4, level: MUSIC_LEVEL, seed: Math.random() * 4294967296 >>> 0, opening: !MU.opened, avoid: MU.piece });
        MU.opened = true;
        if (!MU.timer)
            MU.timer = setInterval(musicTick, 50);
        musicTick();
    }
    catch (e) {
        MU.player = null;
    }
}
// A flourish when a fight ends; the next cue waits for it.
function sting(won) {
    if (!ui.music)
        return;
    const ac = audio();
    if (!ac || ac.state !== 'running')
        return;
    try {
        const s = MUSIC.sting(ac, SCORE, won ? 'won' : 'lost', ac.currentTime + 0.05, MUSIC_LEVEL);
        MU.quiet = s.end + 0.4;
        setTimeout(s.close, 9000);
    }
    catch (e) { /* music is optional */ }
}
const cueForScreen = () => (ui.screen === 'battle' ? (ui.b && ui.b.over ? null : ui.c && ui.c.final ? 'final' : 'battle') : ui.screen === 'muster' ? 'muster' : 'camp');
