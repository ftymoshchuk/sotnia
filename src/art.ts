"use strict";
/* ===== SOTNIA interface: drawing (palette, the field, the map, the pictures of the cards, the camp) ===== */
const LW = BW, LH = 124, FY = 72, HZ = 56;
/**
 * The colours the pictures name by what they are: the dyes of the men (red is madder, blue woad, ochre weld, green moss), and the paper family (paper, paperHi, hill,
 * ground, drab, grey, steel, helm, smoke, flash), which is the ramps of the paper of a document, of dusk earth and of iron. All of them are steps of the ramps in RAMPS.
 */
const PAL = {
  paper: '#bfae82', hill: '#8d7b52', ground: '#4e3d2c', paperHi: '#d3c498', ink: '#14100c', red: '#b2493a', blue: '#33507a',
  ochre: '#a67a27', green: '#587030', drab: '#6e6249', grey: '#6b757e', plum: '#5e3158', black: '#2a2018', skin: '#cd9a73',
  wood: '#6a4a2c', fur: '#4b3524', steel: '#2f363d', helm: '#939ca3', white: '#e7ddbf', flash: '#f6b73e', smoke: '#8f8467', russet: '#6e2420'
} as const;
const INK = PAL.ink;
/** The two colours that dress a figure: coat for the body, trim for the belt and the small touches (plume, hilt). */
interface Livery { coat: string; trim: string }
const SKINS: Record<Skin, Livery> = {
  own: { coat: '#8f3328', trim: '#cf9f3c' }, bandit: { coat: '#6e6249', trim: PAL.white }, deserter: { coat: '#6b757e', trim: '#1d2227' },
  raider: { coat: PAL.green, trim: PAL.ochre }, imperial: { coat: PAL.ochre, trim: '#1d2227' }, swede: { coat: PAL.blue, trim: '#cf9f3c' },
  champion: { coat: PAL.plum, trim: '#cf9f3c' }, black: { coat: '#1d2227', trim: '#8f3328' }, muscovite: { coat: PAL.russet, trim: '#cf9f3c' },
  tatar: { coat: '#2a625a', trim: PAL.white }, croat: { coat: '#67533b', trim: '#b2493a' }
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
  rank?: 'captain'; // the company's captain, who wears gilt where the men wear red
}

/* ---------- the random numbers of the backdrops (the backdrops themselves are in terrain.ts) ---------- */
function mulberry(a: number): () => number { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
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
  captain?: Captain; // the company's captain, who stands behind the line in a fight and gives his order
}

/* ---------- the field ---------- */
function newView(cv: HTMLCanvasElement, seed: number, weather: Weather, names: boolean, setting?: Setting) {
  const buf = sceneCanvas(LW, LH); // SS times finer than the scene, for the figures (see SS)
  const v = { cv, ctx: cv.getContext('2d')!, buf, g: buf.getContext('2d')!, back: makeBackdrop(seed, weather, setting), parts: [] as FieldParticle[], names, weather } as FieldView; // css and dpr: fitView sets them next
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
      if (p.h <= 0) { if (p.k === 'b') { g2.fillStyle = '#8f3328'; g2.fillRect(p.x | 0, (FY + p.y) | 0, 1, 1); } p.life = 99; }
    }
    if (p.life >= p.max) v.parts.splice(i, 1);
  }
  if (v.parts.length > 420) v.parts.splice(0, v.parts.length - 420);
}
function drawField(v: FieldView, b: Battle, t: number) {
  const g = v.g; g.globalAlpha = 1; g.drawImage(v.back, 0, 0, LW, LH);
  if (v.weather === 'fog') {
    g.fillStyle = 'rgba(184,202,200,.4)';
    for (let i = 0; i < 3; i++) g.fillRect(-30 + Math.sin(t * 0.21 + i * 1.7) * 22, 42 + i * 25, LW + 60, 9);
  }
  const us = b.units.filter(u => !u.fled).sort((a, c) => a.y - c.y);
  for (const u of us) if (u.dead) drawSoldier(g, Math.round(u.x * SS) / SS, FY + Math.round(u.y * SS) / SS, { dead: true, cls: u.cls, skin: u.skin, face: u.face, wpn: u.wpn, arm: u.arm, man: manNo(u.sid), nation: nationOf(u.origin) });
  for (const u of us) {
    if (u.dead) continue;
    const x = Math.round(u.x * SS) / SS, y = FY + Math.round(u.y * SS) / SS;
    drawSoldier(g, x, y, { cls: u.cls, skin: u.skin, face: u.face, mode: u.mode, moving: u.moving, anim: u.anim * 2, swing: u.swing, flash: u.flash, hurt: u.hurt, t, level: u.cls === 'pike' && u.tgt && dist(u, u.tgt) < 44, wpn: u.wpn, arm: u.arm, man: manNo(u.sid), nation: nationOf(u.origin) });
    if (!u.routing) {
      g.fillStyle = INK; g.fillRect(x - 5, y - 27, 11, 3); g.fillStyle = '#48515a'; g.fillRect(x - 4, y - 26, 9, 1);
      g.fillStyle = glow((SKINS[u.skin] || SKINS.own).coat, 1.5); g.fillRect(x - 4, y - 26, Math.max(1, Math.round(9 * u.hp / u.max)), 1);
    }
  }
  // the captain's order: a ring of gold under the men it is on, and the captain behind the line, his sabre up as he calls it
  const O = b.order, left = O ? b.buffs[O] : undefined;
  if (O && left !== undefined) {
    g.fillStyle = 'rgba(232,200,116,.8)';
    for (const u of us) if (u.side === 0 && !u.dead && (O === 'rally' || (O === 'volley' ? u.cls === 'shot' : O === 'stand' ? u.cls === 'pike' : u.cls === 'sabre'))) g.fillRect(Math.round(u.x) - 6, FY + Math.round(u.y) + 1, 13, 1);
  }
  if (v.captain && b.order) {
    const C = CAPTAINS[v.captain.type], cx = 11, cy = FY + 30, calling = O && left !== undefined && left > ORDERS[O].secs - 0.7;
    g.fillStyle = '#4e3d2c'; g.fillRect(cx - 9, cy - 38, 1, 38); g.fillStyle = PAL.red; g.fillRect(cx - 8, cy - 38, 8, 5); g.fillStyle = '#cba34f'; g.fillRect(cx - 5, cy - 37, 2, 3);
    drawCamper(g, cx, cy, { cls: C.cls, skin: 'own', face: 1, mode: calling ? 'fight' : 'idle', swing: calling ? 1 : 0, wpn: 2, arm: 2, man: v.captain.name.length, nation: C.origin, rank: 'captain' });
  }
  for (const p of v.parts) {
    const px = Math.round(p.x), py = Math.round(FY + p.y - p.h);
    if (p.k === 's') {
      const fr = p.life / p.max, s = 2 + Math.floor(fr * 4);
      g.globalAlpha = fr > 0.65 ? Math.max(0, 1 - (fr - 0.65) / 0.35) : 1;
      g.fillStyle = '#d1c5a1'; g.fillRect(px - (s >> 1), py - (s >> 1), s, s);
      g.fillStyle = PAL.smoke; g.fillRect(px - (s >> 1), py - (s >> 1) + s - 1, s, 1);
      g.globalAlpha = 1;
    } else { g.fillStyle = p.k === 'b' ? PAL.red : p.k === 'p' ? '#fcdc7c' : '#b3a784'; g.fillRect(px, py, 1, 1); }
  }
  if (v.weather === 'rain') {
    g.fillStyle = 'rgba(157,186,208,.5)';
    for (let i = 0; i < 54; i++) { const x = ((i * 37 + t * 95 + i * i * 13) % (LW + 20)) - 10, y = (i * 53 + t * 190) % LH; g.fillRect(x | 0, y | 0, 1, 2); g.fillRect((x | 0) - 1, (y | 0) + 2, 1, 2); }
  } else if (v.weather === 'fog') {
    g.fillStyle = 'rgba(184,202,200,.24)';
    for (let i = 0; i < 2; i++) g.fillRect(-30 + Math.sin(t * 0.17 + i * 2.3) * 26, 84 + i * 21, LW + 60, 4);
  }
  present(v.ctx, v.buf, v.cv.width, v.cv.height);
  const c = v.ctx;
  if (v.names && v.css >= 1.5) {
    const sc = v.cv.width / LW;
    c.font = Math.round(clamp(v.css * 4.5, 10, 15) * v.dpr) + "px 'IM Fell English SC', Georgia, serif";
    c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 3 * v.dpr; c.strokeStyle = INK; c.fillStyle = '#f4edd6'; // light on a dark halo, to read on dusk ground
    for (const u of b.units) {
      if (u.side !== 0 || !alive(u) || u.routing) continue;
      const n = u.name.split(' ')[0], X = u.x * sc, Y = (FY + u.y - 30) * sc;
      c.strokeText(n, X, Y); c.fillText(n, X, Y);
    }
  }
}

