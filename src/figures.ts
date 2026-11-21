"use strict";
/* ===== SOTNIA interface: figures. Every man, hired hand and foe is drawn here, finely, in what he has bought. ===== */

/**
 * Figures are drawn SS times finer than the scene they stand in: one scene pixel is SS by SS figure pixels. That is the room a man needs
 * for a buckle, the lock of a musket or the comb of a helmet, which at a scene pixel apiece came out as blocks. The backdrops keep
 * their chunky woodcut pixels. In the painters below, dx and dy are figure pixels from the feet (y is negative upwards, x is forwards,
 * and everything is mirrored for a man facing left), while the x and y a figure is drawn at are scene pixels.
 */
const SS = 2;
/**
 * A canvas for a scene of W by H scene pixels, SS times finer, whose context is scaled so that scene coordinates draw as they always
 * did. It turns image smoothing off, so that a coarser canvas drawn onto it (a backdrop) stays sharp.
 */
function sceneCanvas(W: number, H: number) {
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS;
  const g = c.getContext('2d')!; g.scale(SS, SS); g.imageSmoothingEnabled = false;
  return c;
}

const blownUp = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
/**
 * Puts a scene buffer on a canvas of W by H device pixels. Drawn straight at a size that is not a whole number of times as big, some of
 * its pixels would come out a pixel wider than others, which the finer figures show up. So the buffer is blown up by a whole number
 * with hard edges, and the result resized the rest of the way smoothly, which keeps every pixel the same size to within one screen
 * pixel. A size that is nearly a whole number of times as big is drawn straight, with hard edges; and the blown-up copy is kept to
 * a couple of million pixels, since it is redrawn every frame.
 */
function present(c: CanvasRenderingContext2D, buf: HTMLCanvasElement, W: number, H: number) {
  const r = W / buf.width;
  if (r < 1 || Math.abs(r - Math.round(r)) <= 0.1) { c.imageSmoothingEnabled = r < 1; c.drawImage(buf, 0, 0, W, H); return; }
  let k = Math.ceil(r);
  if (k * k * buf.width * buf.height > 1.8e6) k = Math.floor(r);
  if (k < 2) { c.imageSmoothingEnabled = true; c.drawImage(buf, 0, 0, W, H); return; }
  let up = blownUp.get(buf);
  if (!up || up.width !== buf.width * k) { up = document.createElement('canvas'); up.width = buf.width * k; up.height = buf.height * k; blownUp.set(buf, up); }
  const u = up.getContext('2d')!; u.imageSmoothingEnabled = false; u.drawImage(buf, 0, 0, up.width, up.height);
  c.imageSmoothingEnabled = true; c.drawImage(up, 0, 0, W, H);
}

/** A colour (as #rrggbb) made darker (k under 1) or lighter (k over 1, which is that far from the colour towards white). */
const tinted: Record<string, string> = {};
function tint(hex: string, k: number) {
  const key = hex + k;
  if (tinted[key]) return tinted[key];
  const n = parseInt(hex.slice(1), 16), mix = (v: number) => Math.round(clamp(k < 1 ? v * k : v + (255 - v) * (k - 1), 0, 255));
  return (tinted[key] = '#' + ((1 << 24) | (mix(n >> 16) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255)).toString(16).slice(1));
}

/** What the figures are made of: each material in its base colour and, where it shines or lies in shadow, its light (Hi) and shade (Lo). */
const MAT = {
  ink: PAL.ink, hose: '#2e2a27', boot: '#43301f', bootHi: '#6b4a2b', leather: '#3d2b1b',
  skin: PAL.skin, skinLo: '#b98c68', skinHi: '#e4c19d', linen: '#ebe3cd',
  buff: '#c4a265', buffLo: '#94743f', buffHi: '#dcc18a',
  steel: '#8f979c', steelHi: '#dde3e4', steelLo: '#59616a', steelDk: '#363b40',
  gilt: '#d8b25a', giltHi: '#f4dc92', giltLo: '#8c6c2c',
  wood: PAL.wood, woodHi: '#8e6842', woodLo: '#46301c', ash: '#a98f63',
  felt: '#2c2926', feltHi: '#4a443d', fur: PAL.fur, furHi: '#735339',
  cord: '#a99f86', ember: '#f08a2c', blood: '#7c1824'
} as const;
/** The hair a man may have, by his number (see SoldierLook.man): black, brown, chestnut, fair, grey. */
const HAIR = ['#2a1c12', '#4a3220', '#7b5b33', '#a8803e', '#77736b'] as const;
const SHADOW = 'rgba(28,26,23,.22)';

/** A figure's gear level, 0 to 3, from what a caller may have left out. */
const gearLv = (n?: number) => (n ? clamp(Math.floor(n), 0, 3) : 0);
/** The number that settles a man's looks (his hair and moustache) from the id of a soldier, or the 'e3' of a foe. */
const manNo = (sid: number | string) => (typeof sid === 'number' ? sid : 5 + (parseInt(String(sid).slice(1), 10) || 0) * 2);

/** What a figure wears, worked out once for each drawing. */
interface Dress {
  c: string; cd: string; cl: string; // the coat, in shade and in light (white for the moment after a hit)
  t: string; // the trim
  arm: number; wpn: number; // the gear levels
  hair: string; mus: number; // his hair, and his moustache: 0 none, 1 short, 2 long
  hit: boolean;
}
function dressFor(o: SoldierLook): Dress {
  const sk = SKINS[o.skin] || SKINS.own, hit = o.hurt! > 0.1, n = o.man || 0, c = hit ? PAL.white : sk.coat;
  return { c, cd: tint(c, 0.74), cl: tint(c, 1.2), t: sk.trim, arm: gearLv(o.arm), wpn: gearLv(o.wpn), hair: HAIR[n % HAIR.length], mus: Math.floor(n / HAIR.length) % 3, hit };
}

