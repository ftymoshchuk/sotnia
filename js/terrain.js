"use strict";
/* ===== SOTNIA interface: terrain. The scenery behind a fight is the land the fight is in. ===== */
/**
 * Backdrops are drawn SS times finer than the scene, as the figures are, so that a man does not stand against blocks twice his own
 * pixel. Everything here is in figure pixels from the picture's top left: W by H of them, with the horizon at HZ of the scene. The
 * men stand between FY and FY + BD of the scene, the lower half of the picture, so what is drawn there is kept quiet, and the
 * landmarks stand on the hills, the line of the horizon and a little below it.
 *
 * It is painted, not drawn: every colour is a step of the master palette (the ramps just below), and what is far, or wet, or foggy, or
 * lit by the moon is the same step moved along the palette, never a blend off it. Gradients and haze are ordered dither (a Bayer
 * matrix, so a pattern and never speckle) laid on in runs. The light is one low sun, upper left: what stands is lit on its left, cool in
 * its lee, and edged in the darkest soot.
 */
/* ---------- the dyes: the master palette, each ramp dark to light ---------- */
const rSoot = ['#0b0907', '#14100c', '#1d1711', '#2a2018', '#3a2d21', '#4e3d2c', '#67533b', '#846c4c'];
const rBone = ['#6e6249', '#8f8467', '#b3a784', '#d1c5a1', '#e7ddbf', '#f4edd6'];
const rPaper = ['#6d5f3f', '#8d7b52', '#a8976a', '#bfae82', '#d3c498', '#e4d8b3'];
const rBronze = ['#3a2a12', '#5b4219', '#80602a', '#a78039', '#cba34f', '#e8c874', '#f7e2a0'];
const rMadder = ['#240d0c', '#4a1816', '#6e2420', '#8f3328', '#b2493a', '#d0705a', '#e9a58b'];
const rWoad = ['#0e1420', '#17233a', '#233756', '#33507a', '#4b6f98', '#6f94b4', '#9dbad0'];
const rMoss = ['#0e130b', '#1a2411', '#2a3a1a', '#3f5524', '#587030', '#7a8e42', '#a0ae60', '#c6cf8c'];
const rOchre = ['#33240c', '#563b12', '#7e571b', '#a67a27', '#cf9f3c', '#e6c15f', '#f2dc92'];
const rIron = ['#101316', '#1d2227', '#2f363d', '#48515a', '#6b757e', '#939ca3', '#bec4c6', '#e3e6e2'];
const rSkin = ['#4a2c20', '#7a4d36', '#a5714f', '#cd9a73', '#e8bd96', '#f3d6b4'];
const rNight = ['#05070e', '#0a0f1c', '#101a2e', '#182742', '#233a5c', '#35527a'];
const rFire = ['#4a1006', '#8a2c0e', '#c4521a', '#e8862c', '#f6b73e', '#fcdc7c', '#fff2c2'];
const rTeal = ['#0f2623', '#1a403b', '#2a625a', '#3f867a', '#66ac9a', '#9acfbd'];
const rPlum = ['#241022', '#40203c', '#5e3158', '#80487a', '#a86a9c'];
const rSky = ['#4a6a82', '#6c8fa4', '#92b0bb', '#b8cac8', '#d6dccb', '#ece8cf'];
/** Every step of every ramp: what a colour moved off the palette is brought back to. */
const LAND_DYES = [...rSoot, ...rBone, ...rPaper, ...rBronze, ...rMadder, ...rWoad, ...rMoss, ...rOchre, ...rIron, ...rSkin, ...rNight, ...rFire, ...rTeal, ...rPlum, ...rSky];
/** The dark that edges what stands, and the dark of a window and a door. */
const LAND_EDGE = rSoot[1], DARK = rSoot[2];
/** A colour (#rrggbb) moved the part t of the way, from 0 to 1, towards another. */
function mixHex(a, b, t) {
    const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16), ch = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
const dyeRGB = LAND_DYES.map(h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
/** The step of the palette nearest to a colour, as the eye weighs red, green and blue. */
function nearDye(hex) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    let best = Infinity, out = LAND_DYES[0];
    dyeRGB.forEach(([R, G, B], i) => { const m = (r + R) / 2, e = (2 + m / 256) * (r - R) ** 2 + 4 * (g - G) ** 2 + (2 + (255 - m) / 256) * (b - B) ** 2; if (e < best) {
        best = e;
        out = LAND_DYES[i];
    } });
    return out;
}
function dyeGrade(f) {
    const memo = new Map();
    return c => { let o = memo.get(c); if (o === undefined)
        memo.set(c, o = f(c)); return o; };
}
/** A grade that takes each colour the part k of the way to another, then a part dark of the way to soot, and back to the nearest dye (a far hill goes blue this way). */
const dyeTowards = (to, k, dark = 0) => dyeGrade(c => nearDye(mixHex(mixHex(c, to, k), rSoot[1], dark)));
/** Where each dye stands: its ramp, and its step on it. */
const dyeAt = new Map();
for (const ramp of [rSoot, rBone, rPaper, rBronze, rMadder, rWoad, rMoss, rOchre, rIron, rSkin, rNight, rFire, rTeal, rPlum, rSky])
    ramp.forEach((h, i) => dyeAt.set(h, [ramp, i]));
