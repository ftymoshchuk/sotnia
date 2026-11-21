"use strict";
/* ===== SOTNIA interface: terrain. The scenery behind a fight is the land the fight is in. ===== */

/**
 * Backdrops are drawn SS times finer than the scene, as the figures are, so that a man does not stand against blocks twice his own
 * pixel. Everything here is in figure pixels from the picture's top left: W by H of them, with the horizon at HZ of the scene. The
 * men stand between FY and FY + BD of the scene, the lower half of the picture, so what is drawn there is kept quiet, and the
 * landmarks stand on the hills, the line of the horizon and a little below it.
 */

/** The colours of a land, from the sky overhead to the ground at the foot of the picture, and what grows on it. */
interface Tone { sky: string; haze: string; far: string; hill: string; ground: string; fore: string; mark: string; leaf: string; leafLo: string }

/** What a backdrop is drawn on, and with: painters of shapes in figure pixels, the picture's own random numbers, and the lie of the land. */
interface Scene {
  W: number; H: number; HZ: number; // the picture's size, and where the ground begins
  sky: boolean; // whether there is a sky to draw (a skyline by night has its own)
  weather: Weather; T: Tone; r: () => number;
  ridge: (x: number) => number; // the skyline of the near hills at x, which the land sets (the horizon until it does)
  rect(x: number, y: number, w: number, h: number, c: string): void;
  line(x0: number, y0: number, x1: number, y1: number, c: string): void;
  disc(cx: number, cy: number, rx: number, ry: number, c: string, edge?: string): void;
  poly(pts: readonly number[], c: string, edge?: string): void;
}

/** What buildings, roofs and water are made of, whatever the land. */
const STUFF = {
  wall: '#efe9d6', wallLo: '#d6cfba', thatch: '#cdb77f', thatchLo: '#a8935c', tile: '#b9785a', tileLo: '#8f5a43', shingle: '#6d685c', timber: '#9a7b52', timberLo: '#6f5535',
  stone: '#c3bdad', stoneLo: '#9b9588', brick: '#b0674d', brickLo: '#86503d', water: '#b5c3c4', waterLo: '#8fa4a8', smoke: '#c4bfb2', straw: '#d8c58b', earth: '#7f6544', bark: '#6b4f35', birch: '#f0ece0'
} as const;

/** A colour (#rrggbb) moved the part t of the way, from 0 to 1, towards another. */
function mixHex(a: string, b: string, t: number) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16), ch = (s: number) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** A scene to draw on: g is the SS-fine canvas of the backdrop (see sceneCanvas), whose context is scaled to the scene. */
function makeScene(g: CanvasRenderingContext2D, seed: number, weather: Weather, T: Tone, W = LW * SS, sky = true): Scene {
  const H = LH * SS;
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    if (x1 > x0 && y1 > y0) { g.fillStyle = c; g.fillRect(x0 / SS, y0 / SS, (x1 - x0) / SS, (y1 - y0) / SS); }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx - dy;
    for (let i = 0; i < 900; i++) { rect(x0, y0, 1, 1, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x0 += sx; } if (e2 < dx) { e += dx; y0 += sy; } }
  };
  const fillPoly = (pts: readonly number[], c: string) => {
    let top = Infinity, bot = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { top = Math.min(top, pts[i]); bot = Math.max(bot, pts[i]); }
    for (let y = Math.floor(top); y < Math.ceil(bot); y++) {
      const xs: number[] = [], yc = y + 0.5;
      for (let i = 0, n = pts.length; i < n; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % n], by = pts[(i + 3) % n];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) rect(Math.round(xs[k]), y, Math.round(xs[k + 1]) - Math.round(xs[k]), 1, c);
    }
  };
  const poly = (pts: readonly number[], c: string, edge?: string) => {
    fillPoly(pts, c);
    if (edge) for (let i = 0, n = pts.length; i < n; i += 2) line(pts[i], pts[i + 1], pts[(i + 2) % n], pts[(i + 3) % n], edge);
  };
  const disc = (cx: number, cy: number, rx: number, ry: number, c: string, edge?: string) => {
    const rows = (a: number, b: number, col: string) => {
      for (let dy = -b; dy <= b; dy++) { const hw = Math.round(a * Math.sqrt(Math.max(0, 1 - (dy / Math.max(1, b)) ** 2))); rect(cx - hw, cy + dy, 2 * hw + 1, 1, col); }
    };
    rx = Math.round(rx); ry = Math.round(ry); cx = Math.round(cx); cy = Math.round(cy);
    if (edge) { rows(rx, ry, edge); rows(rx - 1, ry - 1, c); } else rows(rx, ry, c);
  };
  return { W, H, HZ: HZ * SS, sky, weather, T, r: mulberry(seed), ridge: () => HZ * SS - 4, rect, line, disc, poly };
}

/* ---------- the colours of each land ---------- */
// Pale, as the paper of the old backdrops was: the ink does the drawing and the tone only says which country it is.
const TONES: Record<LandId, Tone> = {
  steppe:    { sky: '#e0d9bd', haze: '#ebe1ba', far: '#dccf9f', hill: '#d6cca4', ground: '#d1c598', fore: '#c3b68c', mark: '#8e7c4b', leaf: '#b8b078', leafLo: '#8a8355' },
  ukraine:   { sky: '#dcd6be', haze: '#e6ddc0', far: '#d0cba9', hill: '#cec7a4', ground: '#c8bd9a', fore: '#b7ab88', mark: '#6e5d3b', leaf: '#aab380', leafLo: '#7d8860' },
  poland:    { sky: '#dbd7c2', haze: '#e5e0c8', far: '#cfcfb0', hill: '#c9cba9', ground: '#c5c7a2', fore: '#b4b790', mark: '#68704a', leaf: '#aab782', leafLo: '#78875a' },
  prussia:   { sky: '#d6d9ce', haze: '#e1e3d6', far: '#c3cdc9', hill: '#cdcbb2', ground: '#d3cba9', fore: '#c6bd98', mark: '#7a7052', leaf: '#a7b08a', leafLo: '#6f7c5b' },
  lithuania: { sky: '#d4d5c6', haze: '#dedecd', far: '#aeb59c', hill: '#b7bda2', ground: '#bdc0a0', fore: '#aaad8c', mark: '#5a6040', leaf: '#8f9f74', leafLo: '#566a4c' },
  front:     { sky: '#d3ccbb', haze: '#dacfb4', far: '#c8bfa6', hill: '#c4b799', ground: '#bfae91', fore: '#aa9876', mark: '#5e4a30', leaf: '#9a9670', leafLo: '#6b6a4c' },
  silesia:   { sky: '#dcd6c2', haze: '#e6ddc4', far: '#bfc3c4', hill: '#cfc29c', ground: '#c9bd9a', fore: '#b9ab86', mark: '#6e5e3a', leaf: '#a8ab7c', leafLo: '#77805a' },
  saxony:    { sky: '#dcd8c3', haze: '#e6e0c7', far: '#c4ccbb', hill: '#cccb9e', ground: '#c8c79c', fore: '#b8b78d', mark: '#66703f', leaf: '#a6b57a', leafLo: '#6f8656' }
};
/** A land's colours on a day of this weather: rain greys and darkens them, fog pales them. */
function weatherTone(T: Tone, weather: Weather): Tone {
  if (weather === 'clear') return T;
  const to = weather === 'rain' ? '#8f8c82' : '#efebdf', k = weather === 'rain' ? 0.3 : 0.4, out = {} as Tone;
  for (const n of Object.keys(T) as (keyof Tone)[]) out[n] = mixHex(T[n], to, n === 'mark' ? k / 2 : k);
  return out;
}

/* ---------- the sky ---------- */
/** One cloud, as the old woodcuts have them: strokes, the longest below. */
function cloud(s: Scene, cx: number, cy: number, w: number, heavy: boolean) {
  const c = PAL.ink;
  s.rect(cx + w * 0.3, cy, w * 0.3, 1, c); s.rect(cx + w * 0.14, cy + 3, w * 0.62, 1, c); s.rect(cx, cy + 6, w, 2, c);
  if (heavy) { s.rect(cx + w * 0.1, cy + 10, w * 0.7, 1, c); s.rect(cx + w * 0.22, cy + 13, w * 0.4, 1, mixHex(c, s.T.sky, 0.35)); }
}
/** The sun with its rays, as the old woodcuts have it. */
function sun(s: Scene, sx: number, sy: number, k = 1) {
  const c = PAL.ink;
  s.disc(sx, sy, 10 * k, 10 * k, mixHex(s.T.haze, '#fff8e0', 0.7), c);
  for (let a = 0; a < 16; a++) { const an = a * Math.PI / 8, r0 = 14 * k, r1 = (a % 2 ? 19 : 25) * k; s.line(sx + Math.cos(an) * r0, sy + Math.sin(an) * r0, sx + Math.cos(an) * r1, sy + Math.sin(an) * r1, c); }
}
/** The sky: bands from the tone overhead to the haze at the horizon, ruled across as an engraver would, the sun if it is out, and the clouds. */
function skyArt(s: Scene, o: { clouds: number; sun?: [number, number]; sunK?: number }) {
  if (!s.sky) return;
  const { W, HZ, T, r } = s, bands = 6;
  for (let i = 0; i < bands; i++) s.rect(0, Math.round(i * HZ / bands), W, Math.ceil(HZ / bands) + 1, mixHex(T.sky, T.haze, i / (bands - 1)));
  for (let y = 6; y < HZ - 4; y += 9 - Math.round(5 * y / HZ)) {
    const c = mixHex(mixHex(T.sky, T.haze, y / HZ), PAL.ink, 0.05 + 0.05 * y / HZ);
    for (let x = -(r() * 60 | 0); x < W; x += 30 + (r() * 60 | 0) + 20) s.rect(x, y, 30 + (r() * 90 | 0), 1, c);
  }
  const clear = s.weather === 'clear', n = clear ? o.clouds : o.clouds * 2 + 1;
  if (clear && o.sun) sun(s, o.sun[0] + (r() * 80 | 0) - 40, o.sun[1], o.sunK || 1);
  for (let i = 0; i < n; i++) cloud(s, r() * (W - 120) | 0, 8 + (r() * 46 | 0), 52 + (r() * 60 | 0), !clear);
}

/* ---------- the hills ---------- */
/**
 * A skyline of hills, a sum of waves (their frequency and their height) about the line base. It fills the hills in with a tone, inks the
 * skyline and hatches the slopes that turn from the light, and returns the skyline for the landmarks to stand on.
 */
function hillsArt(s: Scene, base: number, waves: readonly (readonly [number, number])[], o: { fill: string; hatch?: boolean; edge?: string }) {
  const ph = waves.map(() => s.r() * 6.28), r = s.r, edge = o.edge || PAL.ink;
  const ridge = (x: number) => Math.round(base - waves.reduce((a, w, i) => a + w[1] * Math.sin(x * w[0] + ph[i]), 0));
  for (let x = 0; x < s.W; x++) {
    const y = ridge(x), next = ridge(x + 3);
    s.rect(x, y, 1, s.HZ - y, o.fill); s.rect(x, y, 1, 1, edge);
    if (o.hatch !== false && x % 3 === 0 && next > y) s.rect(x, y + 3, 1, 2 + (r() * 8 | 0), mixHex(o.fill, PAL.ink, 0.35));
  }
  return ridge;
}