/* ---------- the map: a document, so it stays on paper ---------- */
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
  // a map is a document, and stays on paper: the sea in woad, the land in the paper ramp with a wash that darkens towards the coast, the coast and the roads in soot ink
  g.fillStyle = '#6f94b4'; g.fillRect(0, 0, w, h);
  g.beginPath();
  for (const ring of COAST) { for (let i = 0; i < ring.length; i += 2) { if (i) g.lineTo(X(ring[i]), Y(ring[i + 1])); else g.moveTo(X(ring[i]), Y(ring[i + 1])); } g.closePath(); }
  g.fillStyle = '#bfae82'; g.fill('evenodd');
  g.save(); g.clip('evenodd'); g.lineJoin = 'round'; g.strokeStyle = '#a8976a'; g.lineWidth = 9; g.globalAlpha = 0.6; g.stroke(); g.restore();
  g.strokeStyle = PAL.ink; g.lineWidth = 1.2; g.stroke();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = '#4b6f98'; g.lineWidth = 1.5;
  for (const k in RIVERS) { line(RIVERS[k]); g.stroke(); }
  // every road, then the roads open from here, then the road travelled
  g.setLineDash([2, 3]); g.strokeStyle = 'rgba(20,16,12,.55)'; g.lineWidth = 1;
  for (const r of ROADS) { if (r.river) continue; const a = at(r.a), b = at(r.b); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  g.setLineDash([]);
  const here0 = at(st.at), out = st.over ? [] : roadsFrom(st);
  g.strokeStyle = PAL.ink; g.lineWidth = 2;
  for (const r of out) { const b = at(r.to); g.beginPath(); g.moveTo(here0[0], here0[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  g.strokeStyle = '#8f3328'; g.lineWidth = 3;
  g.beginPath(); st.path.forEach((id, i) => { const p = at(id); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
  // a course set from here, dashed in weld (bronze on an edge of ink, which paper alone would lose it on)
  const target = plan && plan.length ? plan[plan.length - 1].to : null;
  if (target) {
    const course = () => { g.beginPath(); g.moveTo(here0[0], here0[1]); for (const l of plan!) { const p = at(l.to); g.lineTo(p[0], p[1]); } g.stroke(); };
    g.setLineDash([7, 5]); g.lineCap = 'butt';
    g.strokeStyle = 'rgba(20,16,12,.6)'; g.lineWidth = 4.6; course();
    g.strokeStyle = '#cba34f'; g.lineWidth = 3; course();
    g.setLineDash([]); g.lineCap = 'round';
  }
  // places: a filled dot where there is a market, an open one where there is none
  const q = questOf(st), named = new Set([st.at, q.to].concat(target ? [target] : [], out.map(r => r.to), [q.from]));
  cv.hits = (Object.keys(PLACES) as PlaceId[]).map(id => { const xy = at(id); return { id, x: xy[0], y: xy[1] }; });
  for (const id in PLACES) {
    const p = PLACES[id as PlaceId], xy = at(id as PlaceId), shop = (SERVICES[p.kind] || {}).market;
    g.beginPath(); g.arc(xy[0], xy[1], 2.6, 0, Math.PI * 2);
    g.fillStyle = shop ? PAL.ink : PAL.paperHi; g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 1.2; g.stroke();
    if (p.major) named.add(id as PlaceId);
  }
  // the destination, ringed in bronze with an ink edge, and the course's own stopping place in a smaller ring
  const ring = (x: number, y: number, r: number, lw: number) => { g.strokeStyle = PAL.ink; g.lineWidth = lw + 2.4; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#cba34f'; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); };
  const dest = at(q.to);
  ring(dest[0], dest[1], 7.5, 3);
  if (target && target !== q.to) { const t = at(target); ring(t[0], t[1], 5.5, 2); }
  g.fillStyle = PAL.ink; g.fillRect(here0[0] - 1, here0[1] - 19, 2, 19);
  g.fillStyle = PAL.red; g.beginPath(); g.moveTo(here0[0] + 1, here0[1] - 19); g.lineTo(here0[0] + 13, here0[1] - 15); g.lineTo(here0[0] + 1, here0[1] - 11); g.closePath(); g.fill();
  // names, with a paper halo so they read over roads and rivers
  const fs = Math.round(clamp(w / 82, 10, 14));
  g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = 'italic ' + Math.round(fs * 1.1) + "px 'IM Fell DW Pica', Georgia, serif"; g.fillStyle = '#17233a'; g.textAlign = 'center';
  for (const m of MAP_SEAS) g.fillText(m[0], X(m[1]), Y(m[2]));
  g.font = fs + "px 'IM Fell English SC', Georgia, serif";
  const boxes: LabelBox[] = [], hit = (b: LabelBox) => boxes.some(o => o[0] < b[0] + b[2] && b[0] < o[0] + o[2] && o[1] < b[1] + b[3] && b[1] < o[1] + o[3]);
  for (const id of named) {
    const xy = at(id), name = cap1(PLACES[id].name), tw = g.measureText(name).width, x = xy[0], y = xy[1];
    const tries: LabelSpot[] = [[x + 7, y, 'left'], [x - 7, y, 'right'], [x + 4, y + fs, 'left'], [x + 4, y - fs, 'left'], [x - 4, y + fs, 'right'], [x - 4, y - fs, 'right']];
    for (const t of tries) {
      const bx = t[2] === 'left' ? t[0] : t[0] - tw, box: LabelBox = [bx - 2, t[1] - fs / 2 - 1, tw + 4, fs + 2];
      if (box[0] < 1 || box[0] + box[2] > w - 1 || box[1] < 1 || box[1] + box[3] > h - 1 || hit(box)) continue;
      boxes.push(box);
      g.textAlign = t[2]; g.lineWidth = 3.5; g.strokeStyle = PAL.paperHi; g.strokeText(name, t[0], t[1]);
      g.fillStyle = id === st.at ? '#8f3328' : PAL.ink; g.fillText(name, t[0], t[1]);
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
/** How the post alone is drawn: what a camp shows when it knows no more of the man (an officer is drawn by his kind). */
const STATION_LOOK: Record<StaffId, PersonLook> = {
  surgeon: { coat: '#5a4630', trim: PAL.white, hat: 'cap', hatCol: '#3b3128', prop: 'razor', apron: true },
  drill: { coat: '#6b6b66', trim: PAL.ochre, hat: 'morion', prop: 'pike' },
  qm: { coat: '#2a625a', trim: PAL.ochre, hat: 'cap', hatCol: '#8f3328', prop: 'purse' },
  chaplain: { coat: INK, trim: PAL.white, hat: 'biretta', prop: 'cross', long: true }
};
/** How each kind of officer is drawn: his coat, his hat and what he carries say what he is. */
const OFFICER_LOOK: Record<OfficerKind, PersonLook> = {
  barber: STATION_LOOK.surgeon,
  bonesetter: { coat: '#6b4a2c', trim: PAL.white, hat: 'felt', hatCol: '#3b3128', prop: 'splints' },
  physician: { coat: INK, trim: PAL.white, hat: 'flat', prop: 'vial', ruff: true, long: true },
  herbalist: { coat: '#5b6b3a', trim: PAL.white, hat: 'wide', hatCol: '#7a6a45', prop: 'herbs' },
  armysurgeon: { coat: PAL.blue, trim: PAL.ochre, hat: 'plumed', hatCol: '#2c2926', prop: 'saw' },
  pikemaster: STATION_LOOK.drill,
  fencer: { coat: '#7a2230', trim: PAL.white, hat: 'plumed', hatCol: '#2c2926', prop: 'rapier' },
  gunner: { coat: '#8a6d3a', trim: PAL.ochre, hat: 'felt', hatCol: '#2c2926', prop: 'musket' },
  taskmaster: { coat: '#3a3a3f', trim: PAL.red, hat: 'felt', hatCol: '#2c2926', prop: 'cane' },
  veteran: { coat: '#4f4a42', trim: PAL.ochre, hat: 'bare', prop: 'halberd', grey: true, beard: true },
  haggler: STATION_LOOK.qm,
  provisioner: { coat: '#8a7a52', trim: PAL.white, hat: 'cap', hatCol: '#d8c79a', prop: 'sack', apron: true },
  scrounger: { coat: '#6a5a3a', trim: PAL.ochre, hat: 'wide', hatCol: '#5b4a2a', prop: 'goose' },
  paymaster: { coat: INK, trim: PAL.white, hat: 'flat', prop: 'ledger', ruff: true },
  fixer: { coat: '#3b2f3f', trim: PAL.ochre, hat: 'wide', hatCol: '#2c2926', prop: 'letter' },
  catholic: STATION_LOOK.chaplain,
  orthodox: { coat: INK, trim: PAL.white, hat: 'kamilavka', prop: 'orthodox', long: true, beard: true },
  lutheran: { coat: INK, trim: PAL.white, hat: 'flat', prop: 'tome', ruff: true, long: true },
  reformed: { coat: INK, trim: PAL.white, hat: 'felt', hatCol: '#2c2926', prop: 'tome', long: true },
  open: { coat: '#6f665a', trim: PAL.white, hat: 'bare', prop: 'woodcross', long: true }
};
/** How each retainer is drawn. */
const RETAINER_LOOK: Record<RetainerId, PersonLook> = {
  engineer: { coat: '#7a5a2a', trim: PAL.ochre, hat: 'wide', hatCol: '#3b3128', prop: 'spade' },
  cartographer: { coat: '#3a4a5a', trim: PAL.white, hat: 'wide', hatCol: '#2c2926', prop: 'scrolls' },
  informant: { coat: '#2a2725', trim: PAL.ochre, hat: 'wide', hatCol: '#2a2725', prop: 'letter' },
  wisewoman: { coat: '#6b4f6b', trim: PAL.white, hat: 'scarf', hatCol: '#d9c48a', prop: 'herbs', long: true },
  renegade: { coat: PAL.blue, trim: PAL.ochre, hat: 'felt', hatCol: '#2c2926', prop: 'halberd' },
  duellist: { coat: PAL.plum, trim: PAL.ochre, hat: 'plumed', hatCol: '#2c2926', prop: 'rapier' },
  kobzar: { coat: '#cfc8b4', trim: PAL.white, hat: 'cap', hatCol: '#4b3524', prop: 'bandura', grey: true, beard: true, blind: true },
  merchant: { coat: '#7a2230', trim: PAL.ochre, hat: 'turban', hatCol: '#d9d1bc', prop: 'bales', long: true }
};
/* ---------- goods and cargo for the cards: painted once on rasters in the dyes, graded for the hour of the picture, and drawn as images ---------- */
const gradeLuts: Record<string, Lut> = {};
/** The grade of an hour as a lut, kept: the night, the clear day, or the low sun of dusk, which is what the cards' landscapes are lit by. */
const gradeOf = (name: 'night' | 'day' | 'dusk') => gradeLuts[name] || (gradeLuts[name] = gradeLut(name === 'night' ? GRADE_NIGHT : name === 'day' ? GRADE_DAY : GRADE_DUSK));
const goodsCache: Record<string, HTMLCanvasElement> = {};
/** A thing painted on a raster over the box x0, y0, x1, y1 (fine pixels, in the coordinates its painter uses), turned to the dyes of the hour (if one is given) and made an image. Kept. */
function goodsImage(key: string, box: readonly [number, number, number, number], grade: 'night' | 'day' | 'dusk' | null, paint: (b: Pen) => void) {
  const k = key + (grade || '');
  if (goodsCache[k]) return goodsCache[k];
  const p = newPix(box[2] - box[0], box[3] - box[1], box[0], box[1]);
  paint(penOf(p));
  if (grade) {
    const lut = gradeOf(grade);
    for (let i = 0; i < p.d.length; i += 4) if (p.d[i + 3]) { const c = lut.get(keyAt(p.d, i)); if (c !== undefined) setAt(p, i, c); }
  }
  return (goodsCache[k] = pixCanvas(p));
}
/** A hard-edged shadow on a raster that has nothing painted yet: a solid core and a rim of every other pixel. */
function groundShadow(p: Pix, cx: number, cy: number, rx: number, ry: number, c: number | string = 'soot1', solid = 0.5) {
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if (d <= solid || (d <= 1 && (x + y) % 2 === 0)) putPix(p, x, y, c);
  }
}
// An ox, standing or lying, its feet at x, y (its middle at x), facing right (f is 1) or left, its hide of the colour given: the five shades of it run from that darkened to that lightened.
function drawOx(g: CanvasRenderingContext2D, x: number, y: number, f: 1 | -1, lying: boolean, hide: string) {
  const h = packN(hide), key = 'ox' + (lying ? 'l' : 's') + f + hide;
  const img = goodsCache[key] || (goodsCache[key] = pixCanvas(oxPix(lying, f, [mixN(h, 0x14100c, 0.38), mixN(h, 0x14100c, 0.14), h, mixN(h, 0xe7ddbf, 0.18), mixN(h, 0xe7ddbf, 0.38)])));
  const sh = goodsCache.oxshadow || (goodsCache.oxshadow = (() => { const p = newPix(56, 10); groundShadow(p, 28, 5, 24, 3.4); return pixCanvas(p); })());
  g.drawImage(sh, x - 14, y - 2.5, 28, 5);
  g.drawImage(img, x - (f > 0 ? 11.5 : 12), y - (lying ? 14 : 15.5), 24, 18);
}
// The cargo of the quest, by how it travels. x,y is the foot of its left end; load runs from 0 to 1. A cart is the cart of the camp (see paintCart) in the light of the cards.
function drawCargo(g: CanvasRenderingContext2D, kind: TransportId, x: number, y: number, load: number, night: boolean) {
  const grade = night ? 'night' : 'dusk';
  if (kind === 'oxcart' || kind === 'chest') {
    const n = Math.max(1, Math.round(5 * load));
    drawOx(g, x - 10, y + 8, 1, true, night ? '#4a3c2f' : '#6b5338');
    const img = goodsImage('cart' + kind + n, [0, 134, 142, 212], grade, b => { groundShadow(b.p, 88, 205, 58, 5, 'soot1', 0.6); cartPainter(b, kind, n / 5); });
    g.drawImage(img, x - 17, y - 27.5, 71, 39);
  } else if (kind === 'herd') {
    const hide = night ? '#4a3c2f' : '#6b5338', hide2 = night ? '#5b4a3a' : '#8a6c4a';
    drawOx(g, x + 14, y - 3, 1, true, hide); drawOx(g, x + 46, y + 2, -1, true, hide2); drawOx(g, x + 34, y - 9, 1, false, hide); drawOx(g, x + 2, y + 3, -1, true, hide2);
  } else {
    const n = Math.max(1, Math.round(5 * load));
    const img = goodsImage('raft' + n, [0, 150, 160, 214], grade, b => { paintWater(b.p, 70, 192, 78, 15, () => true, ['woad4', 'woad5', 'sky3']); groundShadow(b.p, 70, 203, 52, 3.4, 'night0', 0.6); raftPainter(b, n / 5); });
    g.drawImage(img, x - 9, y - 21, 80, 32);
  }
}

/* ---------- card art: small pictures for the cards, drawn once and kept ---------- */
const artCache: Record<string, string> = {};
function artURL(key: string, W: number, H: number, fn: (g: CanvasRenderingContext2D, W: number, H: number) => void) {
  if (artCache[key]) return artCache[key];
  const c = sceneCanvas(W, H), g = c.getContext('2d')!; fn(g, W, H);
  return (artCache[key] = c.toDataURL());
}
/**
 * The backdrop of a card: a window onto the field backdrop of a land (see backdropOf), its horizon seven pixels above the foot of the
 * picture, or twenty when it is to show a site, which stands on the ground in front of the hills; the window is on the site then.
 */
function landscape(g: CanvasRenderingContext2D, W: number, H: number, seed: number, land: LandId, site?: SiteId) {
  const back = backdropOf(land, seed % 3, 'clear', site), sw = W * SS, sh = H * SS, lift = site ? 20 : 7;
  const sx = site && back.siteX !== undefined ? clamp(Math.round(back.siteX - sw / 2), 0, back.width - sw) : (seed * 173 + W * 11) % (back.width - sw);
  g.drawImage(back, sx, HZ * SS - (H - lift) * SS, sw, sh, 0, 0, W, H);
}
// A man of the company on his card: standing in his arms and armour, or abed. gear tries other levels than he has, for a card to show what buying them would make of him.
function soldierArt(s: Soldier, gear?: Partial<Pick<Soldier, 'wpn' | 'arm'>>, land: LandId = landNow()) {
  const seed = s.id % 5, pose = s.wound ? 'lie' : 'stand', wpn = gear && gear.wpn != null ? gear.wpn : s.wpn, arm = gear && gear.arm != null ? gear.arm : s.arm;
  return artURL('m' + s.id + s.cls + pose + wpn + arm + land, 48, 36, (g, W, H) => { landscape(g, W, H, seed, land); drawCamper(g, 24, H - 3, { cls: s.cls, skin: 'own', face: 1, mode: 'idle', anim: 0, pose, wpn, arm, man: s.id, nation: nationOf(s.origin) }); });
}
// After a fight: how each man came out of it.
function fateArt(l: ReportLine, land: LandId = landNow()) {
  const seed = l.id % 5, cls = l.cls, fate = l.fate, kit = { wpn: l.wpn, arm: l.arm, man: l.id, nation: nationOf(l.origin) };
  return artURL('f' + l.id + cls + fate + l.wpn + l.arm + land, 48, 36, (g, W, H) => {
    landscape(g, W, H, seed, land);
    if (fate === 'killed' || fate === 'struck down') drawCamper(g, 24, H - 3, { cls, skin: 'own', pose: 'lie', bandage: fate !== 'killed', ...kit });
    else if (fate === 'fled') drawCamper(g, 24, H - 3, { cls, skin: 'own', face: -1, mode: 'rout', moving: true, anim: 1, ...kit });
    else drawCamper(g, 24, H - 3, { cls, skin: 'own', face: 1, mode: 'idle', anim: 0, bandage: fate === 'wounded', ...kit });
  });
}
// The other side of a contract or an ambush, facing the reader's company.
function foesArt(c: Contract) {
  const us = c.units.slice(0, 6), land = c.land || landNow(), site = SITE_OF[c.tpl];
  return artURL('e' + c.id + us.map(u => u.cls).join('') + land + (site || ''), 72, 36, (g, W, H) => {
    landscape(g, W, H, c.id % 5, land, site);
    const step = us.length > 4 ? 10 : 12, x0 = Math.round(W / 2 - (us.length - 1) * step / 2);
    us.forEach((u, i) => drawSoldier(g, x0 + i * step, H - 3 - (i % 2) * 2, { cls: u.cls, skin: c.skin || u.skin, face: -1, mode: 'idle', anim: 0, wpn: u.wpn, arm: u.arm, man: i + 2 }));
  });
}
/** The portrait of a person of the command, in a window onto the land the company is in. */
const personArt = (key: string, L: PersonLook, land: LandId) => artURL('p' + key + land, 48, 36, (g, W, H) => { landscape(g, W, H, key.length, land); drawPerson(g, 24, H - 3, L, 1); });
const officerArt = (kind: OfficerKind, land: LandId = landNow()) => personArt(kind, OFFICER_LOOK[kind], land);
const retainerArt = (t: RetainerId, land: LandId = landNow()) => personArt(t, RETAINER_LOOK[t], land);
/** A retainer in the wide picture of the camp event in which he asks for a place. */
const retainerWideArt = (t: RetainerId, land: LandId = landNow()) => artURL('w' + t + land, 96, 30, (g, W, H) => { landscape(g, W, H, t.length, land); drawPerson(g, 48, H - 2, RETAINER_LOOK[t], 1); });
/** The station's own portrait, for a vacant post. */
const staffArt = (k: StaffId, land: LandId = landNow()) => personArt('s' + k, STATION_LOOK[k], land);
/** A captain at the head of his company, in the dress of his nation and the gilt of his rank. */
const captainArt = (c: Captain, land: LandId = landNow()) => {
  const T = CAPTAINS[c.type];
  return artURL('c' + c.type + land, 48, 36, (g, W, H) => { landscape(g, W, H, c.type.length, land); drawCamper(g, 24, H - 3, { cls: T.cls, skin: 'own', face: 1, mode: 'idle', anim: 0, wpn: 2, arm: 2, man: c.name.length, nation: T.origin, rank: 'captain' }); });
};
function stanceArt(s: Stance, land: LandId = landNow()) {
  return artURL('t' + s + land, 60, 36, (g, W, H) => {
    landscape(g, W, H, s.length + 1, land);
    const y = H - 3, o = (cls: TroopClass, x: number, m: Partial<SoldierLook>) => drawSoldier(g, x, y - (x % 3 === 0 ? 1 : 0), Object.assign({ cls, skin: 'own', face: 1, mode: 'idle', anim: 0 }, m));
    // a company is of many nations: these are of the ones it is likely to have
    if (s === 'hold') { o('pike', 12, { nation: 'scot' }); o('shot', 29, { mode: 'aim', flash: 1, nation: 'cossack' }); o('pike', 46, { nation: 'german' }); }
    else if (s === 'advance') { o('pike', 10, { moving: true, anim: 0, nation: 'pole' }); o('sabre', 27, { moving: true, anim: 1, nation: 'magyar' }); o('shot', 44, { moving: true, anim: 0, nation: 'swede' }); }
    else { o('pike', 8, { moving: true, anim: 1, level: true, nation: 'german' }); o('sabre', 36, { mode: 'fight', moving: true, anim: 0, nation: 'cossack' }); o('sabre', 51, { mode: 'fight', moving: true, anim: 1, swing: 1, nation: 'tatar' }); }
  });
}
/** A round loaf, shaded as the light from the upper left would: scored across the top, floured, its outline dark. */
function loaf(b: Pen, cx: number, cy: number, rx: number, ry: number) {
  const { m, shade } = volume([[cx, cy, rx, ry, ry * 1.2]]), tones = ['ochre1', 'ochre2', 'ochre3', 'ochre4', 'bronze5'];
  b.fill(m, (x, y) => tones[banded(shade(x, y), [0.3, 0.5, 0.68, 0.84], x, y, 0.08)]);
  for (let i = -1; i <= 1; i++) { const x = Math.round(cx + i * rx * 0.5); b.line(x - 2, Math.round(cy - ry * 0.55), x + 1, Math.round(cy + ry * 0.05), 'ochre1'); b.px(x - 3, Math.round(cy - ry * 0.6), 'bronze6'); b.px(x, Math.round(cy - ry * 0.45), 'bronze5'); }
  b.fill(mWhere(mEdgeUL(m), (x, y) => y < cy), 'bronze5');
  b.fill(mRing(m), (x, y) => (y > cy ? 'soot1' : 'ochre0'));
}
/** A powder horn: a curve of bone, wide at the stopper and thin at the tip, shaded across as a cone is, capped in bronze, from (x0, y0) to (x1, y1), bowed sideways by bow. */
function horn(b: Pen, x0: number, y0: number, x1: number, y1: number, w0: number, bow: number) {
  const mx = Math.floor(Math.min(x0, x1) - w0 - Math.abs(bow) - 4), my = Math.floor(Math.min(y0, y1) - w0 - 4), s = newPix(Math.ceil(Math.abs(x1 - x0) + 2 * w0 + 2 * Math.abs(bow) + 10), Math.ceil(Math.abs(y1 - y0) + 2 * w0 + 10), mx, my), n = 80;
  const at = (t: number) => [x0 + (x1 - x0) * t + bow * Math.sin(Math.PI * t), y0 + (y1 - y0) * t];
  const tones = ['bone0', 'bone1', 'bone2', 'bone3', 'bone4'], lx = -0.5, ly = -0.62, lz = 0.6, ln = Math.hypot(lx, ly, lz);
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = at(t), [x2, y2] = at(Math.min(1, t + 1 / n)), len = Math.hypot(x2 - x, y2 - y) || 1, nx = -(y2 - y) / len, ny = (x2 - x) / len, hw = (w0 * (1 - t) ** 0.75 + 0.8) / 2;
    for (let u = -hw; u <= hw + 0.01; u += 0.4) {
      const sh = u / hw, lit = (nx * sh * lx + ny * sh * ly + Math.sqrt(Math.max(0, 1 - sh * sh)) * lz) / ln;
      let c = tones[clamp(Math.floor(lit * 5 + 0.2), 0, 4)];
      if (t > 0.9) c = lit > 0.5 ? 'bone1' : 'bone0'; else if (Math.abs(t - 0.3) < 0.012 || Math.abs(t - 0.56) < 0.012) c = 'bone0';
      if (t < 0.09) c = lit > 0.6 ? 'bronze5' : lit > 0.3 ? 'bronze4' : 'bronze2';
      putPix(s, Math.round(x + nx * u), Math.round(y + ny * u), c);
    }
  }
  outlinePix(s, 'soot1');
  blitPix(b.p, s);
}
/** A pouch of leather with a flap, tied at the neck, hanging from a cord. */
function pouch(b: Pen, cx: number, cy: number, w: number, h: number) {
  const { m, shade } = volume([[cx, cy, w / 2, h / 2, h * 0.9]]), tones = ['skin0', 'skin1', 'skin2', 'skin3'];
  b.fill(m, (x, y) => tones[banded(shade(x, y), [0.35, 0.58, 0.8], x, y, 0.08)]);
  b.fill(mWhere(m, (x, y) => y < cy - h * 0.1 && y > cy - h * 0.25 && Math.abs(x - cx) < w * 0.45), 'skin0');
  b.rect(cx - 1, cy - Math.round(h * 0.35), 3, 3, 'bronze3'); b.px(cx - 1, cy - Math.round(h * 0.35), 'bronze5');
  b.fill(mWhere(mEdgeUL(m), (x, y) => y < cy), 'skin4'); b.fill(mRing(m), 'soot1');
  b.line(cx - 1, cy - Math.round(h * 0.5), cx - 5, cy - Math.round(h * 0.5) - 6, 'skin1'); b.line(cx + 1, cy - Math.round(h * 0.5), cx + 4, cy - Math.round(h * 0.5) - 6, 'skin1');
}
/** A rolled cloth of linen, tied: the cloth in the middle of the bread. */
function linenBundle(b: Pen, cx: number, cy: number, rx: number, ry: number) {
  const { m, shade } = volume([[cx, cy, rx, ry, ry * 1.1]]), tones = ['bone0', 'bone1', 'bone2', 'bone3', 'bone4'];
  b.fill(m, (x, y) => tones[banded(shade(x, y), [0.3, 0.5, 0.68, 0.84], x, y, 0.08)]);
  b.line(cx - rx * 0.5, cy - ry * 0.2, cx + rx * 0.3, cy + ry * 0.5, 'bone0'); b.line(cx - rx * 0.2, cy - ry * 0.6, cx + rx * 0.5, cy + ry * 0.1, 'bone1');
  b.fill(mRing(m), 'soot1');
}
/** The wall and the floor of a picture of goods: dusk-dark, a warm glow behind the goods, a floor of planks, painted in the dithered steps of the camp. */
function goodsBackdrop(p: Pix, glowX: number, glowY: number) {
  const W = p.w, H = p.h, floor = Math.round(H * 0.78);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const b = bayer(x, y);
    let c: string;
    if (y < floor) {
      c = (y / floor) ** 1.3 > b ? 'soot3' : 'soot2';
      const d = Math.hypot((x - glowX) / (W * 0.5), (y - glowY) / (H * 0.42)), a = clamp(1 - d, 0, 1) ** 1.2;
      if (a * 0.8 > b) c = 'soot4'; if (a * 0.5 > bayer(x + 2, y + 2)) c = 'bronze1';
      if (y >= floor - 2) c = b < 0.5 ? 'soot2' : 'soot1';
    } else {
      c = 'soot4';
      if ((x + (((y - floor) >> 2) % 2) * 11) % 22 === 0) c = 'soot3';
      if (y === floor) c = 'soot2'; else if (y === floor + 1) c = 'soot5';
      const d = Math.hypot((x - glowX) / (W * 0.55), (y - floor) / (H * 0.3));
      if (clamp(1 - d, 0, 1) * 0.6 > b) c = 'soot5';
      if (y > H - 7 && 0.7 * ((y - (H - 7)) / 7) > b) c = 'soot3';
    }
    putPix(p, x, y, c);
  }
}
function supplyArt(k: Supply) {
  return artURL('u' + k, 48, 36, (g, W, H) => {
    const p = newPix(W * SS, H * SS), b = penOf(p);
    goodsBackdrop(p, 48, 38);
    if (k === 'bread') {
      shadowPix(p, 48, 62, 38, 4, 'soot1', 0.6);
      for (const [x, y, rx, ry] of [[24, 40, 13, 9], [47, 33, 14, 10], [70, 40, 13, 9]]) loaf(b, x, y, rx, ry);
      loaf(b, 21, 54, 13, 8); loaf(b, 74, 54, 13, 8);
      linenBundle(b, 47, 53, 11, 8);
      b.px(43, 49, 'bone5'); b.px(44, 49, 'bone5');
    } else {
      shadowPix(p, 46, 63, 40, 4, 'soot1', 0.6);
      barrel(b, 48, 56, 24, 30); barrel(b, 23, 60, 24, 30);
      horn(b, 58, 64, 86, 38, 11, 7); pouch(b, 74, 56, 14, 11);
      b.line(30, 63, 36, 68, 'soot5'); b.line(31, 63, 37, 68, 'soot3'); b.px(30, 62, 'fire4'); b.px(30, 61, 'fire3'); b.px(29, 62, 'fire2');
    }
    g.drawImage(pixCanvas(p), 0, 0, W, H);
  });
}
// The quest's cargo (and, but for the raft, the man who guards it) for its card. frac is not used.
function questArt(q: Quest, frac?: number) {
  return artURL('q' + q.id, 72, 36, (g, W, H) => {
    landscape(g, W, H, q.id.length, PLACES[q.from].land);
    if (q.transport === 'raft') { drawCargo(g, 'raft', 16, H - 6, 1, false); return; }
    if (q.transport === 'herd') { drawCargo(g, 'herd', 6, H - 6, 1, false); drawSoldier(g, 66, H - 3, { cls: 'sabre', skin: 'own', face: -1, mode: 'idle', anim: 0, nation: 'cossack' }); return; }
    drawCargo(g, q.transport, 19, H - 9, 0.8, false);
    drawSoldier(g, 8, H - 3, { cls: q.transport === 'chest' ? 'shot' : 'pike', skin: 'own', face: 1, mode: 'idle', anim: 0, nation: q.transport === 'chest' ? 'pole' : 'german' });
  });
}
/* ---------- the pictures of the encyclopedia: lands and places, and men of a nation, a class or a people standing together ---------- */
/** A land as it looks on the field, whole, on a day of this weather. */
function landArt(land: LandId, weather: Weather = 'clear') {
  const key = 'land' + land + weather;
  return artCache[key] || (artCache[key] = backdropOf(land, 0, weather).toDataURL());
}
/** A place a fight is fought at, in a land where it is: the window of a card on it, with nobody there. */
function siteArt(site: SiteId, land: LandId) {
  return artURL('site' + site + land, 72, 36, (g, W, H) => landscape(g, W, H, 0, land, site));
}
/** Men standing together on a card's landscape: each is where he stands along the picture (scene pixels, from the left) and what he looks like. */
function squadArt(key: string, W: number, seed: number, land: LandId, men: readonly (readonly [x: number, look: SoldierLook])[]) {
  return artURL(key, W, 36, (g, w, h) => { landscape(g, w, h, seed, land); for (const [x, look] of men) drawSoldier(g, x, h - 3, look); });
}
/** The classes a nation fields, each once, in the order its Origin lists them. */
const classesOf = (o: Origin) => o.cls.filter((c, i) => o.cls.indexOf(c) === i);
// A nation of the company: one man of each class it fields, side by side, in the better kit a man comes to.
function nationArt(o: Origin, land: LandId) {
  const cs = classesOf(o), at = cs.length === 1 ? [36] : cs.length === 2 ? [20, 50] : [14, 36, 58];
  return squadArt('cn' + o.id, 72, o.id.length, land, cs.map((cls, i): [number, SoldierLook] => [at[i], { cls, skin: 'own', nation: o.id, face: 1, mode: 'idle', anim: 0, wpn: i ? 2 : 1, arm: i ? 2 : 1, man: 3 + i * 2 }]));
}
// One unit of a nation: the worst kit a man of it starts with and the best he may come to, side by side.
function unitArt(o: Origin, cls: TroopClass, land: LandId) {
  const look = (lv: number, man: number): SoldierLook => ({ cls, skin: 'own', nation: o.id, face: 1, mode: 'idle', anim: 0, wpn: lv, arm: lv, man });
  return squadArt('cu' + o.id + cls, 72, o.id.length + 1, land, [[22, look(0, 3)], [52, look(3, 8)]]);
}
// A class: four men of the nations that field it, from the worst kit to the best.
function classArt(cls: TroopClass) {
  const from = ORIGINS.filter(o => o.cls.includes(cls)).slice(0, 4);
  return squadArt('cc' + cls, 100, cls.length, 'poland', from.map((o, i): [number, SoldierLook] => [14 + i * 24, { cls, skin: 'own', nation: o.id, face: 1, mode: 'idle', anim: 0, wpn: i, arm: i, man: 3 + i * 2 }]));
}
// The armours: one sabreur in each of the four, worst to best.
function armourArt() {
  return squadArt('car', 100, 5, 'poland', [0, 1, 2, 3].map((lv): [number, SoldierLook] => [14 + lv * 24, { cls: 'sabre', skin: 'own', nation: 'pole', face: 1, mode: 'idle', anim: 0, wpn: 1, arm: lv, man: 3 + lv * 2 }]));
}
// A people met on the road: a man of each class it fields, facing the company, in the gear its degree of drill carries (see TIER).
function peopleArt(skin: Skin, classes: readonly TroopClass[], tier: number, land: LandId) {
  const at = classes.length === 1 ? [40] : classes.length === 2 ? [26, 54] : [20, 42, 64], gear = Math.max(0, tier - 1);
  return squadArt('cp' + skin + classes.join('') + tier, 72, skin.length, land, classes.map((cls, i): [number, SoldierLook] => [at[i], { cls, skin, face: -1, mode: 'idle', anim: 0, wpn: gear, arm: gear, man: 2 + i * 3 }]));
}

/** A small fire for a picture of a corner of the camp: a ring of stones, two crossed logs and three tongues of flame, at cx, cy (the middle of its foot). */
function miniFire(b: Pen, cx: number, cy: number) {
  for (const [dx, dy, front] of [[-9, -2, 0], [-6, -3, 0], [0, -4, 0], [6, -3, 0], [9, -2, 0], [-8, 2, 1], [-3, 3, 1], [3, 3, 1], [8, 2, 1]] as const) {
    const x = cx + dx, y = cy + dy;
    if (front) { b.rect(x - 1, y - 1, 3, 1, 'ochre3'); b.rect(x - 1, y, 3, 1, 'iron2'); b.rect(x - 1, y + 1, 3, 1, 'soot1'); } else { b.rect(x - 1, y - 1, 3, 1, 'iron2'); b.rect(x - 1, y, 3, 1, 'bronze3'); }
  }
  b.line(cx - 6, cy + 1, cx + 6, cy - 2, 'soot3'); b.line(cx + 6, cy + 1, cx - 6, cy - 2, 'soot3'); b.line(cx - 6, cy, cx + 6, cy - 3, 'soot2');
  flamePix(b, cx - 3, cy, 12, 6, -1.2, 0.3); flamePix(b, cx + 3, cy, 14, 6, 1.6, 0.4); flamePix(b, cx, cy + 1, 9, 8, 0.4);
  b.rect(cx - 3, cy - 2, 7, 2, 'fire5'); b.rect(cx - 2, cy - 3, 5, 1, 'fire6');
}
// A corner of the camp at night, for the cards of camp events: a dithered sky with its stars and a moon, pines against it, the earth lit by a small fire, and two men on logs.
function eventArt() {
  return artURL('night', 96, 32, (g, W, H) => {
    const w = W * SS, h = H * SS, p = newPix(w, h), b = penOf(p), horizon = 35, fx = 97, fy = 53;
    const stops = ['night0', 'night1', 'night2', 'night3', 'night4', 'night5'];
    for (let y = 0; y < horizon + 6; y++) for (let x = 0; x < w; x++) { const t = Math.min(1, y / (horizon + 2)) ** 1.5 * 5, i = Math.min(4, Math.floor(t)); putPix(p, x, y, stops[i + (t - i > bayer(x, y) ? 1 : 0)]); }
    const r = mulberry(4);
    for (let i = 0; i < 26; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * 22); putPix(p, x, y, r() < 0.25 ? 'bone4' : r() < 0.5 ? 'woad6' : 'woad4'); }
    for (const [cx, cy] of [[22, 12], [150, 9]]) { putPix(p, cx, cy, 'bone5'); putPix(p, cx - 1, cy, 'woad5'); putPix(p, cx + 1, cy, 'woad5'); putPix(p, cx, cy - 1, 'woad5'); putPix(p, cx, cy + 1, 'woad5'); }
    for (let y = 2; y < 24; y++) for (let x = 164; x < 190; x++) {
      const d = Math.hypot(x + 0.5 - 177, y + 0.5 - 12);
      if (d <= 6 && Math.hypot(x + 0.5 - 179.6, y + 0.5 - 10.2) > 5.2) putPix(p, x, y, d > 5 ? 'bone3' : 'bone4'); else if (d < 12 && clamp((12 - d) / 12, 0, 1) ** 0.8 * 0.6 > bayer(x, y)) putPix(p, x, y, 'night3');
    }
    pine(p, 8, horizon + 4, 6, 20, 5, 5, ['night1', 'night2', 'night3']); pine(p, 36, horizon + 4, 14, 22, 6, 5, ['night1', 'night2', 'night3']);
    pine(p, 150, horizon + 4, 8, 22, 7, 5, ['night1', 'night2', 'night3']); pine(p, 184, horizon + 4, 12, 20, 8, 5, ['night1', 'night2', 'night3']);
    for (let x = 0; x < w; x++) for (let y = horizon + 2; y < horizon + 6; y++) putPix(p, x, y, 'night1');
    const luts = lutsFor('night', true), pool = (x: number, y: number) => clamp(1 - Math.hypot((x - fx) / 84, (y - fy) / 40), 0, 1) ** 1.05;
    for (let y = horizon + 3; y < h; y++) for (let x = 0; x < w; x++) {
      const bb = bayer(x, y), n = fbm(x, y, 5, 6, 3, 2);
      let c = 'soot3';
      if (n < 0.4 && 0.5 > bb) c = 'soot2'; else if (n > 0.62 && 0.5 > bb) c = 'soot4';
      if (y < horizon + 6) c = 'soot1';
      const lvl = levelOf(pool(x, y) * 0.95, luts.length - 1, x, y, 1);
      putPix(p, x, y, luts[lvl].get(D(c)) ?? D(c));
    }
    for (const lx of [72, 122]) { b.rect(lx - 10, 50, 20, 5, 'soot5'); b.rect(lx - 10, 50, 20, 1, 'soot7'); b.rect(lx - 10, 54, 20, 1, 'soot2'); b.rect(lx - 11, 51, 1, 3, 'soot7'); b.fill(mRing(mRect(lx - 10, 50, 20, 5)), 'soot1'); }
    for (let i = 0; i < 18; i++) { const a = r() * 2 * Math.PI, rr = 7 + r() * 11; putPix(p, Math.floor(fx + Math.cos(a) * rr), Math.floor(fy + 1 + Math.sin(a) * rr * 0.4), r() < 0.6 ? 'fire1' : 'fire2'); }
    miniFire(b, fx, fy);
    g.drawImage(pixCanvas(p), 0, 0, W, H);
    const lit = (foot: number) => firelit(g, foot, 1, (x, y) => pool(x, y));
    drawCamper(lit(27), 36, 27, { cls: 'sabre', skin: 'own', pose: 'sit', face: 1, prop: 'bandura', nation: 'cossack' });
    drawCamper(lit(27), 61, 27, { cls: 'pike', skin: 'own', pose: 'sit', face: -1, nation: 'scot' });
  });
}

/* ---------- the camp at night: the company round its fire, each man where his order puts him ---------- */
const CW = 320, CH = 151;
/** A place in the camp: x, y at a man's feet, and the way he faces there. */
type CampSlot = readonly [x: number, y: number, face: 1 | -1];
/** Where a man is in camp: wherever his order sends him, or abed by the tent if he is wounded. */
type CampSpot = CampOrder | 'abed';
/** The slots for each spot, taken in turn by the men whose spot it is, and one for each officer, for the captain and for the retainer. */
interface CampLayout extends Readonly<Record<CampSpot, readonly CampSlot[]>> { readonly staff: Readonly<Record<StaffId, CampSlot>>; readonly captain: CampSlot; readonly retainer: CampSlot }
const CAMP: CampLayout = {
  rest: [[130, 100, 1], [141, 90, 1], [179, 90, -1], [190, 100, -1], [136, 114, 1], [184, 114, -1], [150, 124, 1], [172, 124, -1]],
  drill: [[204, 126, 1], [228, 112, 1], [274, 132, 1], [196, 142, 1], [226, 140, 1], [258, 147, -1], [288, 144, -1], [242, 129, -1]],
  forage: [[20, 130, -1], [40, 138, -1], [10, 118, -1], [59, 142, -1], [30, 146, -1], [50, 124, -1], [70, 134, -1], [16, 146, -1]],
  abed: [[103, 88, 1], [87, 95, 1], [119, 95, -1], [103, 101, 1], [88, 106, 1], [118, 107, -1], [96, 112, 1], [112, 116, -1]],
  staff: { surgeon: [124, 86, -1], drill: [252, 121, -1], qm: [76, 98, -1], chaplain: [242, 90, -1] },
  captain: [213, 87, -1], retainer: [258, 114, -1]
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
/* ---------- the dyes: the ramps that the camp, and the pictures of goods, are painted in ---------- */
/**
 * The palette, in ramps from dark to light, each cool in its shade and warm in its light: soot is the dark of the whole game, bone the linen
 * and the canvas, paper the documents, bronze and ochre the lights, fire for fire and lanterns alone. A step is named by its ramp and its
 * place in it: soot3, fire5.
 */
const RAMPS: Record<string, readonly string[]> = {
  soot: ['#0b0907', '#14100c', '#1d1711', '#2a2018', '#3a2d21', '#4e3d2c', '#67533b', '#846c4c'],
  bone: ['#6e6249', '#8f8467', '#b3a784', '#d1c5a1', '#e7ddbf', '#f4edd6'],
  paper: ['#6d5f3f', '#8d7b52', '#a8976a', '#bfae82', '#d3c498', '#e4d8b3'],
  bronze: ['#3a2a12', '#5b4219', '#80602a', '#a78039', '#cba34f', '#e8c874', '#f7e2a0'],
  madder: ['#240d0c', '#4a1816', '#6e2420', '#8f3328', '#b2493a', '#d0705a', '#e9a58b'],
  woad: ['#0e1420', '#17233a', '#233756', '#33507a', '#4b6f98', '#6f94b4', '#9dbad0'],
  moss: ['#0e130b', '#1a2411', '#2a3a1a', '#3f5524', '#587030', '#7a8e42', '#a0ae60', '#c6cf8c'],
  ochre: ['#33240c', '#563b12', '#7e571b', '#a67a27', '#cf9f3c', '#e6c15f', '#f2dc92'],
  iron: ['#101316', '#1d2227', '#2f363d', '#48515a', '#6b757e', '#939ca3', '#bec4c6', '#e3e6e2'],
  skin: ['#4a2c20', '#7a4d36', '#a5714f', '#cd9a73', '#e8bd96', '#f3d6b4'],
  night: ['#05070e', '#0a0f1c', '#101a2e', '#182742', '#233a5c', '#35527a'],
  fire: ['#4a1006', '#8a2c0e', '#c4521a', '#e8862c', '#f6b73e', '#fcdc7c', '#fff2c2'],
  teal: ['#0f2623', '#1a403b', '#2a625a', '#3f867a', '#66ac9a', '#9acfbd'],
  plum: ['#241022', '#40203c', '#5e3158', '#80487a', '#a86a9c'],
  sky: ['#4a6a82', '#6c8fa4', '#92b0bb', '#b8cac8', '#d6dccb', '#ece8cf']
};
/** Every step of every ramp by name, packed as 0xRRGGBB. */
const DYE: Record<string, number> = {};
for (const r of Object.keys(RAMPS)) RAMPS[r].forEach((h, i) => { DYE[r + i] = parseInt(h.slice(1), 16); });
/** A dye by its name (soot3), packed as 0xRRGGBB; a name that is not a dye is a mistake of the painter's, and says so. */
function D(name: string): number {
  const c = DYE[name];
  if (c === undefined) throw new Error('no dye called ' + name);
  return c;
}
const hexes = new Map<number, string>();
/** A packed colour as the #rrggbb a canvas takes. */
function hexN(c: number): string {
  let h = hexes.get(c);
  if (h === undefined) hexes.set(c, h = '#' + (c | 0x1000000).toString(16).slice(1));
  return h;
}
/** A colour (#rrggbb) packed as 0xRRGGBB. */
const packN = (hex: string) => parseInt(hex.slice(1), 16);
/** A packed colour moved the part t of the way, from 0 to 1, towards another. */
function mixN(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
/** The ordered dither: a 4 by 4 Bayer matrix, each cell a threshold between 0 and 1. Where a share of the pixels is to be lit, those whose threshold is under it are. */
const BAY = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16));
const bayer = (x: number, y: number) => BAY[((y & 3) << 2) | (x & 3)];

/* ---------- colour in perceptual terms: the lightness of a dye, and warming a colour by firelight ---------- */
/** A packed colour as OKLab: lightness, and how far it lies towards red and towards yellow. */
function oklab(c: number): [number, number, number] {
  const f = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = f(c >> 16 & 255), g = f(c >> 8 & 255), b = f(c & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/** OKLab back to a packed colour. */
function fromOklab(L: number, a: number, b: number): number {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const g = (v: number) => { v = Math.min(1, Math.max(0, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
  return (g(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) << 16) | (g(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) << 8) | g(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}
const lightness = new Map<string, number>();
/** The OKLab lightness of a dye by name, kept. */
function lightOf(name: string) {
  let l = lightness.get(name);
  if (l === undefined) lightness.set(name, l = oklab(D(name))[0]);
  return l;
}
/** The step of a ladder of dyes that is nearest in lightness to L (the darker where two are as near). */
function ladderPick(L: number, ladder: readonly string[]) {
  let best = ladder[0], bd = Infinity;
  for (const n of ladder) { const d = Math.abs(lightOf(n) - L); if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && lightOf(n) < lightOf(best))) { bd = d; best = n; } }
  return best;
}

/* ---------- light by palette: a pixel does not get brighter, it becomes the dye the light would make of it ---------- */
/** What each dye becomes at one level of light: packed colour to packed colour. */
type Lut = Map<number, number>;
/** The ramps' steps as the ramp's own names, split into the ramp and the step. */
const dyeParts = (name: string): [string, number] => { const m = /^([a-z]+)(\d+)$/.exec(name)!; return [m[1], +m[2]]; };
/**
 * How the dark of a night, the clear of a day or the low light of dusk grades each ramp: for each step of a ramp, the dye it shows as. The
 * camp is painted in these dyes as the day would see them, and the table of the hour turns them into the colours of the hour. A ramp the
 * table does not name is left as it is.
 */
type DyeGrade = Record<string, readonly string[]>;
const GRADE_NIGHT: DyeGrade = {
  soot: ['soot0', 'soot0', 'soot1', 'soot2', 'soot3', 'soot4', 'soot5', 'soot6'],
  bone: ['iron2', 'iron3', 'iron4', 'iron5', 'iron6', 'iron7'],
  paper: ['iron3', 'iron4', 'iron4', 'iron5', 'iron6', 'iron7'],
  iron: ['iron0', 'iron0', 'iron1', 'iron2', 'iron3', 'iron4', 'iron5', 'iron6'],
  moss: ['moss0', 'moss0', 'moss1', 'moss2', 'moss3', 'moss4', 'moss5', 'moss6'],
  ochre: ['soot2', 'soot4', 'soot5', 'soot6', 'soot7', 'bone1', 'bone2'],
  bronze: ['soot3', 'soot4', 'soot6', 'soot7', 'bone1', 'bone2', 'bone3'],
  madder: ['madder0', 'madder0', 'madder1', 'madder2', 'madder3', 'madder4', 'madder5'],
  woad: ['night1', 'night2', 'night3', 'night4', 'night5', 'woad4', 'woad5'],
  night: ['night0', 'night0', 'night1', 'night2', 'night3', 'night4'],
  skin: ['soot3', 'soot5', 'soot6', 'soot7', 'bone1', 'bone2'],
  teal: ['teal0', 'teal0', 'teal1', 'teal2', 'teal3', 'teal4'],
  plum: ['plum0', 'plum0', 'plum1', 'plum2', 'plum3'],
  sky: ['woad2', 'woad3', 'woad4', 'woad5', 'woad6', 'sky3']
};
const GRADE_DAY: DyeGrade = {
  soot: ['soot2', 'soot3', 'soot4', 'soot6', 'soot7', 'soot7', 'bone0', 'bone1'],
  bone: ['bone1', 'bone2', 'bone3', 'bone4', 'bone5', 'bone5'],
  paper: ['paper1', 'paper2', 'paper3', 'paper4', 'paper5', 'paper5'],
  iron: ['iron1', 'iron2', 'iron3', 'iron4', 'iron5', 'iron6', 'iron7', 'iron7'],
  moss: ['moss1', 'moss2', 'moss3', 'moss4', 'moss5', 'moss6', 'moss7', 'moss7'],
  ochre: ['ochre1', 'ochre2', 'ochre3', 'ochre4', 'ochre5', 'ochre6', 'ochre6'],
  bronze: ['bronze1', 'bronze2', 'bronze3', 'bronze4', 'bronze5', 'bronze6', 'bronze6'],
  madder: ['madder1', 'madder2', 'madder3', 'madder4', 'madder5', 'madder6', 'madder6'],
  woad: ['woad1', 'woad2', 'woad3', 'woad4', 'woad5', 'woad6', 'woad6'],
  night: ['woad1', 'woad2', 'woad3', 'woad4', 'woad5', 'woad6'],
  skin: ['skin1', 'skin2', 'skin3', 'skin4', 'skin5', 'skin5'],
  teal: ['teal1', 'teal2', 'teal3', 'teal4', 'teal5', 'teal5'],
  plum: ['plum1', 'plum2', 'plum3', 'plum4', 'plum4']
};
const GRADE_DUSK: DyeGrade = {
  soot: ['soot1', 'soot2', 'soot3', 'soot4', 'soot5', 'soot6', 'soot7', 'bone0'],
  bone: ['bone0', 'bone1', 'skin3', 'skin4', 'skin5', 'skin5'],
  paper: ['paper0', 'paper1', 'skin3', 'skin4', 'skin5', 'skin5'],
  iron: ['iron0', 'iron1', 'iron2', 'iron3', 'iron4', 'iron5', 'iron6', 'iron7'],
  moss: ['moss0', 'moss1', 'moss2', 'moss3', 'moss4', 'moss5', 'moss6', 'moss6'],
  ochre: ['ochre0', 'ochre1', 'ochre2', 'ochre3', 'ochre4', 'ochre5', 'ochre6'],
  bronze: ['bronze0', 'bronze1', 'bronze2', 'bronze3', 'bronze4', 'bronze5', 'bronze6'],
  woad: ['night1', 'night2', 'night3', 'woad2', 'woad3', 'woad4', 'woad5'],
  night: ['night0', 'night1', 'night2', 'night3', 'night4', 'night5']
};
/** The table of an hour as a lookup. */
function gradeLut(table: DyeGrade): Lut {
  const lut: Lut = new Map();
  for (const name of Object.keys(DYE)) {
    const [r, i] = dyeParts(name), row = table[r];
    lut.set(D(name), row ? D(row[Math.min(i, row.length - 1)]) : D(name));
  }
  return lut;
}
/** The dyes a lit ground and lit things turn to, from the dark soot up through bronze and ochre to the white of fire (warm, never yellow-green). */
const WARM_LADDER = ['soot0', 'soot1', 'soot2', 'soot3', 'soot4', 'soot5', 'bronze1', 'ochre2', 'bronze2', 'ochre3', 'bronze3', 'ochre4', 'bronze4', 'ochre5', 'bronze5', 'ochre6', 'bronze6', 'fire6'];
/** Firelit canvas, linen and paper turn peach rather than yellow. */
const CANVAS_LADDER = ['soot4', 'soot5', 'soot6', 'bone0', 'bone1', 'paper2', 'skin3', 'skin4', 'skin5'];
/** How far up its own ramp a red or a green goes in each level of firelight, which keeps its hue. */
const WARM_SHIFT: Record<string, readonly number[]> = { madder: [0, 1, 2, 3], moss: [0, 1, 1, 2] };
/** Each level of firelight as a gain on the lightness of a dye and an offset to it: one for the things that stand, one for the ground, which has more levels to rise through. */
const FIRE_LEVELS: readonly (readonly [number, number])[] = [[0.86, 0], [1.1, 0.02], [1.4, 0.04], [1.8, 0.08]];
const GROUND_LEVELS: readonly (readonly [number, number])[] = [[0.86, 0], [0.98, 0.01], [1.12, 0.02], [1.28, 0.03], [1.46, 0.045], [1.66, 0.06]];
/** The luts of firelight for these levels: [the grade of the hour, level 1 ... level n]. */
function lightLuts(ambient: Lut, levels: readonly (readonly [number, number])[]): Lut[] {
  const luts: Lut[] = [ambient];
  levels.forEach(([gain, off], k) => {
    const lut: Lut = new Map();
    for (const name of Object.keys(DYE)) {
      const [r, i] = dyeParts(name);
      let to = name;
      if (r === 'fire') to = name;
      else if (WARM_SHIFT[r]) {
        const sh = WARM_SHIFT[r], n = RAMPS[r].length;
        const j = Math.min(n - 1, i + sh[Math.min(sh.length - 1, Math.floor(k * sh.length / levels.length))]);
        to = r + j;
        if (k === levels.length - 1 && r === 'madder' && j >= 5) to = 'fire2';
      } else if (r === 'bone' || r === 'paper') to = ladderPick(Math.min(0.97, lightOf(name) * gain * 1.1 + off), CANVAS_LADDER);
      else to = ladderPick(Math.min(0.97, lightOf(name) * gain + off), WARM_LADDER);
      lut.set(D(name), D(to));
    }
    luts.push(lut);
  });
  return luts;
}
/* ---------- the raster: the camp is painted pixel by pixel, in fine pixels (SS to a scene pixel) ---------- */
/** A raster of fine pixels, four bytes each, clear until painted. ox, oy is where its corner lies in the picture's own pixels, so a part of the picture can be painted on a small raster in the picture's coordinates. */
interface Pix { w: number; h: number; ox: number; oy: number; d: Uint8ClampedArray }
const newPix = (w: number, h: number, ox = 0, oy = 0): Pix => ({ w, h, ox, oy, d: new Uint8ClampedArray(w * h * 4) });
const dyeIn = (c: number | string) => (typeof c === 'string' ? D(c) : c);
/** Sets one pixel (the picture's own x and y, whole numbers) to a dye, or a packed colour. */
function putPix(p: Pix, x: number, y: number, c: number | string) {
  x -= p.ox; y -= p.oy;
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  const k = dyeIn(c), i = (y * p.w + x) * 4;
  p.d[i] = (k >> 16) & 255; p.d[i + 1] = (k >> 8) & 255; p.d[i + 2] = k & 255; p.d[i + 3] = 255;
}
/** The colour at a pixel (packed), or -1 where it is clear or off the raster. */
function getPix(p: Pix, x: number, y: number) {
  x -= p.ox; y -= p.oy;
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return -1;
  const i = (y * p.w + x) * 4;
  return p.d[i + 3] ? (p.d[i] << 16) | (p.d[i + 1] << 8) | p.d[i + 2] : -1;
}
/** A raster's colours drawn on top of another's, where they are not clear. */
function blitPix(to: Pix, from: Pix) {
  for (let y = 0; y < from.h; y++) for (let x = 0; x < from.w; x++) {
    const i = (y * from.w + x) * 4;
    if (!from.d[i + 3]) continue;
    const X = x + from.ox - to.ox, Y = y + from.oy - to.oy;
    if (X < 0 || Y < 0 || X >= to.w || Y >= to.h) continue;
    const j = (Y * to.w + X) * 4;
    to.d[j] = from.d[i]; to.d[j + 1] = from.d[i + 1]; to.d[j + 2] = from.d[i + 2]; to.d[j + 3] = 255;
  }
}
/** A raster made into a canvas of its own pixels. */
function pixCanvas(p: Pix) {
  const c = document.createElement('canvas'); c.width = p.w; c.height = p.h;
  const g = c.getContext('2d')!, im = g.createImageData(p.w, p.h);
  im.data.set(p.d); g.putImageData(im, 0, 0);
  return c;
}

/* ----- shapes as masks: the pixels a shape covers, on a box of its own ----- */
/** The pixels a shape covers: a box (x0, y0, w, h) and a byte for each pixel of it, 1 where the shape is. */
interface Mk { x0: number; y0: number; w: number; h: number; a: Uint8Array }
const mkOf = (x0: number, y0: number, w: number, h: number): Mk => ({ x0, y0, w: Math.max(0, w), h: Math.max(0, h), a: new Uint8Array(Math.max(0, w) * Math.max(0, h)) });
const mAt = (m: Mk, x: number, y: number) => (x >= m.x0 && y >= m.y0 && x < m.x0 + m.w && y < m.y0 + m.h ? m.a[(y - m.y0) * m.w + (x - m.x0)] : 0);
/** The mask of a polygon, its corners as x, y, x, y ... (a pixel is in it where its centre is). */
function mPoly(pts: readonly number[]): Mk {
  let lo = Infinity, hi = -Infinity, l = Infinity, r = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { l = Math.min(l, pts[i]); r = Math.max(r, pts[i]); lo = Math.min(lo, pts[i + 1]); hi = Math.max(hi, pts[i + 1]); }
  const x0 = Math.floor(l) - 1, y0 = Math.floor(lo) - 1, m = mkOf(x0, y0, Math.ceil(r) + 2 - x0, Math.ceil(hi) + 2 - y0), n = pts.length;
  for (let y = y0; y < y0 + m.h; y++) {
    const xs: number[] = [], yc = y + 0.5;
    for (let i = 0; i < n; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % n], by = pts[(i + 3) % n];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.floor(xs[k] + 0.5); x < Math.floor(xs[k + 1] + 0.5); x++) if (x >= x0 && x < x0 + m.w) m.a[(y - y0) * m.w + x - x0] = 1;
  }
  return m;
}
/** The mask of an ellipse. */
function mEll(cx: number, cy: number, rx: number, ry: number): Mk {
  const x0 = Math.floor(cx - rx) - 1, y0 = Math.floor(cy - ry) - 1, m = mkOf(x0, y0, Math.ceil(rx * 2) + 3, Math.ceil(ry * 2) + 3);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (((x0 + x + 0.5 - cx) / rx) ** 2 + ((y0 + y + 0.5 - cy) / ry) ** 2 <= 1) m.a[y * m.w + x] = 1;
  return m;
}
function mRect(x: number, y: number, w: number, h: number): Mk { const m = mkOf(x, y, w, h); m.a.fill(1); return m; }
/** A mask with only the pixels that pass a test. */
function mWhere(m: Mk, f: (x: number, y: number) => boolean): Mk {
  const o = mkOf(m.x0, m.y0, m.w, m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.a[y * m.w + x] && f(m.x0 + x, m.y0 + y)) o.a[y * m.w + x] = 1;
  return o;
}
/** The two together. */
function mOr(a: Mk, b: Mk): Mk {
  const x0 = Math.min(a.x0, b.x0), y0 = Math.min(a.y0, b.y0), o = mkOf(x0, y0, Math.max(a.x0 + a.w, b.x0 + b.w) - x0, Math.max(a.y0 + a.h, b.y0 + b.h) - y0);
  for (const m of [a, b]) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.a[y * m.w + x]) o.a[(y + m.y0 - y0) * o.w + x + m.x0 - x0] = 1;
  return o;
}
/** The pixels of a that are not in b. */
const mWithout = (a: Mk, b: Mk) => mWhere(a, (x, y) => !mAt(b, x, y));
/** A mask moved by dx, dy (pixels that were at x, y are at x + dx, y + dy). */
function mShift(m: Mk, dx: number, dy: number): Mk { return { x0: m.x0 + dx, y0: m.y0 + dy, w: m.w, h: m.h, a: m.a }; }
/** The pixels just outside a mask, over its four sides. */
function mRing(m: Mk): Mk {
  const o = mkOf(m.x0 - 1, m.y0 - 1, m.w + 2, m.h + 2);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    const X = o.x0 + x, Y = o.y0 + y;
    if (!mAt(m, X, Y) && (mAt(m, X - 1, Y) || mAt(m, X + 1, Y) || mAt(m, X, Y - 1) || mAt(m, X, Y + 1))) o.a[y * o.w + x] = 1;
  }
  return o;
}
/** The pixels of a mask on its upper left rim (the side the moon is on): those with nothing of the mask to the left of them or above. */
const mEdgeUL = (m: Mk) => mWhere(m, (x, y) => !mAt(m, x - 1, y) || !mAt(m, x, y - 1));
/** The pixels of a mask with nothing of it below. */
const mEdgeBottom = (m: Mk) => mWhere(m, (x, y) => !mAt(m, x, y + 1));
/** What colours a pixel of a mask: a dye, or a function of where the pixel is that gives one (or -1 to leave it). */
type Tint = number | string | ((x: number, y: number) => number | string);
/** Paints a mask on a raster; a share (amount, 0 to 1) of its pixels if given, picked by the ordered dither. */
function fillMk(p: Pix, m: Mk, tint: Tint, amount?: number | ((x: number, y: number) => number)) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!m.a[y * m.w + x]) continue;
    const X = m.x0 + x, Y = m.y0 + y;
    if (amount !== undefined && (typeof amount === 'number' ? amount : amount(X, Y)) <= bayer(X, Y)) continue;
    const c = typeof tint === 'function' ? tint(X, Y) : tint;
    if (typeof c === 'number' && c < 0) continue;
    putPix(p, X, Y, c);
  }
}
/** Which of the bands, cut at the values in cuts, a value falls in, the cuts a little ragged by the dither (jitter) so that the bands meet in a pattern, not a line. */
function banded(v: number, cuts: readonly number[], x: number, y: number, jitter: number) {
  v += (bayer(x, y) - 0.5) * jitter;
  let i = 0;
  for (const c of cuts) if (v > c) i++;
  return i;
}

/* ----- lines, ellipses, polygons and little pictures painted straight on a raster ----- */
function rectPix(p: Pix, x: number, y: number, w: number, h: number, c: number | string) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) putPix(p, x + i, y + j, c); }
function linePix(p: Pix, x0: number, y0: number, x1: number, y1: number, c: number | string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 2000; i++) {
    putPix(p, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
/** A little picture from rows of characters, its corner at x, y: each character is a dye of key, a dot or a space is clear. */
function stampPix(p: Pix, rows: readonly string[], key: Readonly<Record<string, string>>, x: number, y: number, flip = false) {
  rows.forEach((row, j) => { const r = flip ? row.split('').reverse().join('') : row; for (let i = 0; i < r.length; i++) if (r[i] !== '.' && r[i] !== ' ') putPix(p, x + i, y + j, key[r[i]]); });
}
/** A hard-edged shadow on the ground: a solid core and a rim of every other pixel. */
function shadowPix(p: Pix, cx: number, cy: number, rx: number, ry: number, c: number | string = 'soot1', solid = 0.5) {
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if ((d <= solid || (d <= 1 && (x + y) % 2 === 0)) && getPix(p, x, y) >= 0) putPix(p, x, y, c);
  }
}
/** A one pixel outline round whatever a raster has painted (on the sides where pick, if given, says a colour for the pixel). */
function outlinePix(p: Pix, pick: number | string | ((x: number, y: number) => number | string)) {
  const hit: number[] = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (p.d[(y * p.w + x) * 4 + 3]) continue;
    const X = x + p.ox, Y = y + p.oy;
    if (getPix(p, X - 1, Y) >= 0 || getPix(p, X + 1, Y) >= 0 || getPix(p, X, Y - 1) >= 0 || getPix(p, X, Y + 1) >= 0) hit.push(X, Y);
  }
  for (let i = 0; i < hit.length; i += 2) { const c = typeof pick === 'function' ? pick(hit[i], hit[i + 1]) : pick; if (!(typeof c === 'number' && c < 0)) putPix(p, hit[i], hit[i + 1], c); }
}

/* ----- noise, seeded: the camp's ground is not random, it is the same earth every time ----- */
/** A lattice of seeded values in 0 to 1, cols by rows of them, for value noise (the hash of a cell, not of a point, so that it is done once for each cell). */
function noiseLattice(seed: number, cols: number, rows: number) {
  const t = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let n = Math.imul(i + 374761393, 668265263) ^ Math.imul(j + 1274126177, 2246822519) ^ Math.imul(seed + 1013904223, 3266489917);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    t[j * cols + i] = ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  return t;
}
/**
 * Seeded value noise as a function of x, y (0 to 1) over a picture up to 704 by 320 fine pixels, and 64 beyond its top and left: a lattice of seeded values smoothly joined, its features sx across and sy
 * down, at octaves scales, each half the size and half the weight of the one before. It has all it needs inside it, so that a painter may ask for it at every pixel.
 */
function noiseOf(seed: number, sx: number, sy: number, octaves = 3): (x: number, y: number) => number {
  const lat: { t: Float32Array; cols: number; k: number }[] = [];
  for (let o = 0; o < octaves; o++) { const k = 2 ** o, cols = Math.ceil((704 + 64) * k / sx) + 3, rows = Math.ceil((320 + 64) * k / sy) + 3; lat.push({ t: noiseLattice(seed + o * 17, cols, rows), cols, k }); }
  let tot = 0, amp = 1;
  for (let o = 0; o < octaves; o++) { tot += amp; amp *= 0.5; }
  const floor = Math.floor;
  return (x, y) => {
    let n = 0, amp = 1;
    for (let o = 0; o < octaves; o++) {
      const { t, cols, k } = lat[o], gx = (x + 64) * k / sx, gy = (y + 64) * k / sy, ix = floor(gx), iy = floor(gy), fx = gx - ix, fy = gy - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), i = iy * cols + ix;
      n += ((t[i] * (1 - u) + t[i + 1] * u) * (1 - v) + (t[i + cols] * (1 - u) + t[i + cols + 1] * u) * v) * amp; amp *= 0.5;
    }
    return n / tot;
  };
}
const noises = new Map<string, (x: number, y: number) => number>();
/** The noise of these features, kept. */
function noiseFor(seed: number, sx: number, sy: number, octaves: number) {
  const key = seed + ',' + sx + ',' + sy + ',' + octaves;
  let f = noises.get(key);
  if (!f) noises.set(key, f = noiseOf(seed, sx, sy, octaves));
  return f;
}
/** Value noise at x, y (0 to 1): its features sx across and sy down. */
function vnoise(x: number, y: number, seed: number, sx: number, sy: number) { return noiseFor(seed, sx, sy, 1)(x, y); }
/** The same at several scales, each half the size and half the weight of the one before. */
function fbm(x: number, y: number, seed: number, sx: number, sy: number, octaves = 3) { return noiseFor(seed, sx, sy, octaves)(x, y); }
/* ---------- the light of a day, and the sky it falls on ---------- */
/**
 * The light of a day passing over the camp, at q from 0 (the night the camp is drawn at) round to 1 (the next): d is how much daylight there is,
 * w the glow of dawn and dusk, sun how far along its arc the sun is (null while it is down) and moon how bright the moon.
 */