/** A painter for figure pixels, with the figure's feet at x, y of the scene (see SS), mirrored for one who faces left. */
function figurePainter(g: CanvasRenderingContext2D, x: number, y: number, f: 1 | -1): Painter {
  return (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + (f > 0 ? dx : -dx - w + 1) / SS, y + dy / SS, w / SS, h / SS); };
}
/** A line of pixels from x0, y0 to x1, y1, drawn with a brush w pixels square. */
function seg(R: Painter, x0: number, y0: number, x1: number, y1: number, w: number, c: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) R(Math.round(x0 + (x1 - x0) * i / n) - (w >> 1), Math.round(y0 + (y1 - y0) * i / n) - (w >> 1), w, w, c);
}
/**
 * A painter for something long, a weapon, in its own frame: a runs along it from its butt, c across it, and the painter lays a
 * rectangle len long by wid wide. up stands it on end, with its butt at ox, oy and its head above; otherwise it points forwards.
 */
type Axial = (a: number, c: number, len: number, wid: number, col: string) => void;
function axial(R: Painter, ox: number, oy: number, up: boolean): Axial {
  return up ? (a, c, len, wid, col) => R(ox + c, oy - a - len + 1, wid, len, col) : (a, c, len, wid, col) => R(ox + a, oy + c, len, wid, col);
}
/** The same, for a weapon carried slanting up and forwards, one pixel of rise for every run pixels along it. */
function slanted(R: Painter, ox: number, oy: number, run: number): Axial {
  return (a, c, len, wid, col) => {
    for (let i = a; i < a + len;) {
      const rise = Math.floor(i / run), next = Math.min(a + len, (rise + 1) * run);
      R(ox + i, oy + c - rise, next - i, wid, col); i = next;
    }
  };
}
/** A small picture drawn from rows of characters, its top left corner at x, y: each character is a colour of key, and a dot is clear. */
function bmp(R: Painter, x: number, y: number, rows: readonly string[], key: Readonly<Record<string, string>>) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length;) {
      const ch = row[i]; let n = 1;
      while (row[i + n] === ch) n++;
      if (key[ch]) R(x + i, y + j, n, 1, key[ch]);
      i += n;
    }
  });
}
/** Ostrich plumes, small, large and large with a white tip, each rooted at the bottom: p is the colour, P its light and q its shade. */
const PLUMES: readonly (readonly string[])[] = [
  ['.pp....', 'pPPp...', 'pPPp...', '.pPp...', '..pPp..', '..pPp..', '...pp..', '....p..'],
  ['.ppp.....', 'pPPPp....', 'pPPPPp...', 'pPPPPp...', '.pPPPp...', '..pPPp...', '..pPPp...', '...pPp...', '...pPp...', '....pp...', '....pp...', '.....p...'],
  ['.www.....', 'wwwwp....', 'wwwPPp...', 'pPPPPp...', '.pPPPp...', '..pPPp...', '..pPPp...', '...pPp...', '...pPp...', '....pp...', '....pp...', '.....p...']
];
function plume(U: Painter, x: number, y: number, size: number, c: string) { bmp(U, x, y, PLUMES[size], { p: c, P: tint(c, 1.35), q: tint(c, 0.7), w: PAL.white }); }

/* ---------- the man: legs, coat and armour, head ---------- */
// step: -1 standing, 0 mid-stride, 1 passing
function legs(R: Painter, step: number) {
  const hose = MAT.hose, boot = MAT.boot, hi = MAT.bootHi, K = MAT.ink;
  if (step === 0) {
    R(-4, -11, 4, 3, hose); R(-6, -8, 4, 3, hose); R(-8, -5, 4, 3, boot); R(-8, -5, 4, 1, hi); R(-9, -2, 6, 2, boot); R(-9, -1, 6, 1, K);
    R(1, -11, 4, 3, hose); R(2, -8, 4, 3, hose); R(4, -5, 4, 3, boot); R(4, -5, 4, 1, hi); R(4, -2, 8, 2, boot); R(4, -1, 8, 1, K);
  } else if (step === 1) {
    R(-3, -9, 3, 3, hose); R(-2, -6, 3, 3, boot);
    R(0, -11, 4, 5, hose); R(0, -6, 4, 3, boot); R(0, -6, 4, 1, hi); R(0, -3, 7, 3, boot); R(0, -1, 7, 1, K);
  } else {
    R(-4, -11, 4, 5, hose); R(-4, -6, 4, 3, boot); R(-4, -6, 4, 1, hi); R(-4, -3, 5, 3, boot); R(-4, -1, 5, 1, K);
    R(1, -11, 4, 5, hose); R(1, -6, 4, 3, boot); R(1, -6, 4, 1, hi); R(1, -3, 7, 3, boot); R(1, -1, 7, 1, K);
  }
}
/**
 * The coat and belt and, by arm (his armour, 0 to 3), what he wears over them: a linen shirt in the colour of his company; a buff
 * coat of leather; a steel breastplate and gorget; a cuirass with shoulder plates and tassets. Armour hides the coat, so from the
 * breastplate up the company's colour is carried by the sash.
 */