/* ---------- the ground ---------- */
/** The ground: the horizon line and tone shading from the haze at the horizon to the fore at the foot of the picture. */
function groundArt(s: Scene) {
  const { W, H, HZ, T } = s, n = 8;
  for (let i = 0; i < n; i++) { const y0 = HZ + Math.round(i * (H - HZ) / n), y1 = HZ + Math.round((i + 1) * (H - HZ) / n); s.rect(0, y0, W, y1 - y0 + 1, mixHex(T.ground, T.fore, i / (n - 1))); }
  s.rect(0, HZ, W, 2, PAL.ink);
}

/* ---------- props: the things that stand in a land ---------- */
/** A prop draws one thing standing at x, y (its foot, in figure pixels), k times its usual size. */
type Prop = (s: Scene, x: number, y: number, k: number) => void;
type PropName = 'pine' | 'spruce' | 'birch' | 'willow' | 'poplar' | 'oak' | 'orchard' | 'thorn' | 'dead' | 'bush' | 'rock' | 'tuft' | 'kovyl' | 'reeds' | 'hay' | 'well' | 'cross'
  | 'baba' | 'beacon' | 'khata' | 'orthodox' | 'windmill' | 'cottage' | 'logHut' | 'manor' | 'church' | 'chapel' | 'brickChurch' | 'towerMill' | 'halfTimber' | 'castle' | 'cityWall' | 'ruin'
  | 'tent' | 'cannon' | 'gabions' | 'gallows' | 'boulder' | 'fern' | 'nest' | 'ship' | 'barge' | 'smoke' | 'hops' | 'sheaf' | 'blockhouse' | 'tollHouse' | 'wagon'
  | 'raft' | 'millRuin' | 'watermill' | 'signpost' | 'barn' | 'flame' | 'cow';
