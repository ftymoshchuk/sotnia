"use strict";
/* ===== SOTNIA interface: drawing (palette, pixel sprites, the woodcut backdrop, the field) ===== */
const LW = BW, LH = 124, FY = 72, HZ = 56;
const PAL = {
  paper: '#d9d1bc', hill: '#d0c7ae', ground: '#cbc2a8', paperHi: '#e6dfcc', ink: '#1c1a17', red: '#9c1f2e', blue: '#2d4b70',
  ochre: '#b98a2b', green: '#4e6b50', drab: '#77705a', grey: '#8b877c', plum: '#5c2d55', black: '#2a2725', skin: '#d6ad86',
  wood: '#6a4a2c', fur: '#4b3524', steel: '#3d4144', helm: '#7e8284', white: '#f4f0e4', flash: '#f0b93a', smoke: '#a9a498', russet: '#7a3b26'
} as const;
const INK = PAL.ink;
/** The two colours that dress a figure: coat for the body, trim for the belt and the small touches (plume, hilt). */
interface Livery { coat: string; trim: string }
const SKINS: Record<Skin, Livery> = {
  own: { coat: PAL.red, trim: PAL.ochre }, bandit: { coat: PAL.drab, trim: PAL.paperHi }, deserter: { coat: PAL.grey, trim: PAL.ink },
  raider: { coat: PAL.green, trim: PAL.ochre }, imperial: { coat: PAL.ochre, trim: PAL.ink }, swede: { coat: PAL.blue, trim: PAL.ochre },
  champion: { coat: PAL.plum, trim: PAL.ochre }, black: { coat: PAL.black, trim: PAL.red }, muscovite: { coat: PAL.russet, trim: PAL.ochre },
  tatar: { coat: '#2b7d78', trim: PAL.paperHi }, croat: { coat: '#7b5a3c', trim: '#c0392b' }
};

/** Paints the rectangle at x, y, w by h, in colour c. Each painter has its own origin: a sprite's is the figure's feet (and it mirrors the figure when it faces left), a picture's is its corner. */
type Painter = (x: number, y: number, w: number, h: number, c: string) => void;
/**
 * What a sprite is told about the man it draws. Only cls and skin are always given; face is 1 for right (the default) and -1 for left.
 * Callers leave out whatever does not apply. Of the numbers, swing, flash and hurt are only ever asked whether they are above 0 (and
 * undefined > 0 is false). anim is read only when moving is set, and every caller that sets moving gives anim too.
 */
interface SoldierLook {
  cls: TroopClass; skin: Skin; face?: 1 | -1;
  mode?: UnitMode; // what he is doing, as on the field
  moving?: boolean; anim?: number; // walking, and the clock of his stride
  swing?: number; flash?: number; hurt?: number; // a blow being struck, a musket flashing, a wound just taken: each while above 0
  level?: boolean | null; // a pike held out at the foe (the field passes null for a unit with no target)
  dead?: boolean; // lying where he fell
  t?: number; // the field's clock, for the ramrod
  wpn?: number; arm?: number; // the gear he carries and wears, levels 0 to 3 (see WPN and ARM); left out is the worst of each
  man?: number; // what settles his hair and his moustache: a soldier's id, so the same man always looks the same
  nation?: NationId; // a man of the company wears the dress of his nation (see NATIONS); a foe's comes from his skin
}

/* ---------- backdrop: a woodcut landscape ---------- */
function mulberry(a: number): () => number { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function pxLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string) {
  g.fillStyle = c; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx - dy;
  for (let i = 0; i < 400; i++) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x0 += sx; } if (e2 < dx) { e += dx; y0 += sy; } }
}
/** The landmarks the backdrop can put on its hills. */
type MarkName = 'windmill' | 'church' | 'village' | 'poplars';
/** Draws one landmark standing on the ground at x, y. */
type Landmark = (g: CanvasRenderingContext2D, x: number, y: number) => void;
const MARKS: Record<MarkName, Landmark> = {
  windmill(g, x, y) {
    g.fillStyle = PAL.paper; g.fillRect(x - 4, y - 15, 9, 15); g.fillStyle = INK;
    g.fillRect(x - 4, y - 15, 1, 15); g.fillRect(x + 4, y - 15, 1, 15); g.fillRect(x, y - 5, 1, 5); g.fillRect(x - 1, y - 5, 3, 1);
    pxLine(g, x - 5, y - 15, x, y - 21, INK); pxLine(g, x, y - 21, x + 5, y - 15, INK);
    const my = y - 17;
    pxLine(g, x - 11, my - 9, x + 11, my + 9, INK); pxLine(g, x - 11, my + 9, x + 11, my - 9, INK);
    pxLine(g, x - 11, my - 9, x - 8, my - 12, INK); pxLine(g, x + 11, my + 9, x + 8, my + 12, INK);
    pxLine(g, x - 11, my + 9, x - 14, my + 6, INK); pxLine(g, x + 11, my - 9, x + 14, my - 6, INK);
  },
  church(g, x, y) {
    g.fillStyle = PAL.paper; g.fillRect(x - 9, y - 7, 13, 7); g.fillRect(x + 4, y - 17, 5, 17); g.fillStyle = INK;
    g.fillRect(x - 9, y - 7, 1, 7); g.fillRect(x - 9, y - 8, 13, 1); g.fillRect(x + 4, y - 17, 1, 17); g.fillRect(x + 8, y - 17, 1, 17);
    g.fillRect(x + 4, y - 20, 5, 3); g.fillRect(x + 5, y - 22, 3, 2); g.fillRect(x + 6, y - 28, 1, 6); g.fillRect(x + 5, y - 26, 3, 1);
    g.fillRect(x - 5, y - 4, 1, 3); g.fillRect(x - 1, y - 4, 1, 3); g.fillRect(x + 6, y - 13, 1, 3);
    for (let i = 0; i < 6; i++) g.fillRect(x - 8 + i * 2, y - 10 + (i % 2), 2, 1);
  },
  village(g, x, y) {
    for (let k = 0; k < 3; k++) {
      const hx = x + k * 11 - 14, by = y + (k === 1 ? 1 : 0);
      g.fillStyle = PAL.paper; g.fillRect(hx, by - 5, 8, 5); g.fillStyle = INK;
      g.fillRect(hx, by - 5, 1, 5); g.fillRect(hx + 7, by - 5, 1, 5); g.fillRect(hx + 3, by - 3, 1, 3);
      g.fillRect(hx - 1, by - 6, 10, 1); g.fillRect(hx, by - 7, 8, 1); g.fillRect(hx + 1, by - 8, 6, 1); g.fillRect(hx + 2, by - 9, 4, 1);
    }
    g.fillStyle = INK; g.fillRect(x - 8, y - 12, 1, 2); g.fillRect(x - 7, y - 14, 1, 2); g.fillRect(x - 8, y - 16, 1, 2); g.fillRect(x - 6, y - 18, 1, 2);
  },
  poplars(g, x, y) {
    g.fillStyle = INK;
    [[-10, 15], [-4, 19], [3, 13], [9, 17]].forEach(([dx, h]) => { g.fillRect(x + dx, y - h + 2, 3, h - 5); g.fillRect(x + dx + 1, y - h, 1, h); });
  }
};
function makeBackdrop(seed: number, weather: Weather) {
  const c = document.createElement('canvas'); c.width = LW; c.height = LH;
  const g = c.getContext('2d')!, r = mulberry(seed);
  g.fillStyle = PAL.paper; g.fillRect(0, 0, LW, LH);
  if (weather === 'clear') {
    const sx = 50 + (r() * 200 | 0), sy = 15;
    for (let a = 0; a < 16; a++) { const an = a * Math.PI / 8, r0 = 9, r1 = a % 2 ? 12 : 15; pxLine(g, sx + Math.cos(an) * r0, sy + Math.sin(an) * r0, sx + Math.cos(an) * r1, sy + Math.sin(an) * r1, INK); }
    for (let a = 0; a < 40; a++) { const an = a * Math.PI / 20; g.fillStyle = INK; g.fillRect(Math.round(sx + Math.cos(an) * 6), Math.round(sy + Math.sin(an) * 6), 1, 1); }
  }
  const nc = weather === 'clear' ? 3 : 7;
  for (let i = 0; i < nc; i++) {
    const cx = r() * (LW - 60) | 0, cy = 5 + (r() * 24 | 0), w = 26 + (r() * 30 | 0);
    g.fillStyle = INK;
    g.fillRect(cx, cy + 4, w, 1); g.fillRect(cx + (w * 0.15 | 0), cy + 2, w * 0.6 | 0, 1); g.fillRect(cx + (w * 0.32 | 0), cy, w * 0.3 | 0, 1);
    if (weather !== 'clear') g.fillRect(cx + 4, cy + 6, w * 0.7 | 0, 1);
  }
  const a1 = r() * 6, a2 = r() * 6;
  const hy = (x: number) => Math.round(HZ - 12 - 6 * Math.sin(x * 0.019 + a1) - 3 * Math.sin(x * 0.047 + a2));
  for (let x = 0; x < LW; x++) {
    const y = hy(x);
    g.fillStyle = PAL.hill; g.fillRect(x, y, 1, HZ - y); g.fillStyle = INK; g.fillRect(x, y, 1, 1);
    if (x % 3 === 0 && hy(x + 3) > y) g.fillRect(x, y + 2, 1, 2 + (r() * 5 | 0));
  }
  const names = (Object.keys(MARKS) as MarkName[]).sort(() => r() - 0.5);
  const x1 = 34 + (r() * 60 | 0), x2 = 190 + (r() * 76 | 0);
  MARKS[names[0]](g, x1, hy(x1) + 1); MARKS[names[1]](g, x2, hy(x2) + 1);
  const wx = 110 + (r() * 60 | 0); g.fillStyle = INK; g.fillRect(wx, HZ - 9, 1, 9); g.fillRect(wx - 2, HZ - 7, 5, 1);
  g.fillStyle = PAL.ground; g.fillRect(0, HZ, LW, LH - HZ); g.fillStyle = INK; g.fillRect(0, HZ, LW, 1);
  for (let i = 0; i < 34; i++) { const y = HZ + 2 + (r() * r() * (LH - HZ - 4) | 0), x = r() * LW | 0, w = 4 + (r() * 18 | 0); g.fillStyle = 'rgba(28,26,23,.32)'; g.fillRect(x, y, w, 1); }
  for (let i = 0; i < 46; i++) { const x = r() * LW | 0, y = HZ + 5 + (r() * (LH - HZ - 7) | 0); g.fillStyle = 'rgba(28,26,23,.6)'; g.fillRect(x, y, 1, 2); g.fillRect(x - 1, y - 1, 1, 2); g.fillRect(x + 1, y - 1, 1, 1); }
  for (let i = 0; i < 12; i++) { const x = r() * LW | 0, y = HZ + 6 + (r() * (LH - HZ - 9) | 0); g.fillStyle = PAL.paperHi; g.fillRect(x, y, 3, 2); g.fillStyle = INK; g.fillRect(x, y + 2, 3, 1); g.fillRect(x + 3, y + 1, 1, 1); }
  return c;
}

