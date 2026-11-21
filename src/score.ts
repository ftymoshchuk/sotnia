"use strict";

/* ---------- the shape of a score (the engine reads it through these) ---------- */
// What every piece has: its time (`meter` beats to a bar, `bpm` beats a minute), its mode (`scale`: the mode's
// seven notes, then, if it has one, a raised leading tone), its `ground` (a chord a bar) and `tunes` over it,
// each as many bars as the ground has.
interface PieceDefBase {
  meter: number;
  bpm: number;
  scale: string;
  ground: string;
  tunes: Record<string, string>;
}
// A piece of the suite, which is arranged afresh each time it comes round.
interface SuitePieceDef extends PieceDefBase {
  figures: string[];     // what the lute plays under a tune: a bar of it, repeated under every bar of a pass (a different figure each pass)
  sparse: string[];      // thinner figures for the introduction and the echo, one picked at random for each bar
  cadence: string;       // the figure that ends the echo, in the last bar of the ground
  voices: PitchedName[]; // who may carry a tune
  drone?: string;        // the drone's notes, which come in under a pass with the odds `droneOdds` (0.35 if not given)
  droneOdds?: number;
  perc?: string;         // a pattern for the frame drum, which plays in some of the passes
  chords?: NoteRange;    // where the lute's chords lie (50 to 67 if not given)
  intro: number;         // bars of introduction, and of interlude
  coda: number;          // bars of the echo that ends it
  sections?: undefined;  // (only a loop piece has these)
}
// A piece that goes on as long as it is wanted. It begins at the section `start` and moves on from section to section.
interface LoopPieceDef extends PieceDefBase {
  parts: Record<string, PartDef>;
  start: string;
  sections: Record<string, SectionDef>;
}
type PieceDef = SuitePieceDef | LoopPieceDef;

// A section of a loop piece: the parts that play, for `bars` (as many as the ground has if not given) at `level` (1 if
// not given), and where it may go next. A part is its name, 'horn' or, for a tune, 'horn:a'; a '+' after the tune
// doubles it an octave down ('horn:a+'), and 'strings:thin' is a figure's thinner form.
interface SectionDef {
  parts: string[];
  bars?: number;
  level?: number;
  next: string[];
}
// A part of a loop piece plays an instrument (`ins`), at a `level` against the other parts (1 if not given).
interface PartDefBase { ins: SoundName; level?: number }
// Held notes, sounded as a section begins: 'D2 A2'.
interface DronePartDef extends PartDefBase { kind: 'drone'; notes: string }
// Drum strokes (written as the note on drums at the head of the score says): a bar of `pat` for each bar of a section in turn,
// round and round; `turn` takes the place of the section's last bar.
interface PercPartDef extends PartDefBase { kind: 'perc'; pat: string; turn?: string }
// The bass of each chord, within `win` (33 to 50 if not given).
interface BassPartDef extends PartDefBase { kind: 'bass'; win?: NoteRange }
// A tune of the piece, which a section asks for by name: 'horn:a'.
interface TunePartDef extends PartDefBase { kind: 'tune'; ins: PitchedName }
// `n` voices on each chord, voice-led within `win`.
interface ChordsPartDef extends PartDefBase { kind: 'chords'; win: NoteRange; n: number }
// A figure played under every bar, `thin` being its thinner form. Its bass lies within `low` (33 to 50 if not given), its
// chord within `win` (50 to 67) and has `n` notes (3), strummed `strum` seconds apart (0.025).
interface FigurePartDef extends PartDefBase { kind: 'figure'; fig: string; thin?: string; low?: NoteRange; win?: NoteRange; n?: number; strum?: number }
// A drum roll on the last two beats of a section's last bar.
interface RollPartDef extends PartDefBase { kind: 'roll' }
type PartDef = DronePartDef | PercPartDef | BassPartDef | TunePartDef | ChordsPartDef | FigurePartDef | RollPartDef;