/** The colour of the edge of a mass of leaves or a stone: its own colour, much darkened. */
const edgeOf = (c: string) => mixHex(c, INK, 0.55);
/** The dark of a window or a door. */
const DARK = '#4a443b';
/** Hatches the inside of a polygon with vertical strokes, every step pixels, as an engraver shades a roof. */
function hatchPoly(s: Scene, pts: readonly number[], c: string, step = 2, inset = 2) {
  let left = Infinity, right = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { left = Math.min(left, pts[i]); right = Math.max(right, pts[i]); }
  for (let x = Math.ceil(left) + 1; x < right; x += step) {
    const ys: number[] = [], xc = x + 0.5;
    for (let i = 0, n = pts.length; i < n; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % n], by = pts[(i + 3) % n];
      if ((ax <= xc && bx > xc) || (bx <= xc && ax > xc)) ys.push(ay + (xc - ax) / (bx - ax) * (by - ay));
    }
    ys.sort((a, b) => a - b);
    for (let k = 0; k + 1 < ys.length; k += 2) if (ys[k + 1] - ys[k] > 2 * inset + 1) s.rect(x, ys[k] + inset, 1, ys[k + 1] - ys[k] - 2 * inset, c);
  }
}
/** The four sails of a mill turning on its hub, each a long arm with the bars of its lattice. */
function sails(s: Scene, hx: number, hy: number, len: number, k: number, turn: number) {
  for (let i = 0; i < 4; i++) {
    const a = turn + i * Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    s.line(hx, hy, hx + ux * len, hy + uy * len, INK);
    s.line(hx + ux * len * 0.25 + nx * 4 * k, hy + uy * len * 0.25 + ny * 4 * k, hx + ux * len + nx * 4 * k, hy + uy * len + ny * 4 * k, STUFF.thatchLo);
    for (let d = 0.3; d < 1; d += 0.14) s.line(hx + ux * len * d, hy + uy * len * d, hx + ux * len * d + nx * 4 * k, hy + uy * len * d + ny * 4 * k, STUFF.thatchLo);
  }
}
/** A plain wall of a building, as a box with its two sides and its foot inked. */
function walls(s: Scene, x0: number, y: number, w: number, h: number, c: string) {
  s.rect(x0, y - h, w, h, c); s.rect(x0, y - h, 1, h, INK); s.rect(x0 + w - 1, y - h, 1, h, INK); s.rect(x0, y - 1, w, 1, INK);
}
const PROPS: Record<PropName, Prop> = {
  /* trees */
  pine(s, x, y, k) {
    const h = 38 * k, T = s.T;
    s.rect(x - 1, y - h * 0.8, 2, h * 0.8, STUFF.bark); s.rect(x - 1, y - h * 0.8, 1, h * 0.8, STUFF.timberLo);
    for (const [dx, dy, rx, ry] of [[-7, 9, 8, 4], [7, 6, 9, 4], [0, 0, 9, 4]]) s.disc(x + dx * k, y - h + dy * k, rx * k, ry * k, T.leafLo, edgeOf(T.leafLo));
    s.rect(x - 5 * k, y - h - 2 * k, 6 * k, 1, T.leaf);
  },
  spruce(s, x, y, k) {
    const h = 36 * k, T = s.T, n = 5, step = (h - 4 * k) / n;
    s.rect(x - 1, y - 4 * k, 2, 4 * k, STUFF.bark);
    for (let i = n - 1; i >= 0; i--) {
      const top = y - h + i * step, hw = (3.2 + i * 2.2) * k;
      s.poly([x, top, x + hw, top + step * 1.8, x - hw, top + step * 1.8], T.leafLo, edgeOf(T.leafLo));
    }
  },
  birch(s, x, y, k) {
    const h = 32 * k, T = s.T, top = y - h * 0.72;
    s.rect(x - 1, top, 2, h * 0.72, STUFF.birch); s.rect(x, top, 1, h * 0.72, STUFF.wallLo);
    for (let i = 0; i < 5; i++) s.rect(x - 1 + (i % 2), top + 3 + i * 4 * k, 1, 1, INK);
    for (const [dx, dy, rx, ry] of [[-5, -2, 5, 5], [5, -4, 5, 6], [0, -9, 6, 6], [-3, 3, 4, 4], [4, 4, 4, 4]]) {
      s.disc(x + dx * k + 1, top + dy * k + 2, rx * k, ry * k, T.leafLo); s.disc(x + dx * k, top + dy * k, rx * k, ry * k, T.leaf);
    }
  },
  willow(s, x, y, k) {
    const T = s.T, top = y - 24 * k, rx = 13 * k, ry = 8 * k;
    s.rect(x - 2 * k, y - 14 * k, 4 * k, 14 * k, STUFF.bark);
    s.disc(x, top + 6 * k, rx, ry, T.leaf, edgeOf(T.leaf));
    for (let dx = -rx + 1; dx < rx; dx += 2) {
      const yy = top + 6 * k + ry * Math.sqrt(1 - (dx / rx) ** 2);
      s.rect(x + dx, yy, 1, (5 + ((dx * 7 + 91) % 5) + (Math.abs(dx) < rx * 0.6 ? 4 : 0)) * k, T.leafLo);
    }
  },
  poplar(s, x, y, k) {
    const h = 44 * k, T = s.T, ry = (h - 5 * k) / 2;
    s.rect(x - 1, y - 5 * k, 2, 5 * k, STUFF.bark);
    s.disc(x, y - 5 * k - ry, 4 * k, ry, mixHex(T.leafLo, T.leaf, 0.4), edgeOf(T.leafLo));
    s.rect(x - 2 * k, y - h + 8 * k, 1, h * 0.5, T.leaf);
  },
  oak(s, x, y, k) {
    const T = s.T;
    s.rect(x - 2 * k, y - 12 * k, 4 * k, 12 * k, STUFF.bark);
    for (const [dx, dy, rx, ry] of [[-8, -14, 9, 7], [8, -15, 9, 7], [0, -21, 10, 8]]) s.disc(x + dx * k, y + dy * k, rx * k, ry * k, T.leafLo, edgeOf(T.leafLo));
    s.disc(x - 2 * k, y - 22 * k, 6 * k, 4 * k, T.leaf);
  },
  orchard(s, x, y, k) {
    const T = s.T;
    s.rect(x - 1, y - 6 * k, 2, 6 * k, STUFF.bark);
    s.disc(x, y - 11 * k, 6 * k, 6 * k, T.leaf, edgeOf(T.leaf));
    for (let i = 0; i < 5; i++) s.rect(x - 4 * k + ((i * 5) % 9) * k, y - 15 * k + ((i * 7) % 8) * k, 1, 1, '#f1e4de');
  },
  thorn(s, x, y, k) {
    const T = s.T, bark = STUFF.bark, pts = [[0, 0], [1, -5], [3, -10], [6, -14], [9, -17]];
    for (let i = 1; i < pts.length; i++) for (const o of [0, 1]) s.line(x + pts[i - 1][0] * k + o, y + pts[i - 1][1] * k, x + pts[i][0] * k + o, y + pts[i][1] * k, bark);
    s.line(x + 3 * k, y - 10 * k, x - 3 * k, y - 15 * k, bark); s.line(x + 6 * k, y - 14 * k, x + 13 * k, y - 16 * k, bark);
    for (const [dx, dy, rx, ry] of [[-3, -17, 4, 3], [4, -20, 5, 3], [11, -18, 6, 3], [17, -16, 4, 2]]) s.disc(x + dx * k, y + dy * k, rx * k, ry * k, T.leafLo, edgeOf(T.leafLo));
  },
  dead(s, x, y, k) {
    const c = mixHex(INK, s.T.ground, 0.2);
    s.rect(x - 1, y - 22 * k, 2, 22 * k, c);
    for (const [a, b, d, e] of [[0, -14, -7, -21], [0, -17, 6, -23], [0, -9, 6, -13], [0, -12, -5, -14], [-5, -18, -8, -17]]) s.line(x + a * k, y + b * k, x + d * k, y + e * k, c);
  },
  bush(s, x, y, k) { s.disc(x, y - 3 * k, 5 * k, 3 * k, s.T.leafLo, edgeOf(s.T.leafLo)); s.rect(x - 2 * k, y - 5 * k, 3 * k, 1, s.T.leaf); },
  /* what lies on the ground */
  rock(s, x, y, k) {
    s.poly([x - 6 * k, y, x - 5 * k, y - 4 * k, x - 1 * k, y - 6 * k, x + 4 * k, y - 5 * k, x + 7 * k, y], STUFF.stone, edgeOf(STUFF.stone));
    s.rect(x - 3 * k, y - 5 * k, 3 * k, 1, STUFF.wall);
  },
  boulder(s, x, y, k) {
    s.poly([x - 11 * k, y, x - 9 * k, y - 7 * k, x - 3 * k, y - 11 * k, x + 5 * k, y - 10 * k, x + 11 * k, y - 4 * k, x + 12 * k, y], STUFF.stone, edgeOf(STUFF.stone));
    s.rect(x - 6 * k, y - 9 * k, 6 * k, 1, STUFF.wall); s.rect(x + 3 * k, y - 5 * k, 6 * k, 5 * k, STUFF.stoneLo);
  },
  tuft(s, x, y, k) { const c = mixHex(s.T.mark, s.T.ground, 0.3); for (let i = -2; i <= 2; i++) s.line(x + i * k, y, x + i * 1.5 * k, y - (3 + 2 - Math.abs(i)) * k, c); },
  kovyl(s, x, y, k) {
    const pale = mixHex(s.T.ground, '#fffbe8', 0.85), stem = mixHex(s.T.ground, INK, 0.28);
    for (let i = -2; i <= 2; i++) {
      const h = (8 + 2 * (2 - Math.abs(i))) * k, tx = x + i * 2 * k, d = i < 0 ? -1 : 1;
      s.line(x + i * k, y, tx, y - h, stem); s.line(tx, y - h, tx + d * 3 * k, y - h + 3 * k, pale); s.line(tx, y - h + 2, tx + d * 2 * k, y - h + 5 * k, pale);
    }
  },
  fern(s, x, y, k) { const c = mixHex(s.T.leafLo, s.T.ground, 0.15); for (let i = -3; i <= 3; i++) s.line(x, y, x + i * 2 * k, y - (7 - Math.abs(i)) * k, c); },
  reeds(s, x, y, k) {
    for (let i = -3; i <= 3; i++) { const h = (12 + ((i * 5 + 21) % 6)) * k; s.line(x + i * 2, y, x + i * 2 + (i % 2), y - h, s.T.leafLo); if (i % 2 === 0) s.rect(x + i * 2 + (i % 2) - 1, y - h - 1, 2, 4 * k, STUFF.earth); }
  },
  hay(s, x, y, k) {
    s.disc(x, y - 6 * k, 8 * k, 7 * k, STUFF.straw, edgeOf(STUFF.straw)); s.rect(x - 8 * k, y - 1, 16 * k + 1, 1, INK);
    for (let dx = -6; dx <= 6; dx += 3) s.rect(x + dx * k, y - 9 * k + Math.abs(dx) * 0.5, 1, 6 * k, STUFF.thatchLo);
    s.rect(x, y - 15 * k, 1, 4 * k, STUFF.bark);
  },
  sheaf(s, x, y, k) {
    for (let i = -2; i <= 2; i++) s.line(x + i * 2 * k, y, x + i * k * 0.5, y - 9 * k, STUFF.straw);
    s.rect(x - 3 * k, y - 4 * k, 6 * k, 1, STUFF.thatchLo); s.rect(x - 4 * k, y - 11 * k, 8 * k, 2, STUFF.straw);
  },
  well(s, x, y, k) {
    s.rect(x - 1, y - 16 * k, 2, 16 * k, STUFF.bark); s.rect(x - 3 * k, y - 1, 7 * k, 1, INK);
    s.line(x - 7 * k, y - 12 * k, x + 13 * k, y - 20 * k, STUFF.timberLo); s.line(x - 7 * k, y - 13 * k, x + 13 * k, y - 21 * k, STUFF.timberLo);
    s.rect(x - 9 * k, y - 12 * k, 4 * k, 3 * k, STUFF.stoneLo); s.line(x + 13 * k, y - 20 * k, x + 13 * k, y - 11 * k, INK); s.rect(x + 11 * k, y - 11 * k, 4 * k, 3 * k, STUFF.timberLo);
  },
  cross(s, x, y, k) {
    s.rect(x - 1, y - 14 * k, 2, 14 * k, STUFF.timberLo); s.rect(x - 4 * k, y - 11 * k, 9 * k, 2, STUFF.timberLo);
    s.poly([x - 3 * k, y - 14 * k, x, y - 18 * k, x + 3 * k, y - 14 * k], STUFF.shingle, INK);
  },
  gallows(s, x, y, k) {
    s.rect(x - 1, y - 24 * k, 2, 24 * k, INK); s.rect(x - 1, y - 24 * k, 14 * k, 2, INK); s.line(x, y - 18 * k, x + 7 * k, y - 24 * k, INK);
    s.line(x + 11 * k, y - 22 * k, x + 11 * k, y - 15 * k, INK); s.rect(x + 10 * k, y - 15 * k, 3 * k, 2, INK);
  },
  nest(s, x, y, k) {
    s.rect(x - 1, y - 26 * k, 2, 26 * k, STUFF.timberLo); s.disc(x, y - 27 * k, 7 * k, 3 * k, STUFF.timber, INK);
    s.rect(x - 2 * k, y - 36 * k, 4 * k, 7 * k, STUFF.wall); s.rect(x - 2 * k, y - 36 * k, 1, 7 * k, INK); s.rect(x + 2 * k, y - 35 * k, 4 * k, 1, '#a24a32'); s.rect(x - 4 * k, y - 34 * k, 2 * k, 3 * k, INK);
  },
  /* the steppe */
  baba(s, x, y, k) {
    const st = STUFF.stoneLo;
    s.rect(x - 2 * k, y - 9 * k, 5 * k, 9 * k, STUFF.stone); s.rect(x - 1 * k, y - 12 * k, 3 * k, 3 * k, STUFF.stone);
    s.rect(x - 2 * k, y - 9 * k, 1, 9 * k, st); s.rect(x - 1 * k, y - 12 * k, 1, 3 * k, st); s.rect(x - 2 * k, y - 5 * k, 5 * k, 1, st); s.rect(x - 1 * k, y - 11 * k, 1, 1, INK); s.rect(x + 1 * k, y - 11 * k, 1, 1, INK);
  },
  beacon(s, x, y, k) {
    const h = 32 * k, b = STUFF.timberLo;
    for (const o of [0, 1]) { s.line(x - 7 * k + o, y, x - 3 * k + o, y - h * 0.78, b); s.line(x + 7 * k - o, y, x + 3 * k - o, y - h * 0.78, b); }
    s.line(x - 6 * k, y - 4 * k, x + 4 * k, y - 15 * k, b); s.line(x + 6 * k, y - 4 * k, x - 4 * k, y - 15 * k, b); s.line(x - 5 * k, y - 16 * k, x + 4 * k, y - 25 * k, b); s.line(x + 5 * k, y - 16 * k, x - 4 * k, y - 25 * k, b);
    s.rect(x - 6 * k, y - h * 0.78, 12 * k, 2, STUFF.timber); s.poly([x - 5 * k, y - h * 0.78, x, y - h, x + 5 * k, y - h * 0.78], STUFF.shingle, INK);
    s.rect(x + 10 * k, y - h * 0.9, 1, h * 0.9, b); s.rect(x + 8 * k, y - h * 0.96, 5 * k, 5 * k, '#5a4430'); s.rect(x + 8 * k, y - h * 0.96, 5 * k, 1, INK);
  },
  /* houses and churches */
  khata(s, x, y, k) {
    const w = 24 * k, h = 9 * k, rh = 8 * k, x0 = x - w / 2, roof = [x0 - 3 * k, y - h + 1, x0 + 5 * k, y - h - rh, x0 + w - 5 * k, y - h - rh, x0 + w + 3 * k, y - h + 1];
    walls(s, x0, y, w, h, STUFF.wall); s.rect(x0 + w - 4 * k, y - h, 4 * k - 1, h - 1, STUFF.wallLo);
    s.poly(roof, STUFF.thatch, INK); hatchPoly(s, roof, STUFF.thatchLo);
    s.rect(x - 2 * k, y - 6 * k, 4 * k, 6 * k - 1, DARK); s.rect(x + 6 * k, y - 7 * k, 3 * k, 3 * k, DARK); s.rect(x + 7 * k, y - 7 * k, 1, 3 * k, STUFF.wall);
    s.rect(x - 8 * k, y - h - rh - 2 * k, 3 * k, 4 * k, STUFF.wall); s.rect(x - 8 * k, y - h - rh - 2 * k, 3 * k, 1, INK);
  },
  cottage(s, x, y, k) {
    const w = 18 * k, h = 8 * k, rh = 10 * k, x0 = x - w / 2, roof = [x0 - 2 * k, y - h + 1, x, y - h - rh, x0 + w + 2 * k, y - h + 1];
    walls(s, x0, y, w, h, STUFF.wall);
    s.poly(roof, STUFF.thatch, INK); hatchPoly(s, roof, STUFF.thatchLo);
    s.rect(x - 2 * k, y - 6 * k, 4 * k, 5 * k, DARK); s.rect(x + 4 * k, y - 6 * k, 3 * k, 3 * k, DARK);
    s.rect(x + 6 * k, y - h - rh + 3 * k, 3 * k, 5 * k, STUFF.wall); s.rect(x + 6 * k, y - h - rh + 3 * k, 3 * k, 1, INK);
  },
  logHut(s, x, y, k) {
    const w = 18 * k, h = 8 * k, rh = 11 * k, x0 = x - w / 2, roof = [x0 - 2 * k, y - h + 1, x, y - h - rh, x0 + w + 2 * k, y - h + 1];
    walls(s, x0, y, w, h, STUFF.timber); for (let ly = y - h + 2; ly < y - 1; ly += 2) s.rect(x0 + 1, ly, w - 2, 1, STUFF.timberLo);
    s.poly(roof, STUFF.thatch, INK); hatchPoly(s, roof, STUFF.thatchLo, 3);
    s.rect(x - 2 * k, y - 6 * k, 4 * k, 5 * k, INK); s.rect(x + 4 * k, y - 6 * k, 3 * k, 3 * k, INK);
  },
  halfTimber(s, x, y, k) {
    const w = 22 * k, h = 13 * k, x0 = x - w / 2, t = STUFF.timberLo, roof = [x0 - 2 * k, y - h + 1, x, y - h - 13 * k, x0 + w + 2 * k, y - h + 1];
    s.rect(x0, y - h, w, h, STUFF.wall);
    for (const px of [0, w / 3, 2 * w / 3, w - 1]) s.rect(x0 + px, y - h, 1, h, t);
    for (const py of [h, h / 2, 1]) s.rect(x0, y - py, w, 1, t);
    s.line(x0, y - h / 2, x0 + w / 3, y - h, t); s.line(x0 + w, y - h / 2, x0 + 2 * w / 3, y - h, t); s.line(x0 + w / 3, y - 1, x0 + 2 * w / 3, y - h / 2, t);
    s.poly(roof, STUFF.tile, INK); hatchPoly(s, roof, STUFF.tileLo, 2);
    s.rect(x - 2 * k, y - 6 * k, 4 * k, 5 * k, DARK); s.rect(x - 8 * k, y - 10 * k, 3 * k, 3 * k, DARK); s.rect(x + 5 * k, y - 10 * k, 3 * k, 3 * k, DARK); s.rect(x - 1 * k, y - h - 7 * k, 3 * k, 3 * k, DARK);
    s.rect(x + 6 * k, y - h - 11 * k, 3 * k, 6 * k, STUFF.brick);
  },
  manor(s, x, y, k) {
    const w = 38 * k, h = 11 * k, x0 = x - w / 2, roof = [x0 - 2 * k, y - h + 1, x0 + 6 * k, y - h - 9 * k, x0 + w - 6 * k, y - h - 9 * k, x0 + w + 2 * k, y - h + 1];
    walls(s, x0, y, w, h, STUFF.wall);
    s.poly(roof, STUFF.tile, INK); hatchPoly(s, roof, STUFF.tileLo, 3);
    for (const dx of [-14, -8, 8, 14]) { s.rect(x + dx * k - k, y - 8 * k, 3 * k, 4 * k, DARK); s.rect(x + dx * k, y - 8 * k, 1, 4 * k, STUFF.wall); }
    for (const dx of [-4, -1, 2, 5]) s.rect(x + dx * k, y - 7 * k, 1, 6 * k, STUFF.wallLo);
    s.poly([x - 6 * k, y - h, x, y - h - 6 * k, x + 6 * k, y - h], STUFF.wall, INK); s.rect(x - 1 * k, y - 6 * k, 3 * k, 5 * k, DARK);
    s.rect(x + 10 * k, y - h - 11 * k, 3 * k, 4 * k, STUFF.wall);
  },
  church(s, x, y, k) {
    const nave = [x - 22 * k, y - 11 * k, x - 17 * k, y - 17 * k, x + 2 * k, y - 17 * k, x + 7 * k, y - 11 * k], spire = [x + 4 * k, y - 26 * k, x + 9.5 * k, y - 46 * k, x + 15 * k, y - 26 * k];
    walls(s, x - 20 * k, y, 25 * k, 11 * k, STUFF.wall);
    s.poly(nave, STUFF.tile, INK); hatchPoly(s, nave, STUFF.tileLo, 3);
    for (const dx of [-16, -11, -6]) s.rect(x + dx * k, y - 8 * k, 2 * k, 5 * k, DARK);
    walls(s, x + 5 * k, y, 9 * k, 26 * k, STUFF.wall); s.rect(x + 12 * k, y - 26 * k, 2 * k, 26 * k, STUFF.wallLo); s.rect(x + 8 * k, y - 22 * k, 3 * k, 5 * k, DARK); s.disc(x + 9.5 * k, y - 12 * k, 2 * k, 2 * k, STUFF.wall, INK);
    s.poly(spire, STUFF.shingle, INK); hatchPoly(s, spire, mixHex(STUFF.shingle, INK, 0.4), 2, 3);
    s.rect(x + 9.5 * k, y - 54 * k, 1, 8 * k, INK); s.rect(x + 8 * k, y - 52 * k, 4 * k, 1, INK);
  },
  orthodox(s, x, y, k) {
    const log = STUFF.timber, lo = STUFF.timberLo, roof = STUFF.shingle;
    const bay = (cx: number, w: number, h: number, ridge: number) => {
      walls(s, cx - w / 2, y, w, h, log);
      for (let ly = y - h + 3; ly < y - 1; ly += 3) s.rect(cx - w / 2 + 1, ly, w - 2, 1, lo);
      s.poly([cx - w / 2 - 2, y - h, cx, y - h - ridge, cx + w / 2 + 2, y - h], roof, INK);
      s.disc(cx, y - h - ridge - 2 * k, 2.5 * k, 3 * k, STUFF.thatch, INK); s.rect(cx, y - h - ridge - 8 * k, 1, 4 * k, INK); s.rect(cx - 1 * k, y - h - ridge - 6 * k, 3 * k, 1, INK);
    };
    bay(x - 12 * k, 8 * k, 9 * k, 6 * k); bay(x + 12 * k, 8 * k, 9 * k, 6 * k); bay(x, 14 * k, 14 * k, 12 * k);
    s.rect(x - 2 * k, y - 6 * k, 4 * k, 6 * k, INK);
  },
  chapel(s, x, y, k) {
    const roof = [x - 8 * k, y - 8 * k, x, y - 17 * k, x + 8 * k, y - 8 * k];
    walls(s, x - 6 * k, y, 12 * k, 8 * k, STUFF.timber); for (let ly = y - 6 * k; ly < y - 1; ly += 2) s.rect(x - 6 * k + 1, ly, 12 * k - 2, 1, STUFF.timberLo);
    s.poly(roof, STUFF.shingle, INK); hatchPoly(s, roof, mixHex(STUFF.shingle, INK, 0.4), 2, 2);
    s.disc(x, y - 19 * k, 2 * k, 2.5 * k, STUFF.shingle, INK); s.rect(x, y - 26 * k, 1, 4 * k, INK); s.rect(x - 1 * k, y - 24 * k, 3 * k, 1, INK); s.rect(x - 1 * k, y - 5 * k, 3 * k, 5 * k, INK);
  },
  brickChurch(s, x, y, k) {
    const nave = [x - 30 * k, y - 14 * k, x - 26 * k, y - 22 * k, x - 6 * k, y - 22 * k, x - 2 * k, y - 14 * k], spire = [x - 7 * k, y - 36 * k, x, y - 56 * k, x + 7 * k, y - 36 * k];
    walls(s, x - 28 * k, y, 26 * k, 14 * k, STUFF.brick);
    for (let bx = -24; bx < -4; bx += 5) { s.rect(x + bx * k, y - 14 * k, 1, 14 * k, STUFF.brickLo); s.rect(x + (bx + 2) * k, y - 10 * k, 2 * k, 6 * k, '#4a3a30'); }
    s.poly(nave, STUFF.tileLo, INK); hatchPoly(s, nave, mixHex(STUFF.tileLo, INK, 0.4), 3);
    walls(s, x - 5 * k, y, 10 * k, 36 * k, STUFF.brick); s.rect(x + 2 * k, y - 36 * k, 3 * k, 36 * k, STUFF.brickLo);
    s.rect(x - 2 * k, y - 32 * k, 3 * k, 8 * k, '#4a3a30'); s.rect(x - 2 * k, y - 18 * k, 3 * k, 6 * k, '#4a3a30');
    s.poly(spire, STUFF.shingle, INK); hatchPoly(s, spire, mixHex(STUFF.shingle, INK, 0.4), 2, 3); s.rect(x, y - 64 * k, 1, 8 * k, INK);
  },
  windmill(s, x, y, k) {
    const my = y - 22 * k, b = STUFF.timberLo;
    s.rect(x - 1, y - 14 * k, 2, 14 * k, b); s.line(x - 7 * k, y, x - 1, y - 9 * k, b); s.line(x + 7 * k, y, x + 1, y - 9 * k, b);
    s.poly([x - 6 * k, my + 9 * k, x - 4 * k, my - 6 * k, x + 4 * k, my - 6 * k, x + 6 * k, my + 9 * k], STUFF.timber, INK);
    s.poly([x - 5 * k, my - 6 * k, x, my - 12 * k, x + 5 * k, my - 6 * k], STUFF.shingle, INK);
    sails(s, x, my, 26 * k, k, 0.5 + s.r() * 0.5);
  },
  towerMill(s, x, y, k) {
    const body = [x - 8 * k, y, x - 5 * k, y - 26 * k, x + 5 * k, y - 26 * k, x + 8 * k, y], hy = y - 28 * k;
    s.poly(body, STUFF.wall, INK); s.poly([x + 2 * k, y - 26 * k, x + 5 * k, y - 26 * k, x + 8 * k, y, x + 3 * k, y], STUFF.wallLo);
    s.poly([x - 6 * k, y - 26 * k, x - 3 * k, y - 32 * k, x + 3 * k, y - 32 * k, x + 6 * k, y - 26 * k], STUFF.shingle, INK);
    s.rect(x - 1 * k, y - 6 * k, 3 * k, 6 * k, INK); s.rect(x - 1 * k, y - 18 * k, 2 * k, 3 * k, INK); sails(s, x, hy, 24 * k, k, 0.35 + s.r() * 0.6);
  },
  castle(s, x, y, k) {
    const wall = (x0: number, w: number, h: number) => {
      walls(s, x0, y, w, h, STUFF.stone);
      for (let mx = x0; mx < x0 + w - 1; mx += 3 * k) { s.rect(mx, y - h - 2 * k, 2 * k, 2 * k, STUFF.stone); s.rect(mx, y - h - 2 * k, 2 * k, 1, INK); }
    };
    const tower = (cx: number, w: number, h: number, cone: number) => {
      const c = [cx - w / 2 - 1, y - h, cx, y - h - cone, cx + w / 2 + 1, y - h];
      walls(s, cx - w / 2, y, w, h, STUFF.stone); s.rect(cx + w / 4, y - h, w / 4, h, STUFF.stoneLo);
      s.poly(c, STUFF.tile, INK); hatchPoly(s, c, STUFF.tileLo, 2, 2); s.rect(cx - 1, y - h + 4 * k, 2, 4 * k, INK);
    };
    wall(x - 30 * k, 60 * k, 12 * k); tower(x - 30 * k, 10 * k, 24 * k, 10 * k); tower(x + 30 * k, 10 * k, 24 * k, 10 * k); tower(x, 14 * k, 32 * k, 14 * k);
    s.rect(x - 14 * k, y - 8 * k, 4 * k, 6 * k, INK); s.rect(x + 8 * k, y - 8 * k, 4 * k, 6 * k, INK);
  },
  cityWall(s, x, y, k) {
    const w = 170 * k, x0 = x - w / 2;
    for (const dx of [-0.3, 0, 0.32]) { const cx = x + dx * w; s.rect(cx - 5 * k, y - 26 * k, 10 * k, 14 * k, STUFF.wall); s.rect(cx - 5 * k, y - 26 * k, 1, 14 * k, INK); s.disc(cx, y - 30 * k, 4 * k, 5 * k, STUFF.thatch, INK); s.rect(cx, y - 40 * k, 1, 4 * k, INK); }
    s.rect(x0, y - 14 * k, w, 14 * k, STUFF.wall); s.rect(x0, y - 14 * k, w, 1, INK); s.rect(x0, y - 1, w, 1, INK);
    for (let mx = x0; mx < x0 + w; mx += 4 * k) { s.rect(mx, y - 17 * k, 2 * k, 3 * k, STUFF.wall); s.rect(mx, y - 17 * k, 2 * k, 1, INK); s.rect(mx, y - 17 * k, 1, 3 * k, INK); }
    for (let i = 0; i <= 6; i++) {
      const cx = x0 + 8 * k + i * (w - 16 * k) / 6, h = (i === 3 ? 34 : 24 + (i % 2) * 4) * k, wd = (i === 3 ? 14 : 10) * k, cone = [cx - wd / 2 - 1, y - h, cx, y - h - 11 * k, cx + wd / 2 + 1, y - h];
      walls(s, cx - wd / 2, y, wd, h, STUFF.wall); s.rect(cx + wd / 4, y - h, wd / 4, h, STUFF.wallLo);
      s.poly(cone, STUFF.shingle, INK); hatchPoly(s, cone, mixHex(STUFF.shingle, INK, 0.4), 2, 2); s.rect(cx - 1, y - h + 4 * k, 2, 5 * k, INK);
    }
    s.rect(x - 4 * k, y - 9 * k, 8 * k, 9 * k, INK);
  },
  ruin(s, x, y, k) {
    const c = '#3b3530', w = 22 * k;
    s.poly([x - w / 2, y, x - w / 2, y - 9 * k, x - w / 2 + 4 * k, y - 7 * k, x - w / 2 + 7 * k, y - 11 * k, x - w / 2 + 10 * k, y - 5 * k, x - 1 * k, y - 6 * k, x - 1 * k, y], STUFF.wallLo, INK);
    s.poly([x + 3 * k, y, x + 3 * k, y - 7 * k, x + 8 * k, y - 4 * k, x + 11 * k, y - 8 * k, x + 11 * k, y], STUFF.wallLo, INK);
    s.rect(x + 12 * k, y - 16 * k, 4 * k, 16 * k, STUFF.brick); s.rect(x + 12 * k, y - 16 * k, 1, 16 * k, INK); s.rect(x + 12 * k, y - 16 * k, 4 * k, 1, INK);
    s.line(x - 8 * k, y - 8 * k, x + 2 * k, y - 15 * k, c); s.line(x - 4 * k, y - 9 * k, x + 6 * k, y - 13 * k, c); s.line(x + 2 * k, y - 15 * k, x + 7 * k, y - 8 * k, c);
  },
  /* the camp before Smolensk */
  tent(s, x, y, k) {
    s.poly([x - 9 * k, y, x, y - 13 * k, x + 9 * k, y], STUFF.wall, INK); s.poly([x, y - 13 * k, x + 9 * k, y, x + 3 * k, y], STUFF.wallLo);
    s.poly([x - 2 * k, y, x, y - 7 * k, x + 2 * k, y], '#3a342e'); s.rect(x, y - 19 * k, 1, 6 * k, INK); s.rect(x + 1, y - 19 * k, 5 * k, 3 * k, PAL.red);
  },
  cannon(s, x, y, k) {
    s.rect(x - 9 * k, y - 8 * k, 15 * k, 3 * k, '#3c3f42'); s.rect(x - 9 * k, y - 8 * k, 15 * k, 1, '#6a6d70'); s.rect(x - 11 * k, y - 9 * k, 3 * k, 5 * k, '#3c3f42');
    s.rect(x - 7 * k, y - 5 * k, 10 * k, 3 * k, STUFF.timber); s.disc(x - 2 * k, y - 4 * k, 4 * k, 4 * k, STUFF.timberLo, INK); s.disc(x - 2 * k, y - 4 * k, 1 * k, 1 * k, INK);
  },
  gabions(s, x, y, k) {
    for (let i = 0; i < 4; i++) {
      const gx = x + i * 7 * k;
      walls(s, gx, y, 6 * k, 7 * k, STUFF.earth); s.rect(gx, y - 7 * k, 6 * k, 1, INK);
      for (let dy = 2; dy < 7; dy += 2) s.rect(gx + 1, y - dy * k, 6 * k - 2, 1, STUFF.timberLo);
    }
  },
  /* the water, the smoke and the farms */
  ship(s, x, y, k) {
    s.poly([x - 11 * k, y - 4 * k, x + 11 * k, y - 4 * k, x + 8 * k, y, x - 8 * k, y], STUFF.timber, INK);
    for (const dx of [-5, 3]) { s.rect(x + dx * k, y - 22 * k, 1, 18 * k, INK); s.poly([x + dx * k + 1, y - 21 * k, x + dx * k + 8 * k, y - 18 * k, x + dx * k + 8 * k, y - 8 * k, x + dx * k + 1, y - 7 * k], STUFF.wall, INK); }
  },
  barge(s, x, y, k) {
    s.poly([x - 14 * k, y - 3 * k, x + 14 * k, y - 3 * k, x + 11 * k, y, x - 11 * k, y], STUFF.timberLo, INK); s.rect(x - 2 * k, y - 18 * k, 1, 15 * k, INK);
    s.poly([x - 1 * k, y - 17 * k, x + 8 * k, y - 15 * k, x + 8 * k, y - 6 * k, x - 1 * k, y - 5 * k], STUFF.thatchLo, INK);
  },
  smoke(s, x, y, k) {
    for (let i = 0; i < 9; i++) { const sway = Math.sin(i * 0.8) * 3 * k + i * 1.2 * k; s.disc(x + sway, y - i * 7 * k, (3 + i * 0.9) * k, (3 + i * 0.7) * k, i < 3 ? mixHex(STUFF.smoke, INK, 0.35) : STUFF.smoke); }
  },
  hops(s, x, y, k) {
    for (const dx of [-8, 0, 8]) { s.rect(x + dx * k, y - 30 * k, 1, 30 * k, STUFF.timberLo); for (let i = 0; i < 6; i++) s.rect(x + dx * k - 2 + (i % 2) * 3, y - (4 + i * 4.5) * k, 3, 2, s.T.leaf); }
  },
  blockhouse(s, x, y, k) {
    const roof = [x - 16 * k, y - 15 * k, x - 10 * k, y - 24 * k, x + 10 * k, y - 24 * k, x + 16 * k, y - 15 * k];
    walls(s, x - 14 * k, y, 28 * k, 15 * k, STUFF.timber); for (let ly = y - 13 * k; ly < y - 1; ly += 2) s.rect(x - 14 * k + 1, ly, 28 * k - 2, 1, STUFF.timberLo);
    s.poly(roof, STUFF.shingle, INK); hatchPoly(s, roof, mixHex(STUFF.shingle, INK, 0.4), 2, 2);
    for (const dx of [-9, -2, 5, 10]) s.rect(x + dx * k, y - 11 * k, 2 * k, 3 * k, INK); s.rect(x - 2 * k, y - 7 * k, 4 * k, 7 * k, INK);
  },
  tollHouse(s, x, y, k) {
    const roof = [x - 11 * k, y - 11 * k, x, y - 21 * k, x + 11 * k, y - 11 * k];
    walls(s, x - 9 * k, y, 18 * k, 11 * k, STUFF.wall); s.poly(roof, STUFF.tile, INK); hatchPoly(s, roof, STUFF.tileLo, 2);
    s.rect(x - 2 * k, y - 7 * k, 4 * k, 6 * k, INK); s.rect(x + 4 * k, y - 8 * k, 3 * k, 3 * k, INK);
    s.rect(x + 12 * k, y - 10 * k, 1, 10 * k, INK); s.rect(x + 12 * k, y - 10 * k, 24 * k, 2, INK); s.rect(x + 18 * k, y - 10 * k, 4 * k, 2, PAL.red); s.rect(x + 28 * k, y - 10 * k, 4 * k, 2, PAL.red);
  },
  wagon(s, x, y, k) {
    const cover = [x - 9 * k, y - 9 * k, x - 6 * k, y - 16 * k, x + 7 * k, y - 16 * k, x + 10 * k, y - 9 * k];
    s.rect(x - 11 * k, y - 9 * k, 22 * k, 5 * k, STUFF.timber); s.rect(x - 11 * k, y - 9 * k, 22 * k, 1, INK); s.rect(x - 11 * k, y - 5 * k, 22 * k, 1, STUFF.timberLo);
    s.poly(cover, STUFF.wall, INK); hatchPoly(s, cover, STUFF.wallLo, 3, 1);
    for (const dx of [-6, 6]) { s.disc(x + dx * k, y - 3 * k, 4 * k, 4 * k, STUFF.timberLo, INK); s.disc(x + dx * k, y - 3 * k, 1 * k, 1 * k, INK); }
  },
  raft(s, x, y, k) {
    for (let i = 0; i < 3; i++) { s.rect(x - 14 * k, y - (i + 1) * 3 * k, 28 * k, 3 * k, STUFF.timber); s.rect(x - 14 * k, y - (i + 1) * 3 * k, 28 * k, 1, STUFF.timberLo); s.disc(x + 14 * k, y - (i + 0.5) * 3 * k, 1.5 * k, 1.5 * k, STUFF.timberLo, INK); }
    for (let i = 0; i < 4; i++) s.disc(x - 9 * k + i * 6 * k, y - 11 * k, 3 * k, 2.5 * k, STUFF.wall, INK);
    s.disc(x - 6 * k, y - 15 * k, 3 * k, 2.5 * k, STUFF.wall, INK); s.disc(x + 2 * k, y - 15 * k, 3 * k, 2.5 * k, STUFF.wall, INK); s.rect(x + 12 * k, y - 20 * k, 1, 17 * k, STUFF.bark);
  },
  millRuin(s, x, y, k) {
    const c = '#3b3530';
    s.poly([x - 8 * k, y, x - 6 * k, y - 22 * k, x - 3 * k, y - 19 * k, x - 1 * k, y - 27 * k, x + 3 * k, y - 20 * k, x + 6 * k, y - 25 * k, x + 8 * k, y], STUFF.wallLo, INK);
    s.rect(x - 2 * k, y - 8 * k, 4 * k, 8 * k, INK); for (const dx of [-5, 3]) s.rect(x + dx * k, y - 20 * k, 2 * k, 12 * k, mixHex(STUFF.wallLo, c, 0.5));
    s.line(x - 1 * k, y - 27 * k, x - 14 * k, y - 40 * k, c); s.line(x - 1 * k, y - 27 * k, x + 9 * k, y - 38 * k, c); s.line(x - 1 * k, y - 27 * k, x - 12 * k, y - 22 * k, c); s.line(x - 9 * k, y - 35 * k, x - 12 * k, y - 32 * k, c);
  },
  watermill(s, x, y, k) {
    const roof = [x - 14 * k, y - 12 * k, x - 6 * k, y - 22 * k, x + 6 * k, y - 22 * k, x + 14 * k, y - 12 * k];
    walls(s, x - 12 * k, y, 24 * k, 12 * k, STUFF.wall); s.poly(roof, STUFF.thatch, INK); hatchPoly(s, roof, STUFF.thatchLo);
    s.rect(x - 8 * k, y - 8 * k, 3 * k, 3 * k, DARK); s.rect(x - 2 * k, y - 8 * k, 4 * k, 8 * k, DARK);
    const wx = x + 17 * k, wy = y - 7 * k; s.disc(wx, wy, 8 * k, 8 * k, STUFF.water, STUFF.timberLo); s.disc(wx, wy, 6 * k, 6 * k, STUFF.wall);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; s.line(wx - Math.cos(a) * 8 * k, wy - Math.sin(a) * 8 * k, wx + Math.cos(a) * 8 * k, wy + Math.sin(a) * 8 * k, STUFF.timberLo); }
  },
  signpost(s, x, y, k) {
    s.rect(x - 1, y - 20 * k, 2, 20 * k, STUFF.timberLo); s.poly([x, y - 19 * k, x + 11 * k, y - 19 * k, x + 14 * k, y - 16 * k, x + 11 * k, y - 13 * k, x, y - 13 * k], STUFF.timber, INK);
    s.poly([x, y - 11 * k, x - 10 * k, y - 11 * k, x - 13 * k, y - 8 * k, x - 10 * k, y - 5 * k, x, y - 5 * k], STUFF.timber, INK);
  },
  barn(s, x, y, k) {
    const roof = [x - 22 * k, y - 12 * k, x - 14 * k, y - 26 * k, x + 14 * k, y - 26 * k, x + 22 * k, y - 12 * k];
    walls(s, x - 19 * k, y, 38 * k, 12 * k, STUFF.timber); for (let lx = x - 16 * k; lx < x + 19 * k; lx += 4 * k) s.rect(lx, y - 12 * k, 1, 11 * k, STUFF.timberLo);
    s.poly(roof, STUFF.thatch, INK); hatchPoly(s, roof, STUFF.thatchLo, 3); s.rect(x - 5 * k, y - 9 * k, 10 * k, 9 * k, INK); s.line(x - 5 * k, y - 9 * k, x + 5 * k, y, STUFF.timberLo); s.line(x + 5 * k, y - 9 * k, x - 5 * k, y, STUFF.timberLo);
  },
  flame(s, x, y, k) {
    s.poly([x - 4 * k, y, x - 5 * k, y - 6 * k, x - 1 * k, y - 10 * k, x, y - 17 * k, x + 2 * k, y - 10 * k, x + 5 * k, y - 6 * k, x + 4 * k, y], '#d8642a');
    s.poly([x - 2 * k, y, x - 2 * k, y - 5 * k, x, y - 9 * k, x + 2 * k, y - 5 * k, x + 2 * k, y], '#f0b93a');
  },
  cow(s, x, y, k) {
    const c = '#6b4f35'; s.rect(x - 4 * k, y - 6 * k, 8 * k, 4 * k, c); s.rect(x - 4 * k, y - 6 * k, 8 * k, 1, mixHex(c, INK, 0.5)); s.rect(x + 4 * k, y - 8 * k, 3 * k, 3 * k, c);
    for (const dx of [-3, -1, 2, 3]) s.rect(x + dx * k, y - 2 * k, 1, 2 * k, INK); s.rect(x + 5 * k, y - 9 * k, 1, 2, STUFF.wall); s.rect(x - 2 * k, y - 5 * k, 3 * k, 2 * k, STUFF.wall);
  }
};