function torso(U: Painter, d: Dress) {
  const { c, cd, cl, arm } = d, K = MAT.ink, white = (x: string) => (d.hit ? PAL.white : x);
  const body = arm ? white(MAT.buff) : c, lo = arm ? MAT.buffLo : cd, hi = arm ? MAT.buffHi : cl;
  U(-6, -14, 13, 4, body); U(-4, -19, 9, 3, body); U(-5, -25, 11, 6, body);
  U(-6, -14, 1, 4, lo); U(-4, -19, 1, 3, lo); U(-5, -25, 1, 6, lo); U(-6, -11, 13, 1, lo);
  U(4, -24, 1, 5, hi);
  if (!arm) { U(-1, -26, 4, 1, MAT.linen); U(1, -25, 1, 2, MAT.linen); U(3, -22, 1, 1, hi); U(0, -20, 1, 1, cd); }
  else { U(2, -24, 1, 8, lo); U(-1, -14, 1, 3, lo); U(3, -14, 1, 3, lo); for (let i = 0; i < 3; i++) U(1, -23 + i * 2, 1, 1, MAT.buffHi); }
  U(-4, -16, 9, 2, MAT.leather); U(2, -16, 2, 2, arm > 1 ? MAT.gilt : MAT.steel);
  if (arm > 1) {
    const s = white(arm > 2 ? '#a9b2b6' : MAT.steel), sl = arm > 2 ? '#6f7a80' : MAT.steelLo, sh = MAT.steelHi;
    U(-3, -25, 7, 1, s); U(-4, -24, 9, 7, s); U(-3, -17, 7, 1, sl); U(-4, -24, 1, 7, sl); U(-4, -17, 1, 1, MAT.steelDk);
    U(1, -23, 1, 6, sh); U(-2, -23, 1, 2, sh); U(3, -23, 1, 4, tint(s, 1.15));
    U(-4, -24, 9, 1, arm > 2 ? MAT.gilt : sl); U(-2, -26, 5, 1, s); U(-2, -26, 5, 1, s);
    if (arm > 2) { U(-3, -21, 1, 1, MAT.giltHi); U(3, -21, 1, 1, MAT.giltHi); U(-3, -18, 1, 1, MAT.giltHi); U(3, -18, 1, 1, MAT.giltHi); U(-2, -26, 5, 1, MAT.gilt); }
  }
  if (arm) { U(-5, -17, 11, 2, d.c); U(-5, -17, 11, 1, d.cl); U(2, -16, 2, 2, arm > 1 ? MAT.gilt : MAT.steel); U(-8, -17, 3, 3, d.c); U(-8, -14, 2, 6, d.c); U(-6, -14, 2, 4, d.cd); U(-8, -9, 2, 1, d.cd); }
  if (arm > 2) {
    const s = '#a9b2b6', sl = '#6f7a80';
    for (let i = 0; i < 3; i++) { U(-5, -14 + i * 2, 10 + i, 1, i % 2 ? '#c2cacd' : s); U(-5, -13 + i * 2, 10 + i, 1, sl); }
    U(-5, -9, 11, 1, MAT.gilt);
  }
}
/** The shoulder plates of a cuirass, which go over the sleeves. */
function pauldrons(U: Painter, d: Dress) {
  if (d.arm < 3) return;
  U(1, -27, 6, 3, '#a9b2b6'); U(1, -27, 6, 1, MAT.steelHi); U(1, -25, 6, 1, MAT.gilt); U(-8, -26, 3, 3, '#6f7a80'); U(-8, -24, 3, 1, MAT.giltLo);
}
function head(U: Painter, d: Dress) {
  U(-3, -33, 2, 6, d.hair); U(-2, -33, 6, 6, MAT.skin); U(-2, -28, 6, 1, MAT.skinLo); U(-1, -27, 3, 1, MAT.skinLo);
  U(-1, -30, 1, 2, MAT.skinLo); U(2, -31, 1, 1, MAT.ink); U(1, -32, 2, 1, d.hair); U(4, -31, 1, 2, MAT.skin);
  if (d.mus === 1) U(2, -29, 3, 1, d.hair);
  else if (d.mus === 2) { U(2, -29, 3, 1, d.hair); U(4, -28, 1, 2, d.hair); U(1, -28, 1, 1, d.hair); }
}
/**
 * What he wears on his head, by his class and his armour. A pikeman's morion grows a comb, a brass band and at last a plume. A
 * musketeer's broad felt hat gains a plume and a brooch. A sabreur's fur cap gains a clasp and a feather.
 */
function hat(U: Painter, d: Dress, cls: TroopClass) {
  const a = d.arm;
  if (cls === 'pike') {
    const s = a > 2 ? '#a9b2b6' : MAT.steel, hi = MAT.steelHi, lo = MAT.steelLo;
    U(-5, -35, 11, 1, lo); U(-4, -39, 9, 4, s); U(-2, -41, 5, 2, s); U(-3, -38, 1, 2, hi); U(-1, -41, 2, 1, hi); U(-4, -36, 9, 1, lo);
    U(-6, -36, 1, 2, lo); U(6, -36, 1, 2, lo);
    if (a > 0) { U(-4, -37, 9, 1, MAT.giltLo); U(-3, -33, 2, 4, lo); }
    if (a > 1) { U(-4, -37, 9, 1, MAT.gilt); U(0, -37, 1, 1, MAT.giltHi); U(5, -33, 1, 3, lo); }
    if (a > 2) { U(-2, -42, 5, 1, MAT.gilt); plume(U, -9, -50, 1, d.t); }
  } else if (cls === 'shot') {
    const f = MAT.felt, fh = MAT.feltHi;
    U(-4, -39, 9, 5, f); U(-3, -40, 7, 1, f); U(-7, -35, 15, 2, f); U(-8, -36, 1, 1, f); U(8, -36, 1, 1, f); U(-4, -39, 1, 4, fh); U(-6, -35, 12, 1, fh);
    U(-4, -36, 9, 1, d.t);
    if (a > 1) plume(U, -8, -50, a > 2 ? 2 : 1, d.t); else plume(U, -7, -46, 0, d.t);
    if (a > 1) { U(2, -37, 2, 2, MAT.gilt); U(2, -37, 1, 1, MAT.giltHi); }
    if (a > 2) U(0, -36, 5, 1, MAT.gilt);
  } else {
    U(-4, -40, 9, 7, MAT.fur); U(-3, -41, 7, 1, MAT.fur); U(-3, -40, 2, 1, MAT.furHi); U(0, -38, 2, 1, MAT.furHi); U(2, -36, 2, 1, MAT.furHi); U(-4, -34, 9, 1, tint(MAT.fur, 0.7));
    U(-6, -41, 3, 7, d.c); U(-2, -42, 6, 1, d.c); U(-6, -41, 1, 7, d.cd);
    if (a > 0) { U(-4, -35, 1, 1, MAT.furHi); }
    if (a > 1) { U(3, -39, 2, 3, MAT.gilt); U(3, -39, 1, 1, MAT.giltHi); seg(U, 4, -39, 6, -46, 1, PAL.white); }
    if (a > 2) { seg(U, 4, -39, 6, -50, 2, PAL.white); U(3, -37, 2, 2, d.t); U(3, -40, 2, 1, MAT.giltHi); }
  }
}