/** A dye moved d steps along its own ramp, so that it keeps its hue as it darkens or pales. */
const dyeStepped = (c, d) => { const at = dyeAt.get(c); return at ? at[0][clamp(at[1] + d, 0, at[0].length - 1)] : c; };
const dyeBrightness = (h) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
/** The dye of another ramp whose brightness is nearest to k times this one's. */
const dyeVia = (c, to, k = 1) => { const L = dyeBrightness(c) * k; return to.reduce((a, b) => (Math.abs(dyeBrightness(b) - L) < Math.abs(dyeBrightness(a) - L) ? b : a)); };
/** Rain: whitewash goes the grey of wet lime and thatch the drab of wet straw, the rest a step darker on its own ramp; fire and skin are left alone. */
const RAIN_GRADE = dyeGrade(c => {
    const at = dyeAt.get(c);
    if (!at)
        return c;
    const ramp = at[0];
    if (ramp === rBone)
        return dyeVia(c, rIron, 0.95);
    if (ramp === rOchre || ramp === rBronze)
        return dyeVia(c, rPaper, 0.92);
    return ramp === rSoot || ramp === rFire || ramp === rSkin || ramp === rNight || ramp === rPlum || ramp === rTeal ? c : dyeStepped(c, dyeBrightness(c) > 70 ? -1 : 0); // the darks are dark enough
});
/** Fog: every dye a step paler on its own ramp (the soot of an outline two), the rest is done by the haze laid over the picture. */
const FOG_GRADE = dyeGrade(c => dyeStepped(c, dyeAt.get(c)?.[0] === rSoot ? 2 : 1));
/** The moon's grade: every dye becomes a step of the night ramp by its brightness, but fire and gold, which keep their light. */
const MOON_GRADE = dyeGrade(c => {
    if (c === rFire[3] || c === rFire[4] || c === rFire[5] || c === rBronze[5] || c === rBronze[6])
        return c;
    const n = parseInt(c.slice(1), 16), L = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return rNight[L < 0.1 ? 0 : L < 0.2 ? 1 : L < 0.31 ? 2 : L < 0.45 ? 3 : L < 0.62 ? 4 : 5];
});
const LAND_BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** The patterns made so far, by their two colours and level: each a 4 by 4 tile of the Bayer matrix, drawn one tile pixel to a pixel of the picture. */
const landPatterns = new Map();
/** The fill that stands for a dither of a and b at level n: its pattern, or where the canvas can make none, the two blended (a stipple, which has no a to blend, is left out). */
function landPattern(g, a, b, n) {
    const key = a + '|' + b + '|' + n;
    let p = landPatterns.get(key);
    if (p === undefined) {
        const tile = document.createElement('canvas');
        tile.width = tile.height = 4;
        const t = tile.getContext('2d');
        for (let y = 0; y < 4; y++)
            for (let x = 0; x < 4; x++) {
                const c = LAND_BAYER[y][x] < n ? b : a;
                if (c) {
                    t.fillStyle = c;
                    t.fillRect(x, y, 1, 1);
                }
            }
        p = g.createPattern(tile, 'repeat');
        if (p) {
            try {
                p.setTransform({ a: 1 / SS, b: 0, c: 0, d: 1 / SS, e: 0, f: 0 });
            }
            catch (e) {
                p = null;
            }
        } // the picture's context is scaled SS times: this undoes it
        if (!p)
            p = a === null ? null : mixHex(a, b, n / 16);
        landPatterns.set(key, p);
    }
    return p;
}
/** A scene to draw on: g is the SS-fine canvas of the backdrop (see sceneCanvas), whose context is scaled to the scene. */
function makeScene(g, seed, weather, T, W = LW * SS, sky = true, night = false) {
    const H = LH * SS, weatherGrade = weather === 'rain' ? RAIN_GRADE : weather === 'fog' ? FOG_GRADE : null;
    const baseGrade = night ? MOON_GRADE : weatherGrade;
    let grade = baseGrade, lastFill = null; // lastFill: what the canvas is set to paint with, so that it is set only when it changes
    const fades = new Map(), dithers = new Map();
    const toned = (c) => (grade ? grade(c) : c);
    /** What a fill is made of: a colour, a pattern, or (a stipple with no pattern to make it of) nothing. */
    const fillOf = (c) => {
        if (c === null)
            return null;
        if (typeof c === 'string')
            return toned(c);
        const a = c.a === null ? null : toned(c.a), b = toned(c.b);
        if (c.n >= 16 || a === b)
            return b;
        if (c.n <= 0)
            return a;
        return landPattern(g, a, b, c.n);
    };
    const rect = (x, y, w, h, c) => {
        const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
        if (x1 > x0 && y1 > y0) {
            const f = fillOf(c);
            if (f !== null) {
                if (f !== lastFill)
                    g.fillStyle = lastFill = f;
                g.fillRect(x0 / SS, y0 / SS, (x1 - x0) / SS, (y1 - y0) / SS);
            }
        }
    };
    const same = (p, q) => p === q || (!!p && !!q && typeof p === 'object' && typeof q === 'object' && p.a === q.a && p.b === q.b && p.n === q.n);
    const run = (x0, y0, x1, y1, fn) => {
        x0 = Math.round(x0);
        x1 = Math.round(x1);
        for (let y = Math.round(y0), ye = Math.round(y1); y < ye; y++) {
            let from = x0, cur = fn(x0, y);
            for (let x = x0 + 1; x <= x1; x++) {
                const p = x < x1 ? fn(x, y) : undefined;
                if (x === x1 || !same(p, cur)) {
                    if (cur)
                        rect(from, y, x - from, 1, cur);
                    from = x;
                    cur = p;
                }
            }
        }
    };
    const line = (x0, y0, x1, y1, c) => {
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        x1 = Math.round(x1);
        y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let e = dx - dy;
        for (let i = 0; i < 900; i++) {
            rect(x0, y0, 1, 1, c);
            if (x0 === x1 && y0 === y1)
                break;
            const e2 = 2 * e;
            if (e2 > -dy) {
                e -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                e += dx;
                y0 += sy;
            }
        }
    };
    const shape = (pts) => {
        let top = Infinity, bot = -Infinity;
        for (let i = 1; i < pts.length; i += 2) {
            top = Math.min(top, pts[i]);
            bot = Math.max(bot, pts[i]);
        }
        const y0 = Math.floor(top), runs = [];
        for (let y = y0; y < Math.ceil(bot); y++) {
            const xs = [], yc = y + 0.5, row = [];
            for (let i = 0, n = pts.length; i < n; i += 2) {
                const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % n], by = pts[(i + 3) % n];
                if ((ay <= yc && by > yc) || (by <= yc && ay > yc))
                    xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
            }
            xs.sort((a, b) => a - b);
            for (let k = 0; k + 1 < xs.length; k += 2) {
                const a = Math.round(xs[k]), b = Math.round(xs[k + 1]);
                if (b > a)
                    row.push(a, b);
            }
            runs.push(row);
        }
        return { y0, runs };
    };
    const ellipse = (cx, cy, rx, ry) => {
        cx = Math.round(cx);
        cy = Math.round(cy);
        rx = Math.round(rx);
        ry = Math.round(ry);
        const runs = [];
        for (let dy = -ry; dy <= ry; dy++) {
            const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / Math.max(1, ry)) ** 2)));
            runs.push([cx - hw, cx + hw + 1]);
        }
        return { y0: cy - ry, runs };
    };
    const fill = (sh, c) => sh.runs.forEach((row, i) => { for (let k = 0; k < row.length; k += 2)
        rect(row[k], sh.y0 + i, row[k + 1] - row[k], 1, c); });
    const edge = (sh, c) => {
        for (let i = -1; i <= sh.runs.length; i++) {
            const iv = [];
            for (const [j, grow] of [[i, 1], [i - 1, 0], [i + 1, 0]]) {
                const row = sh.runs[j];
                if (row)
                    for (let k = 0; k < row.length; k += 2)
                        iv.push([row[k] - grow, row[k + 1] + grow]);
            }
            iv.sort((p, q) => p[0] - q[0]);
            let cur = null;
            for (const v of iv) {
                if (cur && v[0] <= cur[1])
                    cur[1] = Math.max(cur[1], v[1]);
                else {
                    if (cur)
                        rect(cur[0], sh.y0 + i, cur[1] - cur[0], 1, c);
                    cur = [v[0], v[1]];
                }
            }
            if (cur)
                rect(cur[0], sh.y0 + i, cur[1] - cur[0], 1, c);
        }
    };
    const poly = (pts, c, e) => { const sh = shape(pts); if (e)
        edge(sh, e); fill(sh, c); return sh; };
    const disc = (cx, cy, rx, ry, c, e) => {
        const sh = ellipse(cx, cy, rx, ry);
        if (e) {
            fill(sh, e);
            const inner = ellipse(cx, cy, rx - 1, ry - 1);
            fill(inner, c);
            return inner;
        }
        fill(sh, c);
        return sh;
    };
    const rims = (sh, c, w, right) => sh.runs.forEach((row, i) => { for (let k = 0; k < row.length; k += 2) {
        const a = row[k], b = row[k + 1], ww = Math.min(w, b - a);
        if (right)
            rect(b - ww, sh.y0 + i, ww, 1, c);
        else
            rect(a, sh.y0 + i, ww, 1, c);
    } });
    const fadeGrade = (t) => {
        let f = fades.get(t);
        if (!f) {
            const to = dyeTowards(baseGrade ? baseGrade(T.haze) : T.haze, t);
            f = baseGrade ? (night ? (c => MOON_GRADE(to(baseGrade(c)))) : (c => to(baseGrade(c)))) : to;
            fades.set(t, f);
        } // by night the far country is brought back to the night's blues
        return f;
    };
    return {
        W, H, HZ: HZ * SS, sky, night, weather, T, r: mulberry(seed), ridge: () => HZ * SS - 4, rect, line, disc, poly, shape, edge, fill, run,
        lit: (sh, c, w = 1) => rims(sh, c, w, false), shade: (sh, c, w = 1) => rims(sh, c, w, true),
        cap: (sh, c, h = 1) => sh.runs.slice(0, h).forEach((row, i) => { for (let k = 0; k < row.length; k += 2)
            rect(row[k], sh.y0 + i, row[k + 1] - row[k], 1, c); }),
        split: (sh, cx, left, right) => sh.runs.forEach((row, i) => { for (let k = 0; k < row.length; k += 2) {
            const a = row[k], b = row[k + 1], m = Math.min(Math.max(Math.round(cx), a), b);
            rect(a, sh.y0 + i, m - a, 1, left);
            rect(m, sh.y0 + i, b - m, 1, right);
        } }),
        courses: (sh, c, every, from = 2) => sh.runs.forEach((row, i) => { if (i >= from && (i - from) % every === 0)
            for (let k = 0; k < row.length; k += 2)
                rect(row[k] + 1, sh.y0 + i, row[k + 1] - row[k] - 2, 1, c); }),
        dither(a, b, n) { const key = a + '|' + b + '|' + n; let d = dithers.get(key); if (!d)
            dithers.set(key, d = { a, b, n }); return d; },
        ramp(cols) {
            const steps = cols.length - 1, top = steps * 16, table = [];
            for (let i = 0; i <= top; i++) {
                const k = Math.min(steps - 1, Math.floor(i / 16)), n = i - k * 16;
                table.push(n <= 0 ? cols[k] : n >= 16 ? cols[k + 1] : this.dither(cols[k], cols[k + 1], n));
            }
            const f = ((t) => table[Math.min(top, Math.max(0, Math.round(t * top)))]);
            f.levels = top;
            f.at = level => table[level < 0 ? 0 : level > top ? top : level];
            return f;
        },
        fade(t, draw) { const was = grade; grade = fadeGrade(t); try {
            return draw();
        }
        finally {
            grade = was;
        } },
        plain(draw) { const was = grade; grade = night ? MOON_GRADE : null; try {
            return draw();
        }
        finally {
            grade = was;
        } }
    };
}
/* ---------- the colours of each land ---------- */
// Each land has its own light, low and from the left: the steppe's is warm and long, Ukraine's golden, the Crown's a pale overcast gold, Prussia's the grey-blue of
// the sea, Lithuania's the dusk of a forest, the Smolensk front's a smoky dawn, and Silesia's and Saxony's the cooler light of hills.
const TONES = {
    steppe: {
        sky: [rSky[0], rSky[1], rSky[2], rSky[3], rSky[4], rSky[5]], glow: rOchre[6], sun: rBone[5], haze: rSky[5], cloud: [rSky[5], rOchre[6], rSky[2]],
        far: [rSky[4], rSky[3], rSky[2], rSky[1]], hill: [rOchre[6], rOchre[5], rOchre[4], rPaper[1]],
        ground: [rPaper[4], rPaper[3], rPaper[2], rMoss[4], rMoss[3]], earth: [rSoot[4], rSoot[6], rPaper[2]], leaf: [rMoss[2], rMoss[4], rMoss[5]], dry: rOchre[3], mark: rBronze[3]
    },
    ukraine: {
        sky: [rSky[0], rSky[1], rSky[2], rSky[3], rSky[4], rBone[5]], glow: rOchre[6], sun: rBone[5], haze: rSky[5], cloud: [rSky[5], rOchre[6], rSky[2]],
        far: [rSky[3], rSky[2], rSky[1], rWoad[4]], hill: [rMoss[6], rMoss[5], rMoss[4], rMoss[3]],
        ground: [rMoss[6], rMoss[5], rMoss[4], rMoss[3]], earth: [rSoot[4], rSoot[5], rPaper[2]], leaf: [rMoss[2], rMoss[4], rMoss[5]], dry: rOchre[3], mark: rMoss[4]
    },
    poland: {
        sky: [rSky[1], rSky[2], rSky[3], rSky[4], rSky[5], rBone[5]], glow: rBronze[6], sun: rBone[5], haze: rSky[5], cloud: [rBone[5], rBronze[6], rSky[3]],
        far: [rSky[4], rSky[3], rSky[2], rWoad[5]], hill: [rMoss[6], rMoss[5], rMoss[4], rMoss[3]],
        ground: [rPaper[4], rMoss[5], rMoss[4], rMoss[3]], earth: [rSoot[4], rSoot[6], rPaper[3]], leaf: [rMoss[2], rMoss[4], rMoss[5]], dry: rPaper[3], mark: rMoss[5]
    },
    prussia: {
        sky: [rSky[0], rSky[1], rSky[2], rIron[6], rIron[7], rIron[7]], glow: rSky[5], sun: rIron[7], haze: rIron[7], cloud: [rIron[7], rSky[5], rIron[5]],
        far: [rIron[6], rSky[3], rSky[2], rSky[1]], hill: [rBone[4], rPaper[4], rPaper[3], rMoss[4]],
        ground: [rBone[4], rPaper[4], rMoss[5], rMoss[4], rMoss[3]], earth: [rSoot[5], rBone[1], rBone[3]], leaf: [rMoss[2], rMoss[3], rMoss[5]], dry: rBone[3], mark: rWoad[4]
    },
    lithuania: {
        sky: [rWoad[2], rWoad[3], rWoad[4], rSky[1], rSky[3], rBone[3]], glow: rMadder[6], sun: rBone[5], haze: rWoad[5], cloud: [rBone[4], rMadder[6], rWoad[5]],
        far: [rSky[2], rWoad[5], rWoad[4], rWoad[3]], hill: [rMoss[5], rMoss[4], rMoss[3], rMoss[1]],
        ground: [rMoss[6], rMoss[5], rMoss[4], rMoss[3]], earth: [rSoot[3], rSoot[5], rBone[1]], leaf: [rMoss[0], rMoss[2], rMoss[4]], dry: rMoss[5], mark: rMoss[2]
    },
    front: {
        sky: [rIron[3], rIron[4], rIron[5], rBone[2], rBone[3], rPaper[5]], glow: rOchre[6], sun: rFire[5], haze: rPaper[4], cloud: [rBone[3], rOchre[6], rIron[4]],
        far: [rBone[3], rBone[2], rIron[5], rIron[4]], hill: [rPaper[4], rPaper[3], rPaper[2], rBone[1]],
        ground: [rPaper[3], rPaper[2], rPaper[1], rSoot[7], rSoot[6]], earth: [rSoot[4], rSoot[6], rPaper[2]], leaf: [rMoss[1], rMoss[3], rMoss[5]], dry: rPaper[3], mark: rSoot[6]
    },
    silesia: {
        sky: [rSky[0], rSky[1], rSky[2], rSky[3], rSky[4], rIron[7]], glow: rSky[5], sun: rBone[5], haze: rSky[4], cloud: [rIron[7], rBone[5], rSky[2]],
        far: [rSky[3], rSky[2], rWoad[5], rWoad[4]], hill: [rOchre[6], rOchre[4], rPaper[2], rBone[1]],
        ground: [rPaper[4], rPaper[3], rMoss[5], rMoss[4], rMoss[3]], earth: [rSoot[4], rSoot[6], rPaper[3]], leaf: [rMoss[2], rMoss[4], rMoss[5]], dry: rPaper[3], mark: rBronze[2]
    },
    saxony: {
        sky: [rSky[0], rSky[1], rSky[2], rSky[3], rSky[4], rSky[5]], glow: rBone[5], sun: rBone[5], haze: rSky[4], cloud: [rSky[5], rBone[5], rSky[2]],
        far: [rSky[3], rSky[2], rWoad[5], rWoad[4]], hill: [rMoss[6], rMoss[5], rMoss[4], rMoss[3]],
        ground: [rMoss[6], rMoss[5], rMoss[4], rMoss[3]], earth: [rSoot[4], rSoot[6], rPaper[3]], leaf: [rMoss[2], rMoss[4], rMoss[5]], dry: rMoss[5], mark: rMoss[3]
    }
};
/** A land's colours on a day of this weather: rain closes the sky over it in grey and fog pales it (the rest is graded as it is painted, see makeScene). */
function weatherTone(T, weather) {
    if (weather === 'rain')
        return { ...T, sky: [rIron[2], rIron[3], rIron[4], rIron[5], rIron[5], rIron[6]], glow: rIron[6], sun: rIron[6], haze: rIron[6], cloud: [rIron[4], rIron[5], rIron[2]] };
    if (weather === 'fog')
        return { ...T, sky: [rSky[3], rSky[4], rSky[4], rSky[5], rSky[5], rSky[5]], glow: rSky[5], sun: rSky[5], haze: rSky[5], cloud: [rSky[5], rSky[5], rSky[3]] };
    return T;
}
const landMat = (dk, lo, mid, lit, hi) => ({ dk, lo, mid, lit, hi });
const STUFF = {
    wall: landMat(rIron[4], rIron[5], rBone[3], rBone[4], rBone[5]), // whitewash, warm in the light and cool in its lee
    thatch: landMat(rOchre[1], rOchre[3], rOchre[4], rOchre[5], rOchre[6]),
    tile: landMat(rMadder[1], rMadder[2], rMadder[3], rMadder[4], rMadder[5]),
    brick: landMat(rMadder[1], rMadder[2], rMadder[2], rMadder[3], rMadder[4]), // brick walls: the face is the darker madder, so that a church of it does not shout
    shingle: landMat(rIron[1], rIron[2], rIron[3], rIron[4], rIron[5]), // slate and weathered shingle
    timber: landMat(rSoot[2], rSoot[4], rSoot[5], rSoot[6], rSoot[7]),
    stone: landMat(rIron[2], rIron[3], rIron[4], rIron[5], rIron[6]),
    lime: landMat(rIron[3], rIron[4], rBone[2], rBone[3], rBone[4]), // limewashed stone and plaster
    water: landMat(rWoad[3], rWoad[4], rSky[1], rSky[2], rSky[4]),
    smoke: landMat(rIron[2], rIron[3], rIron[4], rIron[5], rIron[6]),
    straw: landMat(rOchre[2], rOchre[3], rOchre[4], rOchre[5], rOchre[6]),
    earth: landMat(rSoot[3], rSoot[4], rSoot[5], rSoot[6], rSoot[7]),
    bark: landMat(rSoot[2], rSoot[3], rSoot[4], rSoot[5], rSoot[6]),
    birch: landMat(rBone[1], rBone[2], rBone[3], rBone[4], rBone[5])
};
/* ---------- the sky ---------- */
/** One cloud, a lens of lit cloud w by h about cx, cy: its rim in the sun's warmth along the top, its belly in the cool, and a dash of its shadow beneath. */
function cloud(s, cx, cy, w, h, flat = false) {
    const [body, rim, shade] = s.T.cloud, x0 = Math.round(cx - w / 2), n = Math.round(w), top = [], bot = [], f1 = s.r() * 6, f2 = s.r() * 6, f3 = s.r() * 6;
    const belly = clamp(Math.round(h * 0.4), 3, 12); // how many rows of its underside are in shadow
    for (let i = 0; i < n; i++) {
        const u = (2 * i + 1) / n - 1, bump = Math.pow(Math.max(0, 1 - u * u), flat ? 0.4 : 0.62);
        const ripple = flat ? 0.8 + 0.2 * Math.sin(i * 0.05 + f1) * Math.sin(i * 0.021 + f2) : 0.7 + 0.3 * Math.sin(i * 0.19 + f1) * Math.sin(i * 0.053 + f2) + (h > 12 ? 0.16 * Math.sin(i * 0.09 + f3) : 0);
        top.push(Math.round(cy - h * bump * ripple));
        bot.push(Math.round(cy + 0.5 * Math.sin(i * 0.11 + f2)));
    }
    s.run(x0, cy - h - 1, x0 + n, cy + 6, (x, y) => {
        const i = x - x0, t = top[i], b = bot[i];
        if (y < t || t >= b)
            return undefined;
        if (y > b)
            return y === b + 3 && ((i >> 3) % 3 !== 1) && i > 4 && i < n - 4 ? shade : undefined;
        if (y === t)
            return flat ? s.dither(body, rim, 7) : i === 0 || t <= top[i - 1] ? rim : body;
        if (y === t + 1 && h > 9 && i > 0 && t <= top[i - 1] && t < top[Math.min(n - 1, i + 2)])
            return s.dither(body, rim, 5);
        const up = b - y;
        return up < belly ? s.dither(body, shade, Math.round(13 * (1 - up / belly)) + 1) : body;
    });
}
/** The low sun, a soft disc with no rays, and the glow it makes round itself in the air. */
function sun(s, sx, sy, k = 1) {
    const R = Math.round(7 * k), reach = 30 * k, [, rim] = s.T.cloud;
    s.run(sx - R - reach, sy - R - reach, sx + R + reach, sy + R + reach, (x, y) => {
        const d = Math.hypot(x - sx, (y - sy) * 1.15);
        if (d <= R)
            return d > R - 1.2 ? rim : s.T.sun;
        const f = 1 - (d - R) / reach;
        return f > 0 ? s.dither(null, s.T.glow, Math.round(11 * f * f)) : undefined;
    });
}
/** The sky: ordered dither from the deep air overhead to the glow at the horizon, brightest by the sun, then the sun if it is out and the clouds. */
function skyArt(s, o) {
    if (!s.sky)
        return;
    const { W, HZ, T, r } = s, clear = s.weather === 'clear', p1 = r() * 6.28, p2 = r() * 6.28, sx = o.sun ? o.sun[0] + ((r() * 80) | 0) - 40 : -999;
    s.plain(() => {
        const wob = [], lit = [], K = T.sky.length, ramp = s.ramp(clear && o.sun ? [...T.sky, T.glow] : T.sky), glowing = clear && !!o.sun, span = glowing ? K : K - 1;
        for (let x = 0; x < W; x++) {
            wob.push(Math.round(1.8 * Math.sin(x * 0.012 + p1) + 1.1 * Math.sin(x * 0.031 + p2)));
            lit.push(glowing ? Math.exp(-(((x - sx) / (W * 0.3)) ** 2)) : 0);
        }
        // the air at each row (offset by a few rows where the wobble puts it) as a position along the ramp, and how low in the sky each row is
        const along = [], low = [];
        for (let y = -8; y < HZ + 8; y++)
            along.push(Math.pow(Math.max(0, y) / (HZ - 1), 0.92) * (K - 1));
        for (let y = 0; y < HZ; y++) {
            const l = Math.max(0, (y - HZ * 0.4) / (HZ * 0.6));
            low.push(l * l);
        }
        const levels = ramp.levels / span;
        s.run(0, 0, W, HZ, (x, y) => ramp.at(((along[y + wob[x] + 8] + lit[x] * low[y]) * levels + 0.5) | 0));
        if (clear && o.sun)
            sun(s, sx, o.sun[1], o.sunK || 1);
        if (clear) {
            for (let i = 0; i < (o.veil || 0); i++) {
                const w = 320 + r() * 260;
                cloud(s, w / 2 + r() * (W - w), 8 + r() * 26, w, 5 + r() * 4, true);
            } // a high veil of cloud, thin and long, that the sun shows through
            for (let i = 0; i < o.clouds; i++) {
                const low = i % 3 === 2, w = (low ? 90 : 120) + r() * 100, h = low ? 4 + r() * 3 : 8 + r() * 8;
                cloud(s, w / 2 + r() * (W - w), low ? 66 + r() * 32 : 10 + r() * 40, w, h, low);
            }
        }
        else {
            // a close sky: long banks of cloud lying across the whole of it, the high ones first
            const banks = [];
            for (let i = 0; i < o.clouds + 3; i++) {
                const w = 360 + r() * 320;
                banks.push([w / 2 + r() * (W - w) - 30, 14 + r() * HZ * 0.6, w, 8 + r() * 12]);
            }
            banks.sort((a, b) => a[1] - b[1]).forEach(m => cloud(s, m[0], m[1], m[2], m[3], true));
        }
    });
}
/* ---------- the hills ---------- */
/**
 * A skyline of hills, a sum of waves (their frequency and their height) about the line base. It fills them in with the colours of their light
 * (the rim, the lit flank, the middle and the lee, by how each stretch of the skyline faces the sun), hazes their feet into the air, and returns
 * the skyline for the landmarks to stand on. jag roughens the skyline, as a far wood does.
 */