/** Scatters count things over the ground, small and faint by the horizon and large at the foot of the picture, the far ones first. */
function scatter(s: Scene, count: number, draw: (x: number, y: number, k: number) => void, y0 = 8, y1 = 0) {
  const top = s.HZ + y0, bottom = s.H - y1, pts: [number, number][] = [];
  for (let i = 0; i < count; i++) pts.push([s.r() * s.W | 0, top + (s.r() * s.r() * (bottom - top) | 0)]);
  for (const [x, y] of pts.sort((a, b) => a[1] - b[1])) draw(x, y, 0.55 + 0.7 * (y - s.HZ) / (s.H - s.HZ));
}
/** Dashes along the ground, such as the old backdrops have: long and faint, mostly by the horizon. */
function streaks(s: Scene, count: number, c: string) {
  for (let i = 0; i < count; i++) s.rect(s.r() * s.W | 0, s.HZ + 4 + (s.r() * s.r() * (s.H - s.HZ - 8) | 0), 8 + (s.r() * 40 | 0), 1, c);
}

/* ---------- the lands ---------- */
/** A burial mound or a rise on the skyline at x, w wide and h high, with its outline and the hatching of its shaded side; returns the top. */
function mound(s: Scene, x: number, w: number, h: number) {
  const base = s.ridge(x) + 1, pts: number[] = [], top: [number, number][] = [];
  for (let dx = -w / 2; dx <= w / 2; dx += 2) { const u = 2 * dx / w, y = base - h * Math.pow(Math.max(0, 1 - u * u), 0.75); top.push([x + dx, y]); pts.push(x + dx, y); }
  pts.push(x + w / 2, s.HZ, x - w / 2, s.HZ);
  s.poly(pts, mixHex(s.T.hill, '#fffbe8', 0.14));
  for (let i = 1; i < top.length; i++) { s.line(top[i - 1][0], top[i - 1][1], top[i][0], top[i][1], INK); if (i > top.length / 2 && i % 2) s.rect(top[i][0], top[i][1] + 3, 1, 3 + (i % 3) * 2, mixHex(s.T.hill, INK, 0.35)); }
  return base - h;
}
/** A few horses grazing far off, along the line from x for len, on the ground at y. */
function herd(s: Scene, x: number, y: number, len: number) {
  const c = mixHex(INK, s.T.ground, 0.15);
  for (let i = 0; i < 8; i++) { const hx = x + (i * len / 7 | 0) + (s.r() * 6 | 0), hy = y + (s.r() * 4 | 0); s.rect(hx, hy - 3, 4, 2, c); s.rect(hx, hy - 1, 1, 2, c); s.rect(hx + 3, hy - 1, 1, 2, c); s.rect(hx + 4, hy - 5, 1, 3, c); }
}
/** A track across the ground, two ruts running from one side to the other, faint. */
function track(s: Scene, y0: number, y1: number, c: string) {
  const f = s.r() * 6;
  for (let x = 0; x < s.W; x++) { const y = y0 + (y1 - y0) * x / s.W + 3 * Math.sin(x * 0.02 + f); s.rect(x, y, 1, 1, c); s.rect(x, y + 5 + 3 * x / s.W, 1, 1, c); }
}
/** A stretch of water from x0 to x1 between its banks y0 (which wavers) and y1, with the glints on it. */
function water(s: Scene, x0: number, x1: number, y0: number, y1: number) {
  const f = s.r() * 6, c = mixHex(STUFF.water, s.T.haze, 0.2);
  for (let x = x0; x < x1; x++) { const top = Math.round(y0 + 1.5 * Math.sin(x * 0.045 + f)); s.rect(x, top, 1, y1 - top, c); s.rect(x, top, 1, 1, edgeOf(STUFF.waterLo)); }
  for (let i = 0; i < (x1 - x0) / 12; i++) s.rect(x0 + (s.r() * (x1 - x0) | 0), y0 + 3 + (s.r() * Math.max(1, y1 - y0 - 4) | 0), 5 + (s.r() * 14 | 0), 1, i % 2 ? STUFF.waterLo : STUFF.wall);
  s.rect(x0, y1 - 1, x1 - x0, 1, STUFF.waterLo);
}
/** The same scene with its colours drawn a part t of the way into the haze, for what stands far off. */
const faded = (s: Scene, t: number): Scene => { const T = {} as Tone; for (const n of Object.keys(s.T) as (keyof Tone)[]) T[n] = mixHex(s.T[n], s.T.haze, t); return { ...s, T }; };
/** A wood along the skyline from x to x1: trees of the kinds given, every few pixels, a row far off and a row near. */
function wood(s: Scene, from: number, to: number, kinds: readonly PropName[], kLo: number, kHi: number) {
  for (const far of [true, false]) {
    const q = far ? faded(s, 0.45) : s;
    for (let x = from + (far ? 4 : 0); x < to; x += 8 + (s.r() * 7 | 0)) { const k = (kLo + s.r() * (kHi - kLo)) * (far ? 0.85 : 1); PROPS[kinds[s.r() * kinds.length | 0]](q, x, s.ridge(x) + (far ? 0 : 3), k); }
  }
}
/** A ploughed field centred on cx, wTop wide by the horizon and wBot at the foot of the picture, its furrows in bands that widen as they come near. */
function field(s: Scene, cx: number, wTop: number, wBot: number, c: string) {
  const n = 16, top = s.HZ + 6, bot = s.H - 4, half = (y: number) => (wTop + (wBot - wTop) * (y - top) / (bot - top)) / 2;
  for (let i = 0; i < n; i += 2) {
    const y0 = top + (bot - top) * Math.pow(i / n, 1.8), y1 = top + (bot - top) * Math.pow((i + 1) / n, 1.8);
    s.poly([cx - half(y0), y0, cx + half(y0), y0, cx + half(y1), y1, cx - half(y1), y1], c);
  }
}
/** The rows of a vineyard on the slope between x0 and x1, from the skyline down to the foot of the hill. */
function vines(s: Scene, x0: number, x1: number, c: string) {
  for (let x = x0; x < x1; x += 4) for (let y = s.ridge(x) + 5; y < s.HZ - 3; y += 4) s.rect(x, y, 1, 3, c);
}
/** Birds against the sky: a few small vees. */
function birds(s: Scene, n: number) {
  if (!s.sky) return;
  for (let i = 0; i < n; i++) { const x = 60 + (s.r() * (s.W - 120) | 0), y = 24 + (s.r() * 36 | 0); s.line(x - 4, y - 2, x, y, INK); s.line(x, y, x + 4, y - 2, INK); }
}
/** n copies of a prop along the skyline, from x, every dx, each k times its size. */
function along(s: Scene, prop: PropName, x: number, n: number, dx: number, k: number, drop = 2) {
  for (let i = 0; i < n; i++) { const px = x + i * dx; PROPS[prop](s, px, s.ridge(px) + drop, k + (i % 2) * 0.1); }
}