/* ---------- the weapons, four of each kind, from the worst a man may carry to the best ---------- */
/** The length of each musket, from the butt to the muzzle: an arquebus, a matchlock, a Dutch musket and a wheel-lock. */
const MUSKET_LEN: readonly number[] = [26, 33, 36, 29];
/** A musket in its own frame (see axial): the butt is at a = 0. */
function musketArt(W: Axial, tier: number) {
  const L = MUSKET_LEN[tier], iron = '#4b5257', ironHi = '#7d868b';
  if (tier === 0) {
    // the old arquebus: a crude dark stock and a plain iron tube, with a bare serpentine and a smouldering match
    W(0, -1, 3, 5, MAT.woodLo); W(3, -1, 7, 4, MAT.woodLo); W(10, 0, 9, 2, MAT.woodLo); W(0, -1, 1, 5, iron);
    W(9, -1, L - 9, 2, iron); W(9, -1, L - 9, 1, ironHi); W(L - 2, -2, 2, 4, iron);
    W(5, -2, 4, 2, iron); W(6, -4, 1, 2, iron); W(7, -3, 1, 1, iron); W(6, -5, 1, 1, MAT.ember);
    W(2, -1, 5, 1, MAT.cord);
  } else if (tier === 1) {
    // the matchlock musket: a longer barrel with iron bands, a ramrod, a lock plate and a glowing match
    W(0, -1, 4, 5, MAT.wood); W(4, -1, 7, 4, MAT.wood); W(11, 0, 12, 2, MAT.wood); W(0, -1, 1, 5, '#5f676c'); W(2, -1, 8, 1, MAT.woodHi);
    W(10, -1, L - 10, 2, '#59626a'); W(10, -1, L - 10, 1, '#8b949a'); W(L - 1, -1, 1, 2, '#2f3438');
    for (let i = 0; i < 3; i++) W(14 + i * 6, -1, 1, 4, iron);
    W(11, 2, L - 13, 1, MAT.ash);
    W(5, -2, 5, 2, '#5f676c'); W(6, -4, 1, 2, iron); W(7, -3, 2, 1, iron); W(6, -5, 1, 1, MAT.ember); W(6, -6, 1, 1, '#f6c35a');
    W(6, 3, 4, 1, iron); W(6, 3, 1, 2, iron);
  } else if (tier === 2) {
    // the Dutch musket: the longest, in walnut with brass at the butt, side plate, guard and three bands
    const wd = '#7a5636', wh = '#a07b4d';
    W(0, -1, 5, 6, wd); W(5, -1, 7, 5, wd); W(12, 0, 13, 2, wd); W(0, -1, 1, 6, MAT.gilt); W(1, -1, 10, 1, wh); W(3, 1, 1, 1, wh); W(3, 3, 3, 1, tint(wd, 0.8));
    W(11, -1, L - 11, 2, '#6c767d'); W(11, -1, L - 11, 1, '#aeb7bc'); W(L - 1, -1, 1, 2, '#2f3438');
    for (let i = 0; i < 3; i++) { W(15 + i * 7, -1, 1, 4, MAT.gilt); W(15 + i * 7, -1, 1, 1, MAT.giltHi); }
    W(12, 2, L - 13, 1, MAT.ash); W(L - 2, 2, 2, 1, MAT.gilt);
    W(5, -2, 6, 2, '#6c767d'); W(6, -4, 1, 2, iron); W(7, -3, 2, 1, iron); W(6, -5, 1, 1, MAT.ember); W(6, -6, 1, 1, '#f6c35a'); W(8, -1, 2, 1, MAT.gilt);
    W(7, 3, 5, 1, MAT.gilt); W(7, 3, 1, 2, MAT.gilt); W(5, 1, 2, 1, MAT.gilt);
  } else {
    // the wheel-lock: shorter, in dark wood inlaid with gilt, a blued barrel, and a steel wheel in place of the match
    const wd = '#2f2218', inlay = '#e8d6a0';
    W(0, -1, 3, 7, wd); W(3, -1, 6, 6, wd); W(9, 0, 10, 2, wd); W(0, -1, 1, 7, MAT.gilt); W(1, 0, 1, 1, inlay); W(3, 2, 1, 1, inlay); W(5, 1, 1, 1, inlay); W(2, 4, 1, 1, inlay);
    W(8, -1, L - 8, 2, '#3a4658'); W(8, -1, L - 8, 1, '#667690'); W(L - 1, -1, 1, 2, '#1d232d');
    W(12, -1, 1, 4, MAT.gilt); W(18, -1, 1, 4, MAT.gilt); W(L - 4, -1, 1, 3, MAT.gilt);
    W(9, 2, L - 11, 1, MAT.ash);
    W(4, -4, 5, 5, '#98a1a6'); W(5, -3, 3, 3, '#c9d0d3'); W(6, -2, 1, 1, MAT.gilt); W(3, -4, 1, 2, MAT.steelDk); W(4, -5, 2, 1, MAT.steelDk);
    W(7, 3, 4, 1, MAT.gilt); W(7, 3, 1, 2, MAT.gilt);
  }
}
/** The head of a pike, and its shaft, in its own frame: the butt is at a = 0 and the shaft (len long, 2 across) ends where the head begins. */
function pikeArt(W: Axial, tier: number, len: number, d: Dress) {
  const s = MAT.steel, hi = MAT.steelHi, lo = MAT.steelLo;
  W(0, 0, len, 2, MAT.wood); W(0, 0, len, 1, MAT.woodHi); W(0, 0, 3, 2, lo);
  const h = len;
  if (tier === 0) {
    // an ash pike: a plain shaft with a small leaf of iron
    W(h, 0, 2, 2, lo); W(h + 2, -1, 3, 4, s); W(h + 5, 0, 2, 2, s); W(h + 7, 0, 1, 1, s); W(h + 2, -1, 3, 1, hi);
  } else if (tier === 1) {
    // an ironbound pike: a longer head, with straps of iron running down the shaft, and rings
    W(h - 10, -1, 10, 1, lo); W(h - 10, 2, 10, 1, lo); W(h, 0, 2, 2, lo); W(h + 2, -1, 4, 4, s); W(h + 6, -1, 2, 4, s); W(h + 8, 0, 2, 2, s); W(h + 10, 0, 1, 2, s); W(h + 2, -1, 6, 1, hi);
    for (let i = 1; i < 4; i++) if (h - 10 - i * 9 >= 0) W(h - 10 - i * 9, -1, 1, 4, lo);
  } else if (tier === 2) {
    // a partisan: a broad blade with a lug at either side of its base, and a tassel
    W(h - 12, -1, 12, 1, lo); W(h - 12, 2, 12, 1, lo); W(h, 0, 2, 2, lo); W(h + 2, -3, 3, 8, s); W(h + 5, -1, 5, 4, s); W(h + 10, 0, 2, 2, s); W(h + 12, 0, 1, 1, hi);
    W(h + 2, -3, 8, 1, hi); W(h + 5, -1, 5, 1, hi); W(h - 3, 2, 3, 5, d.t); W(h - 3, 2, 1, 5, tint(d.t, 0.7));
  } else {
    // a master's halberd: gilt at the socket, a spike, an axe blade on one side and a beak on the other, and a big tassel
    const b = '#b9c2c6';
    W(Math.max(0, h - 14), -1, Math.min(h, 14), 1, MAT.gilt); W(Math.max(0, h - 14), 2, Math.min(h, 14), 1, MAT.gilt); W(h, -1, 2, 4, MAT.gilt); W(h - 1, 0, 1, 2, MAT.giltHi);
    W(h + 2, 0, 5, 2, b); W(h + 7, 0, 3, 1, b); W(h + 10, 0, 3, 1, hi); W(h + 13, 0, 1, 1, hi); W(h + 7, 1, 2, 1, b);
    W(h + 1, 2, 1, 3, b); W(h + 2, 2, 1, 5, b); W(h + 3, 2, 1, 6, b); W(h + 4, 2, 4, 7, b); W(h + 8, 2, 1, 6, b); W(h + 9, 2, 1, 4, b); W(h + 10, 2, 1, 2, b);
    W(h + 4, 8, 4, 1, hi); W(h + 3, 7, 1, 1, hi); W(h + 8, 7, 1, 1, hi); W(h + 9, 5, 1, 1, hi); W(h + 4, 3, 1, 5, hi);
    W(h + 3, -2, 3, 2, b); W(h + 5, -3, 2, 1, b); W(h + 2, -1, 1, 1, b);
    W(h - 4, 2, 4, 6, d.t); W(h - 4, 2, 1, 6, tint(d.t, 0.7)); W(h - 5, 2, 1, 1, MAT.gilt);
    for (let i = 1; i < 4; i++) if (h - 14 - i * 8 >= 0) W(h - 14 - i * 8, 0, 2, 2, MAT.gilt);
  }
}
/**
 * The hilt of a sabre at the hand hx, hy, for a blade that points in the direction ang, and the blade itself with len pixels, curving
 * by curve. A notched blade of dull iron; a Hungarian sabre with a steel blade and a knuckle bow; a karabela with the bird's-head
 * pommel of the Poles; a damascened blade, with gilt at the hilt and a tassel.
 */
