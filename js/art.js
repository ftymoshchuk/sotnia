"use strict";
/* ===== SOTNIA interface: drawing (palette, pixel sprites, the woodcut backdrop, the field) ===== */
const LW = BW, LH = 124, FY = 72, HZ = 56;
const PAL = {
  paper: '#d9d1bc', hill: '#d0c7ae', ground: '#cbc2a8', paperHi: '#e6dfcc', ink: '#1c1a17', red: '#9c1f2e', blue: '#2d4b70',
  ochre: '#b98a2b', green: '#4e6b50', drab: '#77705a', grey: '#8b877c', plum: '#5c2d55', black: '#2a2725', skin: '#d6ad86',
  wood: '#6a4a2c', fur: '#4b3524', steel: '#3d4144', helm: '#7e8284', white: '#f4f0e4', flash: '#f0b93a', smoke: '#a9a498'
};
const INK = PAL.ink;
const SKINS = {
  own: { coat: PAL.red, trim: PAL.ochre }, bandit: { coat: PAL.drab, trim: PAL.paperHi }, deserter: { coat: PAL.grey, trim: PAL.ink },
  raider: { coat: PAL.green, trim: PAL.ochre }, imperial: { coat: PAL.ochre, trim: PAL.ink }, swede: { coat: PAL.blue, trim: PAL.ochre },
  champion: { coat: PAL.plum, trim: PAL.ochre }, black: { coat: PAL.black, trim: PAL.red }
};

/* ---------- sprites ---------- */
function drawSoldier(g, x, y, o) {
  const f = o.face || 1, sk = SKINS[o.skin] || SKINS.own;
  const R = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(f > 0 ? x + dx : x - dx - w + 1, y + dy, w, h); };
  const hat = o.cls === 'pike' ? PAL.helm : o.cls === 'shot' ? INK : PAL.fur;
  if (o.dead) {
    R(-7, 0, 13, 1, PAL.red); R(-9, -2, 4, 2, INK); R(-5, -3, 8, 3, sk.coat); R(3, -4, 3, 3, PAL.skin); R(7, -2, 3, 2, hat);
    return;
  }
  const coat = o.hurt > 0.1 ? PAL.white : sk.coat;
  g.fillStyle = 'rgba(28,26,23,.22)'; g.fillRect(x - 4, y, 9, 1);
  const step = o.moving ? Math.floor(o.anim) % 2 : -1;
  if (step === 0) { R(-3, -4, 2, 4, INK); R(2, -4, 2, 4, INK); R(-2, -5, 5, 1, INK); }
  else if (step === 1) R(-1, -5, 3, 5, INK);
  else { R(-2, -5, 2, 5, INK); R(1, -5, 2, 5, INK); }
  const b = step === 1 ? -1 : 0;
  R(-2, -11 + b, 5, 6, coat); R(-3, -7 + b, 7, 2, coat); R(-2, -8 + b, 5, 1, sk.trim);
  R(-3, -11 + b, 1, 4, INK);
  R(-1, -14 + b, 3, 3, PAL.skin); R(1, -13 + b, 1, 1, INK);
  if (o.cls === 'pike') { R(-3, -15 + b, 7, 1, PAL.steel); R(-1, -17 + b, 3, 2, PAL.helm); R(0, -18 + b, 1, 1, PAL.helm); }
  else if (o.cls === 'shot') { R(-3, -15 + b, 7, 1, INK); R(-1, -17 + b, 3, 2, INK); R(-3, -18 + b, 2, 2, sk.trim); }
  else { R(-2, -16 + b, 5, 2, PAL.fur); R(-1, -17 + b, 3, 1, sk.coat); R(-3, -16 + b, 1, 3, sk.coat); }
  const m = o.flash > 0 ? 'aim' : o.mode, sw = o.swing > 0;
  if (m === 'rout') { R(-4, -15 + b, 1, 5, coat); R(3, -15 + b, 1, 5, coat); return; }
  if (o.cls === 'pike') {
    if (m === 'fight' || o.level) { const t = sw ? 3 : 0; R(1, -10 + b, 3, 2, coat); R(2 + t, -9 + b, 18, 1, PAL.wood); R(20 + t, -9 + b, 2, 1, PAL.steel); }
    else { R(2, -10 + b, 1, 4, coat); R(3, -27 + b, 1, 24, PAL.wood); R(3, -29 + b, 1, 2, PAL.steel); }
  } else if (o.cls === 'shot') {
    if (m === 'aim') {
      R(1, -11 + b, 3, 2, coat); R(-1, -12 + b, 2, 2, PAL.wood); R(1, -12 + b, 9, 1, INK);
      if (o.flash > 0) { R(10, -14 + b, 3, 4, PAL.flash); R(13, -13 + b, 3, 2, PAL.white); }
    } else if (m === 'reload') { R(2, -10 + b, 2, 2, coat); R(4, -17 + b, 1, 12, INK); R(3, -19 + b + (Math.floor((o.t || 0) * 5) % 2) * 2, 1, 4, PAL.wood); }
    else if (m === 'fight') { const t = sw ? 3 : 0; R(1, -11 + b, 3, 2, coat); R(1 + t, -11 + b, 8, 1, PAL.wood); }
    else { R(2, -10 + b, 1, 4, coat); R(-3, -7 + b, 2, 2, PAL.wood); R(-2, -7 + b, 10, 1, INK); }
  } else {
    R(1, -10 + b, 3, 2, coat);
    if (sw) { R(3, -10 + b, 5, 1, PAL.steel); R(7, -9 + b, 2, 1, PAL.steel); R(8, -8 + b, 1, 1, PAL.steel); }
    else if (m === 'fight') { for (let i = 0; i < 4; i++) R(3 + i, -11 - i + b, 1, 1, PAL.steel); }
    else { R(3, -12 + b, 1, 3, PAL.steel); R(4, -14 + b, 1, 2, PAL.steel); R(5, -15 + b, 1, 1, PAL.steel); }
    R(3, -9 + b, 1, 1, sk.trim);
  }
}
const iconCache = {};
function icon(cls, skin) {
  const k = cls + skin;
  if (iconCache[k]) return iconCache[k];
  const c = document.createElement('canvas'); c.width = 16; c.height = 31;
  drawSoldier(c.getContext('2d'), 6, 30, { cls, skin, face: 1, mode: 'idle', anim: 0 });
  return (iconCache[k] = c.toDataURL());
}