/** Places things of these widths along the picture from x0 to x1, in a random order and spaced evenly, and calls each one's drawing with its centre. */
function place(s: Scene, items: readonly (readonly [width: number, draw: (x: number) => void])[], x0 = 24, x1 = s.W - 24) {
  const order = items.map((_, i) => i).sort(() => s.r() - 0.5), gap = Math.max(0, (x1 - x0 - items.reduce((n, it) => n + it[0], 0)) / (items.length + 1));
  let x = x0 + gap;
  for (const i of order) { items[i][1](Math.round(x + items[i][0] / 2 + (s.r() - 0.5) * gap * 0.4)); x += items[i][0] + gap; }
}
/** A hamlet at x: houses of this kind at these offsets along the skyline, and a tree of the kind given at each end. */
function hamlet(s: Scene, x: number, house: PropName, offs: readonly number[], k: number, tree?: PropName) {
  offs.forEach((dx, i) => PROPS[house](s, x + dx, s.ridge(x + dx) + 2, k + (i % 2) * 0.1));
  if (tree) { const lo = Math.min(...offs) - 16, hi = Math.max(...offs) + 16; PROPS[tree](s, x + lo, s.ridge(x + lo) + 2, k * 0.95); PROPS[tree](s, x + hi, s.ridge(x + hi) + 2, k * 0.85); }
}