function sabreArt(R: Painter, hx: number, hy: number, ang: number, curve: number, len: number, d: Dress) {
  const t = d.wpn, cs = Math.cos(ang), sn = Math.sin(ang), px = -sn, py = cs;
  const at = (k: number, p: number) => [Math.round(hx + cs * k + px * p), Math.round(hy + sn * k + py * p)] as const;
  const blade = ['#8c9093', '#bcc3c7', '#cdd4d7', '#e2e8ea'][t], edge = ['#aeb2b4', '#e4eaec', '#f4f7f7', '#ffffff'][t];
  // the blade first: it starts a little past the hand, by the guard, and follows its curve; the notches and the damascened streaks are on it
  const path: (readonly [number, number])[] = [];
  for (let i = 0, x = at(3, 0)[0], y = at(3, 0)[1], a = ang; i < len; i++, x += Math.cos(a), y += Math.sin(a), a += curve) path.push([Math.round(x), Math.round(y)]);
  for (const [x, y] of path) R(x, y, 2, 2, blade);
  for (const [x, y] of path) R(x - 1, y - 1, 1, 1, edge);
  if (t === 0) for (const i of [8, 13]) R(path[i][0] + 1, path[i][1] + 1, 1, 1, '#4d5155');
  if (t === 3) for (let i = 6; i < len; i += 5) R(path[i][0], path[i][1], 1, 1, '#9aa5aa');
  // grip and pommel behind the hand, and the guard in front of it
  for (let k = -3; k <= 1; k++) { const [gx, gy] = at(k, 0); R(gx, gy, 2, 2, t === 3 ? MAT.giltLo : MAT.woodLo); }
  const metal = t === 0 ? '#5d6468' : t === 3 ? MAT.gilt : '#b08d3c', metalHi = t === 3 ? MAT.giltHi : '#d8b25a';
  for (let p = -3; p <= 3; p++) { const [qx, qy] = at(2, p); R(qx, qy, t ? 2 : 1, t ? 2 : 1, metal); }
  if (t >= 1) { for (let k = -4; k <= 1; k += 1) { const [kx, ky] = at(k, 4); R(kx, ky, 2, 1, metal); } }
  if (t >= 2) { const [ex, ey] = at(-5, 0); R(ex, ey, 2, 2, metalHi); const [fx, fy] = at(-6, -1); R(fx, fy, 1, 1, metalHi); const [ox, oy] = at(-5, 2); R(ox, oy, 1, 1, metal); }
  else { const [ex, ey] = at(-4, 0); R(ex, ey, 2, 2, metal); }
  if (t === 3) { const [tx, ty] = at(-3, 3); R(tx, ty, 2, 4, d.t); R(tx, ty + 4, 1, 1, tint(d.t, 0.7)); }
}