interface Light { d: number; w: number; sun: number | null; moon: number }
const NIGHT_LIGHT: Light = { d: 0, w: 0, sun: null, moon: 1 };
function lightAt(q: number): Light {
  const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const d = sm(0.12, 0.34, q) * (1 - sm(0.66, 0.88, q)), sq = (q - 0.14) / 0.72;
  return { d, w: Math.min(1, Math.max(0, 1 - Math.abs(q - 0.22) / 0.12) + Math.max(0, 1 - Math.abs(q - 0.78) / 0.12)), sun: sq > 0 && sq < 1 ? sq : null, moon: 1 - d };
}

/** The camp's picture is CW by CH scene pixels, drawn FW by FH fine ones (SS to the scene pixel, which figures.ts, loaded after this, declares as 2). */
const FW = CW * 2, FH = CH * 2;
/** The sky is the top SKY_H fine rows; the ground and the horizon are in front of the rest. */
const SKY_H = 160;
const MOON_X = 104, MOON_Y = 34;
/** The seven stops of the sky from the zenith to the horizon: by night, by day, and in the glow of dawn and dusk. The sky of an hour is a mix of the three. */
const SKY_NIGHT = ['night0', 'night1', 'night2', 'night3', 'night4', 'night5', 'woad4'].map(D);
const SKY_DAY = ['woad3', 'woad4', 'sky1', 'sky2', 'sky3', 'sky4', 'sky5'].map(D);
const SKY_GLOW = ['night3', 'night4', 'plum2', 'madder4', 'fire2', 'fire4', 'fire5'].map(D);
/** The thin clouds: the colour of the edge the moon lights, of the body and of the underside. */
const CLOUD_NIGHT = ['night4', 'night3', 'night2'].map(D);
const CLOUD_DAY = ['bone5', 'bone4', 'sky3'].map(D);
const CLOUD_GLOW = ['fire4', 'plum3', 'plum2'].map(D);