/**
 * A speck in the air over the field: powder smoke (s), a drop of blood (b), a spark off a parried blow (p) or the dust where a ball
 * missed (d). It starts at x, y (along the field and across it) at height h, moves along at vx and up at vh, and lives max seconds.
 */
interface FieldParticle { k: 's' | 'b' | 'p' | 'd'; x: number; y: number; h: number; vx: number; vh: number; life: number; max: number }
/**
 * The picture of a fight (or of the title's demo of one): the canvas it shows on, the LW by LH buffer drawn small and scaled up to it,
 * the backdrop (blood that lands is painted onto it) and the specks in the air. css is the CSS pixels to a picture pixel and dpr the
 * device pixel ratio; fitView sets both.
 */
interface FieldView {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  buf: HTMLCanvasElement; g: CanvasRenderingContext2D;
  back: HTMLCanvasElement; parts: FieldParticle[];
  names: boolean; // write the names of the company's men over their heads
  weather: Weather; css: number; dpr: number;
}

/* ---------- the field ---------- */
function newView(cv: HTMLCanvasElement, seed: number, weather: Weather, names: boolean) {
  const buf = sceneCanvas(LW, LH); // SS times finer than the scene, for the figures (see SS)
  const v = { cv, ctx: cv.getContext('2d')!, buf, g: buf.getContext('2d')!, back: makeBackdrop(seed, weather), parts: [] as FieldParticle[], names, weather } as FieldView; // css and dpr: fitView sets them next
  fitView(v);
  return v;
}
function fitView(v: FieldView) {
  const w = v.cv.clientWidth || 600, dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(w * dpr), H = Math.round(W * LH / LW);
  if (v.cv.width !== W || v.cv.height !== H) { v.cv.width = W; v.cv.height = H; }
  v.css = w / LW; v.dpr = dpr;
}
function drainFx(v: FieldView, b: Battle, loud: boolean) {
  for (const f of b.fx) {
    if (f.k === 'shot') {
      const n = f.mis ? 3 : 8;
      for (let i = 0; i < n; i++) v.parts.push({ k: 's', x: f.x + rnd(-1, 2) * f.f, y: f.y, h: 12 + rnd(-1, 2), vx: f.f * rnd(2, f.mis ? 5 : 17), vh: rnd(1, 6), life: 0, max: rnd(1.6, 3.8) });
      if (loud) sfx(f.mis ? 'fizz' : 'shot');
    } else if (f.k === 'blood') {
      for (let i = 0; i < f.n; i++) v.parts.push({ k: 'b', x: f.x, y: f.y + rnd(-1, 1), h: rnd(6, 12), vx: f.f * rnd(4, 26) + rnd(-5, 5), vh: rnd(4, 26), life: 0, max: 2 });
      if (loud) sfx('hit');
    } else if (f.k === 'parry') {
      for (let i = 0; i < 3; i++) v.parts.push({ k: 'p', x: f.x, y: f.y, h: 10, vx: rnd(-18, 18), vh: rnd(4, 20), life: 0, max: 0.25 });
      if (loud) sfx('clang');
    } else if (f.k === 'miss') {
      for (let i = 0; i < 3; i++) v.parts.push({ k: 'd', x: f.x, y: f.y, h: 0.5, vx: rnd(-6, 6), vh: rnd(6, 14), life: 0, max: 0.5 });
    } else if (f.k === 'death' && loud) sfx('fall');
  }
  b.fx.length = 0;
}
function stepParts(v: FieldView, dt: number) {
  const g2 = v.back.getContext('2d')!;
  for (let i = v.parts.length - 1; i >= 0; i--) {
    const p = v.parts[i]; p.life += dt; p.x += p.vx * dt; p.h += p.vh * dt;
    if (p.k === 's') { p.vx *= 1 - Math.min(1, 1.6 * dt); p.vx += 1.5 * dt; p.vh = Math.max(1.2, p.vh * (1 - dt)); }
    else {
      p.vh -= 60 * dt;
      if (p.h <= 0) { if (p.k === 'b') { g2.fillStyle = PAL.red; g2.fillRect(p.x | 0, (FY + p.y) | 0, 1, 1); } p.life = 99; }
    }
    if (p.life >= p.max) v.parts.splice(i, 1);
  }
  if (v.parts.length > 420) v.parts.splice(0, v.parts.length - 420);
}
function drawField(v: FieldView, b: Battle, t: number) {
  const g = v.g; g.globalAlpha = 1; g.drawImage(v.back, 0, 0);
  if (v.weather === 'fog') {
    g.fillStyle = 'rgba(244,240,228,.5)';
    for (let i = 0; i < 3; i++) g.fillRect(-30 + Math.sin(t * 0.21 + i * 1.7) * 22, 42 + i * 25, LW + 60, 9);
  }
  const us = b.units.filter(u => !u.fled).sort((a, c) => a.y - c.y);
  for (const u of us) if (u.dead) drawSoldier(g, Math.round(u.x * SS) / SS, FY + Math.round(u.y * SS) / SS, { dead: true, cls: u.cls, skin: u.skin, face: u.face, wpn: u.wpn, arm: u.arm, man: manNo(u.sid), nation: nationOf(u.origin) });
  for (const u of us) {
    if (u.dead) continue;
    const x = Math.round(u.x * SS) / SS, y = FY + Math.round(u.y * SS) / SS;
    drawSoldier(g, x, y, { cls: u.cls, skin: u.skin, face: u.face, mode: u.mode, moving: u.moving, anim: u.anim * 2, swing: u.swing, flash: u.flash, hurt: u.hurt, t, level: u.cls === 'pike' && u.tgt && dist(u, u.tgt) < 44, wpn: u.wpn, arm: u.arm, man: manNo(u.sid), nation: nationOf(u.origin) });
    if (!u.routing) {
      g.fillStyle = INK; g.fillRect(x - 5, y - 27, 11, 3); g.fillStyle = PAL.paperHi; g.fillRect(x - 4, y - 26, 9, 1);
      g.fillStyle = (SKINS[u.skin] || SKINS.own).coat; g.fillRect(x - 4, y - 26, Math.max(1, Math.round(9 * u.hp / u.max)), 1);
    }
  }
  for (const p of v.parts) {
    const px = Math.round(p.x), py = Math.round(FY + p.y - p.h);
    if (p.k === 's') {
      const fr = p.life / p.max, s = 2 + Math.floor(fr * 4);
      g.globalAlpha = fr > 0.65 ? Math.max(0, 1 - (fr - 0.65) / 0.35) : 1;
      g.fillStyle = PAL.white; g.fillRect(px - (s >> 1), py - (s >> 1), s, s);
      g.fillStyle = PAL.smoke; g.fillRect(px - (s >> 1), py - (s >> 1) + s - 1, s, 1);
      g.globalAlpha = 1;
    } else { g.fillStyle = p.k === 'b' ? PAL.red : p.k === 'p' ? PAL.white : INK; g.fillRect(px, py, 1, 1); }
  }
  if (v.weather === 'rain') {
    g.fillStyle = 'rgba(28,26,23,.5)';
    for (let i = 0; i < 54; i++) { const x = ((i * 37 + t * 95 + i * i * 13) % (LW + 20)) - 10, y = (i * 53 + t * 190) % LH; g.fillRect(x | 0, y | 0, 1, 2); g.fillRect((x | 0) - 1, (y | 0) + 2, 1, 2); }
  } else if (v.weather === 'fog') {
    g.fillStyle = 'rgba(244,240,228,.26)';
    for (let i = 0; i < 2; i++) g.fillRect(-30 + Math.sin(t * 0.17 + i * 2.3) * 26, 84 + i * 21, LW + 60, 4);
  }
  present(v.ctx, v.buf, v.cv.width, v.cv.height);
  const c = v.ctx;
  if (v.names && v.css >= 1.5) {
    const sc = v.cv.width / LW;
    c.font = Math.round(clamp(v.css * 4.5, 10, 15) * v.dpr) + "px 'Alegreya SC', Georgia, serif";
    c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 3 * v.dpr; c.strokeStyle = PAL.paper; c.fillStyle = INK;
    for (const u of b.units) {
      if (u.side !== 0 || !alive(u) || u.routing) continue;
      const n = u.name.split(' ')[0], X = u.x * sc, Y = (FY + u.y - 30) * sc;
      c.strokeText(n, X, Y); c.fillText(n, X, Y);
    }
  }
}