/* ---------- backdrop: a woodcut landscape ---------- */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function pxLine(g, x0, y0, x1, y1, c) {
  g.fillStyle = c; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx - dy;
  for (let i = 0; i < 400; i++) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x0 += sx; } if (e2 < dx) { e += dx; y0 += sy; } }
}
const MARKS = {
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
function makeBackdrop(seed, weather) {
  const c = document.createElement('canvas'); c.width = LW; c.height = LH;
  const g = c.getContext('2d'), r = mulberry(seed);
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
  const hy = x => Math.round(HZ - 12 - 6 * Math.sin(x * 0.019 + a1) - 3 * Math.sin(x * 0.047 + a2));
  for (let x = 0; x < LW; x++) {
    const y = hy(x);
    g.fillStyle = PAL.hill; g.fillRect(x, y, 1, HZ - y); g.fillStyle = INK; g.fillRect(x, y, 1, 1);
    if (x % 3 === 0 && hy(x + 3) > y) g.fillRect(x, y + 2, 1, 2 + (r() * 5 | 0));
  }
  const names = Object.keys(MARKS).sort(() => r() - 0.5);
  const x1 = 34 + (r() * 60 | 0), x2 = 190 + (r() * 76 | 0);
  MARKS[names[0]](g, x1, hy(x1) + 1); MARKS[names[1]](g, x2, hy(x2) + 1);
  const wx = 110 + (r() * 60 | 0); g.fillStyle = INK; g.fillRect(wx, HZ - 9, 1, 9); g.fillRect(wx - 2, HZ - 7, 5, 1);
  g.fillStyle = PAL.ground; g.fillRect(0, HZ, LW, LH - HZ); g.fillStyle = INK; g.fillRect(0, HZ, LW, 1);
  for (let i = 0; i < 34; i++) { const y = HZ + 2 + (r() * r() * (LH - HZ - 4) | 0), x = r() * LW | 0, w = 4 + (r() * 18 | 0); g.fillStyle = 'rgba(28,26,23,.32)'; g.fillRect(x, y, w, 1); }
  for (let i = 0; i < 46; i++) { const x = r() * LW | 0, y = HZ + 5 + (r() * (LH - HZ - 7) | 0); g.fillStyle = 'rgba(28,26,23,.6)'; g.fillRect(x, y, 1, 2); g.fillRect(x - 1, y - 1, 1, 2); g.fillRect(x + 1, y - 1, 1, 1); }
  for (let i = 0; i < 12; i++) { const x = r() * LW | 0, y = HZ + 6 + (r() * (LH - HZ - 9) | 0); g.fillStyle = PAL.paperHi; g.fillRect(x, y, 3, 2); g.fillStyle = INK; g.fillRect(x, y + 2, 3, 1); g.fillRect(x + 3, y + 1, 1, 1); }
  return c;
}

/* ---------- the field ---------- */
function newView(cv, seed, weather, names) {
  const buf = document.createElement('canvas'); buf.width = LW; buf.height = LH;
  const v = { cv, ctx: cv.getContext('2d'), buf, g: buf.getContext('2d'), back: makeBackdrop(seed, weather), parts: [], names, weather };
  fitView(v);
  return v;
}
function fitView(v) {
  const w = v.cv.clientWidth || 600, dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(w * dpr), H = Math.round(W * LH / LW);
  if (v.cv.width !== W || v.cv.height !== H) { v.cv.width = W; v.cv.height = H; }
  v.css = w / LW; v.dpr = dpr;
}
function drainFx(v, b, loud) {
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
function stepParts(v, dt) {
  const g2 = v.back.getContext('2d');
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
function drawField(v, b, t) {
  const g = v.g; g.globalAlpha = 1; g.drawImage(v.back, 0, 0);
  if (v.weather === 'fog') {
    g.fillStyle = 'rgba(244,240,228,.5)';
    for (let i = 0; i < 3; i++) g.fillRect(-30 + Math.sin(t * 0.21 + i * 1.7) * 22, 42 + i * 25, LW + 60, 9);
  }
  const us = b.units.filter(u => !u.fled).sort((a, c) => a.y - c.y);
  for (const u of us) if (u.dead) drawSoldier(g, Math.round(u.x), FY + Math.round(u.y), { dead: true, cls: u.cls, skin: u.skin, face: u.face });
  for (const u of us) {
    if (u.dead) continue;
    const x = Math.round(u.x), y = FY + Math.round(u.y);
    drawSoldier(g, x, y, { cls: u.cls, skin: u.skin, face: u.face, mode: u.mode, moving: u.moving, anim: u.anim * 2, swing: u.swing, flash: u.flash, hurt: u.hurt, t, level: u.cls === 'pike' && u.tgt && dist(u, u.tgt) < 44 });
    if (!u.routing) {
      g.fillStyle = INK; g.fillRect(x - 5, y - 23, 11, 3); g.fillStyle = PAL.paperHi; g.fillRect(x - 4, y - 22, 9, 1);
      g.fillStyle = (SKINS[u.skin] || SKINS.own).coat; g.fillRect(x - 4, y - 22, Math.max(1, Math.round(9 * u.hp / u.max)), 1);
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
  const c = v.ctx; c.imageSmoothingEnabled = false; c.drawImage(v.buf, 0, 0, v.cv.width, v.cv.height);
  if (v.names && v.css >= 1.5) {
    const sc = v.cv.width / LW;
    c.font = Math.round(clamp(v.css * 4.5, 10, 15) * v.dpr) + "px 'Alegreya SC', Georgia, serif";
    c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 3 * v.dpr; c.strokeStyle = PAL.paper; c.fillStyle = INK;
    for (const u of b.units) {
      if (u.side !== 0 || !alive(u) || u.routing) continue;
      const n = u.name.split(' ')[0], X = u.x * sc, Y = (FY + u.y - 26) * sc;
      c.strokeText(n, X, Y); c.fillText(n, X, Y);
    }
  }
}