let skyIdx: Uint8Array | null = null, skyCloud: Uint8Array | null = null;
/** Which stop each pixel of the sky takes (the dither is fixed, so that the sky can change colour without being laid out again) and where the clouds are, as 1, 2 or 3 for their edge, body and underside. */
function skyMaps() {
  if (skyIdx && skyCloud) return { idx: skyIdx, cloud: skyCloud };
  const idx = skyIdx = new Uint8Array(FW * SKY_H), cloud = skyCloud = new Uint8Array(FW * SKY_H);
  for (let y = 0; y < SKY_H; y++) {
    const t = Math.min(6 - 1e-6, Math.min(1, y / 154) ** 1.55 * 6), i = Math.floor(t), f = t - i;
    for (let x = 0; x < FW; x++) idx[y * FW + x] = i + (f > bayer(x, y) ? 1 : 0);
  }
  const streak = (y0: number, x0: number, x1: number, thick: number, seed: number, tilt: number) => {
    for (let x = x0; x < x1; x++) {
      const env = Math.sin(Math.PI * (x - x0) / (x1 - x0)) ** 0.8, th = thick * env * (0.35 + fbm(x, 0, seed, 38, 1e4, 3));
      if (th < 0.7) continue;
      const yc = y0 + tilt * (x - x0) + 2.2 * Math.sin(x / 31 + seed), top = yc - th * 0.42 - 0.8 * fbm(x, 0, seed + 5, 12, 1e4, 2), bot = yc + th * 0.58;
      for (let y = Math.round(top); y <= Math.round(bot); y++) {
        if (y < 14 || y >= 118) continue;
        const rel = (y - top) / Math.max(1, bot - top), lit = clamp(1 - Math.hypot(x - MOON_X, y - MOON_Y) / 230, 0, 1), b = bayer(x, y);
        let tone = 2;
        if (rel < 0.3 && lit > 0.15 && b < lit * 1.3) tone = 1;
        if (rel > 0.82) tone = b < 0.5 ? 3 : 2;
        if (rel < 0.1 && b > 0.5 + 0.4 * lit) continue;
        cloud[y * FW + x] = tone;
      }
    }
  };
  streak(60, 4, 250, 8, 3, 0.02); streak(82, 400, 636, 7, 8, -0.03); streak(96, 120, 214, 4, 12, 0); streak(44, 470, 590, 4, 15, 0);
  return { idx, cloud };
}
const skyCache = new Map<string, HTMLCanvasElement>();
/** The sky as the light has it: a dithered fall from the zenith to the horizon, and its clouds. Kept, by tenths of a tenth of the light. */
function skyCanvas(L: Light) {
  const qd = Math.round(L.d * 20) / 20, qw = Math.round(L.w * 20) / 20, key = qd + ',' + qw;
  let c = skyCache.get(key);
  if (c) return c;
  const { idx, cloud } = skyMaps(), gw = qw * 0.6 * (1 - 0.4 * qd);
  const stops = SKY_NIGHT.map((n, i) => mixN(mixN(n, SKY_DAY[i], qd), SKY_GLOW[i], gw)), cl = CLOUD_NIGHT.map((n, i) => mixN(mixN(n, CLOUD_DAY[i], qd), CLOUD_GLOW[i], gw));
  const p = newPix(FW, SKY_H);
  for (let i = 0; i < FW * SKY_H; i++) {
    const k = cloud[i] ? cl[cloud[i] - 1] : stops[idx[i]];
    p.d[i * 4] = (k >> 16) & 255; p.d[i * 4 + 1] = (k >> 8) & 255; p.d[i * 4 + 2] = k & 255; p.d[i * 4 + 3] = 255;
  }
  if (skyCache.size > 48) skyCache.clear();
  skyCache.set(key, c = pixCanvas(p));
  return c;
}
/** The horizon's own colour for this light, for the strip the sky does not reach. */
function horizonOf(L: Light) {
  const qd = Math.round(L.d * 20) / 20, qw = Math.round(L.w * 20) / 20;
  return mixN(mixN(SKY_NIGHT[6], SKY_DAY[6], qd), SKY_GLOW[6], qw * 0.6 * (1 - 0.4 * qd));
}

let moonCanvas: HTMLCanvasElement | null = null;
/** The moon: a crescent in a halo of dithered rings, on a raster of its own. */
function moonSprite() {
  if (moonCanvas) return moonCanvas;
  const p = newPix(84, 84, MOON_X - 42, MOON_Y - 42);
  for (let y = p.oy; y < p.oy + 84; y++) for (let x = p.ox; x < p.ox + 84; x++) {
    const d = Math.hypot(x + 0.5 - MOON_X, y + 0.5 - MOON_Y), b = bayer(x, y);
    for (const [rad, col, amt] of [[34, 'night3', 0.55], [25, 'night4', 0.55], [17, 'night5', 0.6], [13, 'woad3', 0.9]] as const)
      if (d < rad && clamp((rad - d) / rad, 0, 1) ** 0.8 * amt * 1.4 > b) putPix(p, x, y, col);
    const outer = d <= 11.2, inner = Math.hypot(x + 0.5 - (MOON_X + 4.4), y + 0.5 - (MOON_Y - 3.4)) <= 9.8;
    if (outer && !inner) putPix(p, x, y, Math.hypot(x + 0.5 - (MOON_X + 3.8), y + 0.5 - (MOON_Y - 2.8)) > 10.6 && d <= 10.4 ? 'bone4' : 'bone3');
    else if (outer && inner && (x + y) % 2 === 0 && 0.7 > b) putPix(p, x, y, 'night3');
  }
  return (moonCanvas = pixCanvas(p));
}
/** The sun by day, pale, and at the ends of the day, as the low sun is, in the colours of fire: a disc in two rings of dithered halo. */
const sunCanvases: Record<string, HTMLCanvasElement> = {};
function sunSprite(low: boolean) {
  const key = low ? 'low' : 'high';
  if (sunCanvases[key]) return sunCanvases[key];
  const R = 28, p = newPix(R * 2, R * 2, 0, 0), halo = low ? ['fire3', 'fire4'] : ['bronze5', 'ochre6'], core = low ? ['fire5', 'fire6'] : ['bone4', 'bone5'];
  for (let y = 0; y < R * 2; y++) for (let x = 0; x < R * 2; x++) {
    const d = Math.hypot(x + 0.5 - R, y + 0.5 - R), b = bayer(x, y);
    if (d <= 12) putPix(p, x, y, d <= 10 ? core[1] : core[0]);
    else if (d < 18 && clamp((18 - d) / 6, 0, 1) * 0.9 + 0.1 > b) putPix(p, x, y, halo[1]);
    else if (d < R && clamp((R - d) / 10, 0, 1) ** 1.2 * 0.55 > b) putPix(p, x, y, halo[0]);
  }
  return (sunCanvases[key] = pixCanvas(p));
}

/** A star of the night sky at x, y (scene pixels, in halves). Those whose phase k is under 2 twinkle (see drawCamp); a big one is a cross. c is its colour and arm the colour of the arms of a cross. */
interface CampStar { x: number; y: number; k: number; big: boolean; c: number; arm: number }
/** The camp's ground (the hills, the tents and all that stands on it, with the sky left clear) keeps its stars, for campSky to paint and drawCamp to twinkle. */
interface HTMLCanvasElement { stars?: CampStar[]; bake?: CampBake }
/** The stars of a night: a hundred or so, none close to another or to the moon, a few of them crosses, thickest high up. */
function campStars(seed: number) {
  const r = mulberry(seed), stars: CampStar[] = [], placed: number[][] = [];
  for (let tries = 0; tries < 4000 && stars.length < 112; tries++) {
    const y = 2 + Math.floor(128 * r() ** 1.4), x = 2 + Math.floor(r() * (FW - 4));
    if (Math.hypot(x - MOON_X, y - MOON_Y) < 17 || placed.some(q => Math.hypot(q[0] - x, q[1] - y) < 6)) continue;
    placed.push([x, y]);
    const i = stars.length, q = r(), haze = y / 128;
    let c: number, arm = -1;
    if (i < 6) { c = D(i < 4 ? 'bone4' : 'bone5'); arm = D(i < 4 ? 'woad5' : 'woad6'); } else if (q < 0.14) c = D('bone4'); else if (q < 0.42) c = D(haze < 0.75 ? 'woad6' : 'woad5'); else c = D(haze < 0.8 ? 'woad4' : 'night5');
    stars.push({ x: x / SS, y: y / SS, k: r() * 6, big: i < 6, c, arm });
  }
  return stars;
}
/** The sky over the camp: its fall from the zenith, its clouds, its stars, the moon and, by day, the sun, as the light has them. At night it is the sky the camp was always drawn under. */
function campSky(g: CanvasRenderingContext2D, stars: readonly CampStar[], L: Light) {
  g.fillStyle = hexN(horizonOf(L)); g.fillRect(0, SKY_H / SS - 1, CW, CH - SKY_H / SS + 1);
  g.drawImage(skyCanvas(L), 0, 0, CW, SKY_H / SS);
  const fade = 1 - clamp(L.d * 2.4, 0, 1);
  if (fade > 0.02) for (const s of stars) {
    if (s.k / 6 >= fade) continue;
    g.fillStyle = hexN(s.c); g.fillRect(s.x, s.y, 1 / SS, 1 / SS);
    if (s.big) { g.fillStyle = hexN(s.arm); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.fillRect(s.x + dx / SS, s.y + dy / SS, 1 / SS, 1 / SS); }
  }
  if (L.moon > 0.02) { g.globalAlpha = L.moon; g.drawImage(moonSprite(), (MOON_X - 42) / SS, (MOON_Y - 42) / SS, 84 / SS, 84 / SS); g.globalAlpha = 1; }
  if (L.sun !== null) {
    const x = 300 - 280 * L.sun, y = 78 - 64 * Math.sin(Math.PI * L.sun);
    g.drawImage(sunSprite(Math.sin(Math.PI * L.sun) < 0.5), x - 14, y - 14, 28, 28);
  }
}
/* ---------- the camp painted: far, ground, what stands on the ground, and what is painted last ---------- */
/**
 * The camp in its layers, each a raster of FW by FH fine pixels painted in the dyes of the day: the far trees; the ground, lit by the fire by its
 * place on the ground; the things that stand on it, each lit by how near the fire it stands and how high; and what is painted after the light
 * (the doors of the tents, the banner, the lantern; and, as late painters, whatever must keep its own colours in the dark, as the oxen do). pl is the firelight on each pixel of what stands, from 0 to 1.
 */
interface CampLayers { far: Pix; gnd: Pix; props: Pix; fin: Pix; pl: Float32Array; doors: CampDoor[]; lantern: [number, number] | null; late: ((out: Pix, mode: CampMode) => void)[] }
/** A tent's door, as the mask of its opening and where it stands. */
interface CampDoor { m: Mk; top: number; base: number; cx: number }
/** Where the fire is on the ground, and how the light falls off from it: an ellipse a little over half as tall as it is wide, as ground goes into the distance. */
const FIRE_X = 320, FIRE_Y = 200, R_GROUND = 180, R_RATIO = 0.55, R_POW = 1.05;
/** The firelight on the ground at x, y of the picture, from 0 to 1. */
const falloff = (x: number, y: number) => { const d = (((x + 0.5 - FIRE_X) / R_GROUND) ** 2 + ((y + 0.5 - FIRE_Y) / (R_GROUND * R_RATIO)) ** 2) ** 0.5; return d >= 1 ? 0 : (1 - d) ** R_POW; };
/** How a thing is painted: a pen with the painters of a raster. */
function penOf(p: Pix) {
  return {
    p, px: (x: number, y: number, c: number | string) => putPix(p, x, y, c),
    rect: (x: number, y: number, w: number, h: number, c: number | string) => rectPix(p, x, y, w, h, c),
    line: (x0: number, y0: number, x1: number, y1: number, c: number | string) => linePix(p, x0, y0, x1, y1, c),
    fill: (m: Mk, t: Tint, a?: number | ((x: number, y: number) => number)) => fillMk(p, m, t, a),
    stamp: (rows: readonly string[], key: Readonly<Record<string, string>>, x: number, y: number, flip = false) => stampPix(p, rows, key, x, y, flip)
  };
}
type Pen = ReturnType<typeof penOf>;
/**
 * Stands a thing on the ground: paints it on a raster of its own over the box x0, y0, x1, y1 (with a pixel to spare all round, for its outline),
 * and lays it on the layer of what stands. Its foot is at baseY and it is hmax tall at most; face (a number, or a function of x) is how much
 * of it turns to the fire. The firelight on each pixel of it is the fire's at its foot, less with height, more on the side that faces the fire.
 */
function standProp(L: CampLayers, box: readonly [number, number, number, number], baseY: number, hmax: number, face: number | ((x: number) => number), paint: (b: Pen) => void) {
  const [x0, y0, x1, y1] = box, s = newPix(x1 - x0, y1 - y0, x0, y0);
  paint(penOf(s));
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = (y * s.w + x) * 4;
    if (!s.d[i + 3]) continue;
    const X = x + x0, Y = y + y0;
    if (X < 0 || Y < 0 || X >= FW || Y >= FH) continue;
    const j = Y * FW + X, f = clamp(typeof face === 'number' ? face : face(X + 0.5), 0, 1.5);
    L.props.d[j * 4] = s.d[i]; L.props.d[j * 4 + 1] = s.d[i + 1]; L.props.d[j * 4 + 2] = s.d[i + 2]; L.props.d[j * 4 + 3] = 255;
    L.pl[j] = clamp((falloff(X, baseY) * clamp(1 - (baseY > Y ? baseY - Y : 0) / hmax, 0, 1) ** 0.8 * f - 0.1) / 0.9, 0, 1);
  }
}

/* ----- the ground ----- */
/** The first row the ground fields cover. */
const GY0 = 140;
interface GroundFields { n: Float32Array; n2: Float32Array; wob: Float32Array; gcov: Float32Array; path: Float32Array; rut: Uint8Array; top: Int16Array }
let groundFields: GroundFields | null = null;
/** The distance, in the squashed measure of the ground and as a share of the half width of a track, to the nearest of a set of tracks (each a run of points x, y, width). */
function trackField(f: Float32Array, pts: readonly (readonly [number, number, number])[]) {
  for (let s = 0; s + 1 < pts.length; s++) {
    const [xa, ya, wa] = pts[s], [xb, yb, wb] = pts[s + 1], n = Math.floor(Math.max(Math.abs(xb - xa), Math.abs(yb - ya))) + 1;
    for (let k = 0; k <= n; k++) {
      const t = k / Math.max(1, n), cx = xa + (xb - xa) * t, cy = ya + (yb - ya) * t, w = wa + (wb - wa) * t;
      for (let y = Math.max(GY0, Math.floor(cy - w * 0.55 - 2)); y < Math.min(FH, Math.floor(cy + w * 0.55 + 3)); y++) for (let x = Math.max(0, Math.floor(cx - w - 2)); x < Math.min(FW, Math.floor(cx + w + 3)); x++) {
        const d = Math.hypot((x + 0.5 - cx) / w, (y + 0.5 - cy) / (w * 0.5)), i = (y - GY0) * FW + x;
        if (d < f[i]) f[i] = d;
      }
    }
  }
}
/** The noise of the earth and its tracks, worked out once: they are the same in every camp. */
function earthFields() {
  if (groundFields) return groundFields;
  const rows = FH - GY0, size = FW * rows, n = new Float32Array(size), n2 = new Float32Array(size), wob = new Float32Array(size), gcov = new Float32Array(size), path = new Float32Array(size).fill(9), rut = new Uint8Array(size);
  const top = new Int16Array(FW), ridge = noiseOf(9, 90, 1e4, 3), nGrain = noiseOf(5, 9, 3.2, 3), nDrift = noiseOf(8, 90, 26, 2), nWob = noiseOf(21, 16, 7, 2), nCover = noiseOf(33, 38, 12, 3);
  for (let x = 0; x < FW; x++) top[x] = Math.round(148.5 + 2.6 * 2 * (ridge(x, 0) - 0.5));
  for (let y = 0; y < rows; y++) for (let x = 0; x < FW; x++) {
    const i = y * FW + x, Y = y + GY0;
    n[i] = nGrain(x, Y); n2[i] = nDrift(x, Y); wob[i] = (nWob(x, Y) - 0.5) * 0.3;
    const away = clamp(((((x - 320) / 150) ** 2 + ((Y - 205) / 70) ** 2) ** 0.5 - 0.9) / 1.2, 0, 1);
    gcov[i] = nCover(x, Y) * 0.55 + away * 0.55;
  }
  // the tracks: door to fire, fire to the forage ground, the road to the signpost and the right edge, the way out to the left
  const tracks: (readonly [number, number, number])[][] = [
    [[262, 183, 7], [240, 176, 6], [226, 171, 6]], [[380, 196, 7], [398, 178, 6], [410, 168, 6]],
    [[300, 236, 9], [262, 252, 11], [214, 272, 14], [170, 302, 18]], [[335, 232, 9], [372, 258, 11], [392, 280, 13], [402, 302, 16]],
    [[640, 222, 15], [590, 232, 15], [540, 242, 13], [494, 252, 12], [452, 262, 13], [424, 276, 15], [410, 302, 18]], [[150, 214, 7], [100, 222, 8], [50, 216, 9], [0, 212, 9]]
  ];
  for (const t of tracks) trackField(path, t);
  const ruts: number[][][] = [[[640, 218], [590, 228], [540, 238], [494, 248], [452, 258], [424, 272], [410, 302]], [[640, 227], [590, 237], [540, 246], [494, 256], [452, 267], [424, 282], [414, 302]]];
  for (const r of ruts) for (let s = 0; s + 1 < r.length; s++) {
    const [xa, ya] = r[s], [xb, yb] = r[s + 1], m = Math.max(Math.abs(xb - xa), Math.abs(yb - ya));
    for (let k = 0; k <= m; k++) { const x = Math.round(xa + (xb - xa) * k / m), y = Math.round(ya + (yb - ya) * k / m); if (y >= GY0 && y < FH && x >= 0 && x < FW) rut[(y - GY0) * FW + x] = 1; }
  }
  return (groundFields = { n, n2, wob, gcov, path, rut, top });
}
/** The beaten circle round the fire, and the drill ground at the right: the ellipses of bare earth. */
const beatenAt = (x: number, y: number, wob: number) => (((x + 0.5 - 322) / 112) ** 2 + ((y + 0.5 - 207) / 49) ** 2) ** 0.5 + wob;
const drillAt = (x: number, y: number, wob: number) => (((x + 0.5 - 424) / 62) ** 2 + ((y + 0.5 - 262) / 30) ** 2) ** 0.5 + wob;
/** Paints the ground: trampled earth, the beaten circle round the fire, tracks and ruts, grass that thickens away from the fire, tufts and pebbles. */
function paintGround(L: CampLayers, land: LandId) {
  const F = earthFields(), g = L.gnd, tone = LAND_EARTH[land], put = putPix;
  const soot3 = D('soot3'), soot2 = D('soot2'), soot4 = D('soot4'), soot5 = D('soot5'), iron1 = D('iron1'), iron2 = D('iron2'), moss1 = D('moss1'), moss2 = D('moss2');
  const grass1 = tone.dry ? D('ochre0') : moss1, grass2 = tone.dry ? D('ochre1') : moss2;
  for (let Y = GY0; Y < FH; Y++) for (let x = 0; x < FW; x++) {
    if (Y < F.top[x]) continue;
    const i = (Y - GY0) * FW + x, b = bayer(x, Y), nn = F.n[i], wob = F.wob[i], calm = 1 - clamp(falloff(x, Y) * 2.4, 0, 0.9);
    let c = soot3;
    if (nn < 0.4 && 0.55 * calm > b) c = soot2; else if (nn > 0.62 && 0.55 * calm > b) c = soot4;
    if (F.n2[i] > 0.58) { if (0.22 > b) c = soot4; } else if (F.n2[i] < 0.4 && 0.3 > b) c = soot2;
    const dd = beatenAt(x, Y, wob);
    if (dd < 1) { if (clamp((1 - dd) * 2.6, 0, 1) > b) c = soot4; if (dd < 0.7 && nn > 0.5 && clamp((0.7 - dd) * 2, 0, 0.5) * calm > b) c = soot5; }
    const bottom = clamp((Y - 246) / 56, 0, 1);
    if (bottom * 0.7 > b) c = soot2;
    const depth = clamp(1 - (Y - 150) / 26, 0, 1);
    if (depth ** 1.2 * 0.62 > b) c = iron1;
    if (depth > 0.45 && (depth - 0.45) * 0.7 > b) c = iron2;
    const d2 = drillAt(x, Y, wob);
    if (d2 < 1) { if (clamp((1 - d2) * 4, 0, 0.9) > b) c = soot4; if (d2 < 0.65 && nn > 0.42 && 0.45 > b) c = soot5; }
    const f = F.path[i];
    if (f < 1) { if (clamp((1 - f) * 3, 0, 1) > b) c = soot4; if (f < 0.55 && clamp((0.55 - f) * 3, 0, 0.55) * (nn > 0.4 ? 1 : 0.6) > b) c = soot5; }
    if (F.rut[i] && 0.6 > b) c = soot2;
    if (f >= 1.1 && dd >= 1 && d2 >= 1) {
      const gc = F.gcov[i];
      if (gc > 0.55 && clamp((gc - 0.55) * 4, 0, 0.75) * tone.grass > b) c = grass1;
      if (gc > 0.66 && clamp((gc - 0.66) * 4, 0, 0.55) * tone.grass > b) c = grass2;
      if (gc < 0.3 && 0.35 > b) c = soot2;
    }
    put(g, x, Y, c);
  }
  // single tufts and pebbles, by perspective
  const r = mulberry(1633 + land.length), placed: number[][] = [], pen = penOf(g);
  const free = (x: number, y: number) => { const i = (y - GY0) * FW + x; return y >= F.top[x] && F.path[i] >= 1.1 && beatenAt(x, y, F.wob[i]) >= 0.9 && drillAt(x, y, F.wob[i]) >= 0.8; };
  for (let k = 0; k < 900; k++) {
    const x = 2 + Math.floor(r() * (FW - 4)), y = 154 + Math.floor(r() * (FH - 156)), q = r(), dry = r() < 0.3;
    if (!free(x, y) || q > (0.18 + 0.9 * Math.max(0, F.gcov[(y - GY0) * FW + x] - 0.35)) * Math.min(1, tone.grass + 0.25) || placed.some(a => (x - a[0]) ** 2 + (y - a[1]) ** 2 < 36)) continue;
    placed.push([x, y]);
    const size = 0.55 + 0.65 * (y - 150) / 150, n = Math.max(3, Math.round(3 + 2 * size));
    for (let j = 0; j < n; j++) {
      const bx = x + (j - (n >> 1)) * (size < 1.3 ? 1 : 2), hgt = Math.round((2 + 2.4 * r()) * size), lean = Math.floor(r() * 3) - 1;
      for (let h = 0; h < hgt; h++) pen.px(bx + (h >= (hgt >> 1) ? lean : 0), y - h, tone.dry || dry ? (h < hgt - 1 ? 'ochre1' : 'ochre3') : (h < hgt - 1 ? 'moss1' : 'moss3'));
    }
  }
  for (let k = 0; k < 80; k++) {
    const x = 4 + Math.floor(r() * (FW - 10)), y = 156 + Math.floor(r() * (FH - 160)), big = r() < 0.18 && y < 230;
    if (!free(x, y) || placed.some(a => (x - a[0]) ** 2 + (y - a[1]) ** 2 < 100)) continue;
    placed.push([x, y]);
    if (big) { pen.rect(x, y, 3, 2, 'iron3'); pen.px(x, y, 'iron5'); pen.px(x + 1, y, 'iron4'); pen.rect(x + 1, y + 2, 3, 1, 'soot1'); pen.px(x + 2, y + 1, 'iron2'); } else { pen.px(x, y, 'iron4'); pen.px(x + 1, y, 'iron3'); pen.px(x + 1, y + 1, 'soot1'); }
  }
}
/** How the earth of each land looks round a camp: how thick its grass grows, and whether it is the dry grass of the steppe, where the grass is not green. */
const LAND_EARTH: Record<LandId, { grass: number; dry: boolean }> = {
  steppe: { grass: 0.55, dry: true }, ukraine: { grass: 1, dry: false }, poland: { grass: 1, dry: false }, prussia: { grass: 0.9, dry: false },
  lithuania: { grass: 1.2, dry: false }, front: { grass: 0.35, dry: true }, silesia: { grass: 0.9, dry: false }, saxony: { grass: 1, dry: false }
};
/* ----- trees and bushes: heaps of leaves, shaded by where the moon is ----- */
const LIGHT3 = (() => { const v = [-0.55, -0.62, 0.56], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; })();
/**
 * A mass of leaves made of domes (cx, cy, r), shaded as a heap would be by the moon on the upper left: a dark mass, its clumps lit on the
 * upper left, the rim there caught in a light of its own. tones go from the shade to the lit; lit leans the shading towards the light.
 */