function hillsArt(s, base, waves, o) {
    const ph = waves.map(() => s.r() * 6.28), off = 8, ys = [], { W, HZ, T } = s, [rim, lit, mid, lee] = o.pal;
    for (let x = -off; x < W + off; x++) {
        let y = base;
        for (let i = 0; i < waves.length; i++)
            y -= waves[i][1] * Math.sin(x * waves[i][0] + ph[i]);
        if (o.jag)
            y -= (x * 7 + 3) % 11 < 4 ? o.jag : 0;
        ys.push(Math.round(y));
    }
    const Y = (x) => ys[clamp(x + off, 0, ys.length - 1)], raw = [], lie = [];
    let top = HZ;
    for (let x = 0; x < W; x++) {
        raw.push(clamp((Y(x - 7) - Y(x + 7)) / 9, -1, 1));
        top = Math.min(top, Y(x));
    }
    // how each stretch of the skyline faces the sun, smoothed and cut into seven steps, so that the light changes slowly along a hill
    for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let k = -8; k <= 8; k++)
            sum += raw[clamp(x + k, 0, W - 1)];
        lie.push(clamp(Math.round(sum / 17 * 3.6), -3, 3));
    }
    const paints = [lee, s.dither(mid, lee, 11), s.dither(mid, lee, 5), s.dither(mid, lit, 3), s.dither(mid, lit, 7), s.dither(mid, lit, 12), lit], inLee = s.dither(mid, lee, 10), inSun = s.dither(mid, lit, 3);
    s.run(0, top, W, HZ, (x, y) => {
        const t = Y(x);
        if (y < t)
            return undefined;
        const d = y - t, c = lie[x];
        if (d === 0)
            return c >= 2 ? rim : c >= -1 ? lit : mid;
        if (d < (c > 0 ? 7 : 4))
            return paints[c + 3];
        return c <= -2 ? inLee : c >= 2 ? inSun : mid;
    });
    // a few small marks of the grass and the earth on the slopes, a step lighter on the lit ones and darker in the lee
    for (let i = 0; i < (o.marks || 0); i++) {
        const x = s.r() * W | 0, t = Y(x), y = t + 3 + (s.r() * Math.max(1, HZ - t - 8) | 0), c = lie[x];
        if (y < HZ - 3)
            s.rect(x, y, 2 + (s.r() * 2 | 0), 1, c >= 0 ? lit : lee);
    }
    const hz = o.haze === undefined ? 10 : o.haze;
    if (hz)
        s.run(0, HZ - 14, W, HZ, (x, y) => (y >= Y(x) ? s.dither(null, T.haze, Math.round((y - (HZ - 14)) / 14 * hz)) : undefined));
    return Y;
}
/* ---------- the ground ---------- */
/** How fast the ground darkens from the horizon: the bright of the sun-lit middle distance is kept to a strip, and the rows where the men stand are mid-value and calm. */
const GROUND_CURVE = 0.72;
/** The ground's colour at row y, d steps darker (or, negative, lighter) along its ramp. */
function groundTone(s, y, d = 0) {
    const G = s.T.ground, K = G.length;
    return G[clamp(Math.round(Math.pow(Math.max(0, y - s.HZ) / (s.H - s.HZ), GROUND_CURVE) * (K - 1)) + d, 0, K - 1)];
}
/** Blobs of ordered dither on the ground, flat as the ground lies and softer at their edges: count of them, within the rows y0 to y1 below the horizon, up to rx wide, in the ground's own colour a step darker or lighter, or in its dry grass. */
function groundPatches(s, count, kind, y0, y1, rx, nMax = 6) {
    for (let i = 0; i < count; i++) {
        const u = s.r(), cy = s.HZ + y0 + u * u * (y1 - y0), k = 0.35 + 0.65 * (cy - s.HZ) / (s.H - s.HZ), w = (0.5 + s.r()) * rx * k, h = Math.max(2, w * 0.1), cx = s.r() * s.W;
        const c = kind === 'dry' ? s.T.dry : kind === 'green' ? s.T.leaf[1] : groundTone(s, cy, kind === 'dark' ? 1 : -1), m = nMax - ((s.r() * 2) | 0);
        s.run(cx - w, cy - h, cx + w, cy + h + 1, (x, y) => { const d = ((x - cx) / w) ** 2 + ((y - cy) / h) ** 2; return d >= 1 ? undefined : s.dither(null, c, Math.round((1 - d) * m * 1.3)); });
    }
}
/** The swell of the ground: n low rises between the rows y0 and y1 below the horizon, each lit on its upper left by the ground's lighter step and shadowed along its foot by the darker, so that the plain is not flat. */
function groundRises(s, n, y0, y1) {
    for (let i = 0; i < n; i++) {
        const y = s.HZ + y0 + Math.floor(s.r() * (y1 - y0)), k = 0.5 + 0.8 * (y - s.HZ) / (s.H - s.HZ), w = Math.round((24 + s.r() * 40) * k), h = Math.max(2, Math.round((2 + s.r() * 2) * k)), x = Math.round(s.r() * s.W);
        const lit = groundTone(s, y, -1), dark = groundTone(s, y, 1), body = s.dither(null, lit, 6);
        s.run(x - w / 2, y - h, x + w / 2 + 1, y + 2, (px, py) => {
            const u = (px - x) / (w / 2), top = y - h * Math.sqrt(Math.max(0, 1 - u * u));
            if (py < top || Math.abs(u) > 1)
                return undefined;
            if (py >= y)
                return u > -0.5 ? s.dither(null, dark, 7) : undefined; // the shadow at its foot, on the side away from the sun
            return py < top + 1.5 && u < 0.35 ? lit : u < 0.1 ? body : undefined;
        });
    }
}
/** The small marks that make a meadow: dashes and blades a step darker and lighter than the ground they lie on, a fleck of dry grass, denser and larger towards the foot of the picture. */
function groundMarks(s, n) {
    const { W, H, HZ, T } = s;
    for (let i = 0; i < n; i++) {
        const y = HZ + 4 + Math.floor(Math.sqrt(s.r()) * (H - HZ - 6)), x = Math.floor(s.r() * W), t = (y - HZ) / (H - HZ), k = 1 + Math.floor(t * 2.2), c = s.r();
        if (c < 0.5) {
            const d = groundTone(s, y, 1);
            s.rect(x, y, 2 * k + 1, 1, d);
            if (c < 0.3)
                s.rect(x + 1, y - 1, k, 1, d);
        }
        else if (c < 0.86) {
            const l = groundTone(s, y, -1);
            s.rect(x, y - k, 1, k + 1, l);
            if (c < 0.7)
                s.rect(x + 2, y - 1, 1, 2, l);
        }
        else if (c < 0.93)
            s.rect(x, y, k, 1, T.dry);
    }
}
/** The grass at the foot of the picture, dark blades with the sun on their tips, which the men never reach. */
function groundFringe(s) {
    const { W, H, T } = s, L = T.leaf;
    for (let x = 0; x < W; x += 3 + (s.r() * 4 | 0)) {
        const h = 4 + (s.r() * 9 | 0), lean = s.r() < 0.5 ? -1 : 1, lo = h >> 1;
        s.rect(x, H - lo, 1, lo, L[0]);
        s.rect(x + 1, H - lo, 1, lo, L[1]);
        s.rect(x + lean, H - h, 1, h - lo, L[0]);
        s.rect(x + lean, H - h, 1, 1, L[2]);
    }
}
/** The ground: ordered dither from the haze at the horizon, through the light mid-distance where the sun lies, to the dark of the foot of the picture, then its patches and marks. */
function groundArt(s, o = {}) {
    const { W, H, HZ, T } = s, ramp = s.ramp(T.ground), wob = [], p1 = s.r() * 6.28, p2 = s.r() * 6.28;
    for (let x = 0; x < W; x++)
        wob.push(Math.round(2.2 * Math.sin(x * 0.017 + p1) + 1.4 * Math.sin(x * 0.043 + p2)));
    const lvl = [], veil = [];
    for (let i = -8; i < H - HZ + 8; i++)
        lvl.push(Math.round(Math.pow(Math.max(0, i) / (H - HZ), GROUND_CURVE) * ramp.levels));
    for (let i = 0; i < 9; i++)
        veil.push(s.dither(null, T.haze, Math.round(15 * Math.pow(1 - i / 9, 1.3))));
    s.run(0, HZ, W, H, (x, y) => ramp.at(lvl[y - HZ + wob[x] + 8]));
    s.run(0, HZ, W, HZ + 9, (x, y) => veil[y - HZ]); // the haze of the horizon lying on the far ground
    groundPatches(s, o.dark === undefined ? 7 : o.dark, 'dark', 6, H - HZ - 6, 80);
    groundPatches(s, o.light === undefined ? 7 : o.light, 'light', 6, H - HZ - 6, 80);
    groundPatches(s, o.dry === undefined ? 3 : o.dry, 'dry', 10, H - HZ - 14, 70, 5);
    if (o.green)
        groundPatches(s, o.green, 'green', 8, H - HZ - 30, 90, 9);
    groundRises(s, o.humps === undefined ? 16 : o.humps, 8, 70);
    groundMarks(s, o.marks === undefined ? 1500 : o.marks);
}
/** A window or a door: dark by day, and by night, in some, the warm light of a fire in the room. */
function windowAt(s, x, y, w, h, door = false) {
    const lit = s.night && !door && ((Math.round(x) * 7 + Math.round(y) * 13) % 5) < 3;
    s.rect(x, y, w, h, lit ? rFire[3] : DARK);
    if (!lit && !door && w >= 2)
        s.rect(x, y, w, 1, rIron[3]);
}
/** A plain wall, edged in soot: x0 its left, y its foot, w by h, lit on the left and, if side is given, shaded for that many pixels at its right end. */
function walls(s, x0, y, w, h, m, side = 0) {
    x0 = Math.round(x0);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    s.rect(x0 - 1, y - h - 1, w + 2, h + 2, LAND_EDGE);
    s.rect(x0, y - h, w, h, m.lit);
    s.rect(x0, y - h, 1, h, m.hi);
    s.rect(x0, y - 1, w, 1, m.mid);
    s.rect(x0, y - h, w, 1, m.mid);
    if (side)
        s.rect(x0 + w - side, y - h, side, h, m.lo);
}
/** A roof over the polygon pts, edged in soot, lit along its left and top and shaded in its lee, with the rows of thatch or shingle across it. */
function roofOver(s, pts, m, o = {}) {
    const sh = s.poly(pts, m.mid, LAND_EDGE);
    if (o.split !== undefined)
        s.split(sh, o.split, m.lit, m.mid);
    else
        s.cap(sh, m.lit, 1);
    s.lit(sh, m.hi, o.lw === undefined ? 1 : o.lw);
    s.shade(sh, m.lo, o.sw === undefined ? 2 : o.sw);
    if (o.course)
        s.courses(sh, s.dither(null, m.lo, 7), o.course, 2);
    const last = sh.runs.length - 1;
    if (last > 1)
        for (let k = 0; k < sh.runs[last].length; k += 2)
            s.rect(sh.runs[last][k], sh.y0 + last, sh.runs[last][k + 1] - sh.runs[last][k], 1, m.dk);
    return sh;
}
/** A mass of leaves: shade underneath, the body, and the sun on its upper left. */
function foliage(s, cx, cy, rx, ry, p, edge) {
    s.disc(cx, cy, rx, ry, p[0], edge);
    s.disc(cx - rx * 0.12, cy - ry * 0.18, rx * 0.84, ry * 0.8, p[1]);
    s.disc(cx - rx * 0.3, cy - ry * 0.4, rx * 0.5, ry * 0.42, p[2]);
    s.rect(cx - rx * 0.8, cy - ry * 0.45, rx * 0.5, 1, s.dither(null, p[2], 6));
}
/** The four sails of a mill turning on its hub, each a long arm with the bars of its lattice. */
function sails(s, hx, hy, len, k, turn) {
    for (let i = 0; i < 4; i++) {
        const a = turn + i * Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
        s.line(hx, hy, hx + ux * len, hy + uy * len, STUFF.timber.dk);
        s.line(hx + (Math.abs(ux) > Math.abs(uy) ? 0 : 1), hy + (Math.abs(ux) > Math.abs(uy) ? 1 : 0), hx + ux * len + (Math.abs(ux) > Math.abs(uy) ? 0 : 1), hy + uy * len + (Math.abs(ux) > Math.abs(uy) ? 1 : 0), STUFF.timber.lo);
        s.line(hx + ux * len * 0.25 + nx * 4 * k, hy + uy * len * 0.25 + ny * 4 * k, hx + ux * len + nx * 4 * k, hy + uy * len + ny * 4 * k, STUFF.timber.lo);
        for (let d = 0.3; d < 1; d += 0.14)
            s.line(hx + ux * len * d, hy + uy * len * d, hx + ux * len * d + nx * 4 * k, hy + uy * len * d + ny * 4 * k, rPaper[1]);
    }
    s.rect(hx - 1, hy - 1, 3, 3, LAND_EDGE);
}
/** A gold cross, as high as h, with its top at x, y. */
function goldCross(s, x, y, h, c = rBronze[5]) { s.rect(x, y, 1, h, c); s.rect(x - 1, y + 1, 3, 1, c); }
/** An onion dome of width w and height h on its drum at the foot (x, y): iron-blue, lit on the left, with its gold cross. */
function onionDome(s, x, y, w, h, m = STUFF.shingle) {
    const sh = s.poly([x, y - h, x + w * 0.3, y - h * 0.78, x + w * 0.5, y - h * 0.42, x + w * 0.36, y - h * 0.12, x + w * 0.22, y, x - w * 0.22, y, x - w * 0.36, y - h * 0.12, x - w * 0.5, y - h * 0.42, x - w * 0.3, y - h * 0.78], m.mid, LAND_EDGE);
    s.split(sh, x, m.lit, m.mid);
    s.shade(sh, m.lo, 1);
    s.rect(x - w * 0.28, y - h * 0.58, 1, 2, m.hi);
    goldCross(s, x, y - h - 5, 5);
}
const PROPS = {
    /* trees */
    pine(s, x, y, k) {
        const h = 38 * k, L = s.T.leaf;
        s.rect(x - 1, y - h * 0.8, 2, h * 0.8, STUFF.bark.lo);
        s.rect(x - 1, y - h * 0.8, 1, h * 0.8, STUFF.bark.mid);
        for (const [dx, dy, rx, ry] of [[-7, 9, 8, 4], [7, 6, 9, 4], [0, 0, 9, 4]])
            foliage(s, x + dx * k, y - h + dy * k, rx * k, ry * k, L);
    },
    spruce(s, x, y, k) {
        const h = 36 * k, L = s.T.leaf, n = 5, step = (h - 4 * k) / n, right = [], left = [];
        s.rect(x - 1, y - 4 * k, 2, 4 * k, STUFF.bark.mid);
        // one silhouette of five tiers, each wider than the last, lit on its left
        for (let i = 0; i < n; i++) {
            const top = y - h + i * step, hw = (3.2 + i * 2.2) * k, bot = top + step * 1.6;
            right.push(x + hw * 0.55, top + step * 0.55, x + hw, bot);
            left.unshift(x - hw, bot, x - hw * 0.55, top + step * 0.55);
        }
        const sh = s.shape([x, y - h, ...right, x + 1, y - 4 * k, ...left]);
        s.split(sh, x, L[1], L[0]);
        s.lit(sh, L[2], 1);
    },
    birch(s, x, y, k) {
        const h = 32 * k, L = s.T.leaf, top = y - h * 0.72;
        s.rect(x - 1, top, 2, h * 0.72, STUFF.birch.lit);
        s.rect(x, top, 1, h * 0.72, STUFF.birch.lo);
        for (let i = 0; i < 5; i++)
            s.rect(x - 1 + (i % 2), top + 3 + i * 4 * k, 1, 1, rSoot[2]);
        for (const [dx, dy, rx, ry] of [[-5, -2, 5, 5], [5, -4, 5, 6], [0, -9, 6, 6], [-3, 3, 4, 4], [4, 4, 4, 4]])
            foliage(s, x + dx * k, top + dy * k + 2, rx * k, ry * k, L);
    },
    willow(s, x, y, k) {
        const L = s.T.leaf, top = y - 24 * k, rx = 13 * k, ry = 8 * k;
        s.rect(x - 2 * k, y - 14 * k, 4 * k, 14 * k, STUFF.bark.mid);
        s.rect(x - 2 * k, y - 14 * k, 1, 14 * k, STUFF.bark.lit);
        foliage(s, x, top + 6 * k, rx, ry, L);
        for (let dx = -rx + 1; dx < rx; dx += 2) {
            const yy = top + 6 * k + ry * Math.sqrt(1 - (dx / rx) ** 2), len = (5 + ((dx * 7 + 91) % 5) + (Math.abs(dx) < rx * 0.6 ? 4 : 0)) * k;
            s.rect(x + dx, yy, 1, len, dx < -rx * 0.2 ? L[1] : L[0]);
            s.rect(x + dx, yy, 1, 1, L[2]);
        }
    },
    poplar(s, x, y, k) {
        const h = 44 * k, L = s.T.leaf, ry = (h - 5 * k) / 2;
        s.rect(x - 1, y - 5 * k, 2, 5 * k, STUFF.bark.mid);
        const sh = s.disc(x, y - 5 * k - ry, 4 * k, ry, L[0]);
        s.disc(x - 1, y - 5 * k - ry - 2, 3 * k - 1, ry - 3, L[1]);
        s.lit(sh, L[2], 1);
        s.rect(x - 2 * k, y - h + 6 * k, 1, h * 0.4, L[2]);
    },
    oak(s, x, y, k) {
        const L = s.T.leaf;
        s.rect(x - 2 * k, y - 12 * k, 4 * k, 12 * k, STUFF.bark.mid);
        s.rect(x - 2 * k, y - 12 * k, 1, 12 * k, STUFF.bark.lit);
        for (const [dx, dy, rx, ry] of [[-8, -14, 9, 7], [8, -15, 9, 7], [0, -21, 10, 8]])
            foliage(s, x + dx * k, y + dy * k, rx * k, ry * k, L);
    },
    orchard(s, x, y, k) {
        const L = s.T.leaf;
        s.rect(x - 1, y - 6 * k, 2, 6 * k, STUFF.bark.mid);
        foliage(s, x, y - 11 * k, 6 * k, 6 * k, L);
        for (let i = 0; i < 5; i++)
            s.rect(x - 4 * k + ((i * 5) % 9) * k, y - 15 * k + ((i * 7) % 8) * k, 1, 1, i % 2 ? rBone[5] : rMadder[6]);
    },
    thorn(s, x, y, k) {
        const L = s.T.leaf, bark = STUFF.bark.mid, pts = [[0, 0], [1, -5], [3, -10], [6, -14], [9, -17]];
        for (let i = 1; i < pts.length; i++)
            for (const o of [0, 1])
                s.line(x + pts[i - 1][0] * k + o, y + pts[i - 1][1] * k, x + pts[i][0] * k + o, y + pts[i][1] * k, bark);
        s.line(x + 3 * k, y - 10 * k, x - 3 * k, y - 15 * k, bark);
        s.line(x + 6 * k, y - 14 * k, x + 13 * k, y - 16 * k, bark);
        for (const [dx, dy, rx, ry] of [[-3, -17, 4, 3], [4, -20, 5, 3], [11, -18, 6, 3], [17, -16, 4, 2]])
            foliage(s, x + dx * k, y + dy * k, rx * k, ry * k, L);
    },
    dead(s, x, y, k) {
        const c = STUFF.bark.lo;
        s.rect(x - 1, y - 22 * k, 2, 22 * k, c);
        s.rect(x - 1, y - 22 * k, 1, 22 * k, STUFF.bark.mid);
        for (const [a, b, d, e] of [[0, -14, -7, -21], [0, -17, 6, -23], [0, -9, 6, -13], [0, -12, -5, -14], [-5, -18, -8, -17]])
            s.line(x + a * k, y + b * k, x + d * k, y + e * k, c);
    },
    bush(s, x, y, k) { foliage(s, x, y - 3 * k, 5 * k, 3 * k, s.T.leaf); },
    /* what lies on the ground */
    rock(s, x, y, k) {
        const sh = s.poly([x - 6 * k, y, x - 5 * k, y - 4 * k, x - 1 * k, y - 6 * k, x + 4 * k, y - 5 * k, x + 7 * k, y], STUFF.stone.lit, LAND_EDGE);
        s.shade(sh, STUFF.stone.mid, 3);
        s.cap(sh, rBone[3], 1);
        s.rect(x - 4 * k, y - 1, 8 * k, 1, STUFF.stone.mid);
    },
    boulder(s, x, y, k) {
        const sh = s.poly([x - 11 * k, y, x - 9 * k, y - 7 * k, x - 3 * k, y - 11 * k, x + 5 * k, y - 10 * k, x + 11 * k, y - 4 * k, x + 12 * k, y], STUFF.stone.mid, LAND_EDGE);
        s.split(sh, x, STUFF.stone.lit, STUFF.stone.mid);
        s.shade(sh, STUFF.stone.lo, 3);
        s.cap(sh, STUFF.stone.hi, 1);
    },
    tuft(s, x, y, k) {
        const L = s.T.leaf;
        for (let i = -2; i <= 2; i++) {
            const h = (3 + 2 - Math.abs(i) + (i & 1)) * k, tx = x + i * 1.5 * k;
            s.line(x + i * k * 0.7, y, tx, y - h, i < 0 ? L[1] : L[0]);
            s.rect(tx, y - h, 1, 1, L[2]);
        }
        s.rect(x - 2 * k, y, 4 * k + 1, 1, L[0]);
    },
    kovyl(s, x, y, k) {
        const stem = rPaper[3];
        for (let i = -2; i <= 2; i++) {
            const h = (7 + 2 * (2 - Math.abs(i))) * k, tx = x + i * 1.6 * k;
            s.line(x + i * 0.6 * k, y, tx, y - h, stem);
            s.rect(tx, y - h, 1, 1, rBone[5]);
            if (i & 1)
                s.rect(tx + (i < 0 ? -1 : 1), y - h + 1, 1, 1, rBone[4]);
        }
    },
    fern(s, x, y, k) { const L = s.T.leaf; for (let i = -3; i <= 3; i++) {
        s.line(x, y, x + i * 2 * k, y - (7 - Math.abs(i)) * k, i < 0 ? L[2] : L[1]);
    } },
    reeds(s, x, y, k) {
        const L = s.T.leaf;
        for (let i = -3; i <= 3; i++) {
            const h = (12 + ((i * 5 + 21) % 6)) * k;
            s.line(x + i * 2, y, x + i * 2 + (i % 2), y - h, i < 0 ? L[1] : L[0]);
            if (i % 2 === 0)
                s.rect(x + i * 2 + (i % 2) - 1, y - h - 1, 2, 4 * k, STUFF.earth.lit);
        }
    },
    hay(s, x, y, k) {
        const m = STUFF.straw, sh = s.poly([x - 8 * k, y, x - 7 * k, y - 5 * k, x - 3 * k, y - 11 * k, x, y - 15 * k, x + 3 * k, y - 11 * k, x + 7 * k, y - 5 * k, x + 8 * k, y], m.mid, LAND_EDGE);
        s.split(sh, x - k, m.lit, m.mid);
        s.shade(sh, m.lo, 3);
        s.lit(sh, m.hi, 1);
        s.cap(sh, m.hi, 2);
        for (let dy = 4; dy < 14; dy += 3)
            s.rect(x - 7 * k + dy * 0.3, y - dy * k, 14 * k - dy * 0.7, 1, s.dither(null, m.dk, 6));
        s.rect(x - 8 * k, y - 1, 16 * k + 1, 1, m.dk);
        s.rect(x, y - 19 * k, 1, 5 * k, STUFF.bark.mid);
    },
    sheaf(s, x, y, k) {
        const m = STUFF.straw;
        for (let i = -2; i <= 2; i++)
            s.line(x + i * 2 * k, y, x + i * k * 0.5, y - 9 * k, i < 0 ? m.lit : m.mid);
        s.rect(x - 3 * k, y - 4 * k, 6 * k, 1, m.lo);
        s.rect(x - 4 * k, y - 11 * k, 8 * k, 2, m.lit);
    },
    well(s, x, y, k) {
        const b = STUFF.timber;
        s.rect(x - 1, y - 16 * k, 2, 16 * k, b.lit);
        s.rect(x - 3 * k, y - 1, 7 * k, 1, LAND_EDGE);
        s.line(x - 7 * k, y - 12 * k, x + 13 * k, y - 20 * k, b.mid);
        s.line(x - 7 * k, y - 13 * k, x + 13 * k, y - 21 * k, b.lit);
        s.rect(x - 9 * k, y - 12 * k, 4 * k, 3 * k, STUFF.stone.mid);
        s.rect(x - 9 * k, y - 12 * k, 4 * k, 1, STUFF.stone.hi);
        s.line(x + 13 * k, y - 20 * k, x + 13 * k, y - 11 * k, b.dk);
        s.rect(x + 11 * k, y - 11 * k, 4 * k, 3 * k, b.mid);
        s.rect(x + 11 * k, y - 11 * k, 4 * k, 1, b.lit);
    },
    cross(s, x, y, k) {
        const b = STUFF.timber;
        s.rect(x - 2, y - 15 * k, 4, 15 * k + 1, LAND_EDGE);
        s.rect(x - 5 * k, y - 12 * k, 10 * k + 1, 4, LAND_EDGE);
        s.rect(x - 1, y - 14 * k, 2, 14 * k, b.mid);
        s.rect(x - 4 * k, y - 11 * k, 9 * k, 2, b.mid);
        s.rect(x - 1, y - 14 * k, 1, 14 * k, b.lit);
        s.poly([x - 3 * k, y - 14 * k, x, y - 18 * k, x + 3 * k, y - 14 * k], STUFF.shingle.mid, LAND_EDGE);
    },
    gallows(s, x, y, k) {
        const b = STUFF.timber;
        s.rect(x - 1, y - 24 * k, 2, 24 * k, b.dk);
        s.rect(x - 1, y - 24 * k, 14 * k, 2, b.dk);
        s.line(x, y - 18 * k, x + 7 * k, y - 24 * k, b.dk);
        s.line(x + 11 * k, y - 22 * k, x + 11 * k, y - 15 * k, b.lit);
        s.rect(x + 10 * k, y - 15 * k, 3 * k, 2, b.dk);
    },
    nest(s, x, y, k) {
        const b = STUFF.timber;
        s.rect(x - 1, y - 26 * k, 2, 26 * k, b.mid);
        s.rect(x - 1, y - 26 * k, 1, 26 * k, b.lit);
        foliage(s, x, y - 27 * k, 7 * k, 3 * k, [b.lo, b.mid, b.lit], LAND_EDGE);
        s.rect(x - 2 * k, y - 36 * k, 4 * k, 7 * k, rBone[5]);
        s.rect(x - 2 * k, y - 36 * k, 1, 7 * k, rBone[4]);
        s.rect(x - 2 * k, y - 36 * k - 1, 4 * k + 5 * k, 1, LAND_EDGE);
        s.rect(x + 2 * k, y - 35 * k, 4 * k, 1, rMadder[4]);
        s.rect(x - 4 * k, y - 34 * k, 2 * k, 3 * k, LAND_EDGE);
    },
    /* the steppe */
    baba(s, x, y, k) {
        const st = STUFF.stone, a = x - 2 * k, w = 5 * k;
        s.rect(a - 1, y - 12 * k - 1, w + 2, 9 * k + 2, LAND_EDGE);
        s.rect(x - 2 * k, y - 13 * k, 3 * k + 2, 4 * k, LAND_EDGE);
        s.rect(a, y - 9 * k, w, 9 * k, st.lit);
        s.rect(x - 1 * k, y - 12 * k, 3 * k, 3 * k, st.hi);
        s.rect(a + w - 2, y - 9 * k, 2, 9 * k, st.mid);
        s.rect(x + 1 * k, y - 12 * k, 1, 3 * k, st.mid);
        s.rect(a, y - 5 * k, w, 1, st.mid);
        s.rect(x - 1 * k, y - 11 * k, 1, 1, LAND_EDGE);
        s.rect(x + 1 * k, y - 11 * k, 1, 1, LAND_EDGE);
    },
    beacon(s, x, y, k) {
        const h = 32 * k, b = STUFF.timber;
        for (const o of [0, 1]) {
            s.line(x - 7 * k + o, y, x - 3 * k + o, y - h * 0.78, o ? b.mid : b.lit);
            s.line(x + 7 * k - o, y, x + 3 * k - o, y - h * 0.78, b.dk);
        }
        s.line(x - 6 * k, y - 4 * k, x + 4 * k, y - 15 * k, b.mid);
        s.line(x + 6 * k, y - 4 * k, x - 4 * k, y - 15 * k, b.mid);
        s.line(x - 5 * k, y - 16 * k, x + 4 * k, y - 25 * k, b.mid);
        s.line(x + 5 * k, y - 16 * k, x - 4 * k, y - 25 * k, b.mid);
        s.rect(x - 7 * k, y - h * 0.78 - 1, 14 * k, 4, LAND_EDGE);
        s.rect(x - 6 * k, y - h * 0.78, 12 * k, 2, b.lit);
        const r = s.poly([x - 5 * k, y - h * 0.78, x, y - h, x + 5 * k, y - h * 0.78], STUFF.shingle.mid, LAND_EDGE);
        s.split(r, x, STUFF.shingle.lit, STUFF.shingle.mid);
        s.rect(x + 10 * k, y - h * 0.9, 1, h * 0.9, b.mid);
        s.rect(x + 8 * k - 1, y - h * 0.96 - 1, 5 * k + 2, 5 * k + 2, LAND_EDGE);
        s.rect(x + 8 * k, y - h * 0.96, 5 * k, 5 * k, rMadder[3]);
        s.rect(x + 8 * k, y - h * 0.96, 5 * k, 1, rMadder[5]);
        if (s.night) {
            s.rect(x + 9 * k, y - h * 0.96 - 2, 3 * k, 2, rFire[4]);
            s.rect(x + 10 * k, y - h * 0.96 - 4, Math.max(1, k), 2, rFire[5]);
        } // the tar in the barrel is lit
    },
    /* houses and churches */
    khata(s, x, y, k) {
        const w = 24 * k, h = 9 * k, rh = 8 * k, x0 = x - w / 2, m = STUFF.wall, t = STUFF.thatch;
        walls(s, x0, y, w, h, m, 4 * k);
        s.rect(x0 + w - 4 * k - 1, y - h, 1, h, m.mid);
        roofOver(s, [x0 - 3 * k, y - h + 1, x0 + 5 * k, y - h - rh, x0 + w - 5 * k, y - h - rh, x0 + w + 3 * k, y - h + 1], t, { course: 3, lw: 2, sw: 3 });
        windowAt(s, x - 2 * k, y - 6 * k, 4 * k, 6 * k - 1, true);
        windowAt(s, x + 6 * k, y - 7 * k, 3 * k, 3 * k);
        s.rect(x + 6 * k, y - 4 * k, 3 * k, 1, m.hi);
        s.rect(x - 8 * k - 1, y - h - rh - 2 * k - 1, 3 * k + 2, 4 * k + 1, LAND_EDGE);
        s.rect(x - 8 * k, y - h - rh - 2 * k, 3 * k, 4 * k, m.lit);
        s.rect(x - 8 * k + 3 * k - 1, y - h - rh - 2 * k, 1, 4 * k, m.lo);
    },
    cottage(s, x, y, k) {
        const w = 18 * k, h = 8 * k, rh = 10 * k, x0 = x - w / 2, m = STUFF.wall;
        walls(s, x0, y, w, h, m, 3 * k);
        roofOver(s, [x0 - 2 * k, y - h + 1, x, y - h - rh, x0 + w + 2 * k, y - h + 1], STUFF.thatch, { course: 3, lw: 1, sw: 3, split: x });
        windowAt(s, x - 2 * k, y - 6 * k, 4 * k, 5 * k, true);
        windowAt(s, x + 4 * k, y - 6 * k, 3 * k, 3 * k);
        s.rect(x + 6 * k - 1, y - h - rh + 3 * k - 1, 3 * k + 2, 5 * k + 1, LAND_EDGE);
        s.rect(x + 6 * k, y - h - rh + 3 * k, 3 * k, 5 * k, m.lit);
        s.rect(x + 8 * k, y - h - rh + 3 * k, 1, 5 * k, m.lo);
    },
    logHut(s, x, y, k) {
        const w = 18 * k, h = 8 * k, rh = 11 * k, x0 = x - w / 2, b = STUFF.timber;
        walls(s, x0, y, w, h, b, 3 * k);
        for (let ly = y - h + 2; ly < y - 1; ly += 2)
            s.rect(x0 + 1, ly, w - 2, 1, b.lo);
        roofOver(s, [x0 - 2 * k, y - h + 1, x, y - h - rh, x0 + w + 2 * k, y - h + 1], STUFF.thatch, { course: 3, lw: 1, sw: 3, split: x });
        windowAt(s, x - 2 * k, y - 6 * k, 4 * k, 5 * k, true);
        windowAt(s, x + 4 * k, y - 6 * k, 3 * k, 3 * k);
    },
    halfTimber(s, x, y, k) {
        const w = 22 * k, h = 13 * k, x0 = x - w / 2, t = STUFF.timber.mid, m = STUFF.wall;
        walls(s, x0, y, w, h, m, 4 * k);
        for (const px of [0, w / 3, 2 * w / 3, w - 1])
            s.rect(x0 + px, y - h, 1, h, t);
        for (const py of [h, h / 2, 1])
            s.rect(x0, y - py, w, 1, t);
        s.line(x0, y - h / 2, x0 + w / 3, y - h, t);
        s.line(x0 + w, y - h / 2, x0 + 2 * w / 3, y - h, t);
        s.line(x0 + w / 3, y - 1, x0 + 2 * w / 3, y - h / 2, t);
        s.rect(x + 6 * k - 1, y - h - 11 * k - 1, 3 * k + 2, 6 * k + 1, LAND_EDGE);
        s.rect(x + 6 * k, y - h - 11 * k, 3 * k, 6 * k, STUFF.brick.mid);
        s.rect(x + 6 * k, y - h - 11 * k, 1, 6 * k, STUFF.brick.lit);
        roofOver(s, [x0 - 2 * k, y - h + 1, x, y - h - 13 * k, x0 + w + 2 * k, y - h + 1], STUFF.tile, { course: 2, lw: 1, sw: 2, split: x });
        windowAt(s, x - 2 * k, y - 6 * k, 4 * k, 5 * k, true);
        windowAt(s, x - 8 * k, y - 10 * k, 3 * k, 3 * k);
        windowAt(s, x + 5 * k, y - 10 * k, 3 * k, 3 * k);
        windowAt(s, x - 1 * k, y - h - 7 * k, 3 * k, 3 * k);
    },
    manor(s, x, y, k) {
        const w = 38 * k, h = 11 * k, x0 = x - w / 2, m = STUFF.wall;
        walls(s, x0, y, w, h, m, 4 * k);
        roofOver(s, [x0 - 2 * k, y - h + 1, x0 + 6 * k, y - h - 9 * k, x0 + w - 6 * k, y - h - 9 * k, x0 + w + 2 * k, y - h + 1], STUFF.tile, { course: 3, lw: 1, sw: 3, split: x });
        for (const dx of [-14, -8, 8, 14])
            windowAt(s, x + dx * k - k, y - 8 * k, 3 * k, 4 * k);
        for (const dx of [-4, -1, 2, 5])
            s.rect(x + dx * k, y - 7 * k, 1, 6 * k, m.mid);
        const g = s.poly([x - 6 * k, y - h, x, y - h - 6 * k, x + 6 * k, y - h], m.lit, LAND_EDGE);
        s.shade(g, m.lo, 2);
        windowAt(s, x - 1 * k, y - 6 * k, 3 * k, 5 * k, true);
        s.rect(x + 10 * k - 1, y - h - 11 * k - 1, 3 * k + 2, 4 * k + 1, LAND_EDGE);
        s.rect(x + 10 * k, y - h - 11 * k, 3 * k, 4 * k, m.lit);
        s.rect(x + 12 * k, y - h - 11 * k, 1, 4 * k, m.lo);
    },
    church(s, x, y, k) {
        const m = STUFF.wall;
        walls(s, x - 20 * k, y, 25 * k, 11 * k, m, 3 * k);
        roofOver(s, [x - 22 * k, y - 11 * k, x - 17 * k, y - 17 * k, x + 2 * k, y - 17 * k, x + 7 * k, y - 11 * k], STUFF.tile, { course: 3, lw: 1, sw: 2, split: x - 10 * k });
        for (const dx of [-16, -11, -6])
            windowAt(s, x + dx * k, y - 8 * k, 2 * k, 5 * k);
        walls(s, x + 5 * k, y, 9 * k, 26 * k, m, 3 * k);
        windowAt(s, x + 8 * k, y - 22 * k, 3 * k, 5 * k);
        s.disc(x + 9.5 * k, y - 12 * k, 2 * k, 2 * k, m.hi, LAND_EDGE);
        const sp = s.poly([x + 4 * k, y - 26 * k, x + 9.5 * k, y - 46 * k, x + 15 * k, y - 26 * k], STUFF.shingle.mid, LAND_EDGE);
        s.split(sp, x + 9.5 * k, STUFF.shingle.lit, STUFF.shingle.mid);
        s.shade(sp, STUFF.shingle.lo, 2);
        s.courses(sp, s.dither(null, STUFF.shingle.lo, 6), 3, 3);
        goldCross(s, x + 9.5 * k, y - 54 * k, 8);
    },
    orthodox(s, x, y, k) {
        const log = STUFF.timber, domeM = STUFF.shingle;
        const bay = (cx, w, h, ridge) => {
            walls(s, cx - w / 2, y, w, h, log, 2);
            for (let ly = y - h + 3; ly < y - 1; ly += 3)
                s.rect(cx - w / 2 + 1, ly, w - 2, 1, log.lo);
            const r = s.poly([cx - w / 2 - 2, y - h, cx, y - h - ridge, cx + w / 2 + 2, y - h], domeM.mid, LAND_EDGE);
            s.split(r, cx, domeM.lit, domeM.mid);
            onionDome(s, cx, y - h - ridge + 2 * k, 5 * k + 2, 7 * k, STUFF.shingle);
        };
        bay(x - 12 * k, 8 * k, 9 * k, 6 * k);
        bay(x + 12 * k, 8 * k, 9 * k, 6 * k);
        bay(x, 14 * k, 14 * k, 12 * k);
        windowAt(s, x - 2 * k, y - 6 * k, 4 * k, 6 * k, true);
    },
    chapel(s, x, y, k) {
        const b = STUFF.timber;
        walls(s, x - 6 * k, y, 12 * k, 8 * k, b, 2);
        for (let ly = y - 6 * k; ly < y - 1; ly += 2)
            s.rect(x - 6 * k + 1, ly, 12 * k - 2, 1, b.lo);
        roofOver(s, [x - 8 * k, y - 8 * k, x, y - 17 * k, x + 8 * k, y - 8 * k], STUFF.shingle, { course: 2, lw: 1, sw: 2, split: x });
        onionDome(s, x, y - 17 * k + 2, 4 * k + 2, 5 * k, STUFF.shingle);
        windowAt(s, x - 1 * k, y - 5 * k, 3 * k, 5 * k, true);
    },
    brickChurch(s, x, y, k) {
        const m = STUFF.brick;
        walls(s, x - 28 * k, y, 26 * k, 14 * k, m, 4 * k);
        for (let bx = -24; bx < -4; bx += 5) {
            s.rect(x + bx * k, y - 14 * k, 1, 14 * k, m.lo);
            windowAt(s, x + (bx + 2) * k, y - 10 * k, 2 * k, 6 * k);
        }
        roofOver(s, [x - 30 * k, y - 14 * k, x - 26 * k, y - 22 * k, x - 6 * k, y - 22 * k, x - 2 * k, y - 14 * k], STUFF.shingle, { course: 3, lw: 1, sw: 2, split: x - 16 * k });
        walls(s, x - 5 * k, y, 10 * k, 36 * k, m, 3 * k);
        windowAt(s, x - 2 * k, y - 32 * k, 3 * k, 8 * k);
        windowAt(s, x - 2 * k, y - 18 * k, 3 * k, 6 * k);
        const sp = s.poly([x - 7 * k, y - 36 * k, x, y - 56 * k, x + 7 * k, y - 36 * k], STUFF.shingle.mid, LAND_EDGE);
        s.split(sp, x, STUFF.shingle.lit, STUFF.shingle.mid);
        s.shade(sp, STUFF.shingle.lo, 2);
        s.courses(sp, s.dither(null, STUFF.shingle.lo, 6), 3, 3);
        goldCross(s, x, y - 64 * k, 8);
    },
    windmill(s, x, y, k) {
        const my = y - 22 * k, b = STUFF.timber;
        s.rect(x - 1, y - 14 * k, 2, 14 * k, b.lo);
        s.line(x - 7 * k, y, x - 1, y - 9 * k, b.mid);
        s.line(x + 7 * k, y, x + 1, y - 9 * k, b.lo);
        const body = s.poly([x - 6 * k, my + 9 * k, x - 4 * k, my - 6 * k, x + 4 * k, my - 6 * k, x + 6 * k, my + 9 * k], b.mid, LAND_EDGE);
        s.split(body, x - k, b.lit, b.mid);
        s.shade(body, b.lo, 2);
        for (let ly = my - 3 * k; ly < my + 9 * k; ly += 3)
            s.rect(x - 4 * k, ly, 8 * k, 1, s.dither(null, b.lo, 5));
        const cap = s.poly([x - 5 * k, my - 6 * k, x, my - 12 * k, x + 5 * k, my - 6 * k], STUFF.thatch.mid, LAND_EDGE);
        s.split(cap, x, STUFF.thatch.lit, STUFF.thatch.mid);
        sails(s, x, my, 26 * k, k, 0.5 + s.r() * 0.5);
    },
    towerMill(s, x, y, k) {
        const m = STUFF.wall, hy = y - 28 * k, body = s.poly([x - 8 * k, y, x - 5 * k, y - 26 * k, x + 5 * k, y - 26 * k, x + 8 * k, y], m.lit, LAND_EDGE);
        s.shade(body, m.lo, 3 * k);
        s.lit(body, m.hi, 1);
        const cap = s.poly([x - 6 * k, y - 26 * k, x - 3 * k, y - 32 * k, x + 3 * k, y - 32 * k, x + 6 * k, y - 26 * k], STUFF.shingle.mid, LAND_EDGE);
        s.split(cap, x - k, STUFF.shingle.lit, STUFF.shingle.mid);
        windowAt(s, x - 1 * k, y - 6 * k, 3 * k, 6 * k, true);
        windowAt(s, x - 1 * k, y - 18 * k, 2 * k, 3 * k);
        sails(s, x, hy, 24 * k, k, 0.35 + s.r() * 0.6);
    },
    castle(s, x, y, k) {
        const m = STUFF.lime;
        const bat = (x0, w, h) => { for (let mx = x0; mx < x0 + w - 1; mx += 3 * k) {
            s.rect(mx - 1, y - h - 2 * k - 1, 2 * k + 2, 2 * k + 1, LAND_EDGE);
            s.rect(mx, y - h - 2 * k, 2 * k, 2 * k, m.lit);
        } };
        const curtain = (x0, w, h) => { bat(x0, w, h); walls(s, x0, y, w, h, m, 0); };
        const tower = (cx, w, h, cone) => {
            walls(s, cx - w / 2, y, w, h, m, w / 4);
            roofOver(s, [cx - w / 2 - 1, y - h, cx, y - h - cone, cx + w / 2 + 1, y - h], STUFF.tile, { course: 2, lw: 1, sw: 2, split: cx });
            windowAt(s, cx - 1, y - h + 4 * k, 2, 4 * k);
        };
        curtain(x - 30 * k, 60 * k, 12 * k);
        tower(x - 30 * k, 10 * k, 24 * k, 10 * k);
        tower(x + 30 * k, 10 * k, 24 * k, 10 * k);
        tower(x, 14 * k, 32 * k, 14 * k);
        windowAt(s, x - 14 * k, y - 8 * k, 4 * k, 6 * k, true);
        windowAt(s, x + 8 * k, y - 8 * k, 4 * k, 6 * k, true);
    },
    cityWall(s, x, y, k) {
        const w = 170 * k, x0 = x - w / 2, m = STUFF.lime;
        for (const dx of [-0.3, 0, 0.32]) {
            const cx = x + dx * w;
            walls(s, cx - 5 * k, y - 12 * k, 10 * k, 14 * k, m, 3 * k);
            onionDome(s, cx, y - 26 * k, 8 * k, 9 * k, STUFF.thatch);
        }
        for (let mx = x0; mx < x0 + w; mx += 4 * k) {
            s.rect(mx - 1, y - 17 * k - 1, 2 * k + 2, 3 * k + 1, LAND_EDGE);
            s.rect(mx, y - 17 * k, 2 * k, 3 * k, m.lit);
        }
        walls(s, x0, y, w, 14 * k, m, 0);
        for (let i = 0; i <= 6; i++) {
            const cx = x0 + 8 * k + i * (w - 16 * k) / 6, h = (i === 3 ? 34 : 24 + (i % 2) * 4) * k, wd = (i === 3 ? 14 : 10) * k;
            walls(s, cx - wd / 2, y, wd, h, m, wd / 4);
            roofOver(s, [cx - wd / 2 - 1, y - h, cx, y - h - 11 * k, cx + wd / 2 + 1, y - h], i % 2 ? STUFF.tile : STUFF.shingle, { course: 2, lw: 1, sw: 2, split: cx });
            windowAt(s, cx - 1, y - h + 4 * k, 2, 5 * k);
        }
        windowAt(s, x - 4 * k, y - 9 * k, 8 * k, 9 * k, true);
    },
    ruin(s, x, y, k) {
        const m = STUFF.lime, c = STUFF.timber.dk, w = 22 * k;
        const a = s.poly([x - w / 2, y, x - w / 2, y - 9 * k, x - w / 2 + 4 * k, y - 7 * k, x - w / 2 + 7 * k, y - 11 * k, x - w / 2 + 10 * k, y - 5 * k, x - 1 * k, y - 6 * k, x - 1 * k, y], m.lit, LAND_EDGE);
        s.shade(a, m.lo, 3);
        s.lit(a, m.hi, 1);
        const b = s.poly([x + 3 * k, y, x + 3 * k, y - 7 * k, x + 8 * k, y - 4 * k, x + 11 * k, y - 8 * k, x + 11 * k, y], m.lit, LAND_EDGE);
        s.shade(b, m.lo, 3);
        s.rect(x + 12 * k - 1, y - 16 * k - 1, 4 * k + 2, 16 * k + 1, LAND_EDGE);
        s.rect(x + 12 * k, y - 16 * k, 4 * k, 16 * k, STUFF.brick.mid);
        s.rect(x + 12 * k, y - 16 * k, 1, 16 * k, STUFF.brick.lit);
        s.rect(x + 12 * k, y - 16 * k, 4 * k, 1, STUFF.brick.dk);
        s.line(x - 8 * k, y - 8 * k, x + 2 * k, y - 15 * k, c);
        s.line(x - 4 * k, y - 9 * k, x + 6 * k, y - 13 * k, c);
        s.line(x + 2 * k, y - 15 * k, x + 7 * k, y - 8 * k, c);
    },
    /* the camp before Smolensk */
    tent(s, x, y, k) {
        const m = STUFF.wall, sh = s.poly([x - 9 * k, y, x, y - 13 * k, x + 9 * k, y], m.lit, LAND_EDGE);
        s.split(sh, x, m.lit, m.lo);
        s.lit(sh, m.hi, 1);
        s.cap(sh, m.hi, 2);
        s.poly([x - 2 * k, y, x, y - 7 * k, x + 2 * k, y], DARK);
        s.rect(x, y - 19 * k, 1, 6 * k, LAND_EDGE);
        s.rect(x + 1, y - 19 * k, 5 * k, 3 * k, rMadder[3]);
        s.rect(x + 1, y - 19 * k, 5 * k, 1, rMadder[5]);
    },
    cannon(s, x, y, k) {
        const st = STUFF.stone, b = STUFF.timber;
        s.rect(x - 11 * k - 1, y - 9 * k - 1, 18 * k + 2, 6 * k + 2, LAND_EDGE);
        s.rect(x - 9 * k, y - 8 * k, 15 * k, 3 * k, st.lo);
        s.rect(x - 9 * k, y - 8 * k, 15 * k, 1, st.lit);
        s.rect(x - 11 * k, y - 9 * k, 3 * k, 5 * k, st.mid);
        s.rect(x - 7 * k, y - 5 * k, 10 * k, 3 * k, b.mid);
        s.rect(x - 7 * k, y - 5 * k, 10 * k, 1, b.lit);
        s.disc(x - 2 * k, y - 4 * k, 4 * k, 4 * k, b.lo, LAND_EDGE);
        s.disc(x - 2 * k, y - 4 * k, 1 * k, 1 * k, LAND_EDGE);
    },
    gabions(s, x, y, k) {
        const e = STUFF.earth, w = STUFF.straw;
        for (let i = 0; i < 4; i++) {
            const gx = x + i * 7 * k;
            walls(s, gx, y, 6 * k, 7 * k, w, 1);
            s.rect(gx, y - 7 * k - 1, 6 * k, 2, e.mid);
            s.rect(gx, y - 7 * k - 1, 6 * k, 1, e.lit);
            for (let dy = 2; dy < 7; dy += 2)
                s.rect(gx + 1, y - dy * k, 6 * k - 2, 1, w.lo);
        }
    },
    /* the water, the smoke and the farms */
    ship(s, x, y, k) {
        const b = STUFF.timber, m = STUFF.wall;
        const hull = s.poly([x - 11 * k, y - 4 * k, x + 11 * k, y - 4 * k, x + 8 * k, y, x - 8 * k, y], b.mid, LAND_EDGE);
        s.cap(hull, b.lit, 1);
        s.shade(hull, b.lo, 2);
        for (const dx of [-5, 3]) {
            s.rect(x + dx * k, y - 22 * k, 1, 18 * k, LAND_EDGE);
            const sl = s.poly([x + dx * k + 1, y - 21 * k, x + dx * k + 8 * k, y - 18 * k, x + dx * k + 8 * k, y - 8 * k, x + dx * k + 1, y - 7 * k], m.lit, LAND_EDGE);
            s.shade(sl, m.lo, 3);
        }
    },
    barge(s, x, y, k) {
        const b = STUFF.timber, hull = s.poly([x - 14 * k, y - 3 * k, x + 14 * k, y - 3 * k, x + 11 * k, y, x - 11 * k, y], b.lo, LAND_EDGE);
        s.cap(hull, b.mid, 1);
        s.rect(x - 2 * k, y - 18 * k, 1, 15 * k, LAND_EDGE);
        const sl = s.poly([x - 1 * k, y - 17 * k, x + 8 * k, y - 15 * k, x + 8 * k, y - 6 * k, x - 1 * k, y - 5 * k], STUFF.straw.mid, LAND_EDGE);
        s.shade(sl, STUFF.straw.lo, 3);
    },
    smoke(s, x, y, k) {
        const m = STUFF.smoke;
        for (let i = 0; i < 9; i++) {
            const sway = Math.sin(i * 0.8) * 3 * k + i * 1.2 * k, rx = (3 + i * 0.9) * k, ry = (3 + i * 0.7) * k, cy = y - i * 7 * k, cx = x + sway;
            s.disc(cx, cy, rx, ry, i < 3 ? m.lo : i < 6 ? m.mid : m.lit);
            s.disc(cx - rx * 0.25, cy - ry * 0.3, rx * 0.6, ry * 0.55, i < 3 ? m.mid : m.lit);
            s.rect(cx + rx * 0.2, cy - ry, rx * 0.9, ry * 2, s.dither(null, i < 5 ? m.dk : m.lo, 4));
        }
    },
    hops(s, x, y, k) {
        const L = s.T.leaf;
        for (const dx of [-8, 0, 8]) {
            s.rect(x + dx * k, y - 30 * k, 1, 30 * k, STUFF.timber.lit);
            for (let i = 0; i < 6; i++)
                s.rect(x + dx * k - 2 + (i % 2) * 3, y - (4 + i * 4.5) * k, 3, 2, i % 2 ? L[2] : L[1]);
        }
    },
    blockhouse(s, x, y, k) {
        const b = STUFF.timber;
        walls(s, x - 14 * k, y, 28 * k, 15 * k, b, 4 * k);
        for (let ly = y - 13 * k; ly < y - 1; ly += 2)
            s.rect(x - 14 * k + 1, ly, 28 * k - 2, 1, b.lo);
        roofOver(s, [x - 16 * k, y - 15 * k, x - 10 * k, y - 24 * k, x + 10 * k, y - 24 * k, x + 16 * k, y - 15 * k], STUFF.shingle, { course: 2, lw: 1, sw: 3, split: x - 4 * k });
        for (const dx of [-9, -2, 5, 10])
            s.rect(x + dx * k, y - 11 * k, 2 * k, 3 * k, LAND_EDGE);
        windowAt(s, x - 2 * k, y - 7 * k, 4 * k, 7 * k, true);
    },
    tollHouse(s, x, y, k) {
        const m = STUFF.wall;
        walls(s, x - 9 * k, y, 18 * k, 11 * k, m, 3 * k);
        roofOver(s, [x - 11 * k, y - 11 * k, x, y - 21 * k, x + 11 * k, y - 11 * k], STUFF.tile, { course: 2, lw: 1, sw: 2, split: x });
        windowAt(s, x - 2 * k, y - 7 * k, 4 * k, 6 * k, true);
        windowAt(s, x + 4 * k, y - 8 * k, 3 * k, 3 * k);
        s.rect(x + 12 * k, y - 10 * k, 1, 10 * k, LAND_EDGE);
        s.rect(x + 12 * k, y - 11 * k, 24 * k, 3, LAND_EDGE);
        s.rect(x + 12 * k, y - 10 * k, 24 * k, 1, rBone[4]);
        for (const dx of [18, 28])
            s.rect(x + dx * k, y - 10 * k, 4 * k, 1, rMadder[4]);
    },
    wagon(s, x, y, k) {
        const b = STUFF.timber, m = STUFF.wall;
        s.rect(x - 11 * k - 1, y - 9 * k - 1, 22 * k + 2, 6 * k + 2, LAND_EDGE);
        s.rect(x - 11 * k, y - 9 * k, 22 * k, 5 * k, b.mid);
        s.rect(x - 11 * k, y - 9 * k, 22 * k, 1, b.lit);
        s.rect(x - 11 * k, y - 5 * k, 22 * k, 1, b.lo);
        const cv = s.poly([x - 9 * k, y - 9 * k, x - 6 * k, y - 16 * k, x + 7 * k, y - 16 * k, x + 10 * k, y - 9 * k], m.lit, LAND_EDGE);
        s.shade(cv, m.lo, 3 * k);
        s.cap(cv, m.hi, 1);
        for (const dx of [-6, 6]) {
            s.disc(x + dx * k, y - 3 * k, 4 * k, 4 * k, b.lo, LAND_EDGE);
            s.disc(x + dx * k, y - 3 * k, 1 * k, 1 * k, LAND_EDGE);
            s.rect(x + dx * k - 2 * k, y - 3 * k, 4 * k + 1, 1, b.lit);
        }
    },
    raft(s, x, y, k) {
        const b = STUFF.timber, m = STUFF.wall;
        for (let i = 0; i < 3; i++) {
            s.rect(x - 14 * k - 1, y - (i + 1) * 3 * k - 1, 28 * k + 2, 3 * k + 1, LAND_EDGE);
            s.rect(x - 14 * k, y - (i + 1) * 3 * k, 28 * k, 3 * k, b.mid);
            s.rect(x - 14 * k, y - (i + 1) * 3 * k, 28 * k, 1, b.lit);
            s.disc(x + 14 * k, y - (i + 0.5) * 3 * k, 1.5 * k, 1.5 * k, b.lo, LAND_EDGE);
        }
        for (let i = 0; i < 4; i++) {
            s.disc(x - 9 * k + i * 6 * k, y - 11 * k, 3 * k, 2.5 * k, m.lit, LAND_EDGE);
            s.rect(x - 11 * k + i * 6 * k, y - 11 * k, 2, 1, m.hi);
        }
        s.disc(x - 6 * k, y - 15 * k, 3 * k, 2.5 * k, m.lit, LAND_EDGE);
        s.disc(x + 2 * k, y - 15 * k, 3 * k, 2.5 * k, m.lit, LAND_EDGE);
        s.rect(x + 12 * k, y - 20 * k, 1, 17 * k, b.lo);
    },
    millRuin(s, x, y, k) {
        const m = STUFF.lime, c = STUFF.timber.dk;
        const w = s.poly([x - 8 * k, y, x - 6 * k, y - 22 * k, x - 3 * k, y - 19 * k, x - 1 * k, y - 27 * k, x + 3 * k, y - 20 * k, x + 6 * k, y - 25 * k, x + 8 * k, y], m.lit, LAND_EDGE);
        s.shade(w, m.lo, 4 * k);
        s.lit(w, m.hi, 1);
        s.rect(x - 2 * k, y - 8 * k, 4 * k, 8 * k, LAND_EDGE);
        for (const dx of [-5, 3])
            s.rect(x + dx * k, y - 20 * k, 2 * k, 12 * k, m.lo);
        s.line(x - 1 * k, y - 27 * k, x - 14 * k, y - 40 * k, c);
        s.line(x - 1 * k, y - 27 * k, x + 9 * k, y - 38 * k, c);
        s.line(x - 1 * k, y - 27 * k, x - 12 * k, y - 22 * k, c);
        s.line(x - 9 * k, y - 35 * k, x - 12 * k, y - 32 * k, c);
    },
    watermill(s, x, y, k) {
        const m = STUFF.wall;
        walls(s, x - 12 * k, y, 24 * k, 12 * k, m, 4 * k);
        roofOver(s, [x - 14 * k, y - 12 * k, x - 6 * k, y - 22 * k, x + 6 * k, y - 22 * k, x + 14 * k, y - 12 * k], STUFF.thatch, { course: 3, lw: 2, sw: 3 });
        windowAt(s, x - 8 * k, y - 8 * k, 3 * k, 3 * k);
        windowAt(s, x - 2 * k, y - 8 * k, 4 * k, 8 * k, true);
        const wx = x + 17 * k, wy = y - 7 * k, b = STUFF.timber;
        s.disc(wx, wy, 8 * k, 8 * k, STUFF.water.mid, b.mid);
        s.disc(wx, wy, 6 * k, 6 * k, STUFF.water.lit);
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 4;
            s.line(wx - Math.cos(a) * 8 * k, wy - Math.sin(a) * 8 * k, wx + Math.cos(a) * 8 * k, wy + Math.sin(a) * 8 * k, b.lit);
        }
    },
    signpost(s, x, y, k) {
        const b = STUFF.timber;
        s.rect(x - 1, y - 20 * k, 2, 20 * k, b.lo);
        s.rect(x - 1, y - 20 * k, 1, 20 * k, b.mid);
        const a = s.poly([x, y - 19 * k, x + 11 * k, y - 19 * k, x + 14 * k, y - 16 * k, x + 11 * k, y - 13 * k, x, y - 13 * k], b.lit, LAND_EDGE);
        s.shade(a, b.mid, 1);
        const c = s.poly([x, y - 11 * k, x - 10 * k, y - 11 * k, x - 13 * k, y - 8 * k, x - 10 * k, y - 5 * k, x, y - 5 * k], b.lit, LAND_EDGE);
        s.shade(c, b.mid, 1);
    },
    barn(s, x, y, k) {
        const b = STUFF.timber;
        walls(s, x - 19 * k, y, 38 * k, 12 * k, b, 4 * k);
        for (let lx = x - 16 * k; lx < x + 19 * k; lx += 4 * k)
            s.rect(lx, y - 12 * k, 1, 11 * k, b.lo);
        roofOver(s, [x - 22 * k, y - 12 * k, x - 14 * k, y - 26 * k, x + 14 * k, y - 26 * k, x + 22 * k, y - 12 * k], STUFF.thatch, { course: 3, lw: 2, sw: 3 });
        s.rect(x - 5 * k, y - 9 * k, 10 * k, 9 * k, LAND_EDGE);
        s.line(x - 5 * k, y - 9 * k, x + 5 * k, y, b.lo);
        s.line(x + 5 * k, y - 9 * k, x - 5 * k, y, b.lo);
    },
    flame(s, x, y, k) {
        s.poly([x - 4 * k, y, x - 5 * k, y - 6 * k, x - 1 * k, y - 10 * k, x, y - 17 * k, x + 2 * k, y - 10 * k, x + 5 * k, y - 6 * k, x + 4 * k, y], rFire[2]);
        s.poly([x - 3 * k, y, x - 3 * k, y - 5 * k, x - 1 * k, y - 9 * k, x + 1 * k, y - 12 * k, x + 2 * k, y - 5 * k, x + 3 * k, y], rFire[3]);
        s.poly([x - 2 * k, y, x - 2 * k, y - 4 * k, x, y - 8 * k, x + 2 * k, y - 4 * k, x + 2 * k, y], rFire[5]);
    },
    cow(s, x, y, k) {
        const c = STUFF.earth.lit, c2 = STUFF.earth.mid;
        s.rect(x - 4 * k, y - 6 * k, 8 * k, 4 * k, c);
        s.rect(x - 4 * k, y - 6 * k, 8 * k, 1, STUFF.earth.hi);
        s.rect(x - 4 * k, y - 3 * k, 8 * k, 1, c2);
        s.rect(x + 4 * k, y - 8 * k, 3 * k, 3 * k, c);
        for (const dx of [-3, -1, 2, 3])
            s.rect(x + dx * k, y - 2 * k, 1, 2 * k, LAND_EDGE);
        s.rect(x + 5 * k, y - 9 * k, 1, 2, rBone[4]);
        s.rect(x - 2 * k, y - 5 * k, 3 * k, 2 * k, rBone[4]);
    }
};
/** Scatters count things over the ground, small and faint by the horizon and large at the foot of the picture, the far ones first. */
function scatter(s, count, draw, y0 = 8, y1 = 0) {
    const top = s.HZ + y0, bottom = s.H - y1, pts = [];
    for (let i = 0; i < count; i++)
        pts.push([s.r() * s.W | 0, top + (s.r() * s.r() * (bottom - top) | 0)]);
    for (const [x, y] of pts.sort((a, b) => a[1] - b[1]))
        draw(x, y, 0.55 + 0.7 * (y - s.HZ) / (s.H - s.HZ));
}
/* ---------- the lands ---------- */
/** A burial mound or a rise on the skyline at x, w wide and h high, lit on its left and in the lee on its right, hazed at its foot; returns the top. */
function mound(s, x, w, h) {
    const base = s.ridge(x) + 1, [rim, lit, mid, lee] = s.T.hill, x0 = Math.round(x - w / 2), n = Math.round(w), top = [];
    for (let i = 0; i < n; i++) {
        const u = (2 * i + 1) / n - 1;
        top.push(Math.round(base - h * Math.pow(Math.max(0, 1 - u * u), 0.75)));
    }
    s.run(x0, base - h, x0 + n, s.HZ, (px, y) => {
        const i = px - x0, t = top[i];
        if (y < t)
            return undefined;
        const u = (2 * i + 1) / n - 1, d = y - t, term = 0.3 - 0.02 * d; // where the light gives out, further left lower down
        if (d === 0)
            return u < term ? rim : lit;
        if (y > s.HZ - 3)
            return s.dither(u < term ? mid : lee, s.T.haze, (y - (s.HZ - 3)) * 4);
        if (u < term - 0.45)
            return d < 7 ? lit : s.dither(lit, mid, Math.min(11, (d - 6) * 3));
        if (u < term - 0.12)
            return d < 3 ? lit : s.dither(mid, lit, 8);
        if (u < term + 0.06)
            return mid;
        return u < term + 0.2 ? s.dither(mid, lee, 9) : d < 9 ? lee : s.dither(lee, mid, Math.min(9, (d - 8) * 2));
    });
    return base - h;
}
/** A few horses grazing far off, along the line from x for len, on the ground at y. */
function herd(s, x, y, len) {
    const c = rSoot[3];
    for (let i = 0; i < 8; i++) {
        const hx = x + (i * len / 7 | 0) + (s.r() * 6 | 0), hy = y + (s.r() * 4 | 0);
        s.rect(hx, hy - 3, 4, 2, c);
        s.rect(hx, hy - 1, 1, 2, c);
        s.rect(hx + 3, hy - 1, 1, 2, c);
        s.rect(hx + 4, hy - 5, 1, 3, c);
        s.rect(hx, hy - 3, 4, 1, rSoot[5]);
    }
}
/** A track across the ground from y0 at the left to y1 at the right: dusty earth worn into ruts with the grass between, lit along its upper edge and feathered into the grass, broader as it comes near (bare widens it, and a negative bare makes a fainter, narrower cart-track). */
function track(s, y0, y1, bare = 0) {
    const f = s.r() * 6, [dk, mid, lit] = s.T.earth, ctr = [], hw = [];
    for (let x = 0; x < s.W; x++) {
        const y = s.HZ + y0 + (y1 - y0) * x / s.W + 3 * Math.sin(x * 0.02 + f);
        ctr.push(y);
        hw.push(2.5 + 0.075 * (y - s.HZ) + bare);
    }
    s.run(0, s.HZ + Math.min(y0, y1) - 10, s.W, s.HZ + Math.max(y0, y1) + 30, (x, y) => {
        const d = y - ctr[x], a = Math.abs(d), w = hw[x], u = a / w, h = ((x >> 2) * 7 + (x >> 4) * 3 + Math.round(y)) % 5;
        if (u > 1.3)
            return undefined;
        if (u > 1.05)
            return s.dither(null, mid, u > 1.18 ? 3 : 7);
        if (u > 1)
            return s.dither(lit, mid, 8);
        if (d < 0 && u > 0.78)
            return s.dither(lit, mid, 5);
        if (u < 0.22)
            return h < 3 ? s.dither(mid, s.T.leaf[1], 8) : mid;
        if (u > 0.3 && u < 0.52 && h !== 0)
            return d > 0 && bare >= 0 ? dk : mid;
        return h === 1 && u > 0.55 ? mid : lit;
    });
}
/** A stretch of water from x0 to x1 between its banks y0 (which wavers) and y1: the sky in it, its glints, and the dark of the bank below; a pond or a lake, which does not cross the whole picture, closes to a point at each end. */
function water(s, x0, x1, y0, y1) {
    const f = s.r() * 6, m = STUFF.water, tops = [], bots = [], ramp = s.ramp([m.hi, m.lit, m.mid, m.lo]), finite = x0 > 0 || x1 < s.W;
    for (let x = x0; x < x1; x++) {
        const d = Math.min(x - x0, x1 - 1 - x), close = finite && d < 16 ? Math.round((16 - d) * (y1 - y0) / 34) : 0;
        tops.push(Math.round(y0 + 1.5 * Math.sin(x * 0.045 + f)) + close);
        bots.push(y1 - close);
    }
    s.run(x0, y0 - 2, x1, y1, (x, y) => {
        const t = tops[x - x0], b = bots[x - x0];
        return y < t || y >= b ? undefined : y >= b - 1 ? m.dk : y === t ? rBone[5] : ramp((y - t) / Math.max(1, b - t - 1));
    });
    for (let i = 0; i < (x1 - x0) / 12; i++) {
        const gx = x0 + (s.r() * (x1 - x0) | 0), gy = y0 + 3 + (s.r() * Math.max(1, y1 - y0 - 4) | 0), gw = 5 + (s.r() * 14 | 0), k = i % 2;
        if (!finite || (gx > x0 + 14 && gx + gw < x1 - 14))
            s.rect(gx, gy, gw, 1, k ? m.hi : rBone[5]);
    }
}
/** A wood along the skyline from x to x1: trees of the kinds given, every few pixels, a row far off and a row near. */
function wood(s, from, to, kinds, kLo, kHi) {
    for (const far of [true, false]) {
        for (let x = from + (far ? 4 : 0); x < to; x += (far ? 9 : 7) + (s.r() * 6 | 0)) {
            const k = (kLo + s.r() * (kHi - kLo)) * (far ? 0.85 : 1), kind = kinds[s.r() * kinds.length | 0], y = s.ridge(x) + (far ? 0 : 3);
            if (far)
                s.fade(0.5, () => PROPS[kind](s, x, y, k));
            else
                PROPS[kind](s, x, y, k);
        }
    }
}
/** Ploughed land centred on cx, as strips of the common field: three ploughed bands side by side with grass left between, which together are wTop wide at their far end and wBot at their near one, between the rows y0 and y1 below the horizon; furrows of earth, pale and dark by turns, in bands that widen as they come near, the edges wavering and feathered into the grass. */
function field(s, cx, wTop, wBot, y0 = 14, y1 = 92) {
    const [dk, mid, lit] = s.T.earth, n = 9, top = s.HZ + y0, bot = s.HZ + y1, f = s.r() * 6, wide = (y) => wTop + (wBot - wTop) * (y - top) / (bot - top);
    for (const [at, share, phase] of [[-0.34, 0.27, 0], [0.02, 0.31, 2], [0.37, 0.22, 4]]) {
        s.run(cx + Math.min(at * wTop, at * wBot) - wBot * 0.25, top, cx + Math.max(at * wTop, at * wBot) + wBot * 0.25, bot, (x, y) => {
            const W = wide(y), hw = W * share / 2 + 3 * Math.sin(y * 0.11 + f + phase), d = Math.abs(x - cx - at * W) - hw, e = Math.min(y - top, bot - y);
            if (d > 3 || e < 0)
                return undefined;
            const u = (y - top) / (bot - top), band = Math.pow(u, 0.7) * n + phase * 0.3, fr = band - Math.floor(band);
            if (d > 0)
                return d < 2 ? s.dither(null, mid, 2) : undefined;
            if (d > -3 || e < 2)
                return s.dither(null, mid, 3);
            return fr < 0.18 ? s.dither(null, dk, 4) : Math.floor(band) % 2 ? s.dither(null, lit, 3) : s.dither(null, mid, 4);
        });
    }
}
/** The rows of a vineyard on the slope between x0 and x1, from the skyline down to the foot of the hill. */
function vines(s, x0, x1) {
    const L = s.T.leaf;
    for (let x = x0; x < x1; x += 5)
        for (let y = s.ridge(x) + 5; y < s.HZ - 3; y += 4) {
            s.rect(x, y, 1, 3, L[0]);
            s.rect(x + 1, y, 1, 2, L[1]);
            s.rect(x, y, 1, 1, L[2]);
        }
}
/** Birds against the sky: a few small vees. */
function birds(s, n) {
    if (!s.sky)
        return;
    for (let i = 0; i < n; i++) {
        const x = 60 + (s.r() * (s.W - 120) | 0), y = 24 + (s.r() * 36 | 0);
        s.line(x - 4, y - 2, x, y, rSoot[2]);
        s.line(x, y, x + 4, y - 2, rSoot[2]);
    }
}
/** n copies of a prop along the skyline, from x, every dx, each k times its size. */
function along(s, prop, x, n, dx, k, drop = 2) {
    for (let i = 0; i < n; i++) {
        const px = x + i * dx;
        PROPS[prop](s, px, s.ridge(px) + drop, k + (i % 2) * 0.1);
    }
}
/** Places things of these widths along the picture from x0 to x1, in a random order and spaced evenly, and calls each one's drawing with its centre. */
function place(s, items, x0 = 24, x1 = s.W - 24) {
    const order = items.map((_, i) => i).sort(() => s.r() - 0.5), gap = Math.max(0, (x1 - x0 - items.reduce((n, it) => n + it[0], 0)) / (items.length + 1));
    let x = x0 + gap;
    for (const i of order) {
        items[i][1](Math.round(x + items[i][0] / 2 + (s.r() - 0.5) * gap * 0.4));
        x += items[i][0] + gap;
    }
}
/** A landmark far off on the far hills, k times its size, gone blue and pale in the haze. */
function farLandmark(s, far, prop, x, k) { s.fade(0.58, () => PROPS[prop](s, x, far(x) + 2, k)); }
/** A hamlet at x: houses of this kind at these offsets along the skyline, and a tree of the kind given at each end. */
function hamlet(s, x, house, offs, k, tree) {
    offs.forEach((dx, i) => PROPS[house](s, x + dx, s.ridge(x + dx) + 2, k + (i % 2) * 0.1));
    if (tree) {
        const lo = Math.min(...offs) - 16, hi = Math.max(...offs) + 16;
        PROPS[tree](s, x + lo, s.ridge(x + lo) + 2, k * 0.95);
        PROPS[tree](s, x + hi, s.ridge(x + hi) + 2, k * 0.85);
    }
}
const LAND_ART = {
    steppe(s) {
        const T = s.T, r = s.r;
        skyArt(s, { clouds: 3, sun: [300, 78], sunK: 1.2 });
        birds(s, 2);
        hillsArt(s, 108, [[0.006, 2], [0.02, 1]], { pal: T.far, haze: 12, jag: 1 });
        s.ridge = hillsArt(s, 106, [[0.0105, 2.4], [0.034, 1.2]], { pal: T.hill, marks: 60 });
        place(s, [
            [120, x => { const t = mound(s, x, 90 + (r() * 30 | 0), 12); PROPS.baba(s, x + 6, t + 2, 1); }],
            [110, x => { const t = mound(s, x, 70 + (r() * 30 | 0), 9); PROPS.beacon(s, x - 4, t + 1, 0.95); }],
            [40, x => PROPS.thorn(s, x, s.ridge(x) + 2, 0.85)], [70, x => herd(s, x - 35, s.HZ - 3, 60)]
        ]);
        groundArt(s, { dry: 9 });
        track(s, 20, 58);
        PROPS.well(s, 60 + (r() * 480 | 0), s.HZ + 26, 0.85);
        scatter(s, 36, (x, y, k) => PROPS.tuft(s, x, y, k));
        scatter(s, 22, (x, y, k) => PROPS.kovyl(s, x, y, k * 0.7));
        scatter(s, 8, (x, y, k) => PROPS.rock(s, x, y, k * 0.8));
    },
    ukraine(s) {
        const T = s.T, r = s.r, church = r() < 0.55, mill = !church || r() < 0.5;
        skyArt(s, { clouds: 3, sun: [250, 76] });
        birds(s, 4);
        const far = hillsArt(s, 90, [[0.007, 7], [0.021, 3.5]], { pal: T.far, haze: 12, jag: 1 });
        farLandmark(s, far, 'windmill', 40 + (r() * 520 | 0), 0.5);
        s.ridge = hillsArt(s, 100, [[0.013, 6], [0.04, 2.5]], { pal: T.hill, marks: 120 });
        const items = [[150, x => hamlet(s, x, 'khata', [-42, -14, 14, 42], 0.82, 'willow')], [76, x => along(s, 'poplar', x - 30, 5, 14, 0.75)]];
        if (church)
            items.push([52, x => PROPS.orthodox(s, x, s.ridge(x) + 2, 0.95)]);
        if (mill)
            items.push([56, x => PROPS.windmill(s, x, s.ridge(x) + 2, 0.85)]);
        place(s, items);
        groundArt(s);
        track(s, 30, 58, -0.5);
        field(s, 140 + (r() * 320 | 0), 70, 190);
        scatter(s, 36, (x, y, k) => PROPS.tuft(s, x, y, k));
        scatter(s, 3, (x, y, k) => PROPS.hay(s, x, y, k * 0.9), 20);
    },
    poland(s) {
        const T = s.T, r = s.r;
        skyArt(s, { clouds: 3, veil: 3, sun: [270, 78] });
        birds(s, 3);
        const far = hillsArt(s, 94, [[0.008, 4], [0.025, 2]], { pal: T.far, haze: 12, jag: 1 });
        farLandmark(s, far, 'manor', 40 + (r() * 520 | 0), 0.55);
        s.ridge = hillsArt(s, 102, [[0.012, 4], [0.036, 2]], { pal: T.hill, marks: 90 });
        place(s, [
            [170, x => { PROPS.church(s, x, s.ridge(x) + 2, 0.9); [-48, 40, 68].forEach((dx, i) => PROPS.cottage(s, x + dx, s.ridge(x + dx) + 2, 0.76 + (i % 2) * 0.1)); PROPS.nest(s, x - 78, s.ridge(x - 78) + 2, 0.75); }],
            [70, x => (r() < 0.6 ? PROPS.windmill(s, x, s.ridge(x) + 2, 0.85) : PROPS.manor(s, x, s.ridge(x) + 2, 0.85))],
            [76, x => along(s, 'birch', x - 30, 5, 13, 0.85)]
        ]);
        groundArt(s);
        track(s, 26, 50, -0.5);
        field(s, 140 + (r() * 320 | 0), 60, 170);
        PROPS.cross(s, 90 + (r() * 420 | 0), s.HZ + 18, 0.9);
        scatter(s, 34, (x, y, k) => PROPS.tuft(s, x, y, k));
        scatter(s, 4, (x, y, k) => PROPS.sheaf(s, x, y, k), 16);
    },
    prussia(s) {
        const T = s.T, r = s.r;
        skyArt(s, { clouds: 3, veil: 2, sun: [290, 74], sunK: 0.8 });
        birds(s, 5);
        s.ridge = hillsArt(s, 104, [[0.006, 2.4], [0.03, 1.3]], { pal: T.hill });
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
        for (let i = 0; i < 9; i++)
            PROPS.reeds(s, 20 + (r() * (s.W - 40) | 0), s.HZ + 17, 0.5);
        scatter(s, 36, (x, y, k) => PROPS.tuft(s, x, y, k));
        scatter(s, 14, (x, y, k) => PROPS.kovyl(s, x, y, k * 0.5), 24);
    },
    lithuania(s) {
        const T = s.T, r = s.r;
        skyArt(s, { clouds: 4, sun: [300, 80], sunK: 0.9 });
        hillsArt(s, 84, [[0.009, 6], [0.03, 3]], { pal: T.far, haze: 12, jag: 2 });
        s.ridge = hillsArt(s, 98, [[0.011, 5], [0.04, 2]], { pal: T.hill });
        const gap = 130 + (r() * 340 | 0), gw = 190;
        wood(s, 0, gap - gw / 2, ['spruce', 'spruce', 'pine'], 0.95, 1.3);
        wood(s, gap + gw / 2, s.W, ['spruce', 'pine', 'spruce', 'birch'], 0.95, 1.3);
        hamlet(s, gap - 14, 'logHut', [-44, -16, 18, 46], 0.78);
        PROPS.chapel(s, gap + 80, s.ridge(gap + 80) + 3, 0.95);
        groundArt(s);
        if (r() < 0.6)
            water(s, gap - 50, gap + 120, s.HZ + 8, s.HZ + 20);
        scatter(s, 20, (x, y, k) => PROPS.tuft(s, x, y, k));
        scatter(s, 30, (x, y, k) => PROPS.fern(s, x, y, k), 14);
        scatter(s, 8, (x, y, k) => PROPS.boulder(s, x, y, k * 0.55), 14);
        scatter(s, 4, (x, y, k) => PROPS.birch(s, x, y, k * 0.8), 10);
    },
    front(s) {
        const T = s.T, r = s.r;
        skyArt(s, { clouds: 3, sun: [250, 84], sunK: 0.9 });
        birds(s, 6);
        hillsArt(s, 92, [[0.007, 5], [0.025, 2.5]], { pal: T.far, haze: 12 });
        s.ridge = hillsArt(s, 100, [[0.01, 3], [0.032, 1.6]], { pal: T.hill });
        place(s, [
            [240, x => { const t = mound(s, x, 230, 14); PROPS.cityWall(s, x, t + 6, 0.8); PROPS.smoke(s, x + 150, s.HZ - 4, 0.8); }],
            [120, x => { for (let i = 0; i < 3; i++)
                    PROPS.gabions(s, x - 50 + i * 30, s.ridge(x) + 3, 0.7); PROPS.cannon(s, x + 44, s.ridge(x) + 4, 0.8); }],
            [96, x => along(s, 'tent', x - 33, 4, 22, 0.75, 4)], [40, x => { PROPS.dead(s, x, s.ridge(x) + 3, 0.9); PROPS.smoke(s, x + 24, s.HZ - 4, 0.65); }]
        ], 10, s.W - 10);
        groundArt(s, { dark: 12, light: 5, dry: 2, green: 3 });
        track(s, 26, 56, 2);
        scatter(s, 6, (x, y, k) => puddle(s, x, y, k * 0.8), 22);
        scatter(s, 14, (x, y, k) => PROPS.tuft(s, x, y, k * 0.8));
        scatter(s, 6, (x, y, k) => PROPS.dead(s, x, y, k * 0.55), 14);
        scatter(s, 10, (x, y, k) => PROPS.rock(s, x, y, k * 0.7));
        scatter(s, 2, (x, y, k) => PROPS.wagon(s, x, y, k * 0.6), 22);
        if (r() < 0.5)
            scatter(s, 1, (x, y, k) => PROPS.cannon(s, x, y, k * 0.6), 30);
    },
    silesia(s) {
        const T = s.T, r = s.r;
        skyArt(s, { clouds: 3, sun: [280, 72] });
        hillsArt(s, 78, [[0.01, 9], [0.045, 5], [0.11, 2]], { pal: T.far, haze: 12 });
        s.ridge = hillsArt(s, 98, [[0.012, 8], [0.03, 3]], { pal: T.hill, marks: 160 });
        place(s, [
            [140, x => { const t = mound(s, x, 130, 16); PROPS.castle(s, x, t + 3, 0.8); }],
            [170, x => { PROPS.church(s, x, s.ridge(x) + 2, 0.8); [-44, 38, 66].forEach((dx, i) => (i === 1 ? PROPS.ruin : PROPS.halfTimber)(s, x + dx, s.ridge(x + dx) + 2, 0.66 + (i % 2) * 0.1)); PROPS.smoke(s, x + 44, s.ridge(x + 38) - 8, 0.7); }],
            [70, x => along(s, 'orchard', x - 28, 4, 14, 0.75)]
        ]);
        groundArt(s);
        field(s, 140 + (r() * 320 | 0), 60, 170);
        PROPS.gallows(s, 80 + (r() * 420 | 0), s.HZ + 16, 0.9);
        scatter(s, 30, (x, y, k) => PROPS.tuft(s, x, y, k));
        scatter(s, 14, (x, y, k) => PROPS.rock(s, x, y, k * 0.8));
    },
    saxony(s) {
        const T = s.T, r = s.r, castle = r() < 0.5;
        skyArt(s, { clouds: 3, sun: [300, 76] });
        const far = hillsArt(s, 82, [[0.009, 7], [0.03, 3]], { pal: T.far, haze: 12 });
        farLandmark(s, far, 'church', 40 + (r() * 520 | 0), 0.5);
        s.ridge = hillsArt(s, 96, [[0.014, 7], [0.04, 3]], { pal: T.hill, marks: 140 });
        const items = [
            [190, x => { hamlet(s, x - 14, 'halfTimber', [-52, -24, 12, 38], 0.66); PROPS.church(s, x + 72, s.ridge(x + 72) + 2, 0.8); }],
            [120, x => { vines(s, x - 55, x + 55); }]
        ];
        items.push(castle ? [110, x => { const t = mound(s, x, 100, 14); PROPS.castle(s, x, t + 3, 0.65); }] : [60, x => PROPS.windmill(s, x, s.ridge(x) + 2, 0.85)]);
        place(s, items);
        groundArt(s);
        water(s, 0, s.W, s.HZ + 8, s.HZ + 18);
        PROPS.barge(s, 120 + (r() * 340 | 0), s.HZ + 18, 0.85);
        for (let i = 0; i < 8; i++)
            PROPS.reeds(s, 16 + (r() * (s.W - 32) | 0), s.HZ + 19, 0.45);
        scatter(s, 30, (x, y, k) => PROPS.tuft(s, x, y, k));
        scatter(s, 3, (x, y, k) => PROPS.hops(s, x, y, k * 0.6), 28);
    }
};
/** The site of each piece of work: its contract's template, or the kind of ambush. Work that names none is fought in the open land. */
const SITE_OF = {
    road: 'road', mill: 'mill', ford: 'ford', toll: 'toll', wagons: 'wagons', river: 'river', quarrel: 'pond', picket: 'picket', forage: 'forage', tatarhunt: 'burning', manor: 'manor', blockhouse: 'blockhouse',
    masterless: 'ravine', roadagents: 'edge', deserters: 'road', riverthieves: 'river', imperials: 'forage', swedes: 'toll', final: 'ford'
};
/** A row of sharpened stakes from x0 to x1 standing on y, k times their size. */
function palisade(s, x0, x1, y, k) {
    const b = STUFF.timber;
    s.rect(x0, y - 4 * k, x1 - x0, 1, b.lo);
    for (let x = x0; x < x1; x += 3 * k) {
        const st = s.poly([x, y - 9 * k, x + k, y - 12 * k, x + 2 * k, y - 9 * k, x + 2 * k, y, x, y], b.mid, LAND_EDGE);
        s.lit(st, b.lit, 1);
        s.shade(st, b.lo, 1);
    }
}
/** A bridge of planks over the water at x, w long, on the ground at y. */
function bridge(s, x, y, w) {
    const b = STUFF.timber;
    s.rect(x - w / 2 - 1, y - 8, w + 2, 9, LAND_EDGE);
    s.rect(x - w / 2, y - 3, w, 3, b.mid);
    s.rect(x - w / 2, y - 3, w, 1, b.lit);
    s.rect(x - w / 2, y - 7, w, 1, b.lo);
    for (let px = x - w / 2; px <= x + w / 2; px += 8)
        s.rect(px, y - 7, 1, 7, b.lo);
}
/** A river across the whole picture behind the fight, with reeds on its bank; ford says where it can be waded. */
function river(s, ford) {
    water(s, 0, s.W, s.HZ + 9, s.HZ + 25);
    if (ford !== undefined) {
        for (let i = 0; i < 9; i++) {
            const st = s.poly([ford - 36 + i * 8, s.HZ + 12 + (i % 3) * 4 + 2, ford - 35 + i * 8, s.HZ + 12 + (i % 3) * 4, ford - 32 + i * 8, s.HZ + 12 + (i % 3) * 4, ford - 31 + i * 8, s.HZ + 12 + (i % 3) * 4 + 2], STUFF.stone.mid);
            s.cap(st, STUFF.stone.hi, 1);
        }
        s.rect(ford - 40, s.HZ + 16, 80, 1, s.dither(null, rBone[5], 8));
    }
    for (let i = 0; i < 10; i++) {
        const rx = 14 + (s.r() * (s.W - 28) | 0);
        if (!ford || Math.abs(rx - ford) > 44)
            PROPS.reeds(s, rx, s.HZ + 26, 0.55);
    }
}
const SITE_ART = {
    ford(s) { const x = 150 + (s.r() * 300 | 0); river(s, x); return x; },
    river(s) {
        const x = 120 + (s.r() * 150 | 0);
        river(s);
        PROPS.raft(s, x, s.HZ + 24, 0.9);
        PROPS.raft(s, x + 150 + (s.r() * 120 | 0), s.HZ + 24, 0.8);
        return x + 60;
    },
    mill(s) { const x = 160 + (s.r() * 280 | 0); PROPS.millRuin(s, x, s.HZ + 30, 1); PROPS.smoke(s, x, s.HZ + 3, 0.8); PROPS.dead(s, x + 38, s.HZ + 32, 0.9); return x + 10; },
    toll(s) {
        const x = 140 + (s.r() * 220 | 0);
        water(s, x - 40, x + 230, s.HZ + 16, s.HZ + 26);
        bridge(s, x + 120, s.HZ + 30, 70);
        PROPS.tollHouse(s, x, s.HZ + 32, 0.95);
        return x + 50;
    },
    wagons(s) {
        const y = s.HZ + 30, x = 90 + (s.r() * 120 | 0);
        track(s, 20, 40, 2);
        for (let i = 0; i < 4; i++)
            PROPS.wagon(s, x + i * 62, y + (i % 2) * 3, 0.9);
        return x + 90;
    },
    pond(s) {
        const x = 220 + (s.r() * 160 | 0);
        water(s, x - 90, x + 90, s.HZ + 12, s.HZ + 30);
        PROPS.watermill(s, x - 105, s.HZ + 30, 0.95);
        s.rect(x + 86, s.HZ + 26, 6, 6, STUFF.stone.mid);
        return x - 20;
    },
    picket(s) {
        const x = 150 + (s.r() * 250 | 0);
        PROPS.signpost(s, x - 46, s.HZ + 30, 1);
        palisade(s, x - 30, x + 40, s.HZ + 30, 0.8);
        for (let i = 0; i < 3; i++)
            PROPS.tent(s, x + 56 + i * 26, s.HZ + 31, 0.95);
        return x + 30;
    },
    forage(s) {
        const x = 160 + (s.r() * 280 | 0);
        PROPS.barn(s, x, s.HZ + 32, 0.95);
        for (let i = 0; i < 3; i++)
            PROPS.hay(s, x + 54 + i * 24, s.HZ + 33, 0.9);
        PROPS.wagon(s, x - 58, s.HZ + 33, 0.85);
        return x + 20;
    },
    burning(s) {
        const x = 130 + (s.r() * 250 | 0), k = 0.95;
        [0, 44, 92].forEach((dx, i) => {
            PROPS[i === 1 ? 'logHut' : 'khata'](s, x + dx, s.HZ + 30, k);
            PROPS.flame(s, x + dx - 4, s.HZ + 11 - (i === 1 ? 4 : 0), 1.1);
            PROPS.smoke(s, x + dx, s.HZ + 4, 0.8);
        });
        for (let i = 0; i < 5; i++)
            PROPS.cow(s, x + 150 + i * 14, s.HZ + 34 + (i % 2) * 3, 0.9);
        return x + 90;
    },
    manor(s) {
        const x = 170 + (s.r() * 260 | 0);
        PROPS.manor(s, x, s.HZ + 34, 1);
        s.rect(x - 60, s.HZ + 33, 30, 2, STUFF.stone.mid);
        s.rect(x + 30, s.HZ + 33, 30, 2, STUFF.stone.mid);
        PROPS.oak(s, x - 66, s.HZ + 34, 0.7);
        PROPS.oak(s, x + 68, s.HZ + 34, 0.65);
        return x;
    },
    blockhouse(s) {
        const x = 170 + (s.r() * 260 | 0);
        palisade(s, x - 62, x + 62, s.HZ + 34, 0.85);
        PROPS.blockhouse(s, x, s.HZ + 32, 1);
        return x;
    },
    road(s) {
        track(s, 22, 50, 2);
        PROPS.cross(s, 70 + (s.r() * 460 | 0), s.HZ + 24, 1.1);
        const x = 120 + (s.r() * 260 | 0);
        PROPS.wagon(s, x, s.HZ + 36, 0.9);
        PROPS.wagon(s, x + 70, s.HZ + 39, 0.85);
        return x + 35;
    },
    ravine(s) {
        const x = 170 + (s.r() * 260 | 0), y = s.HZ + 10, e = STUFF.earth, cleft = s.ramp([e.mid, e.lo, e.dk, e.dk]), top = [], bot = [];
        // a cleft cut across the country: raw earth dropping into the dark, its far lip lit and edged with scrub, its edges broken like a torn bank
        for (let dx = -64; dx <= 64; dx += 5) {
            const u = dx / 64, w = Math.sqrt(Math.max(0, 1 - u * u)), j = ((dx * 13) % 7) % 3 - 1;
            top.push(x + dx, y - 1 - 4 * w - (j > 0 ? 1 : 0));
            bot.unshift(x + dx, y + 1 + 6 * w + (j < 0 ? 1 : 0));
        }
        const sh = s.shape([...top, ...bot]), n = sh.runs.length;
        s.edge(sh, LAND_EDGE);
        sh.runs.forEach((row, i) => { for (let k = 0; k < row.length; k += 2)
            s.rect(row[k], sh.y0 + i, row[k + 1] - row[k], 1, cleft.at(Math.round(i / Math.max(1, n - 1) * cleft.levels))); });
        s.cap(sh, e.lit, 1);
        s.lit(sh, e.lit, 2);
        s.courses(sh, s.dither(null, e.dk, 6), 3, 2);
        for (let dx = -56; dx <= 56; dx += 4) {
            const h = 2 + ((dx * 11) % 5 + 5) % 3;
            s.rect(x + dx, y - 6 - h + 2, 1, h, e.lo);
        }
        for (const dx of [-54, -32, -8, 20, 46])
            PROPS.bush(s, x + dx, y - 4 - ((dx * 7) % 3), 0.7);
        PROPS.rock(s, x + 20, y + 20, 1);
        PROPS.rock(s, x - 24, y + 22, 0.9);
        return x;
    },
    edge(s) {
        const left = s.r() < 0.5, x0 = left ? 0 : s.W - 230, x1 = x0 + 230;
        for (let x = x0 + 8; x < x1; x += 20 + (s.r() * 8 | 0))
            PROPS[x % 3 ? 'spruce' : 'pine'](s, x, s.HZ + 26 + (x % 7) * 2, 1.25);
        for (let x = x0 + 18; x < x1; x += 26 + (s.r() * 8 | 0))
            PROPS.bush(s, x, s.HZ + 34 + (x % 5) * 3, 0.9);
        return x0 + 115;
    }
};
/* ---------- the weather ---------- */
/** A puddle on the ground at x, y, k times its usual size, with the sky in it. */
function puddle(s, x, y, k) {
    const w = 13 * k, h = Math.max(2, 3 * k), sky = s.T.sky, top = s.weather === 'clear' ? rSky[3] : sky[Math.max(0, sky.length - 2)], low = s.weather === 'clear' ? rSky[1] : sky[Math.max(0, sky.length - 4)];
    s.plain(() => s.run(x - w, y - h, x + w + 1, y + h + 1, (px, py) => {
        const d = ((px - x) / w) ** 2 + ((py - y) / h) ** 2;
        if (d > 1)
            return undefined;
        if (d > 0.72)
            return py > y ? rSoot[3] : s.dither(rSoot[4], low, 8);
        return py < y - h * 0.3 ? top : s.dither(low, top, 4);
    }));
}
/**
 * What the day's weather does to a finished backdrop. Fog hangs over everything that stands far off, the more so the nearer the horizon, so
 * that the landmarks are ghosts and the hills a pale smear; rain stands in puddles on the ground and a sheen of sky on its wet.
 */