/** What a land is drawn from: its sky, its hills, the things that stand on them and the marks of its ground. */
type LandArt = (s: Scene) => void;
const LAND_ART: Record<LandId, LandArt> = {
  steppe(s) {
    const T = s.T, r = s.r;
    skyArt(s, { clouds: 3, sun: [300, 36], sunK: 1.25 });
    s.ridge = hillsArt(s, 106, [[0.0105, 2.4], [0.034, 1.2]], { fill: T.hill, hatch: false });
    place(s, [
      [120, x => { const t = mound(s, x, 90 + (r() * 30 | 0), 12); PROPS.baba(s, x + 6, t + 2, 1); }],
      [110, x => { const t = mound(s, x, 70 + (r() * 30 | 0), 9); PROPS.beacon(s, x - 4, t + 1, 0.95); }],
      [40, x => PROPS.thorn(s, x, s.ridge(x) + 2, 0.85)], [70, x => herd(s, x - 35, s.HZ - 3, 60)]
    ]);
    groundArt(s);
    track(s, s.HZ + 20, s.HZ + 58, mixHex(T.ground, INK, 0.22));
    PROPS.well(s, 60 + (r() * 480 | 0), s.HZ + 26, 0.85);
    streaks(s, 40, mixHex(T.ground, INK, 0.2));
    scatter(s, 90, (x, y, k) => PROPS.tuft(s, x, y, k));
    scatter(s, 36, (x, y, k) => PROPS.kovyl(s, x, y, k));
    scatter(s, 8, (x, y, k) => PROPS.rock(s, x, y, k * 0.8));
  },
  ukraine(s) {
    const T = s.T, r = s.r, church = r() < 0.55, mill = !church || r() < 0.5;
    skyArt(s, { clouds: 3, sun: [250, 34] });
    hillsArt(s, 90, [[0.007, 7], [0.021, 3.5]], { fill: T.far, hatch: false, edge: mixHex(T.far, INK, 0.4) });
    s.ridge = hillsArt(s, 100, [[0.013, 6], [0.04, 2.5]], { fill: T.hill });
    const items: [number, (x: number) => void][] = [[150, x => hamlet(s, x, 'khata', [-42, -14, 14, 42], 0.82, 'willow')], [76, x => along(s, 'poplar', x - 30, 5, 14, 0.75)]];
    if (church) items.push([52, x => PROPS.orthodox(s, x, s.ridge(x) + 2, 0.95)]);
    if (mill) items.push([56, x => PROPS.windmill(s, x, s.ridge(x) + 2, 0.85)]);
    place(s, items);
    groundArt(s);
    field(s, 120 + (r() * 360 | 0), 120, 420, mixHex(T.ground, INK, 0.09));
    streaks(s, 30, mixHex(T.ground, INK, 0.2));
    scatter(s, 90, (x, y, k) => PROPS.tuft(s, x, y, k));
    scatter(s, 3, (x, y, k) => PROPS.hay(s, x, y, k * 0.9), 20);
  },
  poland(s) {
    const T = s.T, r = s.r;
    skyArt(s, { clouds: 3, sun: [270, 34] });
    hillsArt(s, 94, [[0.008, 4], [0.025, 2]], { fill: T.far, hatch: false, edge: mixHex(T.far, INK, 0.4) });
    s.ridge = hillsArt(s, 102, [[0.012, 4], [0.036, 2]], { fill: T.hill });
    place(s, [
      [170, x => { PROPS.church(s, x, s.ridge(x) + 2, 0.9); [-48, 40, 68].forEach((dx, i) => PROPS.cottage(s, x + dx, s.ridge(x + dx) + 2, 0.76 + (i % 2) * 0.1)); PROPS.nest(s, x - 78, s.ridge(x - 78) + 2, 0.75); }],
      [70, x => (r() < 0.6 ? PROPS.windmill(s, x, s.ridge(x) + 2, 0.85) : PROPS.manor(s, x, s.ridge(x) + 2, 0.85))],
      [76, x => along(s, 'birch', x - 30, 5, 13, 0.85)]
    ]);
    groundArt(s);
    field(s, 120 + (r() * 360 | 0), 110, 400, mixHex(T.ground, INK, 0.08));
    PROPS.cross(s, 90 + (r() * 420 | 0), s.HZ + 18, 0.9);
    streaks(s, 30, mixHex(T.ground, INK, 0.2));
    scatter(s, 80, (x, y, k) => PROPS.tuft(s, x, y, k));
    scatter(s, 4, (x, y, k) => PROPS.sheaf(s, x, y, k), 16);
  },
  prussia(s) {
    const T = s.T, r = s.r;
    skyArt(s, { clouds: 4, sun: [290, 34] });
    birds(s, 5);
    s.ridge = hillsArt(s, 104, [[0.006, 1.6], [0.03, 0.9]], { fill: T.hill, hatch: false });
    const left = r() < 0.5, sea = left ? [0, 230] : [370, 600];
    water(s, sea[0], sea[1], 100, s.HZ - 1);
    [0.2, 0.62].forEach(t => PROPS.ship(s, sea[0] + (sea[1] - sea[0]) * t, 104, 0.85));
    place(s, [
      [150, x => { PROPS.brickChurch(s, x, s.ridge(x) + 2, 0.75); [-62, 40, 66].forEach((dx, i) => PROPS.halfTimber(s, x + dx, s.ridge(x + dx) + 2, 0.62 + (i % 2) * 0.08)); }],
      [60, x => PROPS.towerMill(s, x, s.ridge(x) + 2, 0.8)],
      [76, x => along(s, 'pine', x - 30, 3, 22, 0.85, 3)]
    ], left ? 250 : 20, left ? 580 : 350);
    groundArt(s);
    water(s, 0, s.W, s.HZ + 9, s.HZ + 16);
    for (let i = 0; i < 9; i++) PROPS.reeds(s, 20 + (r() * (s.W - 40) | 0), s.HZ + 17, 0.5);
    streaks(s, 24, mixHex(T.ground, INK, 0.18));
    scatter(s, 90, (x, y, k) => PROPS.tuft(s, x, y, k));
    scatter(s, 30, (x, y, k) => PROPS.kovyl(s, x, y, k * 0.55), 24);
  },
  lithuania(s) {
    const T = s.T, r = s.r;
    skyArt(s, { clouds: 4, sun: [300, 34] });
    hillsArt(s, 84, [[0.009, 6], [0.03, 3]], { fill: T.far, hatch: false, edge: mixHex(T.far, INK, 0.4) });
    s.ridge = hillsArt(s, 98, [[0.011, 5], [0.04, 2]], { fill: T.hill });
    const gap = 130 + (r() * 340 | 0), gw = 190;
    wood(s, 0, gap - gw / 2, ['spruce', 'spruce', 'pine'], 0.85, 1.15); wood(s, gap + gw / 2, s.W, ['spruce', 'pine', 'spruce', 'birch'], 0.85, 1.15);
    hamlet(s, gap - 14, 'logHut', [-44, -16, 18, 46], 0.78); PROPS.chapel(s, gap + 80, s.ridge(gap + 80) + 3, 0.95);
    groundArt(s);
    if (r() < 0.6) water(s, gap - 50, gap + 120, s.HZ + 8, s.HZ + 20);
    streaks(s, 24, mixHex(T.ground, INK, 0.2));
    scatter(s, 40, (x, y, k) => PROPS.tuft(s, x, y, k));
    scatter(s, 30, (x, y, k) => PROPS.fern(s, x, y, k), 14);
    scatter(s, 8, (x, y, k) => PROPS.boulder(s, x, y, k * 0.55), 14);
    scatter(s, 4, (x, y, k) => PROPS.birch(s, x, y, k * 0.8), 10);
  },
  front(s) {
    const T = s.T, r = s.r;
    skyArt(s, { clouds: 3 });
    hillsArt(s, 92, [[0.007, 5], [0.025, 2.5]], { fill: T.far, hatch: false, edge: mixHex(T.far, INK, 0.4) });
    s.ridge = hillsArt(s, 100, [[0.01, 3], [0.032, 1.6]], { fill: T.hill });
    place(s, [
      [240, x => { const t = mound(s, x, 230, 14); PROPS.cityWall(s, x, t + 6, 0.8); PROPS.smoke(s, x + 150, s.HZ - 4, 0.8); }],
      [120, x => { for (let i = 0; i < 3; i++) PROPS.gabions(s, x - 50 + i * 30, s.ridge(x) + 3, 0.7); PROPS.cannon(s, x + 44, s.ridge(x) + 4, 0.8); }],
      [96, x => along(s, 'tent', x - 33, 4, 22, 0.75, 4)], [40, x => { PROPS.dead(s, x, s.ridge(x) + 3, 0.9); PROPS.smoke(s, x + 24, s.HZ - 4, 0.65); }]
    ], 10, s.W - 10);
    groundArt(s);
    streaks(s, 34, mixHex(T.ground, INK, 0.22));
    scatter(s, 50, (x, y, k) => PROPS.tuft(s, x, y, k * 0.8));
    scatter(s, 6, (x, y, k) => PROPS.dead(s, x, y, k * 0.55), 14);
    scatter(s, 10, (x, y, k) => PROPS.rock(s, x, y, k * 0.7));
    scatter(s, 2, (x, y, k) => PROPS.wagon(s, x, y, k * 0.6), 22);
    if (r() < 0.5) scatter(s, 1, (x, y, k) => PROPS.cannon(s, x, y, k * 0.6), 30);
  },
  silesia(s) {
    const T = s.T, r = s.r;
    skyArt(s, { clouds: 3, sun: [280, 34] });
    hillsArt(s, 78, [[0.01, 9], [0.045, 5], [0.11, 2]], { fill: T.far, hatch: true, edge: mixHex(T.far, INK, 0.45) });
    s.ridge = hillsArt(s, 98, [[0.012, 8], [0.03, 3]], { fill: T.hill });
    place(s, [
      [140, x => { const t = mound(s, x, 130, 16); PROPS.castle(s, x, t + 3, 0.8); }],
      [170, x => { PROPS.church(s, x, s.ridge(x) + 2, 0.8); [-44, 38, 66].forEach((dx, i) => (i === 1 ? PROPS.ruin : PROPS.halfTimber)(s, x + dx, s.ridge(x + dx) + 2, 0.66 + (i % 2) * 0.1)); PROPS.smoke(s, x + 44, s.ridge(x + 38) - 8, 0.7); }],
      [70, x => along(s, 'orchard', x - 28, 4, 14, 0.75)]
    ]);
    groundArt(s);
    field(s, 120 + (r() * 360 | 0), 110, 400, mixHex(T.ground, INK, 0.08));
    PROPS.gallows(s, 80 + (r() * 420 | 0), s.HZ + 16, 0.9);
    streaks(s, 30, mixHex(T.ground, INK, 0.2));
    scatter(s, 70, (x, y, k) => PROPS.tuft(s, x, y, k));
    scatter(s, 14, (x, y, k) => PROPS.rock(s, x, y, k * 0.8));
  },
  saxony(s) {
    const T = s.T, r = s.r, castle = r() < 0.5;
    skyArt(s, { clouds: 3, sun: [300, 34] });
    hillsArt(s, 82, [[0.009, 7], [0.03, 3]], { fill: T.far, hatch: false, edge: mixHex(T.far, INK, 0.4) });
    s.ridge = hillsArt(s, 96, [[0.014, 7], [0.04, 3]], { fill: T.hill });
    const items: [number, (x: number) => void][] = [
      [190, x => { hamlet(s, x - 14, 'halfTimber', [-52, -24, 12, 38], 0.66); PROPS.church(s, x + 72, s.ridge(x + 72) + 2, 0.8); }],
      [120, x => { vines(s, x - 55, x + 55, mixHex(T.hill, T.leafLo, 0.55)); }]
    ];
    items.push(castle ? [110, x => { const t = mound(s, x, 100, 14); PROPS.castle(s, x, t + 3, 0.65); }] : [60, x => PROPS.windmill(s, x, s.ridge(x) + 2, 0.85)]);
    place(s, items);
    groundArt(s);
    water(s, 0, s.W, s.HZ + 8, s.HZ + 18);
    PROPS.barge(s, 120 + (r() * 340 | 0), s.HZ + 18, 0.85);
    for (let i = 0; i < 8; i++) PROPS.reeds(s, 16 + (r() * (s.W - 32) | 0), s.HZ + 19, 0.45);
    streaks(s, 24, mixHex(T.ground, INK, 0.2));
    scatter(s, 70, (x, y, k) => PROPS.tuft(s, x, y, k));
    scatter(s, 3, (x, y, k) => PROPS.hops(s, x, y, k * 0.6), 28);
  }
};