function foliage(p: Pix, blobs: readonly (readonly [number, number, number])[], seed: number, tones: readonly [string, string, string], rim: string, rim2: string, lit = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [cx, cy, r] of blobs) { x0 = Math.min(x0, cx - r - 3); y0 = Math.min(y0, cy - r - 3); x1 = Math.max(x1, cx + r + 3); y1 = Math.max(y1, cy + r + 3); }
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const w = Math.ceil(x1) - x0, h = Math.ceil(y1) - y0, hgt = new Float32Array(w * h), tex = new Float32Array(w * h);
  for (const [cx, cy, r] of blobs) for (let y = Math.max(0, Math.floor(cy - r - 1) - y0); y < Math.min(h, Math.ceil(cy + r + 2) - y0); y++) for (let x = Math.max(0, Math.floor(cx - r - 1) - x0); x < Math.min(w, Math.ceil(cx + r + 2) - x0); x++) {
    const d2 = (x0 + x + 0.5 - cx) ** 2 + (y0 + y + 0.5 - cy) ** 2, v = Math.sqrt(Math.max(0, r * r - d2));
    if (v > hgt[y * w + x]) hgt[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tex[y * w + x] = vnoise(x0 + x, y0 + y, seed + 3, 3.2, 3.2);
  const hh = (x: number, y: number) => { x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1); return hgt[y * w + x] + tex[y * w + x] * 0.35 * 4; };
  const mask = mkOf(x0, y0, w, h), shade = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (hgt[y * w + x] <= 0.6) continue;
    mask.a[y * w + x] = 1;
    const gx = (hh(x + 1, y) - hh(x - 1, y)) / 2, gy = (hh(x, y + 1) - hh(x, y - 1)) / 2, nl = Math.hypot(gx, gy, 1);
    shade[y * w + x] = (-gx * LIGHT3[0] - gy * LIGHT3[1] + LIGHT3[2]) / nl + lit;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask.a[y * w + x]) continue;
    const X = x0 + x, Y = y0 + y, s = shade[y * w + x];
    let c = tones[banded(s, [0.52, 0.78], X, Y, 0.1)];
    if (s > 0.55 && tex[y * w + x] > 0.46 && (!mAt(mask, X - 1, Y) || !mAt(mask, X, Y - 1))) c = bayer(X, Y) > 0.55 ? rim2 : rim;
    putPix(p, X, Y, c);
  }
  return mask;
}
/** A tall Lombardy poplar: a narrow spindle of small leafy clumps, widest low down. */
function poplar(p: Pix, cx: number, base: number, top: number, w: number, seed: number, tones: readonly [string, string, string]) {
  const r = mulberry(seed), blobs: [number, number, number][] = [], n = Math.floor((base - top) / 2.3);
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1), y = top + t * (base - top), prof = Math.sin(Math.PI * 0.5 * Math.min(1, t ** 0.78)) ** 0.9, rr = Math.max(1.8, w * 0.5 * (0.22 + 0.78 * prof) + (r() * 2 - 0.8)), x = cx + (r() - 0.5) * w * 0.28 + 0.8 * Math.sin(t * 7 + seed);
    blobs.push([x, y, rr]);
    if (r() < 0.45) blobs.push([x + (r() < 0.5 ? -1 : 1) * rr * 0.85, y + (r() * 3 - 1), Math.max(1.5, rr * 0.55)]);
  }
  blobs.push([cx, top + 2, 1.9]);
  return foliage(p, blobs, seed, tones, 'moss4', 'woad4');
}
/** A pine: tiers of boughs, wide below and narrow above, on a trunk. */
function pine(p: Pix, cx: number, base: number, top: number, w: number, seed: number, tiers: number, tones: readonly [string, string, string]) {
  const r = mulberry(seed), blobs: [number, number, number][] = [];
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1), y = top + 4 + t * (base - top - 14), half = Math.max(2, (0.18 + 0.82 * t) * w * 0.5), nb = Math.max(2, Math.floor(half / 2));
    for (let j = -nb; j <= nb; j++) { const fx = j / Math.max(1, nb); blobs.push([cx + fx * half, y + Math.abs(fx) * 5 + (r() * 1.6 - 0.8), 2.5 + (1 - Math.abs(fx)) * 1.6]); }
  }
  blobs.push([cx, top + 1, 1.8]);
  const m = foliage(p, blobs, seed + 1, tones, 'moss4', 'woad4');
  for (let y = Math.floor(base - 12); y < base; y++) { putPix(p, cx, y, 'soot1'); putPix(p, cx + 1, y, 'soot1'); }
  return m;
}
/** The tall trees of the right of the picture, a hazier row behind a dark one; the steppe, which has none, and the churned fields of the front have only bushes. */
function paintTrees(far: Pix, land: LandId) {
  if (land === 'steppe' || land === 'front') return;
  const hazy: [string, string, string] = ['night3', 'night3', 'night4'], dark: [string, string, string] = ['night2', 'moss1', 'moss2'];
  poplar(far, 513, 156, 58, 9, 61, hazy); pine(far, 548, 156, 72, 20, 62, 6, hazy); poplar(far, 580, 156, 52, 9, 63, hazy);
  poplar(far, 500, 158, 24, 11, 21, dark); pine(far, 531, 158, 54, 24, 36, 7, dark); poplar(far, 562, 160, 36, 11, 22, dark); pine(far, 586, 160, 60, 22, 41, 7, dark);
  if (land === 'lithuania' || land === 'prussia') { pine(far, 470, 158, 62, 22, 71, 6, hazy); pine(far, 606, 158, 66, 20, 72, 6, dark); pine(far, 622, 160, 82, 18, 73, 5, hazy); }
}
/** A bush at the foot of things: a few domes of leaves. */
function paintBush(L: CampLayers, cx: number, base: number, r: number, seed: number) {
  standProp(L, [Math.floor(cx - r * 2.2), Math.floor(base - r * 2.4), Math.ceil(cx + r * 2.2), base + 3], base, 30, 0.5, b => {
    foliage(b.p, [[cx, base - r * 0.7, r], [cx - r * 0.8, base - r * 0.4, r * 0.7], [cx + r * 0.9, base - r * 0.35, r * 0.75]], seed, ['moss0', 'moss1', 'moss2'], 'moss3', 'moss3', -0.05);
  });
}

/* ----- the tents ----- */
/**
 * A canvas bell tent. The apex is at ax, ay; by is the lowest row of the hem and hw the half width at the hem. The moon (upper left) lights the left flank, and
 * the fire (on the right if fireSide is 1, on the left if -1) the other. Seams fan from the apex; a patch, wrinkles and a dirty hem; a door on the side that faces
 * the fire, which is painted last, lit from within; a wooden finial, and a pennant on one of them.
 */
function bellTent(L: CampLayers, ax: number, ay: number, by: number, hw: number, doorDx: number, doorW: number, doorH: number, fireSide: 1 | -1, pennant: boolean, seed: number) {
  const ry = 5, cyc = by - ry, wf = (y: number) => { const t = clamp((y + 0.5 - ay) / (cyc - ay), 0, 1); return hw * (0.88 * t + 0.12 * t ** 5); };
  const pts: number[] = [ax, ay];
  for (let y = ay; y <= cyc; y++) pts.push(ax - wf(y), y);
  for (let i = 0; i <= 40; i++) { const x = ax - hw + 2 * hw * i / 40; pts.push(x, cyc + ry * Math.sqrt(Math.max(0, 1 - ((x - ax) / hw) ** 2))); }
  for (let y = cyc; y >= ay; y--) pts.push(ax + wf(y), y);
  const face = (x: number) => { let t = clamp((x - (ax - hw)) / (2 * hw), 0, 1); t = fireSide > 0 ? t : 1 - t; t = clamp((t - 0.44) / 0.3, 0, 1); return 0.2 + 1.3 * t * t * (3 - 2 * t); };
  const m = mPoly(pts), uOf = (x: number, y: number) => clamp((x + 0.5 - ax) / Math.max(y <= cyc ? wf(y) : hw, 0.6), -1, 1);
  const dxc = ax + doorDx, hemY = cyc + ry * Math.sqrt(Math.max(0, 1 - (doorDx / hw) ** 2)), top = hemY - doorH, base = Math.floor(hemY) - 1;
  const dm = mWhere(mPoly([dxc - 1, top + 3, dxc, top, dxc + 1, top + 3, dxc + doorW / 2, base + 1, dxc - doorW / 2, base + 1]), (x, y) => mAt(m, x, y) === 1);
  L.doors.push({ m: dm, top, base, cx: dxc });
  standProp(L, [ax - hw - 6, ay - 26, ax + hw + 8, by + 5], by, 140, face, b => {
    const tones = ['bone2', 'bone1', 'bone0'];
    b.fill(m, (x, y) => tones[banded(uOf(x, y), [-0.3, 0.1], x, y, 0.07)]);
    // seams, stitched, not ruled
    [-0.8, -0.5, -0.2, 0.1, 0.38, 0.66].forEach((ui, si) => {
      const c = ui < -0.3 ? 'bone1' : ui < 0.1 ? 'bone0' : 'soot6', y1 = Math.floor(cyc + ry * Math.sqrt(1 - ui * ui)) - 3;
      for (let y = Math.floor(ay + 0.26 * (cyc - ay)); y < y1; y++) { const x = Math.round(ax + ui * wf(y) - 0.5); if ((y + si * 3) % 4 === 0 || (y + si * 5) % 9 === 0) continue; if (mAt(m, x, y)) b.px(x, y, c); }
    });
    // the hem, a little darker and dirtier
    const hem = mWhere(m, (x, y) => !mAt(m, x, y + 2));
    b.fill(hem, 'soot3'); b.fill(mWhere(hem, (x, y) => !mAt(m, x, y + 1)), 'soot2'); b.fill(mWhere(m, (x, y) => !mAt(m, x, y + 5) && !mAt(hem, x, y)), 'soot5', 0.18);
    // the moon's rim on the upper left, and a softer second line near the apex
    const rim = mWhere(mEdgeUL(m), (x, y) => uOf(x, y) < 0.2);
    b.fill(rim, 'bone4'); b.fill(mWhere(m, (x, y) => mAt(rim, x - 1, y) === 1 && !mAt(rim, x, y) && uOf(x, y) < -0.6 && y < cyc - 8), 'bone3', 0.5);
    // a sewn-on patch, wrinkles near the hem
    const pu = fireSide < 0 ? 0.52 : -0.52, py = Math.floor(ay + 0.46 * (cyc - ay)), px0 = Math.floor(ax + pu * wf(py)) - 4;
    b.fill(mWhere(mRect(px0, py, 9, 7), (x, y) => mAt(m, x, y) === 1), pu < -0.3 ? 'bone1' : 'bone0');
    for (let x = px0; x < px0 + 9; x += 2) { b.px(x, py, 'soot6'); b.px(x, py + 6, 'soot6'); }
    for (let y = py; y < py + 7; y += 2) { b.px(px0, y, 'soot6'); b.px(px0 + 8, y, 'soot6'); }
    const r = mulberry(seed * 11 + 5);
    for (let k = 0; k < 9; k++) {
      const ui = -0.9 + 1.8 * k / 8 + (r() - 0.5) * 0.1, yw = Math.floor(cyc - (5 + Math.floor(r() * 10))), xw = Math.round(ax + ui * wf(yw)), dir = ui < 0 ? -1 : 1, c = ui < 0.1 ? 'bone0' : 'soot6';
      for (let j = 0, n = 3 + Math.floor(r() * 3); j < n; j++) if (mAt(m, xw + dir * j, yw + j)) b.px(xw + dir * j, yw + j, c);
    }
    // a dark line on the shadow side and under the hem
    b.fill(mWithout(mOr(mShift(m, 1, 0), mShift(m, 0, 1)), m), 'soot1');
    // the door, on the side that faces the fire: the flaps folded back, tied
    b.fill(dm, 'soot1');
    const left = mWhere(dm, (x, y) => !mAt(dm, x - 1, y)), right = mWhere(dm, (x, y) => !mAt(dm, x + 1, y));
    const flapL = (x: number, y: number) => mAt(left, x + 1, y) === 1 || mAt(left, x + 2, y) === 1, flapR = (x: number, y: number) => mAt(right, x - 1, y) === 1 || mAt(right, x - 2, y) === 1;
    const ok = (x: number, y: number) => mAt(m, x, y) === 1 && !mAt(dm, x, y) && y < base - 1;
    b.fill(m, (x, y) => (ok(x, y) && flapL(x, y) ? 'bone3' : ok(x, y) && flapR(x, y) ? 'bone0' : -1));
    const ty = Math.floor(top + doorH * 0.45);
    b.line(Math.floor(dxc - doorW * 0.3), ty + 3, Math.floor(dxc - doorW * 0.62 - 1), ty - 1, 'soot6'); b.line(Math.floor(dxc + doorW * 0.3), ty + 3, Math.floor(dxc + doorW * 0.62 + 1), ty - 1, 'soot6');
    // the finial and, on one, a pennant
    b.stamp(['.a.', '.s.', 'abb', 'bbc', '.c.', '.s.', 'sbs'], { a: 'ochre4', b: 'ochre3', c: 'ochre1', s: 'soot5', d: 'soot1' }, ax - 1, ay - 6);
    if (pennant) {
      const pt = ay - 16;
      b.line(ax, ay - 6, ax, pt, 'soot5');
      b.fill(mPoly([ax + 1, pt, ax + 15, pt + 2, ax + 11, pt + 3, ax + 15, pt + 6, ax + 1, pt + 5]), (x, y) => (y === pt ? 'madder4' : y >= pt + 4 ? 'madder2' : 'madder3'));
    }
  });
}
/** Ropes from a tent to pegs in the earth. */
function guyRopes(L: CampLayers, ax: number, ay: number, by: number, hw: number, pegs: readonly [readonly [number, number], readonly [number, number]]) {
  const cyc = by - 5, t = 0.62, yy = ay + t * (cyc - ay), w = hw * (0.88 * t + 0.12 * t ** 5);
  standProp(L, [ax - hw - 40, Math.floor(yy) - 2, ax + hw + 60, by + 6], by + 2, 100, 0.5, b => {
    pegs.forEach((peg, k) => {
      const sgn = k ? 1 : -1;
      b.line(ax + sgn * w, yy, peg[0], peg[1], sgn < 0 ? 'soot6' : 'soot4');
      b.rect(peg[0] - 1, peg[1] - 1, 2, 3, 'soot6'); b.px(peg[0] - 1, peg[1] - 1, 'soot7'); b.px(peg[0], peg[1] + 2, 'soot1');
      shadowPix(L.gnd, peg[0], peg[1] + 2, 3, 1, 'soot1', 0.6);
    });
  });
}

/* ----- the tabir far behind the camp: a wattle fence and wagons drawn up ----- */
function paintFence(L: CampLayers, x0: number, x1: number, base: number, h = 7) {
  standProp(L, [x0 - 2, base - h - 4, x1 + 2, base + 2], base, 40, (x: number) => clamp(1 - Math.abs(x - 320) / 140, 0.3, 1), b => {
    for (let x = x0; x < x1; x++) { const top = base - h - (x % 5 === 0 ? 1 : 0); for (let y = top; y < base; y++) b.px(x, y, (((x >> 1) + ((y - top) % 2)) % 2 === 0) ? 'soot5' : 'soot4'); }
    for (let x = x0 + 2; x < x1; x += 6) for (let y = base - h - 2; y <= base; y++) { b.px(x, y, y > base - h - 1 ? 'soot6' : 'soot7'); b.px(x + 1, y, 'soot2'); }
    b.rect(x0, base, x1 - x0, 1, 'soot1');
  });
}
/** A wheel of the tabir far off: a rim, spokes, a hub. */
function smallWheel(b: Pen, cx: number, cy: number, r = 3.5) {
  for (let y = Math.floor(cy - r) - 1; y <= Math.floor(cy + r) + 1; y++) for (let x = Math.floor(cx - r) - 1; x <= Math.floor(cx + r) + 1; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d >= r - 1 && d <= r + 0.2) b.px(x, y, 'iron2'); }
  b.px(Math.floor(cx - 0.5), Math.floor(cy - 0.5), 'iron4');
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) for (let k = -2; k <= 2; k++) if (k) b.px(Math.floor(cx + k * dx - 0.5 + 0.5), Math.floor(cy + k * dy), 'soot3');
}
/** A wagon of the tabir, seen from the side, far off: its bed, a hooped cover or a load, two wheels. */
function paintFarWagon(L: CampLayers, x: number, base: number, len: number, cover: boolean, load: 'sacks' | 'hay') {
  const bedY = base - 9;
  standProp(L, [x - 10, base - 24, x + len + 4, base + 4], base, 60, (px: number) => clamp(1 - (px - x) / 60, 0.35, 1), b => {
    const body = mRect(x, bedY - 3, len, 6);
    b.fill(body, (xx, yy) => (yy === bedY - 3 ? 'soot6' : xx === x ? 'soot6' : (xx - x - 3) % 4 === 0 && xx > x + 2 && xx < x + len - 1 ? 'soot3' : 'soot4'));
    b.fill(mEdgeBottom(body), 'soot2');
    b.line(x - 6, base - 5, x, bedY + 1, 'soot3');
    if (cover) {
      const c0 = x + 3, cw = len - 6, hood = mWhere(mEll(c0 + cw / 2, bedY - 3, cw / 2, 9), (px, py) => py < bedY - 3 && py >= bedY - 12);
      b.fill(hood, (px, py) => (px > c0 + cw * 0.58 || (px - c0) % Math.max(1, Math.floor(cw / 6)) === 0 ? 'bone0' : 'bone1'));
      b.fill(mWhere(mEdgeUL(hood), px => px < c0 + cw * 0.6), 'bone3'); b.fill(mWhere(mRing(hood), (px, py) => py < bedY - 3), 'soot1');
    } else if (load === 'sacks') {
      for (let k = 0; k < 3; k++) {
        const sx = x + 3 + k * 7, sk = mWhere(mEll(sx + 3.5, bedY - 5.5, 4.2, 3.2), (px, py) => py < bedY - 3);
        b.fill(sk, px => (px > sx + 4 ? 'bone0' : 'bone1')); b.fill(mEdgeUL(sk), 'bone3'); b.fill(mWhere(mRing(sk), (px, py) => py < bedY - 3), 'soot1');
      }
    } else {
      const hay = mWhere(mEll(x + len / 2, bedY - 3, len / 2 - 1, 6), (px, py) => py < bedY - 3);
      b.fill(hay, px => (px > x + len * 0.55 ? 'soot4' : 'ochre1')); b.fill(mEdgeUL(hay), 'ochre3'); b.fill(mWhere(mRing(hay), (px, py) => py < bedY - 3), 'soot1');
    }
    smallWheel(b, x + 6, base - 3.5); smallWheel(b, x + len - 7, base - 3.5);
    b.fill(mWhere(mRing(body), (px, py) => py < bedY + 3 && py > bedY - 4), 'soot1');
  });
  shadowPix(L.gnd, x + len / 2, base + 1, len / 2 + 2, 1.6, 'soot1', 0.5);
}
/* ----- goods and the cart ----- */
const OAK = ['ochre3', 'ochre2', 'ochre1', 'ochre0'];
/** A standing oak barrel of salt: bulging staves, iron hoops, a pale lid. (cx, by) is the middle of its lowest row. */
function barrel(b: Pen, cx: number, by: number, w = 15, h = 19, lid = true) {
  const top = by - h + 1, hw = w / 2, rows: [number, number, number, number][] = [], sil = mkOf(Math.floor(cx - w), top - 4, w * 2, h + 8);
  for (let r = 0; r < h; r++) {
    const half = hw * (0.8 + 0.2 * Math.sin(Math.PI * (r + 0.5) / h)), x0 = Math.round(cx - half), x1 = Math.round(cx + half);
    rows.push([top + r, x0, x1, half]);
    for (let x = x0; x < x1; x++) sil.a[(top + r - sil.y0) * sil.w + x - sil.x0] = 1;
  }
  for (const [y, x0, x1, half] of rows) for (let x = x0; x < x1; x++) { const v = (x + 0.5 - cx) / half; b.px(x, y, v < -0.35 ? OAK[0] : v < 0.25 ? OAK[1] : v < 0.72 ? OAK[2] : OAK[3]); }
  for (const [y, x0, x1, half] of rows) for (const vv of [-0.62, -0.15, 0.32]) { const x = Math.round(cx + vv * half - 0.5); if (x >= x0 && x < x1) b.px(x, y, vv < -0.4 ? OAK[1] : vv < 0.2 ? OAK[2] : OAK[3]); }
  const hoops = [2, 3, h >> 1, h - 4, h - 3];
  for (const r of hoops) { const [y, x0, x1, half] = rows[r]; for (let x = x0; x < x1; x++) { const v = (x + 0.5 - cx) / half; b.px(x, y, v < -0.55 ? 'iron5' : v < -0.1 ? 'iron4' : v < 0.45 ? 'iron3' : 'iron2'); } }
  let full = sil;
  if (lid) {
    const lm = mEll(cx, top + 0.5, hw * 0.83, 2.6), edge = mWhere(mRing(lm), (x, y) => !mAt(sil, x, y));
    b.fill(lm, (x) => (x + 0.5 > cx + hw * 0.25 ? 'ochre3' : 'ochre4'));
    b.fill(edge, 'ochre2'); b.fill(edge, 'soot1', 0.5);
    b.px(Math.floor(cx) - 1, top, 'ochre1'); b.px(Math.floor(cx), top, 'ochre1'); b.px(Math.floor(cx - hw * 0.5), top, 'bronze5');
    full = mOr(sil, lm);
  }
  const ring = mRing(full);
  b.fill(ring, (x, y) => (x + 0.5 > cx - hw * 0.45 ? 'soot1' : y > top + 3 ? 'soot2' : -1));
  for (let i = 3; i < h - 3; i++) { const [y, x0] = rows[i]; if (!hoops.includes(i)) b.px(x0, y, 'bronze5'); }
}
const SACK = ['.....ss.....', '....sSSs....', '.....tt.....', '...aabbbc...', '..aabbbbbc..', '.aabbbbbbbc.', 'aabbbbbbbbbc', 'aabbbbbbbbbbc', 'aabbbbbbbbbbc', '.abbbbbbbbbc.', '..cccccccccc.'];
const JUTE = { a: 'ochre3', b: 'ochre2', c: 'ochre1', s: 'ochre3', S: 'ochre2', t: 'soot3' }, LINEN = { a: 'bone2', b: 'bone1', c: 'bone0', s: 'bone2', S: 'bone1', t: 'soot5' };
/** A squat sack tied at the neck, its left edge at x and its lowest row at by. */
function sack(b: Pen, x: number, by: number, flip = false, pal: Readonly<Record<string, string>> = JUTE) {
  const rows = SACK.map(r => r.padEnd(13, '.')), y = by - rows.length + 1, m = mkOf(x - 1, y - 1, 15, rows.length + 2);
  b.stamp(rows, pal, x, y, flip);
  const fx = (i: number) => (flip ? 12 - i : i);
  for (const [i, j] of [[4, 6], [5, 7], [6, 8], [8, 5], [9, 6]]) b.px(x + fx(i), y + j, pal.c);
  for (const [i, j] of [[3, 4], [2, 5], [1, 7]]) b.px(x + fx(i), y + j, pal.s);
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') m.a[(y + j - m.y0) * m.w + (x + i - m.x0)] = 1; });
  b.fill(mRing(m), 'soot1');
}
/** A rolled cloth lying across the load: rounded ends, rope wraps, a pale spiral on the end that shows. */
function canvasBundle(b: Pen, x0: number, y0: number, len = 26, thick = 8) {
  const body = mOr(mOr(mRect(x0 + 2, y0, len - 4, thick), mEll(x0 + 2.5, y0 + thick / 2, 3, thick / 2)), mEll(x0 + len - 2.5, y0 + thick / 2, 3, thick / 2));
  b.fill(body, (x, y) => { const t = (y - y0) / (thick - 1); return y === y0 && x > x0 + 3 ? 'paper1' : t < 0.25 ? 'soot7' : t < 0.65 ? 'soot6' : 'soot5'; });
  for (let x = x0 + 6; x < x0 + len - 3; x += 8) for (let r = 0; r < thick; r++) b.px(x + (r / 3 | 0), y0 + r, r < thick - 2 ? 'soot3' : 'soot2');
  b.fill(mEll(x0 + 2.5, y0 + thick / 2, 2.6, thick / 2 - 0.6), 'paper1');
  b.px(x0 + 2, y0 + (thick >> 1), 'soot5'); b.px(x0 + 3, y0 + (thick >> 1) - 1, 'soot6'); b.px(x0 + 2, y0 + (thick >> 1) + 1, 'soot6');
  b.fill(mRing(body), 'soot1');
}
/** An iron-shod wheel: tyre, wooden felloes, eight spokes, a hub and nave; the gaps are dark. */
function wheel(b: Pen, cx: number, cy: number, r = 11) {
  const spokes: number[][] = [];
  for (let k = 0; k < 8; k++) { const a = (k * 45 + 11) * Math.PI / 180; spokes.push([cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3), Math.sin(a) < 0.1 && Math.cos(a) < 0.55 ? 1 : 0]); }
  for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    if (d > r + 0.25) continue;
    let c = 'soot1';
    if (d >= r - 3.6) { c = 'soot5'; if (ang > -150 && ang < -20) c = 'soot6'; if (ang > 20 && ang < 150 && d > r - 2.4) c = 'soot3'; }
    if (d >= 2.4 && d < r - 3.6) {
      let best = 9, up = 0;
      for (const [sx, sy, u] of spokes) { const vx = sx - cx, vy = sy - cy, t = clamp((dx * vx + dy * vy) / (vx * vx + vy * vy), 0, 1), dd = Math.hypot(dx - vx * t, dy - vy * t); if (dd < best) { best = dd; up = u; } }
      if (best <= 0.62) c = up ? 'soot6' : 'soot4';
    }
    if (d >= r - 1.4) { c = 'iron3'; if (ang > -165 && ang < -15) c = 'iron4'; if (ang > -150 && ang < -60) c = 'iron5'; if (ang > 20 && ang < 160) c = 'iron1'; }
    if (d <= 3.2) { c = 'soot4'; if (dx < 0 && dy < 0) c = 'soot6'; if (d > 2.4) c = 'soot2'; }
    if (d <= 1.3) c = 'iron4';
    b.px(x, y, c);
  }
  for (let k = 0; k < 8; k++) { const a = (k * 45 + 22.5) * Math.PI / 180; b.px(Math.floor(cx + Math.cos(a) * (r - 2.5)), Math.floor(cy + Math.sin(a) * (r - 2.5)), 'soot2'); }
  b.px(Math.floor(cx - 1), Math.floor(cy - 1), 'iron6');
  b.fill(mRing(mEll(cx, cy, r + 0.25, r + 0.25)), 'soot1');
}
/** An iron-bound chest: dark oak, three straps, a domed lid and a lock. */
function chest(b: Pen, x: number, y: number, w: number, h: number) {
  const body = mRect(x, y + 6, w, h - 6), lid = mWhere(mEll(x + w / 2, y + 7, w / 2, 7), (px, py) => py < y + 7);
  b.fill(body, (px, py) => (py === y + 6 ? 'ochre2' : px < x + 2 ? 'ochre2' : px > x + w - 4 ? 'ochre0' : py > y + h - 4 ? 'ochre0' : 'ochre1'));
  b.fill(lid, (px, py) => (py < y + 1 ? 'ochre2' : px < x + w * 0.3 ? 'ochre2' : px > x + w * 0.75 ? 'ochre0' : 'ochre1'));
  for (const sx of [x + 3, x + Math.floor(w / 2) - 1, x + w - 6]) b.rect(sx, y + 1, 3, h - 1, 'iron3'), b.rect(sx, y + 1, 1, h - 1, 'iron5'), b.rect(sx + 2, y + 2, 1, h - 2, 'iron1');
  b.rect(x, y + 6, w, 2, 'iron3'); b.rect(x, y + 6, w, 1, 'iron5'); b.rect(x, y + h - 2, w, 2, 'iron2');
  const lk = x + Math.floor(w / 2) - 2; b.rect(lk, y + 8, 5, 5, 'bronze3'); b.rect(lk, y + 8, 5, 1, 'bronze5'); b.px(lk + 2, y + 10, 'soot1'); b.px(lk + 2, y + 11, 'soot1');
  for (const sx of [x + 1, x + w - 3]) for (const sy of [y + 9, y + h - 4]) b.px(sx, sy, 'iron5');
  b.fill(mRing(mOr(body, lid)), 'soot1');
}