// What plays when the game asks for a cue. It is either a suite of pieces, played in turn (never the same one twice
// running, the music opening on `first`) with a rest of between `rest` seconds after each, or one piece that goes on
// (a loop). `level` is how loud the cue is against the others (1 if not given), `tempo` a multiple of the piece's beats
// a minute (1) and `transpose` a number of semitones (0).
interface CueDefBase { level?: number; tempo?: number; transpose?: number }
interface SuiteCueDef extends CueDefBase { suite: string[]; first?: string; rest: [min: number, max: number]; loop?: undefined }
interface LoopCueDef extends CueDefBase { loop: string; suite?: undefined }
type CueDef = SuiteCueDef | LoopCueDef;

// A flourish played once: a bar of `meter` beats at `bpm`, in lines of an instrument and its notes.
interface StingDef { bpm: number; meter: number; lines: [ins: SoundName, notes: string][] }

// A score: its pieces, the cues that say which of them play when the game asks for music, and its flourishes.
interface Score {
  pieces: Record<string, PieceDef>;
  cues: Record<string, CueDef>;
  stings?: Record<string, StingDef>;
}

/* ===== SOTNIA music: what plays, written out as data. js/music.js composes and plays it. =====
 *
 * Notes are a name and how many beats they last: 'D5:1.5' is the D an octave above the one above
 * middle C, held a beat and a half; 'r:1' is a beat's rest, '[D3,A3]:2' two notes at once, and '|'
 * is a bar line. Every bar must fill its metre, which js/music.js checks (and so do the tests).
 *
 * A ground is a chord a bar, or two to a bar joined by '-' ('Dm-A'). The lute's figures pick from
 * the chord: B is its bass, C the whole chord strummed, 1 to 4 its notes from the lowest up, B8 and
 * B5 the octave and the fifth above the bass. A drum part writes its strokes as notes, or X and x
 * for the frame drum's boom and the tap at its rim.
 *
 * The journey's pieces are each a ground of the time with tunes over it. Each time a piece comes
 * round it is arranged afresh (see suite() in js/music.js); the muster and the fight go on as long
 * as they are needed, from section to section along the `next` each one allows.
 */