/* ---------- arms and hands ---------- */
/** An arm: a sleeve in the coat's colour from the shoulder sx, sy by the elbow ex, ey to the wrist hx, hy, and a hand there. */
function limb(U: Painter, d: Dress, sx: number, sy: number, ex: number, ey: number, hx: number, hy: number) { sleeve(U, d, sx, sy, ex, ey, hx, hy); hand(U, hx, hy); }
/** The sleeve of an arm alone, for a weapon to be drawn over it. */
function sleeve(U: Painter, d: Dress, sx: number, sy: number, ex: number, ey: number, hx: number, hy: number) { seg(U, sx, sy, ex, ey, 3, d.c); seg(U, ex, ey, hx, hy, 3, d.c); }
/** A hand, centred on hx, hy. */
function hand(U: Painter, hx: number, hy: number) { U(hx - 1, hy - 1, 3, 3, MAT.skin); U(hx - 1, hy + 1, 3, 1, MAT.skinLo); }
/** The arm that stays behind the man, in the shade of his body. */
function backArm(U: Painter, d: Dress, ex: number, ey: number) { seg(U, -4, -24, ex, ey, 3, d.cd); U(ex - 1, ey, 3, 2, MAT.skinLo); }

/**
 * Draws one man standing, walking or fighting on the field, with his feet at x, y: his class, his livery (skin) and, by wpn and arm,
 * what he has bought. The look says what he is doing (see SoldierLook); every part of him is a layer, so a man who buys a
 * breastplate has the same picture with that layer swapped.
 */
function drawSoldier(g: CanvasRenderingContext2D, x: number, y: number, o: SoldierLook) {
  const f = o.face || 1, d = dressFor(o), R = figurePainter(g, x, y, f);
  if (o.dead) { fallen(R, d, o.cls); return; }
  R(-8, -1, 17, 2, SHADOW);
  const step = o.moving ? Math.floor(o.anim!) % 2 : -1, b = step === 1 ? -2 : 0;
  const U: Painter = (dx, dy, w, h, c) => R(dx, dy + b, w, h, c);
  legs(R, step);
  const m = o.flash! > 0 ? 'aim' : o.mode, sw = o.swing! > 0, cls = o.cls;
  if (m === 'rout') {
    limb(U, d, -3, -24, -6, -29, -7, -35); torso(U, d); head(U, d); hat(U, d, cls); pauldrons(U, d); limb(U, d, 3, -24, 6, -29, 7, -35);
    return;
  }
  if (cls === 'pike') {
    if (m === 'fight' || o.level) {
      const t = sw ? 6 : 0;
      torso(U, d); head(U, d); hat(U, d, cls); pauldrons(U, d);
      pikeArt(axial(U, -8 + t, -19, false), d.wpn, 44, d);
      limb(U, d, -3, -23, -3 + t, -20, 0 + t, -18); limb(U, d, 3, -24, 7 + t, -22, 11 + t, -19);
    } else {
      backArm(U, d, -6, -17); torso(U, d); head(U, d); hat(U, d, cls); pauldrons(U, d);
      pikeArt(axial(U, 8, -3, true), d.wpn, 43, d);
      limb(U, d, 3, -24, 4, -18, 8, -20);
    }
  } else if (cls === 'shot') {
    const L = MUSKET_LEN[d.wpn];
    if (m === 'aim') {
      backArm(U, d, -6, -18); torso(U, d); head(U, d); hat(U, d, cls); pauldrons(U, d);
      musketArt(axial(U, -3, -26, false), d.wpn);
      limb(U, d, 3, -24, 7, -20, 13, -23); U(1, -23, 4, 2, MAT.skin);
      if (o.flash! > 0) bmp(R, -3 + L, -31, ['...y..y...', '.yyyyyyyy.', 'yyywwwwyyy', 'yyywwwwyyy', '.yyyyyyyy.', '...y..y...'], { y: PAL.flash, w: PAL.white });
    } else if (m === 'reload') {
      backArm(U, d, -6, -17); torso(U, d); head(U, d); hat(U, d, cls); pauldrons(U, d);
      const up = Math.floor((o.t || 0) * 5) % 2 * 2;
      musketArt(axial(U, 8, -3, true), d.wpn);
      ramrod(U, 9, -3 - L, up);
      limb(U, d, 3, -24, 6, -28, 9, -31);
    } else if (m === 'fight') {
      const t = sw ? 6 : 0;
      torso(U, d); head(U, d); hat(U, d, cls); pauldrons(U, d);
      musketArt(axial(U, -2 + t, -19, false), d.wpn);
      limb(U, d, -3, -23, 0 + t, -20, 4 + t, -17); limb(U, d, 3, -24, 7 + t, -22, 11 + t, -18);
    } else {
      backArm(U, d, -6, -17); torso(U, d); bandolier(U, d); head(U, d); hat(U, d, cls); pauldrons(U, d);
      sleeve(U, d, 3, -24, 7, -16, 17, -18);
      musketArt(slanted(U, 2, -20, 5), d.wpn);
      hand(U, 17, -19); hand(U, 8, -19);
    }
  } else {
    if (m === 'fight' || sw) {
      backArm(U, d, -6, -17); torso(U, d); head(U, d); hat(U, d, cls); pauldrons(U, d);
      if (sw) { sabreArt(U, 9, -23, -0.12, 0.05, 24, d); seg(U, 14, -33, 30, -28, 1, 'rgba(244,240,228,.7)'); seg(U, 22, -36, 36, -24, 1, 'rgba(244,240,228,.5)'); }
      else sabreArt(U, 8, -21, -0.8, 0.02, 22, d);
      limb(U, d, 3, -24, 6, -20, sw ? 9 : 8, sw ? -23 : -21);
    } else {
      backArm(U, d, -6, -17); torso(U, d); head(U, d); hat(U, d, cls); pauldrons(U, d);
      sabreArt(U, 6, -22, -1.15, 0.035, 22, d);
      limb(U, d, 3, -24, 5, -19, 6, -22);
    }
  }
}
/** The ramrod that a musketeer drives down his barrel, up above the muzzle at x, y. */
function ramrod(U: Painter, x: number, y: number, up: number) { U(x, y - 12 - up, 1, 12 + up, MAT.ash); U(x - 1, y - 14 - up, 3, 2, MAT.wood); }
/** The strap across a musketeer's chest with the twelve little charges of powder hung from it. */
function bandolier(U: Painter, d: Dress) {
  if (d.arm > 1) { U(-8, -15, 3, 5, MAT.leather); U(-8, -15, 3, 1, MAT.gilt); U(-7, -10, 1, 2, MAT.cord); return; } // in armour, a flask of powder at the hip instead
  seg(U, 3, -25, -4, -16, 1, MAT.leather); seg(U, 3, -24, -4, -15, 1, MAT.leather);
  for (let i = 0; i < 5; i++) U(Math.round(3 - i * 1.5) - 1, -23 + Math.round(i * 1.6), 1, 2, MAT.ash);
}