/** The kinds of cargo a camp may have by it, as the quest names them. */
type CargoKind = TransportId;
/** The ox-cart and its load, at the left of the camp. The cargo is what the quest carries (kind); load, from 0 to 1, is how much of it is left. */
function cartPainter(b: Pen, kind: CargoKind, load: number) {
  const wl: [number, number] = [54, 196], wr: [number, number] = [116, 196], r = 11;
  {
    b.line(36, 186, 4, 190, 'soot4'); b.line(36, 187, 4, 191, 'soot3'); b.line(36, 185, 6, 188, 'soot6'); b.rect(2, 190, 3, 2, 'soot3');
    const bed = mRect(34, 176, 104, 13);
    b.fill(bed, (x, y) => {
      if (y === 176) return 'soot7'; if (y === 177) return 'soot6'; if (x < 36) return 'soot6'; if (y >= 188) return 'soot2'; if (x >= 136) return 'soot3'; if (y === 180 || y === 184) return 'soot3';
      for (const jx of [40, 52, 63, 76, 90, 101, 113, 126]) if (x === jx) for (const [y0, y1] of [[177, 180], [181, 184], [185, 189]]) if ((jx * 3 + y0) % 2 === 0 && y > y0 && y < y1) return 'soot3';
      return 'soot5';
    });
    b.fill(mRing(bed), 'soot1');
    for (const x of [35, 135]) b.rect(x, 176, 2, 13, 'iron2');
    for (const x of [38, 58, 82, 104, 124, 134]) { b.rect(x, 168, 2, 9, 'soot6'); b.rect(x, 168, 1, 9, 'soot7'); b.rect(x + 2, 169, 1, 8, 'soot1'); b.px(x, 167, 'soot1'); b.px(x + 1, 167, 'soot1'); }
    if (kind === 'chest') {
      chest(b, 50, 154, 44, 22);
      sack(b, 99, 176, false, LINEN); sack(b, 112, 176); canvasBundle(b, 100, 160, 28, 8);
    } else {
      const spots = [[47, 176], [63, 176], [79, 176], [47, 157], [63, 157]], n = Math.max(1, Math.round(5 * load));
      for (let i = 0; i < n; i++) barrel(b, spots[i][0], spots[i][1]);
      canvasBundle(b, 93, 160, 30, 8); sack(b, 88, 176); sack(b, 101, 176, true, LINEN); sack(b, 114, 176);
    }
    [[0, 0], [1, 1], [1, 2], [0, 3], [-1, 3], [-2, 2], [-2, 1], [-1, 0]].forEach(([dx, dy], k) => b.px(137 + dx, 168 + dy, k % 2 ? 'soot7' : 'soot6'));
    wheel(b, wl[0], wl[1], r); wheel(b, wr[0], wr[1], r);
  }
}
/** The cart on the ground of the camp, with its shadow, lit by the fire; the lantern hangs at its tail. */
function paintCart(L: CampLayers, kind: CargoKind, load: number) {
  shadowPix(L.gnd, 88, 205, 58, 5, 'soot1', 0.62);
  standProp(L, [0, 130, 148, 212], 206, 100, (x: number) => clamp(0.18 + (x - 20) / 190, 0.15, 0.7), b => cartPainter(b, kind, load));
  L.lantern = [141, 171];
}

/* ----- the oxen ----- */
/** Shades a heap of ellipsoids (cx, cy, rx, ry, depth) as the moon on the upper left would: the pixels it covers, and for each how much it faces the light, from 0 to 1. */
function volume(parts: readonly (readonly [number, number, number, number, number])[]) {
  const lx = -0.5, ly = -0.62, lz = 0.6, ln = Math.hypot(lx, ly, lz);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [cx, cy, rx, ry] of parts) { x0 = Math.min(x0, cx - rx - 3); y0 = Math.min(y0, cy - ry - 3); x1 = Math.max(x1, cx + rx + 3); y1 = Math.max(y1, cy + ry + 3); }
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const w = Math.ceil(x1) - x0, h = Math.ceil(y1) - y0, hgt = new Float32Array(w * h);
  for (const [cx, cy, rx, ry, dep] of parts) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dd = ((x0 + x + 0.5 - cx) / rx) ** 2 + ((y0 + y + 0.5 - cy) / ry) ** 2;
    if (dd < 1) { const v = dep * Math.sqrt(1 - dd); if (v > hgt[y * w + x]) hgt[y * w + x] = v; }
  }
  const m = mkOf(x0, y0, w, h), shade = new Float32Array(w * h), at = (x: number, y: number) => hgt[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (hgt[y * w + x] <= 0.15) continue;
    m.a[y * w + x] = 1;
    shade[y * w + x] = (-(at(x + 1, y) - at(x - 1, y)) / 2 * lx - (at(x, y + 1) - at(x, y - 1)) / 2 * ly + lz) / Math.hypot((at(x + 1, y) - at(x - 1, y)) / 2, (at(x, y + 1) - at(x, y - 1)) / 2, 1) / ln;
  }
  return { m, shade: (x: number, y: number) => (mAt(m, x, y) ? shade[(y - y0) * w + x - x0] : 0) };
}
/**
 * A grey steppe ox lying chewing the cud, head towards the right, long horns of the lyre kind: shaded by the moon from the upper left, its outline dark. tones are its
 * five shades of hide, dark to light. Painted on a raster of its own, 46 across and 34 down, in the coordinates of the picture it was drawn for (x 0 to 40, y 175 to 203).
 */
function oxPixels(b: Pen, tones: readonly (number | string)[]) {
  const { m: body, shade } = volume([[13, 192.5, 16.5, 9, 8], [21.5, 187.2, 7.5, 6.5, 6], [26.5, 191.8, 5.5, 6.5, 4.5], [31.5, 195.5, 6.2, 5.2, 4.5], [36, 198, 3.2, 2.8, 2.6], [22, 199.2, 6.5, 2.4, 2.5], [5.5, 198.8, 7.5, 2.8, 2.8]]);
  b.fill(body, (x, y) => { const s = shade(x, y), i = banded(s, [0.26, 0.44, 0.62, 0.8], x, y, 0.06); return s > 0.86 && y < 188 ? 'bone1' : s > 0.74 && y < 190 && bayer(x, y) > 0.35 ? 'paper1' : tones[i]; });
  for (let x = 1; x < 24; x++) if (mAt(body, x, 199) && BAY[8 + (x & 3)] < 0.6) b.px(x, 199, 'soot2');
  for (const x of [7, 10, 13, 16, 19]) { b.px(x, 190, tones[1]); b.px(x + 1, 191, tones[1]); b.px(x + 1, 192, tones[1]); b.px(x + 1, 193, tones[2]); }
  b.fill(mEll(27, 200.2, 3.4, 1.5), tones[0]); b.rect(28, 200, 3, 1, 'soot2'); b.px(31, 200, 'soot1'); b.px(30, 201, 'soot1');
  b.fill(mEll(1.5, 200.2, 3.6, 1.4), tones[0]); b.px(4, 200, 'soot1');
  b.fill(mWhere(mEll(31, 193, 3.2, 2.6), (x, y) => mAt(body, x, y) === 1), tones[4]);
  const ear = mPoly([27.5, 190.2, 23, 189.3, 24.5, 192.6]);
  b.fill(ear, tones[1]); b.fill(mEdgeUL(ear), tones[4]); b.px(25, 191, 'soot2');
  b.px(32, 194, 'soot1'); b.px(33, 194, 'soot1'); b.px(31, 193, 'bone4');
  b.fill(mEll(36, 198, 2.8, 2.4), tones[2]); b.fill(mEll(35.4, 197.2, 1.6, 1.3), tones[4]);
  for (const [x, y] of [[37, 197], [38, 199], [35, 200], [36, 200]]) b.px(x, y, 'soot1');
  b.line(33, 199, 36, 200, 'soot2');
  for (const [x, y] of [[27, 189], [27, 190], [26, 191], [26, 192], [26, 193], [27, 194], [27, 195], [28, 196], [28, 197], [29, 198]]) b.px(x, y, 'soot2');
  for (const [xa, ya, xb, yb] of [[27, 190, 26, 187], [26, 187, 24, 184], [24, 184, 23, 181], [23, 181, 23, 178]]) { b.line(xa, ya, xb, yb, 'bone2'); b.line(xa + 1, ya, xb + 1, yb, 'bone1'); }
  b.px(23, 177, 'bone3'); b.px(22, 177, 'bone2');
  for (const [xa, ya, xb, yb] of [[28, 189, 28, 186], [28, 186, 28, 183], [28, 183, 30, 180], [30, 180, 32, 178]]) { b.line(xa, ya, xb, yb, 'bone3'); b.line(xa + 1, ya + 1, xb + 1, yb + 1, 'bone1'); if (ya > 182) b.line(xa - 1, ya, xb - 1, yb, 'bone4'); }
  b.line(31, 179, 33, 176, 'bone4'); b.px(33, 175, 'bone5'); b.px(34, 175, 'bone4'); b.px(28, 190, tones[2]); b.px(27, 190, tones[2]);
  for (let y = 187; y < 197; y++) b.px(0, y, 'soot2');
  b.px(1, 197, 'soot2'); b.px(0, 198, 'soot1'); b.px(1, 198, 'soot1');
  b.fill(mRing(body), (x, y) => (y > 185 ? 'soot1' : 'soot2'));
  b.fill(mWhere(mEdgeUL(body), (x, y) => y < 192 && x > 1 && shade(x, y) > 0.5), 'bone2');
}
/** A standing ox: the same hide and horns on four legs, head up. Drawn in the coordinates of a raster 46 across and 34 down. */
function oxStanding(b: Pen, tones: readonly (number | string)[]) {
  const { m: body, shade } = volume([[14, 14, 13, 7.5, 7], [22, 9.5, 6.5, 6, 5.5], [28, 12.5, 5, 5.5, 4], [33, 15, 5.2, 4.2, 4], [37, 17, 3, 2.6, 2.5]]);
  const legs = [mPoly([6, 19, 9.5, 19, 9, 30, 7, 30]), mPoly([11, 20, 14.5, 20, 14, 30, 12, 30]), mPoly([21, 20, 24.5, 20, 24, 30, 22, 30]), mPoly([26, 19, 29.5, 19, 29, 30, 27, 30])];
  let all = body;
  for (const l of legs) all = mOr(all, l);
  b.fill(all, (x, y) => (mAt(body, x, y) ? tones[banded(shade(x, y), [0.26, 0.44, 0.62, 0.8], x, y, 0.06)] : tones[x < 12 ? 1 : 0]));
  b.fill(mWhere(body, (x, y) => shade(x, y) > 0.74 && y < 12 && bayer(x, y) > 0.35), 'paper1');
  for (const x of [7, 12, 22, 27]) { b.rect(x - 1, 29, 4, 2, 'soot2'); b.rect(x - 1, 30, 4, 1, 'soot1'); }
  b.px(33, 14, 'soot1'); b.px(34, 14, 'soot1'); b.px(32, 13, 'bone4');
  for (const [xa, ya, xb, yb] of [[28, 8, 27, 5], [27, 5, 25, 2], [25, 2, 24, -1]]) { b.line(xa, ya, xb, yb, 'bone2'); b.line(xa + 1, ya, xb + 1, yb, 'bone1'); }
  for (const [xa, ya, xb, yb] of [[30, 8, 31, 4], [31, 4, 33, 1], [33, 1, 35, -1]]) { b.line(xa, ya, xb, yb, 'bone3'); b.line(xa + 1, ya, xb + 1, yb, 'bone1'); }
  for (let y = 12; y < 22; y++) b.px(1, y, 'soot2');
  b.fill(mRing(all), 'soot1');
  b.fill(mWhere(mEdgeUL(body), (x, y) => y < 14 && x > 3), 'bone2');
}
const oxCache = new Map<string, Pix>();
/** An ox as a raster of its own, 48 across and 36 down: lying or standing, facing right (face 1) or left (-1), its hide of the five tones. Kept. */
function oxPix(lying: boolean, face: 1 | -1, tones: readonly (number | string)[]) {
  const key = (lying ? 'l' : 's') + face + tones.join(',');
  let p = oxCache.get(key);
  if (p) return p;
  const s = newPix(48, 36, -3, lying ? 172 : -2);
  if (lying) oxPixels(penOf(s), tones); else oxStanding(penOf(s), tones);
  p = newPix(48, 36);
  for (let y = 0; y < 36; y++) for (let x = 0; x < 48; x++) { const i = (y * 48 + x) * 4, j = (y * 48 + (face < 0 ? 47 - x : x)) * 4; for (let k = 0; k < 4; k++) p.d[j + k] = s.d[i + k]; }
  oxCache.set(key, p);
  return p;
}
/** A raster's colours laid on a pen's, its corner at x, y of the picture. */
function stampRaster(b: Pen, sp: Pix, x: number, y: number) {
  for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) { const k = (j * sp.w + i) * 4; if (sp.d[k + 3]) b.px(x + i, y + j, (sp.d[k] << 16) | (sp.d[k + 1] << 8) | sp.d[k + 2]); }
}
/** The five shades of an ox's hide, dark to light, as each hour sees it: it is painted after the light, in colours that keep its outline readable in the dark. */
const OX_HIDE: Record<CampMode, readonly string[]> = { night: ['soot3', 'soot4', 'soot5', 'soot6', 'soot7'], warm: ['soot4', 'soot5', 'soot6', 'soot7', 'bone0'], day: ['soot5', 'soot6', 'soot7', 'bone0', 'bone1'] };
/** An ox of the camp at x, y (the corner of its raster; its feet are 28 below, or 31 if it stands). */
function paintOx(L: CampLayers, x: number, y: number, lying: boolean, face: 1 | -1) {
  shadowPix(L.gnd, x + 23, y + (lying ? 29 : 32), 24, 3.2, 'soot1', 0.62);
  L.late.push((out, mode) => stampRaster(penOf(out), oxPix(lying, face, OX_HIDE[mode]), x, y));
}
/** The oxen of a herd, lying and standing, laid about the left of the camp. */
function paintHerd(L: CampLayers, load: number) {
  const n = Math.max(2, Math.round(4 * load)), spots: [number, number, boolean, 1 | -1][] = [[-8, 172, true, 1], [88, 180, true, -1], [46, 150, false, 1], [100, 148, true, 1]];
  for (let i = 0; i < n; i++) paintOx(L, spots[i][0], spots[i][1], spots[i][2], spots[i][3]);
}
/* ----- the logs the company sits on, and the pit ----- */
/** The angle each of the eight logs lies at (degrees, as it lies on the ground): they go round the fire, the two at the sides on end towards it. */
const SEAT_ANGLES = [90, -30, 30, 90, 28, -28, 7, -6];
/** A log seat lying on the earth, moon-lit on top, with bark flecks and the pale end grain on the end that faces us, at the slot (sx, sy) a man sits at. */
function paintSeat(L: CampLayers, sx: number, sy: number, ang: number, k: number) {
  const ox = sx - FIRE_X, oy = (sy - FIRE_Y) / R_RATIO, on = Math.hypot(ox, oy) || 1, cx = sx + ox / on * 2, cy = sy - 5 + oy / on * 1.5;
  const len = Math.abs(ang) !== 90 ? 21 : 15, T = 7, a = ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  const x0 = Math.floor(cx - dx * len / 2 + 0.5), y0 = Math.floor(cy - dy * len / 2 + 0.5), x1 = Math.floor(cx + dx * len / 2 + 0.5), y1 = Math.floor(cy + dy * len / 2 + 0.5);
  let nx = -dy, ny = dx;
  if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
  const vx = x1 - x0, vy = y1 - y0, v2 = Math.max(vx * vx + vy * vy, 1e-6);
  const segD = (x: number, y: number) => { const t = clamp(((x + 0.5 - x0) * vx + (y + 0.5 - y0) * vy) / v2, 0, 1); return Math.hypot(x + 0.5 - (x0 + t * vx), y + 0.5 - (y0 + t * vy)); };
  const bx0 = Math.min(x0, x1) - 6, by0 = Math.min(y0, y1) - 6;
  const body = mWhere(mRect(bx0, by0, Math.abs(vx) + 13, Math.abs(vy) + 13), (x, y) => segD(x, y) <= T / 2);
  let ex = x1, ey = y1;
  if (y1 < y0) { ex = x0; ey = y0; }
  if (Math.abs(dy) < 0.2) { ex = dx > 0 ? x1 : x0; ey = dx > 0 ? y1 : y0; }
  const cap = mEll(ex, ey, T / 2 * 0.55, T / 2), all = mOr(body, cap);
  standProp(L, [bx0 - 2, by0 - 2, bx0 + Math.abs(vx) + 15, by0 + Math.abs(vy) + 15], cy + Math.floor(T / 2), 30, 1, b => {
    const tones = ['soot3', 'soot5', 'soot6'];
    b.fill(body, (x, y) => { const v = ((x + 0.5 - cx) * nx + (y + 0.5 - cy) * ny) / (T / 2); return v > 0.78 ? 'soot7' : tones[banded(v, [-0.35, 0.3], x, y, 0.1)]; });
    const r = mulberry(k + 10);
    for (let i = 0, n = Math.floor(len * 0.7); i < n; i++) {
      const tt = r(), off = (r() - 0.5) * (T - 2), fx = Math.round(x0 + (x1 - x0) * tt + nx * off), fy = Math.round(y0 + (y1 - y0) * tt + ny * off);
      if (mAt(body, fx, fy)) b.px(fx, fy, r() < 0.7 ? 'soot2' : 'soot7');
    }
    b.fill(cap, 'soot7'); b.fill(mWhere(cap, (x, y) => ((x + 0.5 - ex) / (T / 2 * 0.28)) ** 2 + ((y + 0.5 - ey) / (T / 2 * 0.5)) ** 2 <= 1), 'soot6');
    b.fill(mWhere(cap, (x, y) => x < ex - 1 && y < ey - 1), 'bone0');
    b.fill(mRing(all), (x, y) => (y >= cy - 2 ? 'soot1' : 'soot2'), (x, y) => (y >= cy - 2 ? 1 : 0.6));
  });
  shadowPix(L.gnd, cx + (cx > FIRE_X ? 2 : -2), cy + Math.floor(T / 2) + 1, len / 2 + 1, 2.4, 'soot1', 0.55);
}
/** The ember bed of the pit, on the ground. */
function paintPit(L: CampLayers) {
  const g = L.gnd, bed = mEll(FIRE_X, FIRE_Y + 1, 14.5, 5.6);
  fillMk(g, bed, (x, y) => (y > FIRE_Y && bayer(x, y) < 0.5 ? 'soot0' : 'soot1'));
  fillMk(g, mEll(FIRE_X, FIRE_Y + 1, 13, 4.4), 'iron2', (x, y) => (bayer(x, y) > 0.7 ? 1 : 0));
}