/* ---------- the sites: where in a land a piece of work puts the fight ---------- */
/** What a fight can be at, besides the land itself: SITE_OF says which work is fought where. */
type SiteId = 'ford' | 'river' | 'mill' | 'toll' | 'wagons' | 'pond' | 'picket' | 'forage' | 'burning' | 'manor' | 'blockhouse' | 'road' | 'ravine' | 'edge';
/** The site of each piece of work: its contract's template, or the kind of ambush. Work that names none is fought in the open land. */
const SITE_OF: Partial<Record<Contract['tpl'], SiteId>> = {
  road: 'road', mill: 'mill', ford: 'ford', toll: 'toll', wagons: 'wagons', river: 'river', quarrel: 'pond', picket: 'picket', forage: 'forage', tatarhunt: 'burning', manor: 'manor', blockhouse: 'blockhouse',
  masterless: 'ravine', roadagents: 'edge', deserters: 'road', riverthieves: 'river', imperials: 'forage', swedes: 'toll', final: 'ford'
};
/** A row of sharpened stakes from x0 to x1 standing on y, k times their size. */
function palisade(s: Scene, x0: number, x1: number, y: number, k: number) {
  s.rect(x0, y - 4 * k, x1 - x0, 1, STUFF.timberLo);
  for (let x = x0; x < x1; x += 3 * k) { s.rect(x, y - 9 * k, 2 * k, 9 * k, STUFF.timber); s.rect(x, y - 9 * k, 1, 9 * k, STUFF.timberLo); s.poly([x, y - 9 * k, x + k, y - 12 * k, x + 2 * k, y - 9 * k], STUFF.timber); }
}
/** A bridge of planks over the water at x, w long, on the ground at y. */
function bridge(s: Scene, x: number, y: number, w: number) {
  s.rect(x - w / 2, y - 3, w, 3, STUFF.timber); s.rect(x - w / 2, y - 3, w, 1, INK); s.rect(x - w / 2, y - 7, w, 1, STUFF.timberLo);
  for (let px = x - w / 2; px <= x + w / 2; px += 8) s.rect(px, y - 7, 1, 7, STUFF.timberLo);
}
/** A river across the whole picture behind the fight, with reeds on its bank; ford says where it can be waded. */
function river(s: Scene, ford?: number) {
  water(s, 0, s.W, s.HZ + 9, s.HZ + 25);
  if (ford !== undefined) { for (let i = 0; i < 9; i++) s.rect(ford - 36 + i * 8, s.HZ + 12 + (i % 3) * 4, 5, 2, STUFF.stoneLo); s.rect(ford - 40, s.HZ + 16, 80, 1, STUFF.wall); }
  for (let i = 0; i < 10; i++) { const rx = 14 + (s.r() * (s.W - 28) | 0); if (!ford || Math.abs(rx - ford) > 44) PROPS.reeds(s, rx, s.HZ + 26, 0.55); }
}
/** Draws a site over the land's own scenery, and returns where along the picture it stands (its middle), for a card to look at. */
type SiteArt = (s: Scene) => number;
const SITE_ART: Record<SiteId, SiteArt> = {
  ford(s) { const x = 150 + (s.r() * 300 | 0); river(s, x); return x; },
  river(s) {
    const x = 120 + (s.r() * 150 | 0); river(s); PROPS.raft(s, x, s.HZ + 24, 0.9); PROPS.raft(s, x + 150 + (s.r() * 120 | 0), s.HZ + 24, 0.8); return x + 60;
  },
  mill(s) { const x = 160 + (s.r() * 280 | 0); PROPS.millRuin(s, x, s.HZ + 30, 1); PROPS.smoke(s, x, s.HZ + 3, 0.8); PROPS.dead(s, x + 38, s.HZ + 32, 0.9); return x + 10; },
  toll(s) {
    const x = 140 + (s.r() * 220 | 0); water(s, x - 40, x + 230, s.HZ + 16, s.HZ + 26); bridge(s, x + 120, s.HZ + 30, 70); PROPS.tollHouse(s, x, s.HZ + 32, 0.95); return x + 50;
  },
  wagons(s) {
    const y = s.HZ + 30, x = 90 + (s.r() * 120 | 0); track(s, s.HZ + 20, s.HZ + 40, mixHex(s.T.ground, INK, 0.25)); for (let i = 0; i < 4; i++) PROPS.wagon(s, x + i * 62, y + (i % 2) * 3, 0.9); return x + 90;
  },
  pond(s) {
    const x = 220 + (s.r() * 160 | 0); water(s, x - 90, x + 90, s.HZ + 12, s.HZ + 30); PROPS.watermill(s, x - 105, s.HZ + 30, 0.95); s.rect(x + 86, s.HZ + 26, 6, 6, STUFF.stoneLo); return x - 20;
  },
  picket(s) {
    const x = 150 + (s.r() * 250 | 0); PROPS.signpost(s, x - 46, s.HZ + 30, 1); palisade(s, x - 30, x + 40, s.HZ + 30, 0.8);
    for (let i = 0; i < 3; i++) PROPS.tent(s, x + 56 + i * 26, s.HZ + 31, 0.95);
    return x + 30;
  },
  forage(s) {
    const x = 160 + (s.r() * 280 | 0); PROPS.barn(s, x, s.HZ + 32, 0.95); for (let i = 0; i < 3; i++) PROPS.hay(s, x + 54 + i * 24, s.HZ + 33, 0.9); PROPS.wagon(s, x - 58, s.HZ + 33, 0.85); return x + 20;
  },
  burning(s) {
    const x = 130 + (s.r() * 250 | 0), k = 0.95;
    [0, 44, 92].forEach((dx, i) => {
      PROPS[i === 1 ? 'logHut' : 'khata'](s, x + dx, s.HZ + 30, k); PROPS.flame(s, x + dx - 4, s.HZ + 11 - (i === 1 ? 4 : 0), 1.1); PROPS.smoke(s, x + dx, s.HZ + 4, 0.8);
    });
    for (let i = 0; i < 5; i++) PROPS.cow(s, x + 150 + i * 14, s.HZ + 34 + (i % 2) * 3, 0.9);
    return x + 90;
  },
  manor(s) {
    const x = 170 + (s.r() * 260 | 0); PROPS.manor(s, x, s.HZ + 34, 1); s.rect(x - 60, s.HZ + 33, 30, 2, STUFF.stoneLo); s.rect(x + 30, s.HZ + 33, 30, 2, STUFF.stoneLo);
    PROPS.oak(s, x - 66, s.HZ + 34, 0.7); PROPS.oak(s, x + 68, s.HZ + 34, 0.65);
    return x;
  },
  blockhouse(s) {
    const x = 170 + (s.r() * 260 | 0); palisade(s, x - 62, x + 62, s.HZ + 34, 0.85); PROPS.blockhouse(s, x, s.HZ + 32, 1); return x;
  },
  road(s) {
    track(s, s.HZ + 22, s.HZ + 50, mixHex(s.T.ground, INK, 0.28)); PROPS.cross(s, 70 + (s.r() * 460 | 0), s.HZ + 24, 1.1);
    const x = 120 + (s.r() * 260 | 0); PROPS.wagon(s, x, s.HZ + 36, 0.9); PROPS.wagon(s, x + 70, s.HZ + 39, 0.85);
    return x + 35;
  },
  ravine(s) {
    const x = 170 + (s.r() * 260 | 0), base = s.ridge(x), dark = mixHex(s.T.hill, INK, 0.45), lip = [[-52, -1], [-38, 8], [-28, 15], [-12, 20], [14, 20], [28, 14], [40, 7], [54, -1]];
    const pts: number[] = []; for (const [dx, dy] of lip) pts.push(x + dx, Math.min(s.HZ + 3, base + dy));
    s.poly(pts, dark); hatchPoly(s, pts, mixHex(dark, INK, 0.35), 3, 1);
    for (let i = 1; i < lip.length - 1; i++) s.line(x + lip[i - 1][0], Math.min(s.HZ + 3, base + lip[i - 1][1]), x + lip[i][0], Math.min(s.HZ + 3, base + lip[i][1]), INK);
    for (const dx of [-62, -44, 46, 64]) PROPS.bush(s, x + dx, s.ridge(x + dx) + 3, 0.9);
    PROPS.rock(s, x + 20, s.HZ + 5, 1); PROPS.rock(s, x - 24, s.HZ + 4, 0.9);
    return x;
  },
  edge(s) {
    const left = s.r() < 0.5, x0 = left ? 0 : s.W - 230, x1 = x0 + 230;
    for (let x = x0 + 8; x < x1; x += 20 + (s.r() * 8 | 0)) PROPS[x % 3 ? 'spruce' : 'pine'](s, x, s.HZ + 26 + (x % 7) * 2, 1.25);
    for (let x = x0 + 18; x < x1; x += 26 + (s.r() * 8 | 0)) PROPS.bush(s, x, s.HZ + 34 + (x % 5) * 3, 0.9);
    return x0 + 115;
  }
};