function weatherArt(s) {
    const air = s.T.haze;
    if (s.weather === 'fog')
        s.plain(() => {
            for (let y = 0; y < s.H; y++) {
                const f = y < s.HZ ? 0.35 + 0.65 * y / s.HZ : Math.max(0.12, 1 - 1.1 * (y - s.HZ) / (s.H - s.HZ)) ** 1.3;
                s.rect(0, y, s.W, 1, s.dither(null, air, Math.round(f * 13)));
            }
        });
    else if (s.weather === 'rain') {
        s.plain(() => { for (let i = 0; i < 26; i++) {
            const y = s.HZ + 4 + ((s.r() * s.r() * (s.H - s.HZ - 8)) | 0), w = 20 + ((s.r() * 90) | 0);
            s.rect(s.r() * s.W, y, w, 1, s.dither(null, s.T.sky[s.T.sky.length - 3], 4));
        } });
        scatter(s, 12, (x, y, k) => puddle(s, x, y, k), 18);
    }
}
/** The backdrops made so far, kept: the cards and the encyclopedia take their scenery from them. */
const backdrops = new Map();
/** The backdrop of a land on a clear day, from one of a few seeds. */
function backdropOf(land, seed, weather = 'clear', site) {
    const key = land + seed + weather + (site || '');
    let c = backdrops.get(key);
    if (!c)
        backdrops.set(key, c = makeBackdrop(seed + 1, weather, { land, site }));
    return c;
}
const skylines = new Map();
/**
 * The skyline of a land by night, W scene pixels wide: the field's backdrop without its sky, down to the horizon, painted in the moon's light for the camp to
 * stand against: the far hills pale in the glow, the near ones and the landmarks dark, the lit faces of them touched, a window or two warm.
 */