/* ---------- the map: a plain working map of the real lands, to be dressed in the period style later ---------- */
const MAP_K = Math.cos(50 * Math.PI / 180);
const MAP_ASPECT = (MAP_BOX.e - MAP_BOX.w) * MAP_K / (MAP_BOX.n - MAP_BOX.s);
/** The name of a sea, and the lon, lat it is written at. */
type SeaLabel = readonly [name: string, lon: number, lat: number];
const MAP_SEAS: readonly SeaLabel[] = [['The Black Sea', 31.4, 45.2], ['The Sea of Azov', 36.9, 46.2], ['The Baltic Sea', 16.6, 55.35]];
/** Where drawMap drew a place, in pixels of the map canvas. */
interface MapHit { id: PlaceId; x: number; y: number }
/** The map canvas keeps where it drew each place (hits), for placeAt to find the one a click lands on. */
interface HTMLCanvasElement { hits?: MapHit[] }
// The place nearest a point on the map, within a finger's width; drawMap leaves where each place sits.
function placeAt(cv: HTMLCanvasElement, x: number, y: number) {
  let best: PlaceId | null = null, bd = 16;
  for (const p of cv.hits || []) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p.id; } }
  return best;
}
/** The room a name takes on the map: x, y, width and height. */
type LabelBox = [x: number, y: number, w: number, h: number];
/** A place to try writing a name: the point its text is anchored at, and which side of it the text runs to. */
type LabelSpot = [x: number, y: number, align: 'left' | 'right'];
// plan: the legs of a course to show, as routeTo lists them, or null.
function drawMap(cv: HTMLCanvasElement | null, st: Campaign | null, plan: RouteLeg[] | null) {
  if (!cv || !st) return;
  cv.style.aspectRatio = String(MAP_ASPECT);
  const w = cv.clientWidth || 900, h = w / MAP_ASPECT, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d')!, s = w / ((MAP_BOX.e - MAP_BOX.w) * MAP_K);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const X = (lon: number) => (lon - MAP_BOX.w) * MAP_K * s, Y = (lat: number) => (MAP_BOX.n - lat) * s;
  const at = (id: PlaceId): [number, number] => [X(PLACES[id].lon), Y(PLACES[id].lat)];
  const line = (pts: number[]) => { g.beginPath(); for (let i = 0; i < pts.length; i += 2) { if (i) g.lineTo(X(pts[i]), Y(pts[i + 1])); else g.moveTo(X(pts[i]), Y(pts[i + 1])); } };
  // sea, then the land over it
  g.fillStyle = '#bcbdb3'; g.fillRect(0, 0, w, h);
  g.beginPath();
  for (const ring of COAST) { for (let i = 0; i < ring.length; i += 2) { if (i) g.lineTo(X(ring[i]), Y(ring[i + 1])); else g.moveTo(X(ring[i]), Y(ring[i + 1])); } g.closePath(); }
  g.fillStyle = PAL.paper; g.fill('evenodd');
  g.strokeStyle = PAL.ink; g.lineWidth = 1; g.stroke();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = PAL.blue; g.globalAlpha = 0.5; g.lineWidth = 1.4;
  for (const k in RIVERS) { line(RIVERS[k]); g.stroke(); }
  g.globalAlpha = 1;
  // every road, then the roads open from here, then the road travelled
  g.setLineDash([2, 3]); g.strokeStyle = 'rgba(28,26,23,.45)'; g.lineWidth = 1;
  for (const r of ROADS) { if (r.river) continue; const a = at(r.a), b = at(r.b); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  g.setLineDash([]);
  const here0 = at(st.at), out = st.over ? [] : roadsFrom(st);
  g.strokeStyle = PAL.ink; g.lineWidth = 2;
  for (const r of out) { const b = at(r.to); g.beginPath(); g.moveTo(here0[0], here0[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  g.strokeStyle = PAL.red; g.lineWidth = 3;
  g.beginPath(); st.path.forEach((id, i) => { const p = at(id); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
  // a course set from here, dashed in weld
  const target = plan && plan.length ? plan[plan.length - 1].to : null;
  if (target) {
    g.setLineDash([7, 5]); g.strokeStyle = PAL.ochre; g.lineWidth = 3;
    g.beginPath(); g.moveTo(here0[0], here0[1]); for (const l of plan!) { const p = at(l.to); g.lineTo(p[0], p[1]); } g.stroke();
    g.setLineDash([]);
  }
  // places: a filled dot where there is a market, an open one where there is none
  const q = questOf(st), named = new Set([st.at, q.to].concat(target ? [target] : [], out.map(r => r.to), [q.from]));
  cv.hits = (Object.keys(PLACES) as PlaceId[]).map(id => { const xy = at(id); return { id, x: xy[0], y: xy[1] }; });
  for (const id in PLACES) {
    const p = PLACES[id as PlaceId], xy = at(id as PlaceId), shop = (SERVICES[p.kind] || {}).market;
    g.beginPath(); g.arc(xy[0], xy[1], 2.6, 0, Math.PI * 2);
    g.fillStyle = shop ? PAL.ink : PAL.paper; g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 1.2; g.stroke();
    if (p.major) named.add(id as PlaceId);
  }
  const dest = at(q.to);
  g.strokeStyle = PAL.ochre; g.lineWidth = 3; g.beginPath(); g.arc(dest[0], dest[1], 7.5, 0, Math.PI * 2); g.stroke();
  if (target && target !== q.to) { const t = at(target); g.lineWidth = 2; g.beginPath(); g.arc(t[0], t[1], 5.5, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = PAL.ink; g.fillRect(here0[0] - 1, here0[1] - 19, 2, 19);
  g.fillStyle = PAL.red; g.beginPath(); g.moveTo(here0[0] + 1, here0[1] - 19); g.lineTo(here0[0] + 13, here0[1] - 15); g.lineTo(here0[0] + 1, here0[1] - 11); g.closePath(); g.fill();
  // names, with a paper halo so they read over roads and rivers
  const fs = Math.round(clamp(w / 82, 10, 14));
  g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = 'italic ' + Math.round(fs * 1.1) + "px 'Alegreya', Georgia, serif"; g.fillStyle = PAL.blue; g.textAlign = 'center';
  for (const m of MAP_SEAS) g.fillText(m[0], X(m[1]), Y(m[2]));
  g.font = fs + "px 'Alegreya SC', Georgia, serif";
  const boxes: LabelBox[] = [], hit = (b: LabelBox) => boxes.some(o => o[0] < b[0] + b[2] && b[0] < o[0] + o[2] && o[1] < b[1] + b[3] && b[1] < o[1] + o[3]);
  for (const id of named) {
    const xy = at(id), name = cap1(PLACES[id].name), tw = g.measureText(name).width, x = xy[0], y = xy[1];
    const tries: LabelSpot[] = [[x + 7, y, 'left'], [x - 7, y, 'right'], [x + 4, y + fs, 'left'], [x + 4, y - fs, 'left'], [x - 4, y + fs, 'right'], [x - 4, y - fs, 'right']];
    for (const t of tries) {
      const bx = t[2] === 'left' ? t[0] : t[0] - tw, box: LabelBox = [bx - 2, t[1] - fs / 2 - 1, tw + 4, fs + 2];
      if (box[0] < 1 || box[0] + box[2] > w - 1 || box[1] < 1 || box[1] + box[3] > h - 1 || hit(box)) continue;
      boxes.push(box);
      g.textAlign = t[2]; g.lineWidth = 3.5; g.strokeStyle = PAL.paper; g.strokeText(name, t[0], t[1]);
      g.fillStyle = id === st.at ? PAL.red : PAL.ink; g.fillText(name, t[0], t[1]);
      break;
    }
  }
}

/** How a man is posed in camp: sitting on a log, lying abed (or fallen), walking out foraging with a basket, or standing as on the field. */
type Pose = 'sit' | 'lie' | 'forage' | 'stand';
/** What a man sitting by the fire plays or smokes. */
type CampProp = 'bandura' | 'pipe';
/** A sprite look with a pose. bandage: a bandaged head (a man lying has one unless this is false); prop: what a sitting man holds; strum: which of two frames, 0 or 1, the bandura player's hand is in. */
interface CamperLook extends SoldierLook { pose?: Pose; bandage?: boolean; prop?: CampProp | null; strum?: number }

/* ---------- the company in camp: sitting, lying, foraging, and the people of the baggage train ---------- */
const STAFF_LOOK: Record<StaffId, Livery> = { surgeon: { coat: PAL.black, trim: INK }, drill: { coat: PAL.red, trim: PAL.ochre }, qm: { coat: PAL.blue, trim: PAL.ochre }, chaplain: { coat: INK, trim: INK } };
// An ox, standing or lying, in the colour it should have by day or by firelight.
function drawOx(g: CanvasRenderingContext2D, x: number, y: number, f: 1 | -1, lying: boolean, hide: string) {
  const R: Painter = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(f > 0 ? x + dx : x - dx - w + 1, y + dy, w, h); };
  const dark = '#3a2a1a', horn = PAL.paperHi;
  if (lying) { R(-6, -5, 12, 5, hide); R(5, -7, 4, 4, hide); R(6, -9, 1, 2, horn); R(8, -9, 1, 2, horn); R(7, -6, 1, 1, INK); R(-7, -3, 1, 2, dark); return; }
  R(-6, -9, 12, 5, hide); R(-5, -4, 1, 4, dark); R(-3, -4, 1, 4, dark); R(3, -4, 1, 4, dark); R(5, -4, 1, 4, dark);
  R(6, -10, 4, 4, hide); R(7, -12, 1, 2, horn); R(9, -12, 1, 2, horn); R(8, -9, 1, 1, INK); R(-7, -9, 1, 4, dark);
}
// The cargo of the quest, by how it travels. x,y is the foot of its left end; load runs from 0 to 1.
function drawCargo(g: CanvasRenderingContext2D, kind: TransportId, x: number, y: number, load: number, night: boolean) {
  const F: Painter = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  const wood = night ? '#4b3420' : PAL.wood, wood2 = night ? '#6a4a2c' : '#8a6440', keg = night ? '#5a3f27' : '#7a5a3a';
  const wheel = (a: number) => { g.strokeStyle = night ? '#2e2116' : INK; g.lineWidth = 2; g.beginPath(); g.arc(x + a, y + 4, 5.5, 0, Math.PI * 2); g.stroke(); F(a - 1, -1, 2, 10, night ? '#2e2116' : INK); F(a - 5, 3, 10, 2, night ? '#2e2116' : INK); };
  const wagon = () => { F(0, -6, 50, 6, wood); F(0, -6, 50, 1, wood2); F(-14, -3, 14, 1.5, wood); wheel(9); wheel(40); };
  if (kind === 'oxcart' || kind === 'chest') {
    drawOx(g, x - 10, y + 8, 1, true, night ? '#4a3c2f' : '#6b5338');
    wagon();
    if (kind === 'chest') {
      F(8, -15, 22, 9, night ? '#2e2116' : '#3b2a1c'); F(8, -12, 22, 1, PAL.steel); F(8, -8, 22, 1, PAL.steel); F(18, -14, 2, 3, PAL.ochre);
      F(33, -14, 13, 8, night ? '#a89f8a' : PAL.paper);
    } else {
      const n = Math.max(1, Math.round(5 * load)), spots = [[3, -16], [14, -16], [25, -16], [8, -25], [19, -25]];
      for (let i = 0; i < n; i++) { const s = spots[i]; F(s[0], s[1], 9, 10, keg); F(s[0], s[1] + 2, 9, 1, INK); F(s[0], s[1] + 7, 9, 1, INK); F(s[0] + 1, s[1] - 1, 7, 1, night ? '#a89f8a' : PAL.white); }
      F(36, -14, 11, 8, night ? '#a89f8a' : PAL.paper); F(38, -16, 7, 2, night ? '#a89f8a' : PAL.paper);
    }
  } else if (kind === 'herd') {
    const hide = night ? '#4a3c2f' : '#6b5338', hide2 = night ? '#5b4a3a' : '#8a6c4a';
    drawOx(g, x + 6, y - 2, 1, true, hide); drawOx(g, x + 30, y + 2, -1, true, hide2); drawOx(g, x + 50, y - 4, 1, false, hide); drawOx(g, x + 18, y + 10, 1, true, hide2);
  } else {
    F(-20, -8, 92, 16, night ? '#17222f' : '#9fb0b8');
    for (let i = 0; i < 9; i++) F(-16 + i * 10, -4 + (i % 3) * 4, 5, 1, night ? '#2d4b70' : PAL.white);
    F(0, -4, 48, 5, wood); for (let i = 0; i < 6; i++) F(i * 8, -4, 1, 5, INK);
    const n = Math.max(1, Math.round(4 * load));
    for (let i = 0; i < n; i++) { F(4 + i * 10, -10, 8, 6, night ? '#a89f8a' : PAL.paper); F(6 + i * 10, -11, 4, 1, night ? '#a89f8a' : PAL.paper); F(4 + i * 10, -7, 8, 1, PAL.drab); }
    F(44, -20, 1, 16, wood); F(36, -18, 8, 1, wood);
  }
}

/* ---------- card art: small woodcut pictures for the cards, drawn once and kept ---------- */
const artCache: Record<string, string> = {};
function artURL(key: string, W: number, H: number, fn: (g: CanvasRenderingContext2D, W: number, H: number) => void) {
  if (artCache[key]) return artCache[key];
  const c = sceneCanvas(W, H), g = c.getContext('2d')!; fn(g, W, H);
  return (artCache[key] = c.toDataURL());
}
/** The backdrop of a card: hills and dust, and, for some seeds, a small tree on the far ridge (bare leaves it out and the rest the same, for pictures with men to show). */
function landscape(g: CanvasRenderingContext2D, W: number, H: number, seed: number, bare = false) {
  const r = mulberry(seed * 977 + 13), hz = H - 7, a = r() * 6, b = r() * 6;
  g.fillStyle = PAL.paperHi; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2; i++) { const cx = r() * (W - 16) | 0, cy = 3 + (r() * 7 | 0), w = 8 + (r() * 10 | 0); g.fillStyle = PAL.hill; g.fillRect(cx, cy + 2, w, 1); g.fillRect(cx + 2, cy, w - 5, 1); }
  for (let x = 0; x < W; x++) {
    const y = Math.round(hz - 6 - 3 * Math.sin(x * 0.11 + a) - 2 * Math.sin(x * 0.29 + b));
    g.fillStyle = PAL.hill; g.fillRect(x, y, 1, hz - y); g.fillStyle = INK; g.fillRect(x, y, 1, 1);
  }
  if (r() < 0.6) { const px = 4 + (r() * (W - 8) | 0), py = Math.round(hz - 8 - 3 * Math.sin(px * 0.11 + a) - 2 * Math.sin(px * 0.29 + b)); if (!bare) { g.fillStyle = INK; g.fillRect(px, py - 6, 1, 6); g.fillRect(px - 1, py - 4, 3, 3); } }
  g.fillStyle = PAL.ground; g.fillRect(0, hz, W, H - hz); g.fillStyle = INK; g.fillRect(0, hz, W, 1);
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(28,26,23,.35)'; g.fillRect(r() * W | 0, hz + 2 + (r() * (H - hz - 3) | 0), 2 + (r() * 5 | 0), 1); }
}
// A man of the company on his card: standing in his arms and armour, or abed. gear tries other levels than he has, for a card to show what buying them would make of him.
function soldierArt(s: Soldier, gear?: Partial<Pick<Soldier, 'wpn' | 'arm'>>) {
  const seed = s.id % 5, pose = s.wound ? 'lie' : 'stand', wpn = gear && gear.wpn != null ? gear.wpn : s.wpn, arm = gear && gear.arm != null ? gear.arm : s.arm;
  return artURL('m' + s.id + s.cls + pose + wpn + arm, 48, 36, (g, W, H) => { landscape(g, W, H, seed); drawCamper(g, 24, H - 3, { cls: s.cls, skin: 'own', face: 1, mode: 'idle', anim: 0, pose, wpn, arm, man: s.id, nation: nationOf(s.origin) }); });
}
// After a fight: how each man came out of it.
function fateArt(l: ReportLine) {
  const seed = l.id % 5, cls = l.cls, fate = l.fate, kit = { wpn: l.wpn, arm: l.arm, man: l.id, nation: nationOf(l.origin) };
  return artURL('f' + l.id + cls + fate + l.wpn + l.arm, 48, 36, (g, W, H) => {
    landscape(g, W, H, seed);
    if (fate === 'killed' || fate === 'struck down') drawCamper(g, 24, H - 3, { cls, skin: 'own', pose: 'lie', bandage: fate !== 'killed', ...kit });
    else if (fate === 'fled') drawCamper(g, 24, H - 3, { cls, skin: 'own', face: -1, mode: 'rout', moving: true, anim: 1, ...kit });
    else drawCamper(g, 24, H - 3, { cls, skin: 'own', face: 1, mode: 'idle', anim: 0, bandage: fate === 'wounded', ...kit });
  });
}
// The other side of a contract or an ambush, facing the reader's company.
function foesArt(c: Contract) {
  const us = c.units.slice(0, 6);
  return artURL('e' + c.id + us.map(u => u.cls).join(''), 72, 36, (g, W, H) => {
    landscape(g, W, H, c.id % 5);
    const step = us.length > 4 ? 10 : 12, x0 = Math.round(W / 2 - (us.length - 1) * step / 2);
    us.forEach((u, i) => drawSoldier(g, x0 + i * step, H - 3 - (i % 2) * 2, { cls: u.cls, skin: c.skin || u.skin, face: -1, mode: 'idle', anim: 0, wpn: u.wpn, arm: u.arm, man: i + 2 }));
  });
}
function staffArt(k: StaffId) { return artURL('s' + k, 48, 36, (g, W, H) => { landscape(g, W, H, k.length); drawCivilian(g, 24, H - 3, k, 1); }); }
function stanceArt(s: Stance) {
  return artURL('t' + s, 60, 36, (g, W, H) => {
    landscape(g, W, H, s.length + 1);
    const y = H - 3, o = (cls: TroopClass, x: number, m: Partial<SoldierLook>) => drawSoldier(g, x, y - (x % 3 === 0 ? 1 : 0), Object.assign({ cls, skin: 'own', face: 1, mode: 'idle', anim: 0 }, m));
    // a company is of many nations: these are of the ones it is likely to have
    if (s === 'hold') { o('pike', 12, { nation: 'scot' }); o('shot', 29, { mode: 'aim', flash: 1, nation: 'cossack' }); o('pike', 46, { nation: 'german' }); }
    else if (s === 'advance') { o('pike', 10, { moving: true, anim: 0, nation: 'pole' }); o('sabre', 27, { moving: true, anim: 1, nation: 'magyar' }); o('shot', 44, { moving: true, anim: 0, nation: 'swede' }); }
    else { o('pike', 8, { moving: true, anim: 1, level: true, nation: 'german' }); o('sabre', 36, { mode: 'fight', moving: true, anim: 0, nation: 'cossack' }); o('sabre', 51, { mode: 'fight', moving: true, anim: 1, swing: 1, nation: 'tatar' }); }
  });
}
function supplyArt(k: Supply) {
  return artURL('u' + k, 48, 36, (g, W, H) => {
    g.fillStyle = PAL.paperHi; g.fillRect(0, 0, W, H); g.fillStyle = PAL.ground; g.fillRect(0, H - 9, W, 9); g.fillStyle = INK; g.fillRect(0, H - 9, W, 1);
    const F: Painter = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    if (k === 'bread') {
      [[8, 20], [24, 20], [16, 12]].forEach(([x, y]) => { F(x, y, 14, 7, PAL.ochre); F(x + 1, y - 1, 12, 1, PAL.ochre); F(x, y + 7, 14, 1, INK); F(x + 3, y + 1, 2, 1, '#e6c47a'); F(x + 7, y + 1, 2, 1, '#e6c47a'); F(x + 11, y + 2, 1, 1, '#e6c47a'); });
    } else {
      F(9, 10, 16, 18, '#4b3420'); F(10, 9, 14, 1, '#4b3420'); F(9, 13, 16, 1, INK); F(9, 24, 16, 1, INK); F(15, 17, 4, 4, INK);
      F(28, 18, 11, 4, PAL.paper); F(26, 20, 4, 3, PAL.paper); F(38, 16, 3, 3, PAL.wood); F(28, 22, 11, 1, INK);
    }
  });
}
// The quest's cargo (and, but for the raft, the man who guards it) for its card. frac is not used.
function questArt(q: Quest, frac?: number) {
  return artURL('q' + q.id, 72, 36, (g, W, H) => {
    landscape(g, W, H, q.id.length);
    if (q.transport === 'raft') { drawCargo(g, 'raft', 16, H - 6, 1, false); return; }
    if (q.transport === 'herd') { drawCargo(g, 'herd', 6, H - 6, 1, false); drawSoldier(g, 66, H - 3, { cls: 'sabre', skin: 'own', face: -1, mode: 'idle', anim: 0, nation: 'cossack' }); return; }
    drawCargo(g, q.transport, 22, H - 8, 0.8, false);
    drawSoldier(g, 8, H - 3, { cls: q.transport === 'chest' ? 'shot' : 'pike', skin: 'own', face: 1, mode: 'idle', anim: 0, nation: q.transport === 'chest' ? 'pole' : 'german' });
  });
}
/* ---------- the pictures of the encyclopedia: men of a nation, a class or a people standing together ---------- */
/** Men standing together on a card's landscape: each is where he stands along the picture (scene pixels, from the left) and what he looks like. */
function squadArt(key: string, W: number, seed: number, men: readonly (readonly [x: number, look: SoldierLook])[]) {
  return artURL(key, W, 36, (g, w, h) => { landscape(g, w, h, seed, true); for (const [x, look] of men) drawSoldier(g, x, h - 3, look); });
}
/** The classes a nation fields, each once, in the order its Origin lists them. */
const classesOf = (o: Origin) => o.cls.filter((c, i) => o.cls.indexOf(c) === i);
// A nation of the company: one man of each class it fields, side by side, in the better kit a man comes to.
function nationArt(o: Origin) {
  const cs = classesOf(o), at = cs.length === 1 ? [36] : cs.length === 2 ? [20, 50] : [14, 36, 58];
  return squadArt('cn' + o.id, 72, o.id.length, cs.map((cls, i): [number, SoldierLook] => [at[i], { cls, skin: 'own', nation: o.id, face: 1, mode: 'idle', anim: 0, wpn: i ? 2 : 1, arm: i ? 2 : 1, man: 3 + i * 2 }]));
}
// One unit of a nation: the worst kit a man of it starts with and the best he may come to, side by side.
function unitArt(o: Origin, cls: TroopClass) {
  const look = (lv: number, man: number): SoldierLook => ({ cls, skin: 'own', nation: o.id, face: 1, mode: 'idle', anim: 0, wpn: lv, arm: lv, man });
  return squadArt('cu' + o.id + cls, 72, o.id.length + 1, [[22, look(0, 3)], [52, look(3, 8)]]);
}
// A class: four men of the nations that field it, from the worst kit to the best.
function classArt(cls: TroopClass) {
  const from = ORIGINS.filter(o => o.cls.includes(cls)).slice(0, 4);
  return squadArt('cc' + cls, 100, cls.length, from.map((o, i): [number, SoldierLook] => [14 + i * 24, { cls, skin: 'own', nation: o.id, face: 1, mode: 'idle', anim: 0, wpn: i, arm: i, man: 3 + i * 2 }]));
}
// The armours: one sabreur in each of the four, worst to best.
function armourArt() {
  return squadArt('car', 100, 5, [0, 1, 2, 3].map((lv): [number, SoldierLook] => [14 + lv * 24, { cls: 'sabre', skin: 'own', nation: 'pole', face: 1, mode: 'idle', anim: 0, wpn: 1, arm: lv, man: 3 + lv * 2 }]));
}
// A people met on the road: a man of each class it fields, facing the company, in the gear its degree of drill carries (see TIER).
function peopleArt(skin: Skin, classes: readonly TroopClass[], tier: number) {
  const at = classes.length === 1 ? [40] : classes.length === 2 ? [26, 54] : [20, 42, 64], gear = Math.max(0, tier - 1);
  return squadArt('cp' + skin + classes.join('') + tier, 72, skin.length, classes.map((cls, i): [number, SoldierLook] => [at[i], { cls, skin, face: -1, mode: 'idle', anim: 0, wpn: gear, arm: gear, man: 2 + i * 3 }]));
}

// A corner of the camp at night, for the cards of camp events.
function eventArt() {
  return artURL('night', 96, 32, (g, W, H) => {
    const F: Painter = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    F(0, 0, W, H, '#1f2a3e'); F(0, 12, W, 6, '#26324a');
    [[9, 3], [22, 6], [47, 2], [74, 5], [60, 8], [88, 4]].forEach(p => F(p[0], p[1], 1, 1, PAL.paperHi));
    F(0, 18, W, 14, '#2b3446'); F(0, 23, W, 9, '#3b3325');
    const gr = g.createRadialGradient(48, 24, 2, 48, 24, 26); gr.addColorStop(0, 'rgba(240,170,60,.55)'); gr.addColorStop(1, 'rgba(240,170,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    F(40, 21, 4, 1, '#d8642a'); F(52, 21, 4, 1, '#d8642a');
    drawCamper(g, 36, 27, { cls: 'sabre', skin: 'own', pose: 'sit', face: 1, prop: 'bandura', nation: 'cossack' });
    drawCamper(g, 61, 27, { cls: 'pike', skin: 'own', pose: 'sit', face: -1, nation: 'scot' });
    F(46, 26, 6, 2, '#4b3420'); F(46, 22, 6, 4, '#c2412b'); F(47, 20, 4, 4, PAL.flash); F(48, 18, 2, 2, PAL.flash); F(48, 23, 2, 2, '#fff3c4');
  });
}

/* ---------- the camp at night: the company round its fire, each man where his order puts him ---------- */
const CW = 320, CH = 151;
/** A place in the camp: x, y at a man's feet, and the way he faces there. */
type CampSlot = readonly [x: number, y: number, face: 1 | -1];
/** Where a man is in camp: wherever his order sends him, or abed by the tent if he is wounded. */
type CampSpot = CampOrder | 'abed';
/** The slots for each spot, taken in turn by the men whose spot it is, and one slot for each hired hand of the baggage train. */
interface CampLayout extends Readonly<Record<CampSpot, readonly CampSlot[]>> { readonly staff: Readonly<Record<StaffId, CampSlot>> }
const CAMP: CampLayout = {
  rest: [[130, 100, 1], [141, 90, 1], [179, 90, -1], [190, 100, -1], [136, 114, 1], [184, 114, -1], [150, 124, 1], [172, 124, -1]],
  drill: [[204, 126, 1], [228, 112, 1], [274, 132, 1], [196, 142, 1], [226, 140, 1], [258, 147, -1], [288, 144, -1], [242, 129, -1]],
  forage: [[20, 130, -1], [40, 138, -1], [10, 118, -1], [59, 142, -1], [30, 146, -1], [50, 124, -1], [70, 134, -1], [16, 146, -1]],
  abed: [[103, 88, 1], [87, 95, 1], [119, 95, -1], [103, 101, 1], [88, 106, 1], [118, 107, -1], [96, 112, 1], [112, 116, -1]],
  staff: { surgeon: [124, 86, -1], drill: [252, 121, -1], qm: [76, 98, -1], chaplain: [242, 90, -1] }
};
/** One man of the roll as the camp shows him: where he belongs tonight (x, y at his feet, f the way he faces), what he is doing there (k) and what he holds. */
interface CampFigure { id: number; s: Soldier; k: CampSpot; x: number; y: number; f: 1 | -1; prop: CampProp | null }
// Where each man of the roll belongs tonight, and what he is doing there.
function campPlan(st: Campaign) {
  const n: Record<CampSpot, number> = { rest: 0, drill: 0, forage: 0, abed: 0 }, out: CampFigure[] = [];
  let bard = false;
  for (const s of st.roster) {
    const k = s.wound ? 'abed' : s.order, list = CAMP[k], slot = list[Math.min(n[k]++, list.length - 1)];
    let prop: CampProp | null = null;
    if (k === 'rest' && !bard && s.origin === 'Zaporozhian') { prop = 'bandura'; bard = true; } else if (k === 'rest' && s.id % 3 === 1) prop = 'pipe';
    out.push({ id: s.id, s, k, x: slot[0], y: slot[1], f: slot[2], prop });
  }
  return out;
}
/** A star of the night sky at x, y. Those whose phase k is under 2 twinkle (see drawCamp); a big one is 2 pixels across. */
interface CampStar { x: number; y: number; k: number; big: boolean }
/** The camp's backdrop keeps its stars, for drawCamp to twinkle. */
interface HTMLCanvasElement { stars?: CampStar[] }
function campBack(st: Campaign) {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d')!, F: Painter = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const poly = (pts: number[], col: string) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = col; g.fill(); };
  const r = mulberry(st.date * 31 + 7), stars: CampStar[] = [];
  F(0, 0, CW, CH, '#0f1520'); F(0, 34, CW, 40, '#141c2b'); F(0, 58, CW, 16, '#1a2335');
  for (let i = 0; i < 46; i++) { const x = r() * CW | 0, y = r() * 58 | 0; if (Math.hypot(x - 52, y - 17) < 11) continue; const s = { x, y, k: r() * 6, big: r() < 0.08 }; stars.push(s); F(x, y, s.big ? 2 : 1, s.big ? 2 : 1, 'rgba(230,223,204,.75)'); }
  g.fillStyle = PAL.paperHi; g.beginPath(); g.arc(52, 17, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0f1520'; g.beginPath(); g.arc(55.5, 15, 6.3, 0, Math.PI * 2); g.fill();
  poly([0, 74, 18, 70, 40, 72, 62, 66, 88, 70, 110, 67, 140, 71, 170, 65, 200, 69, 228, 66, 256, 70, 284, 67, 320, 71, 320, 151, 0, 151], '#192132');
  poly([0, 83, 40, 80, 90, 83, 140, 79, 200, 82, 250, 79, 320, 81, 320, 151, 0, 151], '#221c15');
  F(0, 134, CW, 17, '#1a1510');
  for (let i = 0; i < 26; i++) F(r() * CW | 0, 86 + (r() * 62 | 0), 2 + (r() * 2 | 0), 1, '#2c241a');
  [[262, 18, 86, 16], [290, 6, 90, 19], [314, 24, 92, 14], [244, 44, 84, 10]].forEach(([x, top, base, w]) => {
    const h = base - top; poly([x, top, x - w * 0.5, top + h * 0.35, x - w * 0.25, top + h * 0.35, x - w * 0.75, top + h * 0.68, x - w * 0.45, top + h * 0.68, x - w, base, x + w, base, x + w * 0.45, top + h * 0.68, x + w * 0.75, top + h * 0.68, x + w * 0.25, top + h * 0.35, x + w * 0.5, top + h * 0.35], '#0c120d');
    F(x - 1, base, 2, 4, '#0c120d');
  });
  const tent = (l: number, rr: number, top: number, base: number, peak: number) => { poly([peak, top, l, base, rr, base], '#6c624f'); poly([peak, top, rr, base, peak + (rr - peak) * 0.5, base], '#564e40'); poly([peak, top + (base - top) * 0.34, peak - (rr - l) * 0.135, base, peak + (rr - l) * 0.135, base], '#120f0b'); F(peak - 0.5, top - 4, 1, 4, PAL.wood); };
  tent(75, 130, 49, 84, 102.5); tent(190, 235, 48, 80, 212.5);
  F(198, 68, 29, 2, '#7a2230'); poly([213, 43, 220, 43, 218, 44.5, 220, 46, 213, 46], PAL.red);
  F(159, 20, 2, 62, '#5a3f26'); F(158, 17, 4, 3, PAL.ochre);
  drawCargo(g, questOf(st).transport, 18, 92, st.cargo0 ? st.cargo / st.cargo0 : 1, true);
  F(236, 111, 2, 16, '#4b3420'); F(233, 111, 8, 9, '#8a6d2c'); F(231, 113, 12, 1.5, '#4b3420'); F(233, 114, 8, 1, '#6e5622'); F(233, 117, 8, 1, '#6e5622');
  for (const [x, y, f] of CAMP.rest) { const lx = f > 0 ? x - 4 : x - 3; F(lx, y - 4, 7, 3, '#4b3420'); F(lx, y - 4, 7, 1, PAL.wood); }
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(160, 79); g.lineTo(153, 103); g.moveTo(160, 79); g.lineTo(167, 103); g.stroke();
  F(160, 79, 1, 7, PAL.steel); F(156, 86, 8, 1, PAL.steel); F(157, 87, 6, 3, INK);
  F(146, 117, 9, 3, '#6b5338'); F(154, 116, 3, 3, '#6b5338'); F(155, 115, 1, 1, '#3a2a1a'); F(145, 118, 1, 1, '#6b5338');
  c.stars = stars;
  return c;
}
/** A speck of the camp's night: an ember (e), a wisp of smoke (s) or a note of the bandura (n). It starts at x, y, drifts at vx, vy and lives max seconds. */
interface CampParticle { k: 'e' | 's' | 'n'; x: number; y: number; vx: number; vy: number; life: number; max: number }
/** Where a man stands in the camp scene now (x, y at his feet). Once he has walked he also has the way he faces and the clock of his stride. */
interface CampWalker { x: number; y: number; moving?: boolean; face?: 1 | -1; anim?: number }
/** The walkers by soldier id (a string, as the camp's buttons carry it). A man has one from the first frame he is drawn. */
type CampPositions = Partial<Record<string, CampWalker>>;
/** The picture of the camp. */
interface CampView {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; // the canvas on the page
  buf: HTMLCanvasElement; g: CanvasRenderingContext2D; // the CW by CH buffer drawn small and scaled up to it
  sel: HTMLCanvasElement; // scratch, for the outline round the man picked
  back: HTMLCanvasElement | null; key: string; // the night's backdrop and what it was drawn for (none before the first frame)
  pos: CampPositions; parts: CampParticle[]; t: number; // where the men are, the specks in the air, and the clock
  btns: HTMLElement[] | null; // the clickable figures laid over the canvas
}
function newCamp(cv: HTMLCanvasElement, pos?: CampPositions) {
  const buf = sceneCanvas(CW, CH), sel = sceneCanvas(44, 44); // SS times finer than the scene, for the figures (see SS)
  const v: CampView = { cv, ctx: cv.getContext('2d')!, buf, g: buf.getContext('2d')!, sel, back: null, key: '', pos: pos || {}, parts: [], t: 0, btns: null };
  fitCamp(v);
  return v;
}
function fitCamp(v: CampView) {
  const w = v.cv.clientWidth || 640, dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(w * dpr), H = Math.round(W * CH / CW);
  if (v.cv.width !== W || v.cv.height !== H) { v.cv.width = W; v.cv.height = H; }
}
function campFlag(g: CanvasRenderingContext2D, t: number) {
  for (let x = 0; x < 23; x++) {
    const off = Math.round(Math.sin(t * 3.2 - x * 0.45) * (x / 22) * 1.4), X = 161 + x, Y = 22 + off;
    g.fillStyle = PAL.red;
    if (x < 19) g.fillRect(X, Y, 1, 11);
    else { const gap = (x - 18) * 2 - 1; g.fillRect(X, Y, 1, (11 - gap) >> 1); g.fillRect(X, Y + 11 - ((11 - gap) >> 1), 1, (11 - gap) >> 1); }
    g.fillStyle = PAL.ochre;
    if (x === 9 || x === 10) g.fillRect(X, Y + 2, 1, 7);
    if (x >= 7 && x <= 12) g.fillRect(X, Y + 4, 1, 2);
  }
}
function campFire(g: CanvasRenderingContext2D, t: number, still: boolean) {
  const F: Painter = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(154 + x, 89 + y, w, h); };
  F(0, 12, 12, 2, '#4b3420'); F(2, 12, 8, 1, PAL.wood); F(2, 11, 8, 1, '#d8642a');
  if (still || Math.floor(t * 4.8) % 2) {
    F(2, 7, 8, 4, '#c2412b'); F(3, 5, 6, 5, PAL.flash); F(5, 8, 2, 2, '#fff3c4'); F(4, 3, 2, 2, PAL.flash); F(7, 2, 1, 3, PAL.flash); F(2, 5, 1, 2, '#c2412b'); F(9, 6, 1, 2, '#c2412b');
  } else {
    F(2, 8, 8, 3, '#c2412b'); F(3, 6, 6, 4, PAL.flash); F(5, 8, 2, 2, '#fff3c4'); F(6, 2, 2, 4, PAL.flash); F(3, 4, 1, 2, PAL.flash); F(9, 5, 1, 3, '#c2412b'); F(1, 7, 1, 2, '#c2412b');
  }
}
// Draw the camp. dt is the time since the last frame; still draws it at rest, as for reduced motion.
function drawCamp(v: CampView | null, st: Campaign | null, sel: number | null, dt: number, still: boolean) {
  if (!v || !st) return;
  v.t += dt;
  const t = v.t, g = v.g, key = st.quest + st.date + ':' + (st.cargo0 ? Math.round(5 * st.cargo / st.cargo0) : 0);
  if (v.key !== key) { v.back = campBack(st); v.key = key; }
  g.globalAlpha = 1; g.drawImage(v.back!, 0, 0);
  if (!still) for (const s of v.back!.stars!) if (s.k < 2) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 1.3 + s.k * 9); g.fillStyle = PAL.paperHi; g.fillRect(s.x, s.y, 1, 1); }
  g.globalAlpha = 1;
  campFlag(g, still ? 0 : t);
  const plan = campPlan(st);
  for (const p of plan) {
    let c = v.pos[p.id];
    if (!c || still) c = v.pos[p.id] = { x: p.x, y: p.y };
    const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
    if (d > 0.6) { const m = Math.min(d, 42 * dt); c.x += dx / d * m; c.y += dy / d * m; c.moving = true; c.face = dx >= 0 ? 1 : -1; c.anim = (c.anim || 0) + dt * 6; }
    else { c.x = p.x; c.y = p.y; c.moving = false; }
  }
  const draw = (gg: CanvasRenderingContext2D, p: CampFigure, x: number, y: number) => {
    const c = v.pos[p.id]!, s = p.s;
    const me = { cls: s.cls, skin: 'own' as const, wpn: s.wpn, arm: s.arm, man: s.id, nation: nationOf(s.origin) };
    if (c.moving) return drawCamper(gg, x, y, { ...me, face: c.face, mode: 'idle', moving: true, anim: c.anim });
    if (p.k === 'abed') return drawCamper(gg, x, y, { ...me, face: p.f, pose: 'lie' });
    if (p.k === 'rest') return drawCamper(gg, x, y, { ...me, face: p.f, pose: 'sit', prop: p.prop, strum: Math.floor(t * 5) % 2 });
    if (p.k === 'forage') return drawCamper(gg, x, y, { ...me, face: p.f, pose: 'forage', anim: t * 1.6 + p.id });
    const ph = (t + p.id * 0.7) % 3;
    if (s.cls === 'sabre') return drawCamper(gg, x, y, { ...me, face: p.f, mode: 'fight', swing: ph % 1 < 0.35 ? 1 : 0 });
    if (s.cls === 'shot') return drawCamper(gg, x, y, { ...me, face: p.f, mode: ph > 1.2 ? 'aim' : 'idle', flash: ph > 2.6 && ph < 2.75 ? 1 : 0 });
    return drawCamper(gg, x, y, { ...me, face: p.f, mode: 'idle', level: ph % 1.5 > 0.75 });
  };
  for (const p of plan.slice().sort((a, b) => v.pos[a.id]!.y - v.pos[b.id]!.y)) {
    const c = v.pos[p.id]!, x = Math.round(c.x * SS) / SS, y = Math.round(c.y * SS) / SS;
    if (p.id === sel) {
      const sg = v.sel.getContext('2d')!; sg.clearRect(0, 0, 44, 44); draw(sg, p, 22, 40);
      sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#e8c46a'; sg.fillRect(0, 0, 44, 44); sg.globalCompositeOperation = 'source-over';
      for (const o of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) g.drawImage(v.sel, x - 22 + o[0] / SS, y - 40 + o[1] / SS, 44, 44);
    }
    draw(g, p, x, y);
  }
  for (const k in STAFF_LOOK) if (st.staff[k as StaffId]) { const s = CAMP.staff[k as StaffId]; drawCivilian(g, s[0], s[1], k as StaffId, s[2]); }
  const fl = still ? 1 : 1 + 0.05 * Math.sin(t * 7.1) + 0.03 * Math.sin(t * 17.3);
  let gr = g.createRadialGradient(160, 100, 40, 160, 100, 230);
  gr.addColorStop(0, 'rgba(5,8,14,0)'); gr.addColorStop(1, 'rgba(5,8,14,.55)'); g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
  gr = g.createRadialGradient(160, 100, 2, 160, 100, 100 * fl);
  gr.addColorStop(0, 'rgba(240,170,60,.36)'); gr.addColorStop(0.35, 'rgba(216,100,42,.15)'); gr.addColorStop(1, 'rgba(216,100,42,0)'); g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
  campFire(g, t, still);
  if (!still) {
    if (Math.random() < dt * 5) v.parts.push({ k: 'e', x: 157 + Math.random() * 6, y: 94, vx: rnd(-3, 5), vy: rnd(-34, -20), life: 0, max: rnd(1.2, 2.4) });
    if (Math.random() < dt * 1.2) v.parts.push({ k: 's', x: 159 + Math.random() * 3, y: 84, vx: rnd(-1, 1), vy: -4, life: 0, max: 2.6 });
    for (const p of plan) {
      const c = v.pos[p.id]!; if (c.moving || p.k !== 'rest') continue;
      if (p.prop === 'bandura' && Math.random() < dt * 0.6) v.parts.push({ k: 'n', x: c.x + p.f * 3, y: c.y - 16, vx: p.f * 4, vy: -11, life: 0, max: 3 });
      if (p.prop === 'pipe' && Math.random() < dt * 0.5) v.parts.push({ k: 's', x: c.x + p.f * 5, y: c.y - 14, vx: p.f * 2, vy: -5, life: 0, max: 2.2 });
    }
    for (let i = v.parts.length - 1; i >= 0; i--) {
      const p = v.parts[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life >= p.max) { v.parts.splice(i, 1); continue; }
      const a = 1 - p.life / p.max; g.globalAlpha = Math.min(1, a * 1.6);
      if (p.k === 'e') { g.fillStyle = a > 0.5 ? PAL.flash : '#d8642a'; g.fillRect(p.x | 0, p.y | 0, 1, 1); }
      else if (p.k === 's') { g.fillStyle = PAL.smoke; g.fillRect(p.x | 0, p.y | 0, 1, 1); }
      else { g.fillStyle = '#e8c46a'; const x = p.x | 0, y = p.y | 0; g.fillRect(x, y, 1, 4); g.fillRect(x - 2, y + 3, 2, 2); g.fillRect(x + 1, y, 1, 1); g.fillRect(x + 2, y + 1, 1, 1); }
    }
    g.globalAlpha = 1;
  }
  present(v.ctx, v.buf, v.cv.width, v.cv.height);
  // keep the clickable figures over the drawn ones as they walk
  if (v.btns) for (const b of v.btns) {
    const p = v.pos[b.dataset.id!]; if (!p) continue;
    const L = ((p.x - 9) / CW * 100).toFixed(2) + '%', T = ((p.y - (b.dataset.k === 'abed' ? 8 : b.dataset.k === 'rest' ? 18 : 31)) / CH * 100).toFixed(2) + '%';
    if (b.style.left !== L) b.style.left = L;
    if (b.style.top !== T) b.style.top = T;
  }
}