/** A man lying where he fell, in his armour, in a pool of his own blood. */
function fallen(R: Painter, d: Dress, cls: TroopClass) {
  const white = (x: string) => (d.hit ? PAL.white : x);
  R(-15, -1, 31, 2, MAT.blood); R(-11, 0, 23, 1, PAL.red);
  R(-20, -5, 10, 4, MAT.hose); R(-23, -5, 4, 4, MAT.boot); R(-23, -4, 3, 1, MAT.bootHi);
  const body = d.arm ? white(MAT.buff) : d.c, lo = d.arm ? MAT.buffLo : d.cd;
  R(-10, -9, 16, 8, body); R(-10, -9, 16, 1, lo); R(-10, -2, 16, 1, lo); R(-10, -9, 1, 8, lo);
  if (d.arm > 1) { R(-3, -9, 9, 8, d.arm > 2 ? '#a9b2b6' : MAT.steel); R(-3, -9, 9, 1, MAT.steelHi); R(-3, -2, 9, 1, MAT.steelLo); R(0, -8, 1, 5, MAT.steelHi); if (d.arm > 2) R(-3, -9, 1, 8, MAT.gilt); }
  if (d.arm > 2) for (let i = 0; i < 3; i++) R(-10 + i * 2, -9, 2, 8, i % 2 ? '#a9b2b6' : '#6f7a80');
  R(7, -9, 6, 7, MAT.skin); R(7, -3, 6, 1, MAT.skinLo); R(12, -6, 1, 2, MAT.skin); R(6, -9, 1, 6, d.hair); R(10, -6, 1, 1, MAT.ink);
  const hatc = cls === 'pike' ? MAT.steel : cls === 'shot' ? MAT.felt : MAT.fur;
  R(14, -4, 8, 4, hatc); R(15, -5, 5, 1, hatc); R(14, -4, 8, 1, cls === 'pike' ? MAT.steelHi : cls === 'shot' ? MAT.feltHi : MAT.furHi);
}

/* ---------- the company in camp ---------- */
/** A man seated, lying or foraging: the poses of camp that the field has no use for. */
function drawSeated(R: Painter, d: Dress, o: CamperLook) {
  const U: Painter = (dx, dy, w, h, c) => R(dx, dy + 4, w, h, c);
  // the thigh runs forward along the log, the shin down from the knee
  R(-1, -9, 11, 4, MAT.hose); R(8, -6, 4, 4, MAT.hose); R(8, -4, 4, 2, MAT.boot); R(8, -3, 8, 3, MAT.boot); R(8, -1, 8, 1, MAT.ink);
  backArm(U, d, -6, -16); torso(U, d); head(U, d); hat(U, d, o.cls); pauldrons(U, d);
  if (o.prop === 'bandura') {
    R(1, -16, 10, 8, MAT.wood); R(2, -17, 8, 1, MAT.wood); R(1, -9, 10, 1, MAT.woodLo); R(2, -16, 8, 1, MAT.woodHi); R(5, -14, 3, 3, MAT.ink);
    R(10, -20, 2, 5, MAT.wood); R(9, -26, 2, 7, MAT.wood); R(8, -29, 4, 3, MAT.woodLo); R(9, -26, 1, 7, MAT.woodHi);
    for (let i = 0; i < 3; i++) R(3 + i * 2, -15, 1, 5, MAT.cord);
    limb(U, d, 3, -24, 5, -19, 10, -18);
    R(7, o.strum ? -13 : -15, 3, 2, MAT.skin);
  } else if (o.prop === 'pipe') {
    limb(U, d, 3, -24, 5, -20, 5, -25); R(4, -29, 7, 2, MAT.ink); R(10, -33, 2, 5, MAT.wood); R(10, -33, 2, 1, MAT.ember);
  } else limb(U, d, 3, -24, 5, -19, 9, -14);
}
function drawLying(R: Painter, d: Dress, o: CamperLook) {
  // a bedroll, the man in his coat with a blanket over him, and his head on the pillow; a bandage if he is hurt
  R(-17, -4, 37, 4, MAT.woodLo); R(-17, -4, 37, 1, MAT.wood);
  R(-14, -9, 25, 6, d.arm ? MAT.buff : d.c); R(-14, -9, 25, 1, d.arm ? MAT.buffHi : d.cl); R(-14, -4, 25, 1, d.arm ? MAT.buffLo : d.cd);
  R(-4, -10, 24, 7, PAL.drab); R(-4, -10, 24, 1, tint(PAL.drab, 1.25)); R(-4, -4, 24, 1, tint(PAL.drab, 0.7)); R(2, -9, 1, 5, tint(PAL.drab, 0.8)); R(10, -9, 1, 5, tint(PAL.drab, 0.8));
  R(16, -10, 6, 8, MAT.boot); R(16, -10, 6, 1, MAT.bootHi);
  R(-17, -11, 7, 7, MAT.skin); R(-17, -5, 7, 1, MAT.skinLo); R(-18, -11, 2, 5, d.hair); R(-12, -8, 1, 1, MAT.ink); R(-11, -8, 1, 2, MAT.skin);
  if (o.bandage !== false) { R(-18, -12, 8, 2, PAL.white); R(-19, -11, 1, 4, PAL.white); R(-14, -12, 2, 2, PAL.red); }
  if (d.mus) R(-12, -6, 3, 1, d.hair);
}
function drawForaging(R: Painter, U: Painter, d: Dress, o: CamperLook) {
  limb(U, d, -3, -24, -4, -19, -3, -16); torso(U, d); head(U, d); hat(U, d, o.cls); pauldrons(U, d);
  limb(U, d, 3, -24, 6, -19, 9, -16);
  U(6, -15, 11, 7, MAT.wood); U(6, -15, 11, 1, MAT.ink); U(6, -8, 11, 1, MAT.woodLo); U(8, -17, 7, 2, PAL.green); U(9, -18, 3, 1, tint(PAL.green, 1.3));
  for (let i = 0; i < 4; i++) U(7 + i * 3, -13, 1, 4, MAT.woodLo);
  seg(U, 9, -16, 11, -20, 1, MAT.woodLo); seg(U, 11, -20, 14, -16, 1, MAT.woodLo);
}
/**
 * How a man is posed in camp: sitting on a log, lying abed (or fallen), walking out foraging with a basket, or standing as on the field.
 * Anything but those draws a man as drawSoldier does.
 */