function skylineOf(land, seed, W) {
    const key = land + seed + W;
    let c = skylines.get(key);
    if (!c) {
        const back = makeBackdrop(seed, 'clear', { land }, { width: W * SS, sky: false, night: true });
        skylines.set(key, c = sceneCanvas(W, HZ));
        const g = c.getContext('2d');
        g.drawImage(back, 0, 0, W * SS, HZ * SS, 0, 0, W, HZ);
    }
    return c;
}
/** The land the company is in, or the Crown's where there is no company yet. */
const landNow = () => (G ? here(G).land : 'poland');
/** Where a fight is: the land its contract names or, for a contract saved before they named one, the land the company stands in. */
function settingOf(st, c) { return { land: c.land || here(st).land, site: SITE_OF[c.tpl] }; }
/** The picture behind a fight: this land, under this weather, drawn afresh from the seed. */
function makeBackdrop(seed, weather, setting, o = {}) {
    const land = setting ? setting.land : Object.keys(LANDS)[seed % 8], W = o.width || LW * SS;
    const c = sceneCanvas(W / SS, LH), s = makeScene(c.getContext('2d'), seed, weather, weatherTone(TONES[land], weather), W, o.sky !== false, !!o.night);
    LAND_ART[land](s);
    if (setting && setting.site)
        c.siteX = SITE_ART[setting.site](s);
    if (s.sky)
        groundFringe(s);
    weatherArt(s);
    return c;
}