/* ----- the signpost where the roads leave, the noticeboard, and the things lying about the camp ----- */
/** The signpost at the right of the camp: a tall post on a cairn, a board for each road that leaves from here (up to three), each pointing its way. */
function paintSignpost(L: CampLayers, roads: number) {
  const x = 608, y0 = 120, y1 = 212;
  shadowPix(L.gnd, x + 4, y1 + 1, 9, 2.2, 'soot1', 0.6);
  standProp(L, [x - 36, y0 - 6, x + 36, y1 + 6], y1 + 1, 100, 0.3, b => {
    for (const [sx, sy, sw] of [[x - 6, y1 - 1, 5], [x + 3, y1 - 1, 6], [x - 2, y1 + 1, 5]]) { b.rect(sx, sy, sw, 3, 'iron3'); b.rect(sx, sy, sw, 1, 'iron4'); b.px(sx, sy, 'iron5'); b.rect(sx + 1, sy + 3, sw, 1, 'soot1'); b.rect(sx + sw - 1, sy + 1, 1, 2, 'iron2'); }
    for (let y = y0 + 1; y < y1; y++) { b.px(x - 1, y, 'soot7'); b.px(x, y, 'soot6'); b.px(x + 1, y, 'soot4'); if (y > y0 + 12) b.px(x + 2, y, 'soot1'); }
    b.px(x - 1, y0, 'soot6'); b.px(x, y0 - 1, 'soot7'); b.px(x + 1, y0, 'soot4'); b.px(x, y0, 'soot6');
    for (let i = 0; i < Math.min(roads, 3); i++) {
      const dir = i % 2 === 0 ? -1 : 1, by0 = y0 + 6 + i * 16, by1 = by0 + 11, mid = (by0 + by1) >> 1, X = (d: number) => x + 1 + dir * d;
      const bm = mPoly([X(-1), by0, X(21), by0, X(29), (by0 + by1) / 2, X(21), by1, X(-1), by1]);
      b.fill(bm, (px, py) => (py >= by1 - 1 ? 'soot4' : py > mid + 1 || py === mid ? 'soot5' : py === by0 + 1 && Math.abs(px - x) < 22 ? 'soot7' : 'soot6'));
      b.fill(mEdgeUL(bm), 'bone2');
      b.rect(Math.min(X(4), X(12)), mid - 2, 9, 1, 'soot2'); b.rect(Math.min(X(4), X(17)), mid + 1, 14, 1, 'soot2');
      b.px(X(6), mid - 3, 'soot2'); b.px(X(10), mid - 3, 'soot2'); b.px(X(9), mid + 2, 'soot2'); b.px(X(14), mid + 2, 'soot2');
      b.px(X(2), by0 + 2, 'iron4'); b.px(X(2), by1 - 2, 'iron4');
      b.fill(mRing(bm), 'soot1');
      if (i === Math.min(roads, 3) - 1) { b.line(x + 1 + dir * 2, y0 + 20 + i * 16, x + 1 + dir * 12, by1 + 1, 'soot4'); b.line(x + 1 + dir * 2, y0 + 21 + i * 16, x + 1 + dir * 12, by1 + 2, 'soot2'); }
    }
  });
}
/** The noticeboard, with a paper pinned on it for each piece of work posted here (up to four). */
function paintNoticeboard(L: CampLayers, papers: number) {
  const x0 = 518, top = 136;
  shadowPix(L.gnd, x0 + 28, 212, 32, 3, 'soot1', 0.55);
  standProp(L, [x0 - 6, top - 6, x0 + 66, 218], 212, 90, 0.2, b => {
    for (const px of [524, 564]) { b.rect(px, 154, 4, 58, 'soot4'); b.rect(px, 154, 1, 58, 'soot6'); b.rect(px + 3, 155, 1, 57, 'soot2'); }
    b.rect(x0, top, 56, 4, 'soot5'); b.rect(x0, top, 56, 1, 'soot7'); b.rect(x0, top + 3, 56, 1, 'soot2');
    const board = mRect(x0 + 2, top + 4, 52, 44);
    b.fill(board, (x, y) => ((y - top - 4) % 11 === 0 && y > top + 4 ? 'soot3' : y === top + 4 ? 'soot6' : y === top + 47 ? 'soot2' : x === x0 + 2 ? 'soot6' : 'soot4'));
    for (let i = 0; i < Math.min(papers, 4); i++) {
      const x = x0 + 6 + (i % 2) * 22, y = top + 8 + (i >> 1) * 18;
      b.rect(x, y, 18, 14, 'paper3'); b.rect(x, y, 18, 1, 'paper4'); b.rect(x, y + 13, 18, 1, 'paper1'); b.rect(x + 17, y, 1, 14, 'paper2');
      for (const ly of [y + 3, y + 6, y + 9]) b.rect(x + 2, ly, 10 + (ly % 3) * 2, 1, 'paper1');
      b.rect(x + 9, y - 2, 3, 4, 'madder3'); b.px(x + 9, y - 2, 'madder4'); b.px(x + 1, y + 1, 'iron4');
    }
    b.fill(mRing(mOr(board, mRect(x0, top, 56, 4))), 'soot1');
  });
}
/** A rack of pikes at the right of the camp, the heads catching the moon. */
function paintLanceRack(L: CampLayers, x0 = 474, x1 = 494, base = 170) {
  shadowPix(L.gnd, (x0 + x1) / 2 + 2, base + 1, (x1 - x0) / 2 + 4, 2.2, 'soot1', 0.6);
  standProp(L, [x0 - 8, base - 70, x1 + 12, base + 4], base + 1, 80, 0.3, b => {
    const bases = [x0 + 3, x0 + 6, x0 + 9, x0 + 12, x0 + 15, x0 + 18], tops = [x0 + 1, x0 + 4, x0 + 8, x0 + 11, x0 + 16, x0 + 21], hs = [40, 46, 42, 48, 44, 40];
    bases.forEach((xb, i) => {
      const xt = tops[i], ytop = base - 54 - (hs[i] - 40);
      b.line(xb, base, xt, ytop, 'soot6'); if (xb % 2) b.line(xb - 1, base, xt - 1, ytop, 'soot3');
      for (let k = 0; k < 5; k++) b.px(xt, ytop - 1 - k, k < 3 ? 'iron5' : 'iron6');
      b.px(xt - 1, ytop - 2, 'iron4'); b.px(xt + 1, ytop - 3, 'iron3'); b.px(xt - 1, ytop - 3, 'iron4'); b.px(xt, ytop - 6, 'iron7'); b.px(xt, ytop + 1, 'madder3');
    });
    for (const px of [x0, x1]) { b.rect(px, base - 17, 3, 17, 'soot5'); b.rect(px, base - 17, 1, 17, 'soot7'); b.rect(px + 2, base - 16, 1, 16, 'soot3'); b.px(px - 1, base - 18, 'soot6'); b.px(px + 3, base - 18, 'soot6'); b.px(px, base - 18, 'soot7'); b.px(px + 2, base - 18, 'soot6'); }
    for (const [ry, c1, c2] of [[base - 13, 'soot6', 'soot7'], [base - 5, 'soot5', 'soot6']] as const) { b.rect(x0 - 2, ry, x1 - x0 + 7, 2, c1); b.rect(x0 - 2, ry, x1 - x0 + 7, 1, c2); b.rect(x0 - 2, ry + 2, x1 - x0 + 7, 1, 'soot2'); }
  });
}
/** A stack of hay, combed and roped, with a pitchfork leaning on it. */
function paintHaystack(L: CampLayers, cx = 565, base = 190) {
  shadowPix(L.gnd, cx + 5, base + 1, 24, 3.4, 'soot1', 0.6);
  const top = base - 38, half = (y: number) => 20.5 * ((y - top) / (base - top)) ** 0.72 + 0.6;
  const body = mkOf(cx - 24, top, 48, base - top + 6), skirt = mWhere(mEll(cx, base - 1, 21.5, 4.6), (x, y) => y >= base - 3);
  for (let y = top; y <= base; y++) for (let x = Math.round(cx - half(y)); x < Math.round(cx + half(y)); x++) body.a[(y - body.y0) * body.w + x - body.x0] = 1;
  const all = mOr(body, skirt), v = (x: number, y: number) => (x + 0.5 - cx) / Math.max(y >= base - 3 && !mAt(body, x, y) ? 21.5 : half(Math.min(y, base)), 1);
  standProp(L, [cx - 30, top - 10, cx + 34, base + 8], base + 1, 60, 0.25, b => {
    const tones = ['bronze4', 'bronze3', 'bronze2', 'bronze1'];
    b.fill(all, (x, y) => tones[banded(v(x, y), [-0.38, 0.12, 0.58], x, y, 0.1)]);
    const r = mulberry(55), pts: number[][] = [];
    for (let y = top; y <= base; y++) for (let x = Math.round(cx - half(y)); x < Math.round(cx + half(y)); x++) pts.push([x, y]);
    for (let i = 0; i < 230; i++) {
      const [x, y] = pts[Math.floor(r() * pts.length)], len = 3 + Math.floor(r() * 4), vv = v(x, y), sgn = vv < 0 ? -1 : 1;
      let tone = vv < -0.4 ? 'bronze5' : vv < 0.1 ? 'bronze4' : vv < 0.55 ? 'bronze2' : 'bronze1';
      if (r() < 0.45) tone = vv < 0.3 ? 'bronze2' : 'bronze1';
      for (let j = 0; j < len; j++) if (mAt(all, x - sgn * j, y + j)) b.px(x - sgn * j, y + j, tone);
    }
    for (const yy of [top + 16, top + 27]) { const hf = 20.5 * ((yy - top) / (base - top)) ** 0.72; for (let x = Math.floor(cx - hf); x < Math.floor(cx + hf); x++) b.px(x, yy + Math.floor(2.2 * (1 - ((x - cx) / Math.max(hf, 1)) ** 2)), x % 2 ? 'soot3' : 'soot4'); }
    b.fill(mWhere(mEdgeUL(all), (x, y) => v(x, y) < -0.2 && y < base - 4), 'bone3');
    b.fill(mRing(all), (x, y) => (y >= base - 2 ? 'soot1' : 'soot2'));
    for (let i = 0; i < 26; i++) b.px(cx - 23 + Math.floor(r() * 46), base + Math.floor(r() * 4) - 1, r() < 0.6 ? 'bronze2' : 'bronze3');
    for (let y = top - 6; y <= top; y++) { b.px(cx, y, 'soot6'); b.px(cx + 1, y, 'soot3'); }
    b.px(cx - 1, top - 6, 'soot7'); b.px(cx - 1, top, 'bronze3'); b.px(cx + 1, top - 1, 'bronze2'); b.px(cx - 2, top + 1, 'bronze3');
    b.line(cx + 25, base, cx + 15, base - 26, 'soot6'); b.line(cx + 26, base, cx + 16, base - 26, 'soot3');
    for (const dx of [-2, 0, 2]) { b.px(cx + 15 + dx, base - 28, 'iron4'); b.px(cx + 15 + dx, base - 29, 'iron5'); }
    b.rect(cx + 13, base - 27, 5, 1, 'iron3');
  });
}
/** A small keg on its side, at the foot of a tent. */
function paintKeg(L: CampLayers, cx = 452, base = 175) {
  shadowPix(L.gnd, cx + 2, base + 1, 10, 2, 'soot1', 0.6);
  const len = 15, hh = 10, x0 = cx - (len >> 1), y0 = base - hh, sil = mkOf(x0 - 2, y0 - 2, len + 6, hh + 4);
  for (let i = 0; i < len; i++) {
    const half = hh / 2 * (0.84 + 0.16 * Math.sin(Math.PI * (i + 0.5) / len));
    for (let y = Math.round(y0 + hh / 2 - half); y < Math.round(y0 + hh / 2 + half); y++) sil.a[(y - sil.y0) * sil.w + x0 + i - sil.x0] = 1;
  }
  const end = mEll(x0 + 1.5, y0 + hh / 2, 2.2, hh / 2 - 0.5);
  standProp(L, [x0 - 3, y0 - 4, x0 + len + 5, base + 4], base + 1, 40, 0.6, b => {
    b.fill(sil, (x, y) => { const t = (y - y0) / hh; return [3, 7, 11, 12, 2].includes(x - x0) ? (t < 0.25 ? 'iron5' : t < 0.6 ? 'iron4' : 'iron3') : t < 0.25 ? OAK[0] : t < 0.62 ? OAK[1] : t < 0.88 ? OAK[2] : OAK[3]; });
    b.fill(end, (x) => (x > x0 + 1 ? 'ochre3' : 'ochre4'));
    b.px(x0 + len, y0 + hh - 3, 'bronze4'); b.px(x0 + len + 1, y0 + hh - 3, 'bronze3'); b.px(x0 + len + 1, y0 + hh - 2, 'bronze2');
    b.fill(mRing(mOr(sil, end)), 'soot1'); b.fill(mWhere(mEdgeUL(sil), (x, y) => y < y0 + 3), 'bronze5');
    b.rect(x0 + 1, base, 3, 1, 'soot3'); b.rect(x0 + len - 4, base, 3, 1, 'soot3');
  });
}
/** A pile of split logs between two stakes. */
function paintWoodpile(L: CampLayers, x0 = 406, base = 208) {
  shadowPix(L.gnd, x0 + 11, base + 1, 14, 2.6, 'soot1', 0.6);
  standProp(L, [x0 - 4, base - 18, x0 + 28, base + 4], base + 1, 30, 0.9, b => {
    const r = mulberry(91);
    for (let row = 0; row < 4; row++) {
      const y = base - 3 - row * 3;
      let x = x0 + (row % 2) * 2;
      while (x < x0 + 21) {
        const len = Math.min(9 + Math.floor(r() * 4), x0 + 21 - x);
        if (len < 4) break;
        b.rect(x, y, len, 3, 'soot5'); b.rect(x, y, len, 1, 'soot6'); b.rect(x, y + 2, len, 1, 'soot3'); b.px(x, y + 1, 'soot7');
        if (len > 5) b.px(x + 1, y, 'soot7');
        b.px(x + len - 1, y, 'soot1'); b.px(x + len - 1, y + 1, 'soot2');
        x += len;
      }
    }
    b.rect(x0 - 1, base - 13, 2, 14, 'soot6'); b.rect(x0 + 21, base - 13, 2, 14, 'soot4'); b.px(x0 - 1, base - 13, 'soot7');
  });
}
/** A hooped wooden bucket with a ladle hooked over the rim. */
function paintBucket(L: CampLayers, cx = 352, base = 217) {
  shadowPix(L.gnd, cx + 2, base + 1, 7, 1.8, 'soot1', 0.6);
  const body = mPoly([cx - 4, base - 9, cx + 4, base - 9, cx + 3, base, cx - 3, base]), top = mEll(cx, base - 9, 4.2, 1.5);
  standProp(L, [cx - 8, base - 22, cx + 14, base + 4], base + 1, 30, 0.9, b => {
    b.fill(body, (x, y) => ((y === base - 7 || y === base - 2) ? (x < cx - 1 ? 'iron5' : 'iron3') : x < cx - 1 ? 'ochre3' : x > cx + 1 ? 'ochre1' : 'ochre2'));
    b.fill(top, (x, y) => (Math.abs(x + 0.5 - cx) < 2.8 && Math.abs(y + 0.5 - (base - 9)) < 0.8 ? 'bronze2' : 'ochre1')); b.px(cx - 1, base - 9, 'bronze4');
    b.fill(mRing(mOr(body, top)), 'soot1'); b.px(cx - 4, base - 9, 'bronze5');
    b.line(cx + 3, base - 10, cx + 7, base - 15, 'soot6'); b.line(cx + 4, base - 10, cx + 8, base - 15, 'soot3'); b.rect(cx + 6, base - 17, 3, 2, 'soot5'); b.px(cx + 6, base - 17, 'soot7');
  });
}
/** The company's banner: its pole, planted in a heap of earth. The finial and the tassels are gilt, and are painted after the light (see paintBanner); the cloth is the camp's flag. */
function paintBannerPole(L: CampLayers) {
  const px = 320, top = 30, base = 166;
  shadowPix(L.gnd, px + 2, base + 3, 8, 1.8, 'soot1', 0.6);
  standProp(L, [px - 8, top, px + 8, base + 4], base, 150, 0.9, b => {
    for (let y = top + 6; y < base; y++) { b.px(px - 1, y, 'bone3'); b.px(px, y, 'soot5'); }
    b.stamp(['..sss..', '.sbbbs.', 'sbbbbbs'], { s: 'soot3', b: 'soot5' }, px - 3, base - 1); b.rect(px - 4, base + 1, 8, 1, 'soot1');
  });
}
/** What is painted after the light, in the colours it is meant to be: the gilt finial and tassels of the banner. */
function paintBannerGilt(f: Pix) {
  const b = penOf(f), px = 320, top = 30;
  b.stamp(['.a.', 'aab', 'aab', '.ab', 'ccc', '.b.'], { a: 'bronze5', b: 'bronze3', c: 'bronze4' }, px - 2, top - 6); b.px(px - 1, top - 7, 'bronze6');
  for (const dx of [-3, 3]) { b.line(px - 1 + (dx > 0 ? 1 : 0), top + 1, px - 1 + dx, top + 8, 'madder3'); b.rect(px - 1 + dx, top + 8, 1, 3, 'bronze3'); }
}
/** Dark water in an ellipse, its edge ragged and ripples dithered over it, on the pixels of a raster where there is ground to take it. tones are the deep water, the middle and the lights. */
function paintWater(p: Pix, cx: number, cy: number, rx: number, ry: number, where: (x: number, y: number) => boolean, tones: readonly [string, string, string] = ['woad2', 'woad3', 'woad4']) {
  for (let y = Math.floor(cy - ry) - 4; y < Math.ceil(cy + ry) + 4; y++) for (let x = Math.floor(cx - rx) - 4; x < Math.ceil(cx + rx) + 4; x++) {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + (fbm(x, y, 77, 8, 4, 2) - 0.5) * 0.35;
    if (d > 1 || !where(x, y)) continue;
    const nn = fbm(x, y, 78, 14, 2.2, 2), b = bayer(x, y);
    let c = d > 0.86 ? 'soot2' : tones[0];
    if (d <= 0.86 && nn > 0.58 && (nn - 0.5) * 2 > b) c = tones[1];
    if (d <= 0.8 && nn > 0.7 && (nn - 0.62) * 3 > b && y % 2 === 0) c = tones[2];
    if (d > 0.9 && b < 0.5) c = 'soot3';
    putPix(p, x, y, c);
  }
}
/** The raft of rye: lashed logs under planks, a post at each end, and sacks of grain on it. */
function raftPainter(b: Pen, load: number) {
  const n = Math.max(1, Math.round(5 * load));
  for (let k = 0; k < 4; k++) { const y = 190 + k * 3; b.rect(18, y, 104, 3, k % 2 ? 'soot4' : 'soot5'); b.rect(18, y, 104, 1, 'soot6'); b.rect(18, y + 2, 104, 1, 'soot3'); for (let x = 22 + k * 5; x < 120; x += 17) b.px(x, y + 1, 'soot2'); }
  b.rect(16, 188, 3, 15, 'soot3'); b.rect(121, 188, 3, 15, 'soot3'); b.rect(16, 188, 3, 1, 'soot6');
  for (let i = 0; i < n; i++) sack(b, 24 + i * 19, 191 - (i % 2) * 6, i % 2 === 1, i % 2 ? LINEN : JUTE);
  b.fill(mRing(mRect(18, 190, 104, 12)), 'soot1');
  b.rect(18, 202, 104, 1, 'soot1');
}
/** The raft of rye, moored at the left of the camp: dark water, planks, and sacks of grain. */
function paintRaft(L: CampLayers, load: number) {
  paintWater(L.gnd, 62, 192, 92, 17, (x, y) => getPix(L.gnd, x, y) >= 0);
  shadowPix(L.gnd, 70, 204, 52, 3.4, 'night0', 0.6);
  standProp(L, [10, 150, 150, 214], 204, 70, 0.3, b => raftPainter(b, load));
}
/* ---------- the camp composed: the layers lit by the hour, and the camp's own canvas ---------- */
/** The hours the camp is lit for: the night it is drawn at, the glow of dawn and dusk, and the day. */
type CampMode = 'night' | 'warm' | 'day';
/** How much of the fire's light each hour has. */
const MODE_FIRE: Record<CampMode, number> = { night: 1, warm: 0.55, day: 0 };
const modeLuts: Record<string, Lut[]> = {};
/** The luts of an hour, for the ground (with more levels of firelight) or for what stands: [the grade of the hour, firelight 1 to n]. */
function lutsFor(mode: CampMode, ground: boolean): Lut[] {
  const key = mode + (ground ? 'g' : 'p');
  return modeLuts[key] || (modeLuts[key] = lightLuts(gradeLut(mode === 'night' ? GRADE_NIGHT : mode === 'day' ? GRADE_DAY : GRADE_DUSK), ground ? GROUND_LEVELS : FIRE_LEVELS));
}
/** The level of light a pixel gets from how much light falls on it (0 to 1), n levels, the steps between them dithered by an ordered pattern (jw is how wide the dither is). */
const levelOf = (I: number, n: number, x: number, y: number, jw: number) => { const v = (I < 0 ? 0 : I > 1 ? 1 : I) * n + 0.5 + (bayer(x, y) - 0.5) * jw, l = v < 0 ? 0 : v | 0; return l > n ? n : l; };
const keyAt = (d: Uint8ClampedArray, i: number) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
function setAt(p: Pix, i: number, c: number) { p.d[i] = (c >> 16) & 255; p.d[i + 1] = (c >> 8) & 255; p.d[i + 2] = c & 255; p.d[i + 3] = 255; }
/** A small pool of warm light laid on the finished picture: the dyes under it go up the levels of firelight, thinning towards its edge. */
function localGlow(out: Pix, luts: readonly Lut[], cx: number, cy: number, rx: number, ry: number, strength: number, jw = 0.8, pw = 1) {
  const n = luts.length - 1;
  for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(FH, Math.ceil(cy + ry) + 1); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(FW, Math.ceil(cx + rx) + 1); x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry), i = (y * FW + x) * 4;
    if (d >= 1 || !out.d[i + 3]) continue;
    const lvl = levelOf((1 - d) ** pw * strength, n, x, y, jw);
    if (!lvl) continue;
    const k = keyAt(out.d, i), m = luts[lvl].get(k);
    if (m !== undefined) setAt(out, i, m);
  }
}
/** The door of a tent seen from the fire: dark, with the glow of a candle and a bed roll deep inside, and the light that spills out of it on the earth. lit is how much of the night is in the hour. */
function paintDoor(out: Pix, door: CampDoor, luts: readonly Lut[], lit: number) {
  const { m, cx, base } = door;
  let y0 = Infinity, y1 = -Infinity;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.a[y * m.w + x]) { y0 = Math.min(y0, m.y0 + y); y1 = Math.max(y1, m.y0 + y); }
  if (y0 > y1) return;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    for (let x = m.x0; x < m.x0 + m.w; x++) {
      if (!mAt(m, x, y)) continue;
      const th = bayer(x, y);
      let c = 'soot0';
      if (lit > 0.3) { if (t > 0.8) c = th < 0.45 ? 'ochre2' : 'ochre1'; else if (t > 0.58) c = th < (t - 0.58) * 3 ? 'ochre1' : 'soot1'; else if (t > 0.4) c = th < (t - 0.4) * 2.2 ? 'soot2' : 'soot0'; } else c = t > 0.6 ? 'soot2' : 'soot1';
      putPix(out, x, y, c);
    }
  }
  if (lit > 0.3) {
    const lx = Math.floor(cx), ly = Math.floor(base - 5);
    for (const [dx, dy, c] of [[0, 0, 'fire4'], [0, 1, 'fire3'], [-1, 1, 'fire2'], [1, 1, 'fire2'], [0, -1, 'fire3']] as const) if (mAt(m, lx + dx, ly + dy)) putPix(out, lx + dx, ly + dy, c);
    for (let x = Math.floor(cx) - 4; x <= Math.floor(cx) + 4; x++) if (mAt(m, x, base - 1)) putPix(out, x, base - 1, (x + base) % 2 ? 'bronze2' : 'ochre2');
    localGlow(out, luts, cx, base + 4, 16, 5.5, 0.75 * lit, 0.8);
  }
}
/** The lantern hung on the cart: a glow on what is round it, then an iron frame round a lit pane. */
function paintLantern(out: Pix, luts: readonly Lut[], lx: number, ly: number, lit: number) {
  if (lit > 0.3) localGlow(out, luts, lx, ly + 4, 26, 16, 0.95 * lit, 0.85, 1.1);
  const b = penOf(out);
  b.rect(lx - 2, ly - 2, 5, 1, 'iron3'); b.rect(lx - 2, ly + 5, 5, 1, 'iron2'); b.rect(lx - 2, ly - 1, 5, 6, 'iron2');
  if (lit > 0.3) { b.rect(lx - 1, ly, 3, 4, 'fire4'); b.px(lx, ly + 1, 'fire6'); b.px(lx, ly + 2, 'fire5'); b.px(lx - 1, ly + 3, 'fire3'); b.px(lx + 1, ly + 3, 'fire3'); } else b.rect(lx - 1, ly, 3, 4, 'bone1');
  b.px(lx, ly - 3, 'iron3'); b.px(lx - 1, ly - 2, 'iron4');
}
/**
 * The layers as the hour sees them: the far trees and the ground and what stands each turned to the dyes of the hour and, where the fire's light falls, lit by it in
 * steps that are dithered into one another; then what is painted after the light.
 */
function composeCamp(L: CampLayers, mode: CampMode): Pix {
  const set = setAt, out = newPix(FW, FH), fire = MODE_FIRE[mode], lutG = lutsFor(mode, true), lutP = lutsFor(mode, false), amb = lutG[0], ng = lutG.length - 1, np = lutP.length - 1;
  for (let p = 0; p < FW * FH; p++) { const i = p * 4; if (L.far.d[i + 3]) { const k = keyAt(L.far.d, i); set(out, i, amb.get(k) ?? k); } }
  for (let y = GY0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const i = (y * FW + x) * 4;
    if (!L.gnd.d[i + 3]) continue;
    const I = fire ? clamp((falloff(x, y) - 0.05) / 0.95, 0, 1) * 0.95 * clamp(1 - (y - 236) / 120, 0.55, 1) * fire : 0, k = keyAt(L.gnd.d, i);
    set(out, i, lutG[levelOf(I, ng, x, y, 1)].get(k) ?? k);
  }
  for (let p = 0; p < FW * FH; p++) {
    const i = p * 4;
    if (!L.props.d[i + 3]) continue;
    const k = keyAt(L.props.d, i);
    set(out, i, lutP[levelOf(L.pl[p] * fire, np, p % FW, (p / FW) | 0, 0.62)].get(k) ?? k);
  }
  const lit = fire > 0.9 ? 1 : fire > 0.3 ? 0.6 : 0, glow = [new Map() as Lut, ...lutP.slice(1)];
  for (let p = 0; p < FW * FH; p++) { const i = p * 4; if (L.fin.d[i + 3]) set(out, i, keyAt(L.fin.d, i)); }
  for (const d of L.doors) paintDoor(out, d, glow, lit);
  if (L.lantern) paintLantern(out, glow, L.lantern[0], L.lantern[1], lit);
  for (const late of L.late) late(out, mode);
  return out;
}
/** A skyline as an hour sees it: by night as the land gave it, dark; by day and at dusk the haze of distance over it. */
function tintedSkyline(sk: HTMLCanvasElement, mode: CampMode) {
  if (mode === 'night') return sk;
  const c = sceneCanvas(CW, HZ), g = c.getContext('2d')!;
  g.drawImage(sk, 0, 0, CW, HZ);
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.82; g.fillStyle = hexN(D(mode === 'day' ? 'woad5' : 'plum2')); g.fillRect(0, 0, CW, HZ);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  return c;
}
/** The camp's layers, and the skyline behind them, kept with the canvas that is drawn from them so that the same camp can be had at another hour. */
interface CampBake { layers: CampLayers; skyline: HTMLCanvasElement; made: Partial<Record<CampMode, HTMLCanvasElement>>; flare?: HTMLCanvasElement }
/** The camp's ground, and all that stands on it, as one hour sees them (the sky is left clear, and is campSky's). */
function bakeCanvas(L: CampLayers, skyline: HTMLCanvasElement, mode: CampMode) {
  const c = sceneCanvas(CW, CH), g = c.getContext('2d')!;
  g.drawImage(tintedSkyline(skyline, mode), 0, 81 - HZ, CW, HZ);
  g.drawImage(pixCanvas(composeCamp(L, mode)), 0, 0, CW, CH);
  return c;
}
/**
 * The pixels of the night's camp that a brighter fire would light one level more. Laid over the camp at the moments the fire flares, they make the edge of its
 * pool of light shimmer, as a flame does. Made on the first moment it is wanted.
 */
function campFlare(back: HTMLCanvasElement) {
  const b = back.bake;
  if (!b) return null;
  if (b.flare) return b.flare;
  const L = b.layers, out = newPix(FW, FH), lutG = lutsFor('night', true), lutP = lutsFor('night', false), ng = lutG.length - 1, np = lutP.length - 1, set = setAt;
  for (let y = 90; y < FH; y++) for (let x = 100; x < 540; x++) {
    const i = (y * FW + x) * 4;
    if (L.gnd.d[i + 3]) {
      const I = clamp((falloff(x, y) - 0.05) / 0.95, 0, 1) * 0.95 * clamp(1 - (y - 236) / 120, 0.55, 1), k = keyAt(L.gnd.d, i), a = levelOf(I, ng, x, y, 1), c = levelOf(I * 1.05 + 0.012, ng, x, y, 1);
      if (c > a) set(out, i, lutG[c].get(k) ?? k);
    }
    if (L.props.d[i + 3]) {
      const I = L.pl[y * FW + x], k = keyAt(L.props.d, i), a = levelOf(I, np, x, y, 0.62), c = levelOf(I * 1.05 + 0.012, np, x, y, 0.62);
      if (c > a) set(out, i, lutP[c].get(k) ?? k);
    }
  }
  return (b.flare = pixCanvas(out));
}
/** The back of the camp as another hour has it: made once from the same layers. */
function campVariant(back: HTMLCanvasElement, mode: CampMode) {
  const b = back.bake;
  if (!b) return back;
  return b.made[mode] || (b.made[mode] = bakeCanvas(b.layers, b.skyline, mode));
}

/**
 * Paints the whole camp, back to front, in the layers: far trees, the ground with its pit and tracks, the tabir far behind, the tents, the things lying about, the logs round the
 * fire, the cargo of the quest, the signpost, the banner. The signs and the notices are the state of the company: a board for each road, a paper for each piece of work.
 */
