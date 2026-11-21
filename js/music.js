"use strict";
/* ===== SOTNIA music: a small engine that composes as it plays and synthesises every note. =====
 *
 * It knows nothing of the game. Give it a score (js/score.js holds the game's) and any Web Audio
 * context, and it plays a cue live, a bar at a time, or renders it whole into an
 * OfflineAudioContext. Nothing here touches the page or the context until it is asked to play,
 * so the composing can be run and tested on its own.
 *
 * The sound follows Pageant's music bed (sigrix-io/pageant, src/pageant/music.py): each tone is
 * a few harmonics with soft envelopes, each instrument has a gentle low-pass, and a room made of
 * decaying noise sits over the whole. Pageant's pad, bass and pluck are here as it makes them.
 *
 * The composing is what keeps a long journey from wearing thin. A piece is a ground (a chord a
 * bar), tunes written out over it, and figures for the accompaniment. Each time a piece comes
 * round it is arranged afresh: who carries the tune, how it is ornamented, which figures the lute
 * plays, whether the bass and the drone come in. The chords are voice-led from bar to bar, the
 * last bars slow to a close, and the music rests between pieces.
 */
const MUSIC = (() => {
    /* ---------- numbers ---------- */
    // mulberry32: small, quick and the same everywhere, so one seed always plays the same music.
    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    const choose = (list, r) => list[Math.floor(r() * list.length)];
    // Any index but the last one, so a choice never comes twice running when there is another.
    const other = (n, last, r) => { if (n < 2)
        return 0; let k; do
        k = Math.floor(r() * n);
    while (k === last); return k; };
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    /* ---------- notation ---------- */
    const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    function pcOf(name) {
        const m = /^([A-G])(#|b)?$/.exec(name);
        if (!m)
            throw new Error('Not a pitch: ' + name);
        return (LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12;
    }
    // 'C#4' is 61: octaves as in scientific pitch, where C4 is middle C.
    function noteOf(name) {
        const m = /^([A-G])(#|b)?(\d)$/.exec(name);
        if (!m)
            throw new Error('Not a note: ' + name);
        return 12 * (+m[3] + 1) + LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    }
    // One note or several sounded together: 'D4', or '[D3,A3,F#4]'.
    const notesOf = w => (w[0] === '[' ? w.slice(1, -1).split(',').map(noteOf) : [noteOf(w)]);
    // Bars of 'what:beats', with '|' between bars and 'r' for a rest. Each bar must fill its metre
    // exactly. Answers, for each bar, [beat, what, beats] for all but the rests.
    function barsOf(text, meter, read, where) {
        return text.trim().split('|').map((bar, i) => {
            let at = 0;
            const out = [];
            for (const tok of bar.trim().split(/\s+/)) {
                const k = tok.lastIndexOf(':'), d = +tok.slice(k + 1);
                if (k < 1 || !(d > 0))
                    throw new Error(where + ', bar ' + (i + 1) + ': cannot read "' + tok + '"');
                if (tok.slice(0, k) !== 'r')
                    out.push([at, read(tok.slice(0, k)), d]);
                at += d;
            }
            if (Math.abs(at - meter) > 1e-6)
                throw new Error(where + ', bar ' + (i + 1) + ' holds ' + at + ' beats, not ' + meter + ': ' + bar.trim());
            return out;
        });
    }
    /* ---------- chords ---------- */
    // Each kind of chord, as steps above its root: the root, the third and the fifth first, then
    // anything added. Pageant's sevenths and ninths are here so its bed can be written as a score.
    const QUALITY = { '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], add9: [0, 4, 7, 2], maj9: [0, 4, 7, 11, 2], m9: [0, 3, 7, 10, 2] };
    // 'Dm', 'A', 'Gm/Bb' (a G minor chord over B flat in the bass).
    function chordOf(sym) {
        const m = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/.exec(sym);
        if (!m || !(m[2] in QUALITY))
            throw new Error('Not a chord: ' + sym);
        const root = pcOf(m[1]), steps = QUALITY[m[2]];
        const third = steps.find(s => s === 3 || s === 4);
        return { sym, root, pcs: steps.map(s => (root + s) % 12), bass: m[3] ? pcOf(m[3]) : root, third: third === undefined ? null : (root + third) % 12 };
    }
    // A chord a bar, or one for each half of it: 'Dm A Dm-A Dm'. Answers, for each bar, [beat, chord, beats].
    const groundOf = (text, meter) => text.replace(/\|/g, ' ').trim().split(/\s+/).map(sym => {
        const parts = sym.split('-');
        return parts.map((s, i) => [i * meter / parts.length, chordOf(s), meter / parts.length]);
    });
    // The chord's notes between lo and hi, n of them, moved as little as they can from the last voicing:
    // the way Pageant voices its pads by hand, worked out here for any ground. With fewer voices than
    // the chord has notes, the fifth goes first and then the root, which the bass sounds anyway. A
    // doubled third and a semitone between neighbours are avoided.
    function voiceLead(ch, prev, lo, hi, n) {
        const keep = [ch.pcs[1], ...ch.pcs.slice(3), ch.pcs[0], ch.pcs[2]].filter(p => p !== undefined);
        const need = keep.slice(0, Math.min(n, keep.length)), notes = [];
        for (let m = lo; m <= hi; m++)
            if (ch.pcs.includes(m % 12))
                notes.push(m);
        let best = null, cost = Infinity;
        const pick = (from, v) => {
            if (v.length === n) {
                const pcs = v.map(m => m % 12);
                if (!need.every(p => pcs.includes(p)))
                    return;
                let c = 0;
                for (let i = 0; i < n; i++)
                    c += Math.abs(v[i] - (prev && prev.length === n ? prev[i] : lo + (hi - lo) * (i + 0.5) / n));
                if (ch.third !== null)
                    c += 4 * Math.max(0, pcs.filter(p => p === ch.third).length - 1);
                for (let i = 1; i < n; i++)
                    if (v[i] - v[i - 1] === 1)
                        c += 6;
                if (c < cost) {
                    cost = c;
                    best = v.slice();
                }
                return;
            }
            for (let i = from; i <= notes.length - (n - v.length); i++) {
                v.push(notes[i]);
                pick(i + 1, v);
                v.pop();
            }
        };
        pick(0, []);
        if (!best)
            throw new Error('No voicing of ' + ch.sym + ' in ' + n + ' voices between ' + lo + ' and ' + hi);
        return best;
    }
    // The note of that pitch nearest the last bass note, within the range.
    function bassNear(pc, prev, lo, hi) {
        let best = null;
        for (let m = lo; m <= hi; m++)
            if (m % 12 === pc && (best === null || Math.abs(m - prev) < Math.abs(best - prev)))
                best = m;
        return best;
    }
    /* ---------- variations ---------- */
    // A tune as it comes round again. 'orn' adds a grace to some bars, as players did: a passing note
    // through a third, or a quick turn down and back at the start of a long note. 'thin' drops the
    // quick notes off the beat. Either way the tune can move by an octave (`shift`, in semitones).
    // The graces keep to the mode's seven notes: `mode` is { tonic, diatonic, lead, meter }, where
    // `lead` is a raised leading tone (C sharp in D minor) that only ever graces the tonic.
    function vary(tune, how, mode, shift, r) {
        const out = tune.map(bar => bar.map(([at, ms, d]) => [at, ms.map(m => m + shift), d]));
        const pc = m => ((m % 12) + 12) % 12, diatonic = m => mode.diatonic.includes(pc(m));
        if (how === 'thin') {
            return out.map(bar => {
                const kept = [];
                for (const n of bar) {
                    const prev = kept[kept.length - 1];
                    if (prev && n[2] <= 0.5 && n[0] % 1 && prev[1].length === 1)
                        prev[2] += n[2];
                    else
                        kept.push(n.slice());
                }
                return kept;
            });
        }
        if (how !== 'orn')
            return out;
        return out.map((bar, b) => {
            const graces = [], following = out[b + 1] && out[b + 1][0];
            bar.forEach(([at, ms, d], i) => {
                if (ms.length !== 1 || at % 1 || !diatonic(ms[0]))
                    return;
                const m = ms[0], nx = bar[i + 1];
                // The note straight after this one, in this bar or on the next downbeat.
                const next = nx ? (Math.abs(nx[0] - at - d) < 1e-6 ? nx : null) : following && following[0] === 0 && Math.abs(at + d - mode.meter) < 1e-6 ? following : null;
                if (d >= 1 && next && next[1].length === 1 && diatonic(next[1][0])) {
                    const gap = Math.abs(next[1][0] - m), lo = Math.min(m, next[1][0]);
                    const pass = (gap === 4 ? [lo + 2] : gap === 3 ? [lo + 1, lo + 2] : []).find(diatonic);
                    if (pass !== undefined)
                        graces.push([i, [[at, [m], d - 0.5], [at + d - 0.5, [pass], 0.5]]]);
                }
                if (d >= 1.5) {
                    const below = pc(m) === mode.tonic && mode.lead !== null ? m - 1 : diatonic(m - 1) ? m - 1 : diatonic(m - 2) ? m - 2 : null;
                    if (below !== null)
                        graces.push([i, [[at, [m], 0.25], [at + 0.25, [below], 0.25], [at + 0.5, [m], d - 0.5]]]);
                }
            });
            if (!graces.length || r() < 0.45)
                return bar;
            const [i, notes] = choose(graces, r), copy = bar.slice();
            copy.splice(i, 1, ...notes);
            return copy;
        });
    }
    /* ---------- the sounds ---------- */
    // Each sound is a few harmonics, given as the strength of each (the fundamental first), played by
    // one oscillator a voice; voices are [cents, pan]. A held sound swells over `attack`, falls to
    // `sustain` and fades over `release` once let go; a plucked one dies away with time constant
    // `decay`, and is damped when let go. `sweep` moves a low-pass on each note from one multiple of
    // its pitch to another; `lowpass`, `pan` and `breath` (Pageant's slow swell) are on the whole
    // instrument, and `room` is how much of it goes to the room. `range` is where it can play.
    const SOUNDS = {
        // Pageant's three, as music.py makes them.
        pad: { partials: [1, 0.28, 0.12, 0.05], voices: [[-6, -0.5], [0, 0], [6, 0.5]], attack: 1.6, release: 2.4, lowpass: 2600, breath: [0.07, 0.08], level: 0.16, room: 0.32, range: [36, 84] },
        bass: { partials: [1, 0.2], attack: 0.9, release: 2, lowpass: 400, level: 0.2, room: 0.32, range: [24, 52] },
        pluck: { partials: [1, 0.25], attack: 0.004, decay: 0.32, damp: 0.3, ring: 1.6, lowpass: 6000, level: 0.075, room: 0.32, range: [48, 96] },
        // A lute: gut strings plucked near the bridge, paired a few cents apart as its courses are,
        // bright for an instant and then mellow. Its bass strings go down to A, as a lute of the 1630s did.
        lute: { partials: [1, 0.47, 0.27, 0.17, 0.1, 0.06, 0.03, 0.01], voices: [[-3, 0], [3, 0]], pan: -0.15, attack: 0.003, decay: f => Math.max(0.3, Math.min(1.1, 0.9 * Math.sqrt(110 / f))), damp: 0.16, ring: 0.5, sweep: [7, 2.2, 0.12], level: 0.31, room: 0.24, oct: -12, range: [33, 81] },
        // A recorder: nearly a pure tone, a breath at the start, and a little vibrato on long notes.
        flute: { partials: [1, 0.08, 0.12, 0.03, 0.02], pan: 0.2, attack: 0.06, release: 0.14, sustain: 0.9, fall: 0.3, vibrato: [4.6, 6, 0.4, 0.8], chiff: [2.5, 2, 0.06, 0.04], lowpass: 3600, legato: 0.94, level: 0.6, room: 0.36, oct: 12, range: [62, 86] },
        // A treble viol, bowed: its notes swell in, with vibrato on the long ones.
        viol: { partials: [1, 0.55, 0.38, 0.27, 0.19, 0.13, 0.09, 0.06, 0.04, 0.03], voices: [[-4, 0], [4, 0]], pan: 0.25, attack: 0.2, release: 0.32, vibrato: [5.3, 8, 0.35, 0.7], lowpass: 2300, legato: 0.98, level: 0.32, room: 0.3, oct: -12, range: [50, 84] },
        // The bass viol under the ground: one voice, so the low notes do not beat against each other.
        bassviol: { partials: [1, 0.5, 0.32, 0.2, 0.12, 0.07], attack: 0.25, release: 0.5, lowpass: 800, level: 0.26, room: 0.22, range: [28, 55] },
        // Low strings for the march and the fight: short bowed strokes.
        cello: { partials: [1, 0.6, 0.42, 0.3, 0.2, 0.13, 0.08, 0.05], voices: [[-5, 0], [5, 0]], pan: -0.1, attack: 0.025, release: 0.12, sustain: 0.7, fall: 0.15, lowpass: 1300, level: 0.26, room: 0.25, range: [33, 64] },
        // A drone, as of a lira or the pipes: an open fifth that breathes, very soft.
        drone: { partials: [1, 0.38, 0.2, 0.1, 0.05], voices: [[-4, -0.4], [4, 0.4]], attack: 3, release: 4, lowpass: 900, breath: [0.05, 0.1], level: 0.13, room: 0.45, range: [36, 57] },
        // Natural horns: the filter opens as the note speaks, which is what makes brass sound brass.
        horn: { partials: [1, 0.62, 0.45, 0.32, 0.22, 0.14, 0.09, 0.05, 0.03], voices: [[-4, 0], [4, 0]], pan: -0.05, attack: 0.07, release: 0.25, sustain: 0.85, fall: 0.3, sweep: [1.5, 4, 0.06], lowpass: 2200, level: 0.28, room: 0.35, range: [43, 74] },
        // Men's voices on 'oh': harmonics lifted where the vowel's formants are ([Hz, width, strength]).
        choir: { formants: [[450, 70, 1], [800, 80, 0.6], [2830, 100, 0.12]], voices: [[-7, -0.3], [7, 0.3]], attack: 0.45, release: 0.7, vibrato: [5, 9, 0.25, 0.8], lowpass: 3000, level: 0.2, room: 0.5, range: [40, 70] },
        // Drums are struck: a body that falls in pitch, and the slap of a little noise.
        // Kettle drums: harmonics 2 to 5 of half the note, near enough a timpani's 1, 1.5, 2 and 2.5.
        timp: { drum: true, partials: [0, 1, 0.5, 0.3, 0.15], base: 0.5, glide: [1.04, 0.05], decay: f => 0.5 * Math.pow(100 / f, 0.3), noise: ['lowpass', 300, 0.7, 0.5, 0.03], level: 0.63, room: 0.28, range: [33, 47] },
        // A frame drum: a low boom, and a tap at the rim.
        frame: { drum: true, pan: -0.2, partials: [1, 0.2], glide: [1.6, 0.03], decay: 0.16, noise: ['bandpass', 600, 0.7, 0.35, 0.03], level: 0.32, room: 0.2 },
        tap: { drum: true, pan: -0.2, partials: [1], decay: 0.03, noise: ['bandpass', 2000, 1, 0.5, 0.025], level: 0.12, room: 0.2 },
        // A field drum for the rolls, kept soft.
        tabor: { drum: true, pan: 0.15, partials: [1], glide: [1.25, 0.04], decay: 0.04, noise: ['bandpass', 1100, 0.9, 1, 0.05], level: 0.14, room: 0.2 },
    };
    const ONE = [[0, 0]];
    const SWELL = new Float32Array(33).map((_, i) => Math.pow(Math.sin(i / 32 * Math.PI / 2), 2));
    // Harmonics for a sung vowel at f0: a buzz whose strength falls with each harmonic, lifted near
    // each formant, and kept at one power whatever the note.
    function formantPartials(F, f0) {
        const amps = [];
        for (let k = 1; k * f0 < 4000 && k <= 40; k++) {
            let a = 0;
            for (const [fc, bw, g] of F)
                a += g / (1 + Math.pow((k * f0 - fc) / bw, 2));
            amps.push(a / k);
        }
        const p = Math.sqrt(amps.reduce((s, a) => s + a * a, 0)) || 1;
        return amps.map(a => a / p);
    }
    /* ---------- playing ---------- */
    const WAVES = new WeakMap(), BUSES = new WeakMap(), NOISE = new WeakMap();
    function waveOf(ac, name, I, m) {
        let w = WAVES.get(ac);
        if (!w)
            WAVES.set(ac, (w = {}));
        const key = I.formants ? name + m : name;
        if (!w[key]) {
            const amps = I.formants ? formantPartials(I.formants, hz(m)) : I.partials;
            const real = new Float32Array(amps.length + 1), imag = new Float32Array(amps.length + 1);
            amps.forEach((a, k) => { imag[k + 1] = a; });
            w[key] = ac.createPeriodicWave(real, imag, { disableNormalization: true });
        }
        return w[key];
    }
    function noiseOf(ac) {
        if (!NOISE.has(ac)) {
            const n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0), r = rng(11);
            for (let i = 0; i < n; i++)
                d[i] = r() * 2 - 1;
            NOISE.set(ac, buf);
        }
        return NOISE.get(ac);
    }
    // Pageant's room: noise dying away by 60 dB over `seconds`, darkened above 5 kHz, after 12 ms of quiet.
    function impulse(ac, seconds) {
        const rate = ac.sampleRate, n = Math.floor(seconds * rate), buf = ac.createBuffer(2, n, rate), r = rng(7);
        const pre = Math.floor(0.012 * rate), k = Math.exp(-2 * Math.PI * 5000 / rate);
        for (let c = 0; c < 2; c++) {
            const d = buf.getChannelData(c);
            let y = 0;
            for (let i = 0; i < n; i++) {
                y = (1 - k) * ((r() * 2 - 1) * Math.exp(-6.9 * i / rate / seconds)) + k * y;
                d[i] = i < pre ? 0 : y;
            }
        }
        return buf;
    }
    // The way out, one for each context: the room beside the music, then a gentle limiter.
    function busOf(ac, level) {
        let b = BUSES.get(ac);
        if (!b) {
            const input = ac.createGain(), limit = ac.createDynamicsCompressor(), room = ac.createGain(), hall = ac.createConvolver();
            limit.threshold.value = -10;
            limit.knee.value = 8;
            limit.ratio.value = 3;
            limit.attack.value = 0.01;
            limit.release.value = 0.3;
            hall.buffer = impulse(ac, 3.2);
            room.connect(hall);
            hall.connect(input);
            input.connect(limit);
            limit.connect(ac.destination);
            BUSES.set(ac, (b = { input, room }));
        }
        if (level != null)
            b.input.gain.value = level;
        return b;
    }
    // A deck plays one cue: its own way into the bus and the room, so it can fade on its own, and a
    // list of what it has set sounding, so it can stop it all.
    function deckOf(ac, level) {
        const b = busOf(ac, level), dry = ac.createGain(), wet = ac.createGain();
        dry.connect(b.input);
        wet.connect(b.room);
        return { ac, dry, wet, chans: {}, live: [] };
    }
    function chan(dk, name) {
        if (dk.chans[name])
            return dk.chans[name];
        const I = SOUNDS[name], ac = dk.ac, input = ac.createGain();
        input.gain.value = I.level;
        if (I.breath) {
            const lfo = ac.createOscillator(), depth = ac.createGain();
            lfo.frequency.value = I.breath[0];
            depth.gain.value = I.level * I.breath[1];
            lfo.connect(depth);
            depth.connect(input.gain);
            lfo.start();
            dk.live.push([lfo, Infinity]);
        }
        let tail = input;
        if (I.lowpass) {
            const lp = ac.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = I.lowpass;
            lp.Q.value = Math.SQRT1_2;
            tail.connect(lp);
            tail = lp;
        }
        if (I.pan && ac.createStereoPanner) {
            const p = ac.createStereoPanner();
            p.pan.value = I.pan;
            tail.connect(p);
            tail = p;
        }
        tail.connect(dk.dry);
        if (I.room) {
            const send = ac.createGain();
            send.gain.value = I.room;
            tail.connect(send);
            send.connect(dk.wet);
        }
        return (dk.chans[name] = input);
    }
    function burst(dk, out, [type, freq, q, gain, tau], t, v, r) {
        const ac = dk.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), end = t + tau * 7 + 0.01;
        s.buffer = noiseOf(ac);
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v * gain, t + 0.001);
        g.gain.setTargetAtTime(0, t + 0.001, tau);
        s.connect(f);
        f.connect(g);
        g.connect(out);
        s.start(t, r() * 1.5);
        s.stop(end);
        dk.live.push([s, end]);
    }
    // One note: `t` and `sec` in the context's seconds, `v` from 0 to 1.
    function sound(dk, ins, m, t, sec, v, r) {
        const I = SOUNDS[ins];
        if (!I)
            return;
        const ac = dk.ac, out = chan(dk, ins), f = hz(m), env = ac.createGain(), base = I.base || 1;
        let end;
        env.gain.value = 0;
        if (I.drum || I.decay) {
            const tau = typeof I.decay === 'function' ? I.decay(f) : I.decay, a = I.attack || 0.002;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(v, t + a);
            env.gain.setTargetAtTime(0, t + a, tau);
            end = t + a + tau * 6;
            const off = t + Math.max(sec, I.ring || 0, a + 0.01);
            if (I.damp && off < end - 0.05) {
                env.gain.setTargetAtTime(0, off, I.damp);
                end = Math.min(end, off + I.damp * 6);
            }
        }
        else {
            const a = Math.min(I.attack, sec * 0.6);
            if (a >= 0.06)
                env.gain.setValueCurveAtTime(SWELL.map(x => x * v), t, a);
            else {
                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(v, t + a);
            }
            if (I.sustain)
                env.gain.setTargetAtTime(v * I.sustain, t + a, I.fall);
            env.gain.setTargetAtTime(0, t + sec, I.release / 3);
            end = t + sec + I.release * 2;
        }
        let into = env;
        if (I.sweep) {
            const lp = ac.createBiquadFilter(), [from, to, time] = I.sweep;
            lp.type = 'lowpass';
            lp.Q.value = 0.5;
            lp.frequency.setValueAtTime(Math.min(f * from, 16000), t);
            lp.frequency.exponentialRampToValueAtTime(Math.min(f * to, 16000), t + time * 3);
            lp.connect(env);
            into = lp;
        }
        let vib = null;
        if (I.vibrato && sec >= I.vibrato[3]) {
            const [rate, cents, delay] = I.vibrato, lfo = ac.createOscillator();
            vib = ac.createGain();
            lfo.frequency.value = rate * (0.94 + r() * 0.12);
            vib.gain.setValueAtTime(0, t);
            vib.gain.setValueAtTime(0, t + delay);
            vib.gain.linearRampToValueAtTime(cents, t + delay + 0.5);
            lfo.connect(vib);
            lfo.start(t);
            lfo.stop(end);
            dk.live.push([lfo, end]);
        }
        if (I.partials || I.formants) {
            const wave = waveOf(ac, ins, I, m);
            for (const [cents, pan] of I.voices || ONE) {
                const o = ac.createOscillator();
                o.setPeriodicWave(wave);
                o.frequency.value = f * base;
                if (cents)
                    o.detune.value = cents;
                if (I.glide) {
                    o.frequency.setValueAtTime(f * base * I.glide[0], t);
                    o.frequency.exponentialRampToValueAtTime(f * base, t + I.glide[1]);
                }
                if (vib)
                    vib.connect(o.detune);
                if (pan && ac.createStereoPanner) {
                    const p = ac.createStereoPanner();
                    p.pan.value = pan;
                    o.connect(p);
                    p.connect(into);
                }
                else
                    o.connect(into);
                o.start(t);
                o.stop(end);
                dk.live.push([o, end]);
            }
        }
        env.connect(out);
        if (I.noise)
            burst(dk, out, I.noise, t, v, r);
        if (I.chiff) {
            const [mul, q, gain, tau] = I.chiff;
            burst(dk, out, ['bandpass', Math.min(f * mul, 12000), q, gain, tau], t, v, r);
        }
    }
    function close(dk) {
        for (const [node] of dk.live) {
            try {
                node.stop();
            }
            catch (e) { /* not started yet, or done */ }
        }
        dk.live = [];
        try {
            dk.dry.disconnect();
            dk.wet.disconnect();
        }
        catch (e) { /* gone already */ }
    }
    /* ---------- reading a score ---------- */
    const COMPILED = new WeakMap();
    const readFig = w => { if (!/^(B|B5|B8|C|[1-4])$/.test(w))
        throw new Error('Not a figure step: ' + w); return w; };
    // Drum strokes: a note for the part's own drum, X for the frame drum's boom and x for its rim.
    const readStroke = ins => w => (w === 'X' ? [['frame', 43]] : w === 'x' ? [['tap', 79]] : notesOf(w).map(m => [ins, m]));
    const notes = text => text.trim().split(/\s+/).map(noteOf);
    // Checks a score and puts it in the form the composing uses, once for each score. A mistake in
    // the score (a bar that does not add up, a tune longer than its ground) is an error here.
    function compile(score) {
        if (COMPILED.has(score))
            return COMPILED.get(score);
        const pieces = {};
        for (const [name, p] of Object.entries(score.pieces)) {
            const meter = p.meter, scale = p.scale.trim().split(/\s+/).map(pcOf);
            if (scale.length < 7)
                throw new Error(name + ': a scale needs its seven notes');
            // The first seven notes are the mode; an eighth a semitone under the tonic is its raised leading tone.
            const lead = scale.slice(7).find(x => x === (scale[0] + 11) % 12);
            const P = { name, meter, bpm: p.bpm, ground: groundOf(p.ground, meter), mode: { tonic: scale[0], diatonic: scale.slice(0, 7), lead: lead === undefined ? null : lead, meter }, tunes: {} };
            const one = (text, read, where) => { const b = barsOf(text, meter, read, name + ' ' + where); if (b.length !== 1)
                throw new Error(name + ' ' + where + ' should be one bar'); return b[0]; };
            for (const [k, t] of Object.entries(p.tunes || {})) {
                P.tunes[k] = barsOf(t, meter, notesOf, name + ' tune ' + k);
                if (P.tunes[k].length !== P.ground.length)
                    throw new Error(name + ' tune ' + k + ' has ' + P.tunes[k].length + ' bars, and its ground ' + P.ground.length);
            }
            if (p.sections) {
                P.parts = {};
                for (const [k, d] of Object.entries(p.parts)) {
                    const part = Object.assign({}, d, { key: k });
                    if (d.kind === 'perc') {
                        part.pat = barsOf(d.pat, meter, readStroke(d.ins), name + ' ' + k);
                        part.turn = d.turn ? one(d.turn, readStroke(d.ins), k + ' turn') : null;
                    }
                    if (d.kind === 'figure') {
                        part.fig = one(d.fig, readFig, k);
                        part.thin = d.thin ? one(d.thin, readFig, k + ' thin') : part.fig;
                    }
                    if (d.kind === 'drone')
                        part.notes = notes(d.notes);
                    P.parts[k] = part;
                }
                P.sections = p.sections;
                P.start = p.start;
                for (const [k, s] of Object.entries(p.sections)) {
                    for (const ref of s.parts) {
                        const [pk, arg] = ref.replace('+', '').split(':');
                        if (!P.parts[pk])
                            throw new Error(name + ' ' + k + ': no part ' + pk);
                        if (P.parts[pk].kind === 'tune' && !P.tunes[arg])
                            throw new Error(name + ' ' + k + ': no tune ' + arg);
                    }
                    for (const n of s.next)
                        if (!p.sections[n] || n === k)
                            throw new Error(name + ' ' + k + ': cannot go on to ' + n);
                }
            }
            else {
                P.figures = p.figures.map((f, i) => one(f, readFig, 'figure ' + (i + 1)));
                P.sparse = p.sparse.map((f, i) => one(f, readFig, 'sparse figure ' + (i + 1)));
                P.cadence = one(p.cadence, readFig, 'cadence');
                P.voices = p.voices;
                P.drone = p.drone ? notes(p.drone) : null;
                P.droneOdds = p.droneOdds == null ? 0.35 : p.droneOdds;
                P.intro = p.intro;
                P.coda = p.coda;
                P.win = p.chords || [50, 67];
                P.perc = p.perc ? barsOf(p.perc, meter, readStroke('frame'), name + ' drum') : null;
                for (const v of P.voices)
                    if (!SOUNDS[v])
                        throw new Error(name + ': no sound ' + v);
            }
            pieces[name] = P;
        }
        for (const [k, c] of Object.entries(score.cues))
            for (const p of c.suite || [c.loop])
                if (!pieces[p])
                    throw new Error('cue ' + k + ': no piece ' + p);
        const stings = {};
        for (const [k, s] of Object.entries(score.stings || {}))
            stings[k] = { bpm: s.bpm, meter: s.meter, lines: s.lines.map(([ins, t]) => [ins, barsOf(t, s.meter, notesOf, 'sting ' + k)[0]]) };
        const out = { pieces, cues: score.cues, stings };
        COMPILED.set(score, out);
        return out;
    }
    /* ---------- composing ---------- */
    const RIT = [1, 0.97, 0.93, 0.86, 0.74];
    const fits = (tune, ins) => tune.every(bar => bar.every(([, ms]) => ms.every(m => m >= SOUNDS[ins].range[0] && m <= SOUNDS[ins].range[1])));
    // One bar of a pass, as events: { ins, m, at (beats into the bar), d (beats), sec (or seconds), v, off (seconds early or late) }.
    function buildBar(P, pass, i, st, r) {
        const ev = [], segs = P.ground[i], last = i === pass.to - 1;
        const segAt = at => { let k = 0; while (k + 1 < segs.length && segs[k + 1][0] <= at + 1e-9)
            k++; return k; };
        for (const part of pass.parts) {
            if (!part)
                continue;
            const v = part.level || 1;
            if (part.kind === 'figure') {
                const fig = i === P.ground.length - 1 && part.cadence ? part.cadence : part.figs ? choose(part.figs, r) : part.alt && i - pass.from >= part.altAt ? part.alt : part.fig;
                const low = part.low || [33, 50], win = part.win || [50, 67], n = part.n || 3;
                const vo = segs.map(([, ch]) => (st.voice[part.key] = voiceLead(ch, st.voice[part.key], win[0], win[1], n)));
                const bs = segs.map(([, ch]) => (st.bass[part.key] = bassNear(ch.bass, st.bass[part.key] == null ? (low[0] + low[1]) / 2 : st.bass[part.key], low[0], low[1])));
                for (const [at, tok, d] of fig) {
                    const k = segAt(at), voicing = vo[k], b = bs[k];
                    if (tok === 'C')
                        [b, ...voicing.filter(m => m !== b)].forEach((m, j) => ev.push({ ins: part.ins, m, at, d, v: v * (1 - j * 0.05), off: j * (part.strum || 0.025) }));
                    else
                        ev.push({ ins: part.ins, m: tok === 'B' ? b : tok === 'B8' ? b + 12 : tok === 'B5' ? b + 7 : voicing[(+tok - 1) % voicing.length], at, d, v: v * (at % 1 ? 0.85 : 1) });
                }
            }
            else if (part.kind === 'tune') {
                for (const [at, ms, d] of part.bars[i] || [])
                    for (const m of ms) {
                        const accent = at === 0 ? 1 : at % 1 ? 0.84 : 0.92;
                        ev.push({ ins: part.ins, m, at, d: d * (SOUNDS[part.ins].legato || 1), v: v * accent });
                        if (part.double)
                            ev.push({ ins: part.ins, m: m + part.double, at, d: d * (SOUNDS[part.ins].legato || 1), v: v * accent * 0.7 });
                    }
            }
            else if (part.kind === 'bass') {
                const win = part.win || [33, 50];
                for (const [at, ch, d] of segs) {
                    const m = (st.bass[part.key] = bassNear(ch.bass, st.bass[part.key] == null ? 38 : st.bass[part.key], win[0], win[1]));
                    ev.push({ ins: part.ins, m, at, d: d * 0.97, v: v * 0.9 });
                }
            }
            else if (part.kind === 'drone') {
                if (i === pass.from)
                    for (const m of part.notes)
                        ev.push({ ins: part.ins, m, at: 0, d: 0, sec: pass.sec + 1.5, v: v * 0.8 });
            }
            else if (part.kind === 'chords') {
                for (const [at, ch, d] of segs) {
                    const vo = (st.voice[part.key] = voiceLead(ch, st.voice[part.key], part.win[0], part.win[1], part.n));
                    for (const m of vo)
                        ev.push({ ins: part.ins, m, at, d: d + 0.1, v: v * 0.8 });
                }
            }
            else if (part.kind === 'perc') {
                const pat = last && part.turn ? part.turn : part.pat[(i - pass.from) % part.pat.length];
                for (const [at, strokes, d] of pat)
                    for (const [ins, m] of strokes)
                        ev.push({ ins, m, at, d, v: v * (at === 0 ? 1 : at % 1 ? 0.7 : 0.85) });
            }
            else if (part.kind === 'roll') {
                if (last)
                    for (let k = 0; k < 8; k++)
                        ev.push({ ins: part.ins, m: 60, at: P.meter - 2 + k * 0.25, d: 0.25, v: v * (0.35 + k * 0.09) });
            }
        }
        // Played, not printed: a little early or late, a little louder or softer.
        for (const e of ev) {
            e.off = (e.off || 0) + (r() - 0.5) * 0.016;
            e.v *= 0.9 + r() * 0.2;
        }
        return ev;
    }
    // Passes into bars at `bpm`; a pass marked `rit` slows to its end.
    function perform(P, passes, st, r, cue, bpm) {
        const bars = [], tr = cue.transpose || 0;
        for (const pass of passes) {
            const len = pass.to - pass.from, tempi = [];
            for (let j = 0; j < len; j++)
                tempi.push(bpm * (pass.rit ? RIT[Math.max(0, RIT.length - len + j)] : 1));
            pass.sec = tempi.reduce((s, b) => s + P.meter * 60 / b, 0);
            for (let j = 0; j < len; j++) {
                const events = buildBar(P, pass, pass.from + j, st, r);
                for (const e of events) {
                    e.m += tr;
                    e.v *= pass.level || 1;
                }
                bars.push({ bpm: tempi[j], beats: P.meter, events, piece: P.name, pass: pass.name });
            }
        }
        return bars;
    }
    // A piece of a suite, arranged for this time round: an introduction on the lute (left out when it
    // opens the music), the tunes two to four times with the arrangement changing each time and now
    // and then a bar or two of the ground alone, then the last bars again, softly and slowing, as an echo.
    function suite(P, st, r, opening, cue) {
        const n = P.ground.length, passes = [], keys = Object.keys(P.tunes), used = {};
        let figK = -1, voice = null;
        const lute = (alt) => {
            figK = other(P.figures.length, figK, r);
            const f = { kind: 'figure', ins: 'lute', key: 'lute', fig: P.figures[figK], win: P.win };
            if (alt && r() < 0.35) {
                f.alt = P.figures[other(P.figures.length, figK, r)];
                f.altAt = 4 * (1 + Math.floor(r() * Math.max(1, n / 4 - 1)));
            }
            return f;
        };
        const sparse = () => ({ kind: 'figure', ins: 'lute', key: 'lute', figs: P.sparse, cadence: P.cadence, win: P.win, strum: 0.03, level: 0.9 });
        const drone = () => (P.drone && r() < P.droneOdds ? { kind: 'drone', ins: 'drone', notes: P.drone } : null);
        const bass = odds => (r() < odds ? { kind: 'bass', ins: 'bassviol', key: 'bass' } : null);
        const drum = () => (P.perc && r() < 0.7 ? { kind: 'perc', ins: 'frame', pat: P.perc, level: 0.8 } : null);
        const tune = (key, how, avoid) => {
            for (let tries = 0; tries < 8; tries++) {
                const pool = P.voices.filter(x => x !== avoid), ins = choose(pool.length ? pool : P.voices, r);
                const h = tries < 4 ? how : 'plain', bars = vary(P.tunes[key], h, P.mode, h === 'oct' ? SOUNDS[ins].oct || 0 : 0, r);
                if (fits(bars, ins))
                    return { kind: 'tune', ins, bars };
            }
            return null;
        };
        if (!opening)
            passes.push({ name: 'intro', from: 0, to: P.intro, level: 0.8, parts: [sparse(), drone()] });
        const count = 2 + (r() < 0.6 ? 1 : 0) + (r() < 0.25 ? 1 : 0);
        let key = keys[0], first = null;
        for (let k = 0; k < count; k++) {
            if (k > 0 && keys.length > 1)
                key = key === keys[0] ? (r() < 0.75 ? keys[1] : keys[0]) : keys[0];
            const t = tune(key, used[key] ? choose(['orn', 'orn', 'thin', 'oct'], r) : 'plain', voice);
            if (t) {
                voice = t.ins;
                first = first || t.ins;
            }
            used[key] = (used[key] || 0) + 1;
            passes.push({ name: 'tune ' + key, from: 0, to: n, level: k === 0 ? 0.92 : 1, parts: [lute(true), t, bass(0.3 + 0.25 * k), drone(), drum()] });
            if (k < count - 1 && r() < 0.22)
                passes.push({ name: 'interlude', from: 0, to: P.intro, level: 0.85, parts: [lute(false), bass(0.5)] });
        }
        const echo = first && vary(P.tunes[key], 'thin', P.mode, 0, r);
        passes.push({ name: 'echo', from: n - P.coda, to: n, level: 0.72, rit: true, parts: [sparse(), echo && fits(echo, first) ? { kind: 'tune', ins: first, bars: echo } : null, drone()] });
        return perform(P, passes, st, r, cue, P.bpm * (cue.tempo || 1) * (0.97 + r() * 0.06));
    }
    // A section of a piece that goes on as long as it is wanted, chosen from where the last one may go.
    function loop(P, st, r, cue) {
        const name = st.section == null ? P.start : choose(P.sections[st.section].next, r), S = P.sections[name];
        st.section = name;
        st.seen[name] = (st.seen[name] || 0) + 1;
        const parts = S.parts.map(ref => {
            const doubled = ref.endsWith('+'), [k, arg] = ref.replace('+', '').split(':'), d = P.parts[k];
            if (d.kind === 'tune')
                return { kind: 'tune', ins: d.ins, bars: vary(P.tunes[arg], st.seen[name] > 1 && r() < 0.5 ? 'orn' : 'plain', P.mode, 0, r), double: doubled ? -12 : 0, level: d.level };
            if (d.kind === 'figure')
                return Object.assign({}, d, { fig: arg === 'thin' ? d.thin : d.fig });
            return d;
        });
        if (!st.bpm)
            st.bpm = P.bpm * (cue.tempo || 1) * (0.97 + r() * 0.06);
        return perform(P, [{ name, from: 0, to: S.bars || P.ground.length, level: S.level || 1, parts }], st, r, cue, st.bpm);
    }
    // A cue as an endless run of bars, each { bpm, beats, events } or { rest } in seconds, decided as
    // it goes from its own random numbers: the same seed always plays the same music. `opening` starts
    // a suite with the piece the cue names first, straight into its tune; `avoid` is a piece not to
    // start with, the one that played last.
    function performer(score, name, seed, opts) {
        const S = compile(score), cue = S.cues[name], o = opts || {};
        if (!cue)
            throw new Error('No cue ' + name);
        const r = rng(seed), st = { voice: {}, bass: {}, section: null, seen: {}, played: 0, piece: null }, queue = [];
        const refill = () => {
            if (cue.suite) {
                const opening = !st.played && o.opening && cue.first, avoid = st.played ? st.piece : o.avoid;
                const pool = cue.suite.filter(p => p !== avoid), p = opening ? cue.first : choose(pool.length ? pool : cue.suite, r);
                st.piece = p;
                queue.push(...suite(S.pieces[p], st, r, !!opening, cue));
                queue.push({ rest: cue.rest[0] + r() * (cue.rest[1] - cue.rest[0]), piece: null });
                st.played++;
            }
            else {
                st.piece = cue.loop;
                queue.push(...loop(S.pieces[cue.loop], st, r, cue));
            }
        };
        return { get piece() { return st.piece; }, next() { if (!queue.length)
                refill(); return queue.shift(); } };
    }
    /* ---------- out loud ---------- */
    const AHEAD = 0.3;
    // Plays a cue on `ac` from `at`, fading in over `fade` seconds. Call tick() often (a few times a
    // second at least) with the context's time and it schedules the bars about to start; stop() fades
    // it out, and close() silences whatever it left sounding.
    function play(ac, score, name, opts) {
        const o = opts || {}, seed = o.seed >>> 0, r = rng(seed ^ 0x5bd1e995), perf = performer(score, name, seed, o), dk = deckOf(ac, o.level);
        const start = o.at != null ? o.at : ac.currentTime + 0.1;
        const gain = compile(score).cues[name].level || 1;
        for (const g of [dk.dry, dk.wet]) {
            g.gain.value = gain;
            if (o.fade) {
                g.gain.setValueAtTime(0, Math.min(ac.currentTime, start));
                g.gain.setValueAtTime(0, start);
                g.gain.linearRampToValueAtTime(gain, start + o.fade);
            }
        }
        let next = start;
        // Every bar that starts before `until`, in its turn.
        const schedule = until => {
            while (next < until) {
                const bar = perf.next(), spb = 60 / (bar.bpm || 60);
                for (const e of bar.events || [])
                    sound(dk, e.ins, e.m, next + e.at * spb + e.off, e.sec != null ? e.sec : e.d * spb, e.v, r);
                next += bar.rest != null ? bar.rest : bar.beats * spb;
            }
        };
        return {
            get piece() { return perf.piece; },
            schedule,
            tick(now) {
                dk.live = dk.live.filter(x => x[1] > now);
                // After the page has slept, carry on from now rather than play everything it missed at once.
                if (next < now - 0.5)
                    next = now + 0.05;
                schedule(now + AHEAD);
            },
            stop(now, fade) {
                for (const g of [dk.dry, dk.wet]) {
                    g.gain.cancelScheduledValues(now);
                    g.gain.setValueAtTime(g.gain.value, now);
                    g.gain.linearRampToValueAtTime(0, now + fade);
                }
            },
            close() { close(dk); },
        };
    }
    // A short flourish, once: answers when it has finished, and a way to silence it.
    function sting(ac, score, name, at, level) {
        const s = compile(score).stings[name], dk = deckOf(ac, level), spb = 60 / s.bpm, r = rng(3);
        for (const [ins, bar] of s.lines)
            for (const [b, ms, d] of bar)
                for (const m of ms)
                    sound(dk, ins, m, at + b * spb, d * spb, 1, r);
        return { end: at + s.meter * spb, close: () => close(dk) };
    }
    // A cue rendered whole, faster than it plays, for listening to it outside the game: resolves to an AudioBuffer.
    function render(score, name, seconds, opts) {
        const o = opts || {}, rate = o.rate || 48000, ac = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
        play(ac, score, name, Object.assign({ at: 0.05 }, o)).schedule(seconds);
        return ac.startRendering();
    }
    return { rng, noteOf, chordOf, voiceLead, vary, compile, performer, play, sting, render, SOUNDS };
})();