const SCORE = {
  pieces: {
    // La Folia, the dance ground everyone played, in sarabande time.
    folia: {
      meter: 3, bpm: 66, scale: 'D E F G A Bb C C#',
      ground: 'Dm A Dm C F C Dm A | Dm A Dm C F C Dm-A Dm',
      tunes: {
        a: 'A4:1 D5:1.5 E5:.5 | F5:1 E5:2 | D5:1 F5:1.5 A5:.5 | G5:1 E5:2 | A5:1 F5:1.5 G5:.5 | A5:1 G5:2 | F5:1 E5:1 D5:1 | C#5:2 E5:1 |' +
          'D5:1 A5:1.5 G5:.5 | F5:1 E5:2 | D5:1 F5:1.5 A5:.5 | G5:1 E5:1.5 D5:.5 | C5:1 F5:1.5 A5:.5 | Bb5:1 G5:2 | F5:1 E5:.5 C#5:1.5 | D5:3',
        b: 'D5:1 C5:.5 Bb4:.5 A4:1 | A4:.5 B4:.5 C#5:1 E5:1 | F5:1.5 E5:.5 D5:1 | C5:1 E5:1 G5:1 | A5:1.5 G5:.5 F5:1 | E5:1 C5:1 G4:1 | A4:.5 Bb4:.5 A4:.5 G4:.5 F4:1 | E4:1 A4:2 |' +
          'D5:1 C5:.5 Bb4:.5 A4:1 | A4:.5 B4:.5 C#5:1 E5:1 | F5:1.5 G5:.5 A5:1 | G5:1 E5:.5 F5:.5 G5:1 | A5:1.5 G5:.5 F5:1 | E5:1 G5:.5 F5:.5 E5:1 | D5:1 F5:.5 E5:1 C#5:.5 | D5:3',
      },
      figures: ['B:1 C:2', 'C:1 C:2', 'B:1 3:.5 2:.5 4:1', 'B:1 2:1 3:1', 'B:.5 2:.5 3:.5 4:.5 3:.5 2:.5'],
      sparse: ['B:3', 'B:2 3:1', 'B:1 r:1 C:1'], cadence: 'C:3',
      voices: ['flute', 'viol', 'lute'], drone: 'D2 A2', droneOdds: 0.3, intro: 8, coda: 4,
    },
    // A lament on the falling fourth, D C B flat A, as Italy was singing it in the 1630s.
    lament: {
      meter: 3, bpm: 58, scale: 'D E F G A Bb C C#',
      ground: 'Dm C Bb A | Dm C Bb A | Gm/Bb Dm Bb A | Dm Gm Dm-A Dm',
      tunes: {
        a: 'F5:2 E5:1 | E5:1.5 D5:.5 C5:1 | D5:2 C5:1 | C#5:3 | A5:2 G5:1 | G5:1.5 F5:.5 E5:1 | F5:1 D5:1 Bb4:1 | A4:2 C#5:1 |' +
          'D5:2 Bb4:1 | A4:1 D5:1 F5:1 | F5:1.5 E5:.5 D5:1 | E5:2 C#5:1 | D5:1.5 E5:.5 F5:1 | G5:1 Bb5:1 G5:1 | F5:1 D5:.5 E5:1 C#5:.5 | D5:3',
        b: 'A4:1.5 G4:.5 F4:1 | G4:1.5 F4:.5 E4:1 | F4:1.5 E4:.5 D4:1 | C#4:2 E4:1 | D4:1 F4:1 A4:1 | G4:1 C5:1 E5:1 | D5:1.5 C5:.5 Bb4:1 | A4:3 |' +
          'Bb4:1.5 A4:.5 G4:1 | F4:1.5 E4:.5 D4:1 | D4:1 F4:1 Bb4:1 | A4:1 C#5:1 E5:1 | F5:2 E5:1 | D5:1.5 C5:.5 Bb4:1 | A4:1 F4:.5 E4:1.5 | D4:3',
      },
      figures: ['B:1 C:2', 'B:1 2:1 3:1', 'B:1 3:.5 2:.5 4:1', 'B:2 C:1'],
      sparse: ['B:3', 'B:2 3:1', 'B:1 r:1 4:1'], cadence: 'C:3',
      voices: ['viol', 'flute', 'lute'], drone: 'D2 A2', droneOdds: 0.3, intro: 8, coda: 4,
    },
    // A duma, the cossack's sung tale, over a drone, in the mode with the raised fourth (G sharp in D).
    duma: {
      meter: 4, bpm: 54, scale: 'D E F G# A B C',
      ground: 'Dm Dm E Dm | Am Dm E Dm',
      tunes: {
        a: 'D4:1.5 E4:.5 F4:2 | A4:3 G#4:.5 A4:.5 | B4:2 G#4:1 E4:1 | F4:1 E4:1 D4:2 | C5:2 B4:1 A4:1 | A4:1.5 G#4:.5 F4:1 E4:1 | G#4:1.5 F4:.5 E4:2 | D4:4',
        b: 'A4:1 D5:1 F5:2 | E5:1.5 F5:.5 D5:2 | B4:1 E5:1 G#5:2 | F5:1.5 E5:.5 D5:2 | E5:2 C5:1 A4:1 | D5:1 F5:1 A5:1.5 G#5:.5 | G#5:2 F5:1 E5:1 | D5:4',
      },
      figures: ['B:2 C:2', 'B:1 3:1 2:1 4:1', 'B:1 C:1.5 3:.5 2:1'],
      sparse: ['B:4', 'B:2 3:2', 'B:1 r:2 C:1'], cadence: 'C:4',
      voices: ['viol', 'flute'], drone: 'D2 A2', droneOdds: 0.85, intro: 4, coda: 4,
    },
    // A Polish dance, chorea polonica as the lute books call it, on the passamezzo ground, with a frame drum.
    taniec: {
      meter: 4, bpm: 76, scale: 'F G A Bb C D E',
      ground: 'F Bb F C | F Bb F-C F',
      tunes: {
        a: 'C5:1 F5:1 A5:1 F5:1 | D5:1.5 C5:.5 Bb4:2 | A4:1 C5:1 F5:1.5 E5:.5 | G5:1 E5:1 C5:2 | A5:1 G5:.5 F5:.5 C5:1 F5:1 | D5:1 F5:1 Bb4:1 D5:1 | C5:1 A4:1 G4:1 E5:1 | F5:3 r:1',
        b: 'A4:2 C5:2 | Bb4:1.5 A4:.5 G4:1 F4:1 | A4:1 G4:.5 A4:.5 C5:2 | E4:2 G4:2 | F4:1 A4:1 C5:1 F5:1 | D5:2 Bb4:1 D5:1 | C5:1.5 A4:.5 G4:1.5 E4:.5 | F4:4',
      },
      figures: ['B:1 C:1 B5:1 C:1', 'B:1 3:.5 4:.5 C:1 2:1', 'B:2 C:1 C:1', 'B:1 2:1 3:1 4:1'],
      sparse: ['B:2 C:2', 'B:4', 'B:1 r:1 C:2'], cadence: 'C:4',
      voices: ['flute', 'lute', 'viol'], perc: 'X:1 x:.5 x:.5 X:1 x:1', intro: 4, coda: 4,
    },
    // Before a fight: a drone, a slow heartbeat on the kettle drums, the bass viol, and horn calls.
    muster: {
      meter: 4, bpm: 63, scale: 'D E F G A Bb C C#',
      ground: 'Dm Dm Bb A | Dm Dm Gm/Bb A',
      tunes: {
        a: 'r:2 A3:1 D4:1 | A4:3 r:1 | r:4 | r:2 E4:1 C#4:1 | D4:3 r:1 | r:2 D4:.5 D4:.5 F4:1 | G4:2 Bb4:1 G4:1 | A4:4',
        b: 'r:4 | D4:1 F4:1 A4:2 | Bb4:2 F4:2 | E4:2 r:2 | r:4 | A3:1 D4:1 F4:1 A4:1 | Bb4:3 r:1 | A4:2 E4:2',
      },
      parts: {
        drone: { kind: 'drone', ins: 'drone', notes: 'D2 A2' },
        heart: { kind: 'perc', ins: 'timp', pat: 'D2:.75 D2:3.25 | D2:.75 D2:1.25 A1:2', level: 0.8 },
        low: { kind: 'bass', ins: 'bassviol' },
        horn: { kind: 'tune', ins: 'horn' },
        choir: { kind: 'chords', ins: 'choir', win: [50, 64], n: 3, level: 0.85 },
        march: { kind: 'perc', ins: 'frame', pat: 'X:1 x:1 X:1 x:.5 x:.5', level: 0.7 },
      },
      start: 'wait',
      sections: {
        wait: { parts: ['drone', 'heart'], bars: 4, next: ['low'] },
        low: { parts: ['drone', 'heart', 'low'], next: ['call', 'voices'] },
        call: { parts: ['drone', 'heart', 'low', 'horn:a'], next: ['voices', 'march', 'low'] },
        voices: { parts: ['drone', 'heart', 'choir', 'horn:b'], next: ['march', 'call'] },
        march: { parts: ['heart', 'low', 'march', 'horn:a'], next: ['call', 'voices', 'low'] },
      },
    },
    // The fight: kettle drums in threes and twos, low strings driving, horns with the old theme, and voices.
    battle: {
      meter: 4, bpm: 120, scale: 'D E F G A Bb C C#',
      ground: 'Dm Dm Bb C | Dm Dm Bb A',
      tunes: {
        a: 'D4:2.5 r:.5 A4:1 | A4:2 G4:1 F4:1 | F4:2.5 r:.5 G4:1 | E4:3 C4:.5 E4:.5 | D4:1 F4:1 A4:2 | D5:2.5 r:.5 C5:1 | Bb4:2 A4:1 G#4:1 | A4:3.5 r:.5',
        b: 'F4:1.5 E4:.5 D4:2 | A4:1.5 G4:.5 F4:1 E4:1 | D4:2 F4:2 | E4:1 G4:1 C5:2 | D5:2 A4:1 F4:1 | D4:1 F4:1 A4:1 D5:1 | D5:2 C5:1 Bb4:1 | A4:2 E4:1 C#4:1',
      },
      parts: {
        timp: { kind: 'perc', ins: 'timp', pat: 'D2:1.5 D2:1.5 A1:1', turn: 'D2:1.5 D2:1.5 A1:.5 A1:.5' },
        strings: { kind: 'figure', ins: 'cello', fig: 'B:.5 B:.5 B8:.5 B:.5 B:.5 B8:.5 B5:.5 B:.5', thin: 'B:1 B8:1 B:1 B5:1', low: [33, 50] },
        horns: { kind: 'tune', ins: 'horn' },
        choir: { kind: 'chords', ins: 'choir', win: [50, 64], n: 3 },
        roll: { kind: 'roll', ins: 'tabor' },
      },
      start: 'drums',
      sections: {
        drums: { parts: ['timp'], bars: 2, next: ['drive'] },
        drive: { parts: ['timp', 'strings'], next: ['theme'] },
        theme: { parts: ['timp', 'strings', 'horns:a'], next: ['voices', 'answer'] },
        answer: { parts: ['timp', 'strings', 'horns:b'], next: ['voices', 'full'] },
        voices: { parts: ['timp', 'strings', 'horns:b', 'choir', 'roll'], next: ['full', 'break', 'theme'] },
        full: { parts: ['timp', 'strings', 'horns:a+', 'choir'], next: ['break', 'answer', 'drive'] },
        break: { parts: ['timp', 'strings:thin', 'roll'], bars: 4, next: ['theme', 'voices'] },
      },
    },
  },
  cues: {
    // Camp, the road and the title: the pieces in turn, never the same one twice running, with a
    // rest of 8 to 20 seconds between them. The music opens on the folia.
    camp: { suite: ['folia', 'lament', 'duma', 'taniec'], first: 'folia', rest: [8, 20] },
    // The muster a little louder than its few instruments would be, the fight louder again.
    muster: { loop: 'muster', level: 1.4 },
    battle: { loop: 'battle', level: 1.3 },
    final: { loop: 'battle', level: 1.3, tempo: 1.08, transpose: 2 },
  },
  stings: {
    // The field is won: horns up the chord of D major, the drums and the voices on it.
    won: { bpm: 120, meter: 4, lines: [['horn', 'A3:.5 D4:.5 F#4:.5 A4:2.5'], ['horn', 'r:1.5 D4:2.5'], ['horn', 'r:1.5 F#4:2.5'], ['timp', 'D2:.5 r:1 D2:.25 D2:.25 D2:2'], ['choir', 'r:1.5 [D3,A3,D4,F#4]:2.5']] },
    // Lost: the lament's falling fourth, left open on A.
    lost: { bpm: 60, meter: 5, lines: [['horn', 'D4:1 C4:1 Bb3:1 A3:2'], ['bassviol', 'D2:1 C2:1 Bb1:1 A1:2'], ['timp', 'D2:3 A1:2'], ['choir', 'r:3 [A2,E3,A3]:2']] },
  },
} satisfies Score;
// The cues the game can ask for, and the flourishes that end a fight: the names written above.
type CueName = keyof typeof SCORE.cues;
type StingName = keyof typeof SCORE.stings;