function paintCamp(st: Campaign): CampLayers {
  const L: CampLayers = { far: newPix(FW, FH), gnd: newPix(FW, FH), props: newPix(FW, FH), fin: newPix(FW, FH), pl: new Float32Array(FW * FH), doors: [], lantern: null, late: [] };
  const land = here(st).land, q = questOf(st), load = st.cargo0 ? st.cargo / st.cargo0 : 1, work = has(st, 'work');
  paintTrees(L.far, land);
  paintGround(L, land);
  paintPit(L);
  paintFence(L, 258, 322, 157);
  [[330, 157, true], [355, 158, false], [376, 159, true], [468, 158, false], [494, 157, true]].forEach(([x, y, cover], i) => paintFarWagon(L, x as number, y as number, 26, cover as boolean, i % 2 === 0 ? 'sacks' : 'hay'));
  paintBush(L, 262, 158, 7, 5); paintBush(L, 458, 160, 6, 6);
  [[490, 160, 7], [516, 161, 8], [547, 162, 9], [575, 161, 8], [601, 162, 9], [628, 162, 9], [14, 156, 6], [96, 157, 7], [138, 158, 6], [284, 158, 5]].forEach(([x, y, r], k) => paintBush(L, x, y, r, 40 + k));
  shadowPix(L.gnd, 425 + 8, 163, 50, 3.4, 'soot1', 0.6); shadowPix(L.gnd, 205 - 8, 171, 60, 3.4, 'soot1', 0.6);
  bellTent(L, 425, 96, 162, 45, -17, 16, 28, -1, true, 2); guyRopes(L, 425, 96, 162, 45, [[370, 168], [476, 166]]);
  bellTent(L, 205, 98, 170, 55, 22, 18, 32, 1, false, 1); guyRopes(L, 205, 98, 170, 55, [[126, 176], [270, 174]]);
  paintLanceRack(L); paintBucket(L); paintKeg(L);
  if (!work) paintHaystack(L, 548);
  CAMP.rest.forEach((s, k) => paintSeat(L, s[0] * SS, s[1] * SS, SEAT_ANGLES[k % SEAT_ANGLES.length], k));
  if (q.transport === 'raft') paintRaft(L, load);
  else if (q.transport === 'herd') paintHerd(L, load);
  else { paintCart(L, q.transport, load); paintOx(L, -8, 172, true, 1); }
  paintWoodpile(L);
  paintSignpost(L, roadsFrom(st).length);
  if (work) paintNoticeboard(L, st.contracts.length);
  paintBannerPole(L); paintBannerGilt(L.fin);
  return L;
}
/** The camp at night: the ground, the tents and all that stands on it, with the sky left clear (see campSky). It carries the stars of the night, and the layers it was lit from. */
function campBack(st: Campaign) {
  const L = paintCamp(st), sk = skylineOf(here(st).land, st.date % 3 + 1, CW), c = bakeCanvas(L, sk, 'night');
  c.bake = { layers: L, skyline: sk, made: {} };
  c.stars = campStars(st.date * 31 + 7);
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
/* ---------- the fire: a few frames of it painted once, and the light it throws on the men ---------- */
/** One tongue of flame rising from x0, y0: outer fire3, then fire4, fire5 and a hot core of fire6. */
function flamePix(b: Pen, x0: number, y0: number, h: number, w: number, lean: number, wob = 0, core = true) {
  for (let r = 0; r < Math.floor(h); r++) {
    const t = r / h, half = Math.max(0, w * 0.5 * (1 - t ** 1.15) ** 0.85), cx = x0 + lean * t * t + wob * Math.sin(t * 5), y = Math.floor(y0 - r);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const e = Math.abs(x - cx) / Math.max(half, 0.8);
      b.px(x, y, core && e < 0.3 && t < 0.4 ? 'fire6' : e < 0.5 && t < 0.66 ? 'fire5' : e < 0.78 && t < 0.86 ? 'fire4' : 'fire3');
    }
  }
}
/** The stones round the pit: fourteen, the near ones showing their lit top and a dark face, the far ones the face the flames light. */
function fireStones(b: Pen, front: boolean) {
  const ring: number[][] = [];
  for (let k = 0; k < 14; k++) { const a = k / 14 * 2 * Math.PI + 0.25; ring.push([FIRE_X + Math.cos(a) * 16.8, FIRE_Y + 1.5 + Math.sin(a) * 6.9]); }
  for (const [sx, sy] of ring.sort((a, c) => a[1] - c[1])) {
    if ((sy >= FIRE_Y + 1.5) !== front) continue;
    const x = Math.round(sx), y = Math.round(sy);
    if (front) { b.rect(x - 2, y - 1, 5, 1, 'ochre3'); b.px(x - 2, y - 1, 'ochre2'); b.px(x + 2, y - 1, 'ochre2'); b.rect(x - 2, y, 5, 2, 'iron2'); b.px(x - 2, y, 'iron3'); b.rect(x - 1, y + 2, 4, 1, 'soot1'); }
    else { b.rect(x - 2, y - 1, 5, 1, 'iron2'); b.rect(x - 2, y, 5, 2, 'bronze3'); b.px(x - 1, y + 1, 'ochre4'); b.px(x + 1, y, 'ochre4'); b.px(x + 2, y + 1, 'ochre2'); b.px(x - 2, y + 1, 'ochre2'); }
  }
}
/** The tripod: three legs of iron-shod wood, the two in front lit on the side that faces the flames, bound at the apex with rope. */
function fireTripod(b: Pen, ax = 320, ay = 175) {
  for (const [x1, y1, tag] of [[322, 197, 'B'], [302, 207, 'L'], [338, 207, 'R']] as const) {
    const n = Math.floor(Math.max(Math.abs(x1 - ax), Math.abs(y1 - ay))) + 1, inner = tag === 'L' ? 1 : -1;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = Math.round(ax + (x1 - ax) * t), y = Math.round(ay + (y1 - ay) * t);
      if (tag === 'B') { b.px(x, y, 'soot3'); continue; }
      b.px(x, y, 'soot2'); b.px(x + inner, y, t > 0.55 ? 'ochre3' : t > 0.3 ? 'ochre2' : 'bronze1');
      if (t > 0.15) b.px(x - inner, y, 'soot1');
    }
  }
  b.rect(ax - 2, ay - 1, 5, 3, 'paper1'); b.rect(ax - 2, ay, 5, 1, 'bone0'); b.px(ax - 2, ay - 1, 'bone2'); b.px(ax - 1, ay - 1, 'bone2'); b.px(ax + 2, ay + 1, 'soot3'); b.rect(ax - 2, ay + 2, 5, 1, 'soot1'); b.px(ax, ay + 3, 'iron4'); b.px(ax, ay + 4, 'iron2');
}
/** An iron cauldron hung low over the flames: a dark body, a firelit belly, the rim bright on the left. */
function fireCauldron(b: Pen, cx = 320, cy = 187) {
  const body = mWhere(mEll(cx, cy, 7.7, 8.3), (x, y) => y >= cy - 5), lip = mEll(cx, cy - 5, 8.6, 2.5), mouth = mEll(cx, cy - 5.2, 6.7, 1.9);
  b.fill(body, (x, y) => {
    const xc = x + 0.5, bay = bayer(x, y);
    if (y >= cy + 3) return y >= cy + 6 && xc < cx - 1 && bay > 0.6 ? 'fire3' : y >= cy + 6 && bay > 0.35 ? 'fire2' : y >= cy + 5 ? 'fire1' : y >= cy + 4 ? 'fire0' : 'madder0';
    return xc > cx + 3.5 ? 'iron0' : xc < cx - 4.5 && y > cy - 3 && y < cy + 2 ? 'iron3' : xc < cx - 2.5 && y > cy - 4 && y < cy + 4 ? 'iron2' : 'iron1';
  });
  b.fill(lip, (x, y) => (x + 0.5 < cx - 1 ? 'iron5' : x + 0.5 > cx + 3 ? 'iron2' : y >= cy - 4 && bayer(x, y) > 0.5 && x + 0.5 < cx + 2 ? 'ochre4' : 'iron3'));
  b.fill(mouth, (x, y) => (y > cy - 6 && x + 0.5 > cx - 3 && x + 0.5 < cx + 1 ? 'bronze3' : y > cy - 6 && bayer(x, y) > 0.5 ? 'ochre1' : 'soot1'));
  b.px(cx - 2, cy - 6, 'bronze5'); b.px(cx + 1, cy - 5, 'bronze4');
  b.fill(mRing(mOr(body, lip)), 'soot1');
  for (let k = -7; k <= 7; k++) b.px(cx + k, cy - 8 - Math.round(3 * (1 - (k / 7) ** 2)), k < 3 ? 'iron3' : 'iron2');
  b.px(cx - 7, cy - 7, 'iron3'); b.px(cx + 7, cy - 7, 'iron2');
}
/** A charred log in the pit, glowing along its top. */
function fireLog(b: Pen, x0: number, y0: number, x1: number, y1: number, t: number) {
  const vx = x1 - x0, vy = y1 - y0, v2 = vx * vx + vy * vy;
  for (let y = Math.min(y0, y1) - 4; y <= Math.max(y0, y1) + 4; y++) for (let x = Math.min(x0, x1) - 4; x <= Math.max(x0, x1) + 4; x++) {
    const tt = clamp(((x - x0) * vx + (y - y0) * vy) / v2, 0, 1), d = Math.hypot(x - (x0 + tt * vx), y - (y0 + tt * vy));
    if (d > t / 2 + 0.35) continue;
    const top = y + 0.5 < y0 + vy * tt - 0.3;
    b.px(x, y, top ? (d > t / 2 - 0.3 && bayer(x, y) > 0.4 ? 'fire1' : 'soot3') : 'soot2');
  }
}
const FIRE_BOX = [290, 168, 60, 46] as const;
let fireFrameCanvases: HTMLCanvasElement[] | null = null;
/** The fire in three frames: its flames leaning and rising a little differently, the glow of it on the earth round the pit stronger and weaker. */
function fireFrames() {
  if (fireFrameCanvases) return fireFrameCanvases;
  return (fireFrameCanvases = [0, 1, 2].map(f => {
    const p = newPix(FIRE_BOX[2], FIRE_BOX[3], FIRE_BOX[0], FIRE_BOX[1]), b = penOf(p), sw = [0, 1, -1][f], gl = [1, 1.14, 0.9][f];
    for (let y = FIRE_Y - 9; y < FIRE_Y + 15; y++) for (let x = FIRE_X - 30; x < FIRE_X + 30; x++) {
      const d = Math.hypot((x + 0.5 - FIRE_X) / 27, (y + 0.5 - (FIRE_Y + 2)) / 12);
      if (d >= 1) continue;
      if (d < 0.62 && clamp((0.62 - d) * 0.45 * gl, 0, 0.2) > bayer(x, y)) b.px(x, y, 'fire2'); else if (clamp((1 - d) * 0.55 * gl, 0, 0.3) > bayer(x, y)) b.px(x, y, 'fire1');
    }
    fireStones(b, false);
    fireLog(b, 309, 204, 331, 198, 4); fireLog(b, 331, 204, 309, 198, 4); fireLog(b, 312, 197, 328, 195, 3);
    for (const [x, y, h, w, lean, wob] of [[313, 199, 17, 8, -1.5, 0.5], [327.5, 199, 19, 8, 2.5, 0.6], [320, 199, 12, 9, 1, 0], [309.5, 200, 8, 5, -1.5, 0], [331.5, 200, 8, 5, 2, 0]] as const)
      flamePix(b, x, y, h + sw * (x > 320 ? 2 : -1.5), w, lean + sw * 0.8, wob + f * 0.3);
    fireTripod(b); fireCauldron(b);
    for (const [x, y, h, w, lean] of [[316, 203, 9, 6, -0.5], [323.5, 203, 10, 6, 1], [320, 204, 6, 5, 0], [312, 202, 5, 3, -1], [328.5, 202, 6, 4, 1]] as const) flamePix(b, x, y, h + (x > 320 ? sw : -sw), w, lean + sw * 0.5);
    for (const [x, y, c] of [[312, 203, 'fire2'], [315, 202, 'fire3'], [318, 201, 'fire3'], [322, 201, 'fire3'], [325, 202, 'fire2'], [328, 201, 'fire2'], [314, 204, 'fire1'], [326, 204, 'fire1'], [310, 204, 'fire1'], [330, 204, 'fire1']] as const) b.px(x, y, c);
    for (const [x, y, c] of [[329, 178, 'fire4'], [330, 177, 'fire3'], [312, 181, 'fire3'], [333, 180, 'fire3'], [314, 180, 'fire4'], [332, 175, 'fire2']] as const) if ((x + f) % 3) b.px(x + sw, y + (f ? -f : 0), c);
    b.rect(317, 201, 7, 2, 'fire5'); b.rect(318, 200, 5, 1, 'fire6'); b.rect(319, 201, 3, 2, 'fire6'); b.rect(319, 199, 3, 1, 'fire6');
    fireStones(b, true);
    const r = mulberry(9);
    for (let i = 0; i < 22; i++) { const a = r() * 2 * Math.PI, rr = 9 + r() * 11, c = r() < 0.6 ? 'fire1' : 'fire2'; if ((i + f) % 4) b.px(Math.floor(FIRE_X + Math.cos(a) * rr), Math.floor(FIRE_Y + 2 + Math.sin(a) * rr * 0.42), c); }
    return pixCanvas(p);
  }));
}
const campShadows: Record<string, HTMLCanvasElement> = {};
/** The hard-edged shadow a man casts on the ground, as the ground's own shadows are (a solid core and a rim of every other pixel); a man lying has a longer one. Kept. */
function campShadow(lying: boolean) {
  const key = lying ? 'lying' : 'standing';
  if (!campShadows[key]) { const p = newPix(lying ? 40 : 30, 8); groundShadow(p, p.w / 2, 4, p.w / 2 - 2, 2.6, 'soot0', 0.5); campShadows[key] = pixCanvas(p); }
  return campShadows[key];
}
/** The fire of the camp, in the frame of the moment: still, it is the first. */
function campFire(g: CanvasRenderingContext2D, t: number, still: boolean) {
  const f = fireFrames()[still ? 0 : [0, 1, 2, 1, 0, 2][Math.floor(t * 7) % 6]];
  g.drawImage(f, FIRE_BOX[0] / SS, FIRE_BOX[1] / SS, FIRE_BOX[2] / SS, FIRE_BOX[3] / SS);
}

/* ---------- the banner: a swallow-tailed cloth of madder with a gilt cross, rippling in the wind off the left ---------- */
function campFlag(g: CanvasRenderingContext2D, t: number) {
  const x0 = 321, y0 = 33, len = 44, hgt = 23, notch = 15, amp = 3.4, ph = t * 3.2;
  const off = (c: number) => amp * Math.min(1, 0.12 + c / (len - 1) * 1.05) * Math.sin(c / 5.6 + 0.4 - ph) + 0.025 * c;
  const slope = (c: number) => Math.cos(c / 5.6 + 0.4 - ph) * amp * Math.min(1, 0.12 + c / (len - 1) * 1.05) / 5.6;
  const rect = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = hexN(D(c)); g.fillRect(x / SS, y / SS, w / SS, h / SS); };
  const lift: Record<string, string> = { madder3: 'madder4', madder4: 'madder5', madder2: 'madder3' };
  for (let c = 0; c < len; c++) {
    const dy = Math.round(off(c)), sl = slope(c), k = c >= len - notch ? (c - (len - notch)) / notch : 0, cut = k * hgt * 0.5;
    let run = '', from = 0;
    const flush = (to: number) => { if (run) rect(x0 + c, y0 + dy + from, 1, to - from, run); };
    for (let r = 0; r < hgt; r++) {
      let tone = 'madder3';
      if (k && Math.abs(r + 0.5 - hgt / 2) < cut * 0.98) tone = '';
      else {
        if (sl < -0.1) tone = 'madder4'; else if (sl > 0.12) tone = 'madder2';
        if (r === 0) tone = sl < 0.12 ? 'madder5' : 'madder4';
        if (r >= hgt - 3) tone = lift[tone] || tone;
        if (r === hgt - 1) tone = c % 2 === 0 ? 'madder5' : 'fire2';
        if (c === 1) tone = 'bronze3';
      }
      if (tone !== run) { flush(r); run = tone; from = r; }
    }
    flush(hgt);
  }
  const ccx = x0 + 12;
  for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [-2, 2], [-1, 2], [1, 2], [2, 2]]) {
    const yy = y0 + 6 + dy + Math.round(off(ccx + dx - x0));
    rect(ccx + dx, yy, 1, 1, dx <= 0 && dy < 4 ? 'bronze5' : 'bronze4');
    if (dx === 0) rect(ccx + 1, yy, 1, 1, 'bronze3');
  }
  for (let dy = 0; dy < 8; dy++) if (dy !== 2) rect(ccx + 1, y0 + 6 + dy + Math.round(off(ccx + 1 - x0)), 1, 1, 'bronze2');
}

/* ---------- the light of the fire on the men ---------- */
const warmCache = new Map<string, string>();
/** A colour (#rrggbb) as the firelight at this level (1 to 4) makes it: lighter, and pushed towards orange. Kept. */
function warmHex(hex: string, level: number) {
  const key = hex + level;
  let c = warmCache.get(key);
  if (c === undefined) {
    const s = [0, 0.35, 0.7, 1.1, 1.6][level], [Lt, a, b] = oklab(packN(hex));
    warmCache.set(key, c = hexN(fromOklab(Math.min(1, Lt * (1 + 0.55 * s) + 0.04 * s), a + 0.03 * s, b + 0.06 * s)));
  }
  return c;
}
/**
 * A painter for a man by the fire, to hand to the figures in place of the canvas: it paints on g, but each colour is the one the fire's light makes of it at that pixel
 * (stronger the nearer the fire his feet are, less on his head than his boots), the levels of light dithered into one another as the ground's are. strength is how bright the
 * fire is (0 by day); pool is how much light the fire throws at a fine pixel of the picture (the camp's own fire by default).
 */
function firelit(g: CanvasRenderingContext2D, footY: number, strength: number, pool: (fx: number, fy: number) => number = falloff): CanvasRenderingContext2D {
  let fill = '#000000';
  const sink = {
    get fillStyle() { return fill; }, set fillStyle(c: string) { fill = c; },
    fillRect(x: number, y: number, w: number, h: number) {
      let c = fill;
      if (strength > 0.02 && c.length === 7 && c[0] === '#') {
        const fx = Math.floor((x + w / 2) * SS), fy = Math.floor((y + h / 2) * SS), fo = footY * SS;
        const I = pool(fx, fo) * clamp(1 - Math.max(fo - fy, 0) / 80, 0, 1) ** 0.8 * strength, lvl = Math.min(4, Math.floor(clamp(I, 0, 1) * 4 + bayer(fx, fy)));
        if (lvl > 0) c = warmHex(c, lvl);
      }
      g.fillStyle = c; g.fillRect(x, y, w, h);
    }
  };
  return sink as unknown as CanvasRenderingContext2D;
}
/**
 * A day, or days, going by over the camp (see startPass in main.ts): how it is spent (kind), how many days it is, the seconds gone (t) of the seconds it takes (dur),
 * and what it brought (res). A march leaves the camp it began in (oldBack) and arrives in another: swapped is whether it has. ledger is the company's purse and stores
 * as they were before, for the ledger to show what changed.
 */
interface PassState { kind: 'rest' | 'march'; days: number; t: number; dur: number; res: DayNews; ledger: Ledger; oldBack: HTMLCanvasElement | null; swapped: boolean }
/** The few things of the company that the ledger tells of, and the changes in them that a day or a march makes. */
interface Ledger { thalers: number; bread: number; powder: number; renown: number; cargo: number }
const ledgerOf = (st: Campaign): Ledger => ({ thalers: st.thalers, bread: st.bread, powder: st.powder, renown: st.renown, cargo: st.cargo });
// Draw the camp. dt is the time since the last frame; still draws it at rest, as for reduced motion; pass is a day going by, which changes the light and sends men out and in.
function drawCamp(v: CampView | null, st: Campaign | null, sel: number | null, dt: number, still: boolean, pass?: PassState | null) {
  if (!v || !st) return;
  v.t += dt;
  const t = v.t, g = v.g, key = st.quest + st.at + st.date + ':' + (st.cargo0 ? Math.round(5 * st.cargo / st.cargo0) : 0) + ':' + st.contracts.length;
  const u = pass ? clamp(pass.t / pass.dur, 0, 1) : 0, L = pass ? lightAt((u * pass.days) % 1) : NIGHT_LIGHT;
  let fade = 0; // how far the picture has gone to black, between the camp a march leaves and the one it comes to
  if (pass && pass.kind === 'march') {
    fade = Math.max(0, 1 - Math.abs(u - 0.5) / 0.12);
    if (u >= 0.5 && !pass.swapped) { pass.swapped = true; v.back = campBack(st); v.key = key; for (const p of campPlan(st)) v.pos[p.id] = { x: -26, y: p.y }; }
  }
  if (!v.back) { v.back = pass && pass.oldBack && !pass.swapped ? pass.oldBack : campBack(st); v.key = key; }
  else if (!pass && v.key !== key) { v.back = campBack(st); v.key = key; }
  campSky(g, v.back.stars!, L);
  g.globalAlpha = 1; g.drawImage(v.back, 0, 0, CW, CH);
  // the fire flares now and then, and lights its pool a level further for a moment
  if (!still && L.d < 0.5 && Math.sin(t * 5.3) + 0.7 * Math.sin(t * 11.1 + 1) + 0.5 * Math.sin(t * 2.1) > 0.3) { const fl = campFlare(v.back); if (fl) g.drawImage(fl, 0, 0, CW, CH); }
  // the light of the day lays the camp as the day sees it over the camp as the night does, and the glow of dawn and dusk lays its own
  if (L.d > 0.01) { g.globalAlpha = clamp(L.d, 0, 1); g.drawImage(campVariant(v.back, 'day'), 0, 0, CW, CH); }
  if (L.w > 0.01) { g.globalAlpha = clamp(L.w * 0.85, 0, 1); g.drawImage(campVariant(v.back, 'warm'), 0, 0, CW, CH); }
  g.globalAlpha = 1;
  if (!still && L.d < 0.5) for (const s of v.back.stars!) if (s.k < 2 && Math.sin(t * 1.3 + s.k * 9) > 0.55) { g.fillStyle = hexN(D('bone5')); g.fillRect(s.x, s.y, 1 / SS, 1 / SS); }
  campFlag(g, still ? 0 : t);
  const plan = campPlan(st);
  for (const p of plan) {
    // a day passing sends the foragers out and brings them back; a march sends everybody out of one camp and into the next
    if (pass && pass.kind === 'rest' && p.k === 'forage' && u > 0.08 && u < 0.6) p.x = -18;
    if (pass && pass.kind === 'march' && !pass.swapped) p.x = CW + 26;
    let c = v.pos[p.id];
    if (!c || still) c = v.pos[p.id] = { x: p.x, y: p.y };
    const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), speed = pass ? (pass.kind === 'march' ? 150 : 64) : 42;
    if (d > 0.6) { const m = Math.min(d, speed * dt); c.x += dx / d * m; c.y += dy / d * m; c.moving = true; c.face = dx >= 0 ? 1 : -1; c.anim = (c.anim || 0) + dt * 6; }
    else { c.x = p.x; c.y = p.y; c.moving = false; }
  }
  // the fire throws its light on the men, less by day, and flickers a little
  const strength = (1 - clamp(L.d * 1.25, 0, 1)) * (still ? 1 : 1 + 0.06 * Math.sin(t * 7.1) + 0.04 * Math.sin(t * 17.3));
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
  // everything that stands in the camp, drawn from the back of it to the front: the men, the people of the command, and the fire
  const things: { y: number; draw: () => void }[] = [];
  for (const p of plan) {
    const c = v.pos[p.id]!, x = Math.round(c.x * SS) / SS, y = Math.round(c.y * SS) / SS;
    things.push({
      y: c.y, draw: () => {
        if (p.id === sel) {
          const sg = v.sel.getContext('2d')!; sg.clearRect(0, 0, 44, 44); draw(sg, p, 22, 40);
          sg.globalCompositeOperation = 'source-in'; sg.fillStyle = hexN(D('bronze5')); sg.fillRect(0, 0, 44, 44); sg.globalCompositeOperation = 'source-over';
          for (const o of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) g.drawImage(v.sel, x - 22 + o[0] / SS, y - 40 + o[1] / SS, 44, 44);
        }
        if (p.k !== 'rest') { const sh = campShadow(p.k === 'abed'); g.drawImage(sh, x - sh.width / SS / 2, y - 1.5, sh.width / SS, sh.height / SS); }
        draw(firelit(g, y, strength), p, x, y);
      }
    });
  }
  for (const o of officersOf(st)) { const s = CAMP.staff[o.station]; things.push({ y: s[1], draw: () => drawPerson(firelit(g, s[1], strength), s[0], s[1], OFFICER_LOOK[o.kind], s[2]) }); }
  if (st.retainer) { const s = CAMP.retainer, look = RETAINER_LOOK[st.retainer.type]; things.push({ y: s[1], draw: () => drawPerson(firelit(g, s[1], strength), s[0], s[1], look, s[2]) }); }
  { const c = CAPTAINS[st.captain.type], s = CAMP.captain; things.push({ y: s[1], draw: () => drawCamper(firelit(g, s[1], strength), s[0], s[1], { cls: c.cls, skin: 'own', face: s[2], mode: 'idle', wpn: 2, arm: 2, man: st.captain.name.length, nation: c.origin, rank: 'captain' }) }); }
  things.push({ y: FIRE_Y / SS, draw: () => campFire(g, t, still) });
  things.sort((a, b) => a.y - b.y);
  for (const th of things) th.draw();
  if (!still) {
    if (Math.random() < dt * 6) v.parts.push({ k: 'e', x: 157.5 + Math.random() * 5, y: 94, vx: rnd(-3, 6), vy: rnd(-36, -20), life: 0, max: rnd(1.2, 2.6) });
    if (Math.random() < dt * 2.2) v.parts.push({ k: 's', x: 159 + Math.random() * 3, y: 85, vx: rnd(1, 3.5), vy: rnd(-11, -7), life: 0, max: rnd(3.6, 5) });
    for (const p of plan) {
      const c = v.pos[p.id]!; if (c.moving || p.k !== 'rest') continue;
      if (p.prop === 'bandura' && Math.random() < dt * 0.6) v.parts.push({ k: 'n', x: c.x + p.f * 3, y: c.y - 16, vx: p.f * 4, vy: -11, life: 0, max: 3 });
      if (p.prop === 'pipe' && Math.random() < dt * 0.5) v.parts.push({ k: 's', x: c.x + p.f * 5, y: c.y - 14, vx: p.f * 2, vy: -5, life: 0, max: 2.2 });
    }
    const embers = ['fire1', 'fire2', 'fire3', 'fire4', 'fire5', 'fire6'].map(n => hexN(D(n)));
    for (let i = v.parts.length - 1; i >= 0; i--) {
      const p = v.parts[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life >= p.max) { v.parts.splice(i, 1); continue; }
      const a = 1 - p.life / p.max, fx = Math.floor(p.x * SS), fy = Math.floor(p.y * SS);
      if (p.k === 'e') { g.fillStyle = embers[Math.min(5, Math.floor(a * 6))]; g.fillRect(fx / SS, fy / SS, 1 / SS, 1 / SS); }
      else if (p.k === 's') { if (a * 1.3 > bayer(fx, fy)) { g.fillStyle = hexN(D(p.y > 66 ? 'bone0' : p.y > 52 ? 'iron4' : 'iron3')); g.fillRect(fx / SS, fy / SS, 2 / SS, 2 / SS); } }
      else if (a * 1.6 > bayer(fx, fy) || a > 0.62) { g.fillStyle = hexN(D('bronze5')); const x = Math.floor(p.x), y = Math.floor(p.y); g.fillRect(x, y, 1, 4); g.fillRect(x - 2, y + 3, 2, 2); g.fillRect(x + 1, y, 1, 1); g.fillRect(x + 2, y + 1, 1, 1); }
    }
  }
  if (fade > 0) { g.fillStyle = 'rgba(8,6,4,' + fade.toFixed(3) + ')'; g.fillRect(0, 0, CW, CH); }
  present(v.ctx, v.buf, v.cv.width, v.cv.height);
  // keep the clickable figures over the drawn ones as they walk
  if (v.btns) for (const b of v.btns) {
    const p = v.pos[b.dataset.id!]; if (!p) continue;
    const L = ((p.x - 9) / CW * 100).toFixed(2) + '%', T = ((p.y - (b.dataset.k === 'abed' ? 8 : b.dataset.k === 'rest' ? 18 : 31)) / CH * 100).toFixed(2) + '%';
    if (b.style.left !== L) b.style.left = L;
    if (b.style.top !== T) b.style.top = T;
  }
}