/* ---------- the weather ---------- */
/** A puddle on the ground at x, y, k times its usual size, with the sky in it. */
function puddle(s: Scene, x: number, y: number, k: number) {
  s.disc(x, y, 13 * k, 3 * k, mixHex(STUFF.water, s.T.ground, 0.2), mixHex(STUFF.waterLo, INK, 0.3)); s.rect(x - 6 * k, y - 1, 8 * k, 1, STUFF.wall); s.rect(x + 3 * k, y + 1, 5 * k, 1, STUFF.wall);
}
/**
 * What the day's weather does to a finished backdrop. Fog hangs over everything that stands far off, the more so the nearer the horizon, so
 * that the landmarks are ghosts and the hills a pale smear; rain cools the colours and stands in puddles on the ground.
 */
function weatherArt(s: Scene) {
  if (s.weather === 'fog') {
    const veil = (y0: number, y1: number, a: number) => s.rect(0, y0, s.W, y1 - y0, 'rgba(238,234,222,' + a.toFixed(2) + ')');
    for (let i = 0; i < 8; i++) veil(i * s.HZ / 8, (i + 1) * s.HZ / 8 + 1, 0.22 + 0.5 * i / 7);
    for (let i = 0; i < 6; i++) veil(s.HZ + i * 14, s.HZ + (i + 1) * 14 + 1, 0.55 - i * 0.09);
  } else if (s.weather === 'rain') {
    s.rect(0, 0, s.W, s.H, 'rgba(60,66,76,.09)');
    scatter(s, 11, (x, y, k) => puddle(s, x, y, k), 18);
  }
}

/* ---------- the backdrop ---------- */
/** A backdrop with a site on it remembers where along it the site stands. */
interface HTMLCanvasElement { siteX?: number }
/** Where a fight, or a night in camp, is: the land, and the place in it that the work names, if it does. */
interface Setting { land: LandId; site?: SiteId }
/** The backdrops made so far, kept: the cards and the encyclopedia take their scenery from them. */
const backdrops = new Map<string, HTMLCanvasElement>();
/** The backdrop of a land on a clear day, from one of a few seeds. */
function backdropOf(land: LandId, seed: number, weather: Weather = 'clear', site?: SiteId) {
  const key = land + seed + weather + (site || ''); let c = backdrops.get(key);
  if (!c) backdrops.set(key, c = makeBackdrop(seed + 1, weather, { land, site }));
  return c;
}
const skylines = new Map<string, HTMLCanvasElement>();
/** The skyline of a land by night, W scene pixels wide: the field's backdrop without its sky, down to the horizon, as one dark shape for the camp to stand against. */
function skylineOf(land: LandId, seed: number, W: number) {
  const key = land + seed + W; let c = skylines.get(key);
  if (!c) {
    const back = makeBackdrop(seed, 'clear', { land }, { width: W * SS, sky: false });
    skylines.set(key, c = sceneCanvas(W, HZ)); const g = c.getContext('2d')!;
    g.drawImage(back, 0, 0, W * SS, HZ * SS, 0, 0, W, HZ);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(4,8,16,.96)'; g.fillRect(0, 0, W, HZ);
  }
  return c;
}
/** The land the company is in, or the Crown's where there is no company yet. */
const landNow = (): LandId => (G ? here(G).land : 'poland');
/** Where a fight is: the land its contract names or, for a contract saved before they named one, the land the company stands in. */
function settingOf(st: Whereabouts, c: Contract): Setting { return { land: c.land || here(st).land, site: SITE_OF[c.tpl] }; }
/** The picture behind a fight: this land, under this weather, drawn afresh from the seed. */
function makeBackdrop(seed: number, weather: Weather, setting?: Setting, o: { width?: number; sky?: boolean } = {}) {
  const land = setting ? setting.land : (Object.keys(LANDS) as LandId[])[seed % 8], W = o.width || LW * SS;
  const c = sceneCanvas(W / SS, LH), s = makeScene(c.getContext('2d')!, seed, weather, weatherTone(TONES[land], weather), W, o.sky !== false);
  LAND_ART[land](s);
  if (setting && setting.site) c.siteX = SITE_ART[setting.site](s);
  weatherArt(s);
  return c;
}