function drawCamper(g: CanvasRenderingContext2D, x: number, y: number, o: CamperLook) {
  if (o.pose !== 'sit' && o.pose !== 'lie' && o.pose !== 'forage') {
    drawSoldier(g, x, y, o);
    if (o.bandage) { const R = figurePainter(g, x, y, o.face || 1), b = o.moving && Math.floor(o.anim!) % 2 === 1 ? -2 : 0; R(-3, -34 + b, 8, 2, PAL.white); R(-3, -32 + b, 6, 1, '#cfc8b4'); R(-2, -34 + b, 2, 2, PAL.red); }
    return;
  }
  const f = o.face || 1, d = dressFor(o), R = figurePainter(g, x, y, f);
  if (o.pose === 'lie') { drawLying(R, d, o); return; }
  if (o.pose === 'sit') { drawSeated(R, d, o); return; }
  const step = Math.floor(o.anim || 0) % 2, b = step === 1 ? -2 : 0, U: Painter = (dx, dy, w, h, c) => R(dx, dy + b, w, h, c);
  R(-8, -1, 17, 2, SHADOW);
  legs(R, step);
  drawForaging(R, U, d, o);
}

/* ---------- the baggage train: the hired hands ---------- */
function drawCivilian(g: CanvasRenderingContext2D, x: number, y: number, k: StaffId, face?: 1 | -1) {
  const f = face || 1, L = STAFF_LOOK[k], R = figurePainter(g, x, y, f), K = MAT.ink;
  R(-8, -1, 17, 2, SHADOW);
  legs(R, -1);
  R(-6, -14, 13, 4, L.coat); R(-4, -19, 9, 3, L.coat); R(-5, -25, 11, 6, L.coat); R(-6, -14, 1, 4, tint(L.coat === K ? '#3a3631' : L.coat, 0.7)); R(-5, -25, 1, 6, tint(L.coat === K ? '#3a3631' : L.coat, 0.7)); R(-6, -11, 13, 1, tint(L.coat === K ? '#3a3631' : L.coat, 0.7));
  R(-4, -16, 9, 2, MAT.leather);
  R(-3, -33, 2, 6, HAIR[1]); R(-2, -33, 6, 6, MAT.skin); R(-2, -28, 6, 1, MAT.skinLo); R(-1, -27, 3, 1, MAT.skinLo); R(2, -31, 1, 1, K); R(4, -31, 1, 2, MAT.skin);
  R(-8, -35, 17, 2, K); R(-4, -39, 9, 4, K); R(-4, -39, 1, 4, MAT.feltHi);
  const arm = (hx: number, hy: number) => { seg(R, 3, -24, 5, -19, 3, L.coat); seg(R, 5, -19, hx, hy, 3, L.coat); R(hx - 1, hy - 1, 3, 3, MAT.skin); };
  if (k === 'surgeon') { R(-2, -25, 7, 2, PAL.white); R(-2, -23, 7, 10, PAL.white); R(-2, -13, 7, 1, '#cfc8b4'); arm(9, -19); R(10, -17, 8, 2, MAT.steel); R(14, -15, 5, 1, MAT.steel); R(16, -14, 3, 1, MAT.steelHi); }
  else if (k === 'drill') { arm(8, -19); R(9, -32, 2, 32, MAT.wood); R(9, -34, 2, 2, MAT.gilt); R(-4, -37, 9, 1, PAL.white); R(-5, -25, 11, 1, MAT.gilt); }
  else if (k === 'qm') { arm(9, -19); R(8, -19, 8, 8, PAL.white); R(8, -19, 8, 1, K); R(8, -19, 1, 8, K); R(10, -16, 4, 1, MAT.cord); R(10, -13, 4, 1, MAT.cord); R(-3, -37, 6, 2, L.trim); }
  else { R(-2, -25, 7, 2, PAL.white); arm(8, -19); R(9, -30, 2, 11, MAT.gilt); R(6, -27, 8, 2, MAT.gilt); R(9, -30, 1, 11, MAT.giltHi); R(-3, -26, 7, 1, PAL.white); }
}

/* ---------- the pictures of gear, for the cards ---------- */
const gearCache: Record<string, string> = {};
/**
 * A picture of one thing a man can buy, drawn as it is worn: his weapon (slot 'wpn', for his class) or his armour (slot 'arm'), at
 * level tier, 0 to 3. It is the address of an image 44 by 32 figure pixels, which the cards show pixel for pixel (see sceneCanvas).
 */
function gearArt(slot: GearSlot, cls: TroopClass, tier: number) {
  const key = slot + (slot === 'wpn' ? cls : '') + tier;
  if (gearCache[key]) return gearCache[key];
  // the origin is the middle of the picture
  const c = sceneCanvas(22, 16), g = c.getContext('2d')!, d = dressFor({ cls, skin: 'own', wpn: tier, arm: tier }), R = figurePainter(g, 11, 8, 1);
  if (slot === 'arm') {
    const U: Painter = (dx, dy, w, h, col) => R(dx, dy + 19, w, h, col);
    U(-8, -26, 5, 8, d.c); U(5, -26, 4, 8, d.c); torso(U, d); pauldrons(U, d);
  } else if (cls === 'shot') musketArt(axial(R, -(MUSKET_LEN[tier] >> 1), -1, false), tier);
  else if (cls === 'pike') pikeArt(axial(R, 0, 15, true), tier, 15, d);
  else sabreArt(R, -9, 7, -0.85, 0.045, 26, d);
  return (gearCache[key] = c.toDataURL());
}
