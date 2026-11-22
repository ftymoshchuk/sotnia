"use strict";
/* ===== SOTNIA interface: drawing (palette, pixel sprites, the woodcut backdrop, the field) ===== */
const LW = BW, LH = 124, FY = 72, HZ = 56;
const PAL = {
    paper: '#d9d1bc', hill: '#d0c7ae', ground: '#cbc2a8', paperHi: '#e6dfcc', ink: '#14100c', red: '#b2493a', blue: '#33507a',
    ochre: '#a67a27', green: '#587030', drab: '#77705a', grey: '#8b877c', plum: '#5e3158', black: '#2a2018', skin: '#cd9a73',
    wood: '#6a4a2c', fur: '#4b3524', steel: '#3d4144', helm: '#7e8284', white: '#e7ddbf', flash: '#f0b93a', smoke: '#a9a498', russet: '#6e2420'
};
const INK = PAL.ink;
const SKINS = {
    own: { coat: '#8f3328', trim: '#cf9f3c' }, bandit: { coat: '#6e6249', trim: PAL.white }, deserter: { coat: '#6b757e', trim: '#1d2227' },
    raider: { coat: PAL.green, trim: PAL.ochre }, imperial: { coat: PAL.ochre, trim: '#1d2227' }, swede: { coat: PAL.blue, trim: '#cf9f3c' },
    champion: { coat: PAL.plum, trim: '#cf9f3c' }, black: { coat: '#1d2227', trim: '#8f3328' }, muscovite: { coat: PAL.russet, trim: '#cf9f3c' },
    tatar: { coat: '#2a625a', trim: PAL.white }, croat: { coat: '#67533b', trim: '#b2493a' }
};
/* ---------- the random numbers of the backdrops (the backdrops themselves are in terrain.ts) ---------- */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* ---------- the field ---------- */
function newView(cv, seed, weather, names, setting) {
    const buf = sceneCanvas(LW, LH); // SS times finer than the scene, for the figures (see SS)
    const v = { cv, ctx: cv.getContext('2d'), buf, g: buf.getContext('2d'), back: makeBackdrop(seed, weather, setting), parts: [], names, weather }; // css and dpr: fitView sets them next
    fitView(v);
    return v;
}
function fitView(v) {
    const w = v.cv.clientWidth || 600, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(w * dpr), H = Math.round(W * LH / LW);
    if (v.cv.width !== W || v.cv.height !== H) {
        v.cv.width = W;
        v.cv.height = H;
    }
    v.css = w / LW;
    v.dpr = dpr;
}
function drainFx(v, b, loud) {
    for (const f of b.fx) {
        if (f.k === 'shot') {
            const n = f.mis ? 3 : 8;
            for (let i = 0; i < n; i++)
                v.parts.push({ k: 's', x: f.x + rnd(-1, 2) * f.f, y: f.y, h: 12 + rnd(-1, 2), vx: f.f * rnd(2, f.mis ? 5 : 17), vh: rnd(1, 6), life: 0, max: rnd(1.6, 3.8) });
            if (loud)
                sfx(f.mis ? 'fizz' : 'shot');
        }
        else if (f.k === 'blood') {
            for (let i = 0; i < f.n; i++)
                v.parts.push({ k: 'b', x: f.x, y: f.y + rnd(-1, 1), h: rnd(6, 12), vx: f.f * rnd(4, 26) + rnd(-5, 5), vh: rnd(4, 26), life: 0, max: 2 });
            if (loud)
                sfx('hit');
        }
        else if (f.k === 'parry') {
            for (let i = 0; i < 3; i++)
                v.parts.push({ k: 'p', x: f.x, y: f.y, h: 10, vx: rnd(-18, 18), vh: rnd(4, 20), life: 0, max: 0.25 });
            if (loud)
                sfx('clang');
        }
        else if (f.k === 'miss') {
            for (let i = 0; i < 3; i++)
                v.parts.push({ k: 'd', x: f.x, y: f.y, h: 0.5, vx: rnd(-6, 6), vh: rnd(6, 14), life: 0, max: 0.5 });
        }
        else if (f.k === 'death' && loud)
            sfx('fall');
    }
    b.fx.length = 0;
}
function stepParts(v, dt) {
    const g2 = v.back.getContext('2d');
    for (let i = v.parts.length - 1; i >= 0; i--) {
        const p = v.parts[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.h += p.vh * dt;
        if (p.k === 's') {
            p.vx *= 1 - Math.min(1, 1.6 * dt);
            p.vx += 1.5 * dt;
            p.vh = Math.max(1.2, p.vh * (1 - dt));
        }
        else {
            p.vh -= 60 * dt;
            if (p.h <= 0) {
                if (p.k === 'b') {
                    g2.fillStyle = PAL.red;
                    g2.fillRect(p.x | 0, (FY + p.y) | 0, 1, 1);
                }
                p.life = 99;
            }
        }
        if (p.life >= p.max)
            v.parts.splice(i, 1);
    }
    if (v.parts.length > 420)
        v.parts.splice(0, v.parts.length - 420);
}
function drawField(v, b, t) {
    const g = v.g;
    g.globalAlpha = 1;
    g.drawImage(v.back, 0, 0, LW, LH);
    if (v.weather === 'fog') {
        g.fillStyle = 'rgba(244,240,228,.5)';
        for (let i = 0; i < 3; i++)
            g.fillRect(-30 + Math.sin(t * 0.21 + i * 1.7) * 22, 42 + i * 25, LW + 60, 9);
    }
    const us = b.units.filter(u => !u.fled).sort((a, c) => a.y - c.y);
    for (const u of us)
        if (u.dead)
            drawSoldier(g, Math.round(u.x * SS) / SS, FY + Math.round(u.y * SS) / SS, { dead: true, cls: u.cls, skin: u.skin, face: u.face, wpn: u.wpn, arm: u.arm, man: manNo(u.sid), nation: nationOf(u.origin) });
    for (const u of us) {
        if (u.dead)
            continue;
        const x = Math.round(u.x * SS) / SS, y = FY + Math.round(u.y * SS) / SS;
        drawSoldier(g, x, y, { cls: u.cls, skin: u.skin, face: u.face, mode: u.mode, moving: u.moving, anim: u.anim * 2, swing: u.swing, flash: u.flash, hurt: u.hurt, t, level: u.cls === 'pike' && u.tgt && dist(u, u.tgt) < 44, wpn: u.wpn, arm: u.arm, man: manNo(u.sid), nation: nationOf(u.origin) });
        if (!u.routing) {
            g.fillStyle = INK;
            g.fillRect(x - 5, y - 27, 11, 3);
            g.fillStyle = PAL.paperHi;
            g.fillRect(x - 4, y - 26, 9, 1);
            g.fillStyle = (SKINS[u.skin] || SKINS.own).coat;
            g.fillRect(x - 4, y - 26, Math.max(1, Math.round(9 * u.hp / u.max)), 1);
        }
    }
    // the captain's order: a ring of gold under the men it is on, and the captain behind the line, his sabre up as he calls it
    const O = b.order, left = O ? b.buffs[O] : undefined;
    if (O && left !== undefined) {
        g.fillStyle = 'rgba(246,220,151,.75)';
        for (const u of us)
            if (u.side === 0 && !u.dead && (O === 'rally' || (O === 'volley' ? u.cls === 'shot' : O === 'stand' ? u.cls === 'pike' : u.cls === 'sabre')))
                g.fillRect(Math.round(u.x) - 6, FY + Math.round(u.y) + 1, 13, 1);
    }
    if (v.captain && b.order) {
        const C = CAPTAINS[v.captain.type], cx = 11, cy = FY + 30, calling = O && left !== undefined && left > ORDERS[O].secs - 0.7;
        g.fillStyle = '#4b3420';
        g.fillRect(cx - 9, cy - 38, 1, 38);
        g.fillStyle = PAL.red;
        g.fillRect(cx - 8, cy - 38, 8, 5);
        g.fillStyle = PAL.ochre;
        g.fillRect(cx - 5, cy - 37, 2, 3);
        drawCamper(g, cx, cy, { cls: C.cls, skin: 'own', face: 1, mode: calling ? 'fight' : 'idle', swing: calling ? 1 : 0, wpn: 2, arm: 2, man: v.captain.name.length, nation: C.origin, rank: 'captain' });
    }
    for (const p of v.parts) {
        const px = Math.round(p.x), py = Math.round(FY + p.y - p.h);
        if (p.k === 's') {
            const fr = p.life / p.max, s = 2 + Math.floor(fr * 4);
            g.globalAlpha = fr > 0.65 ? Math.max(0, 1 - (fr - 0.65) / 0.35) : 1;
            g.fillStyle = PAL.white;
            g.fillRect(px - (s >> 1), py - (s >> 1), s, s);
            g.fillStyle = PAL.smoke;
            g.fillRect(px - (s >> 1), py - (s >> 1) + s - 1, s, 1);
            g.globalAlpha = 1;
        }
        else {
            g.fillStyle = p.k === 'b' ? PAL.red : p.k === 'p' ? PAL.white : INK;
            g.fillRect(px, py, 1, 1);
        }
    }
    if (v.weather === 'rain') {
        g.fillStyle = 'rgba(28,26,23,.5)';
        for (let i = 0; i < 54; i++) {
            const x = ((i * 37 + t * 95 + i * i * 13) % (LW + 20)) - 10, y = (i * 53 + t * 190) % LH;
            g.fillRect(x | 0, y | 0, 1, 2);
            g.fillRect((x | 0) - 1, (y | 0) + 2, 1, 2);
        }
    }
    else if (v.weather === 'fog') {
        g.fillStyle = 'rgba(244,240,228,.26)';
        for (let i = 0; i < 2; i++)
            g.fillRect(-30 + Math.sin(t * 0.17 + i * 2.3) * 26, 84 + i * 21, LW + 60, 4);
    }
    present(v.ctx, v.buf, v.cv.width, v.cv.height);
    const c = v.ctx;
    if (v.names && v.css >= 1.5) {
        const sc = v.cv.width / LW;
        c.font = Math.round(clamp(v.css * 4.5, 10, 15) * v.dpr) + "px 'Alegreya SC', Georgia, serif";
        c.textAlign = 'center';
        c.lineJoin = 'round';
        c.lineWidth = 3 * v.dpr;
        c.strokeStyle = PAL.paper;
        c.fillStyle = INK;
        for (const u of b.units) {
            if (u.side !== 0 || !alive(u) || u.routing)
                continue;
            const n = u.name.split(' ')[0], X = u.x * sc, Y = (FY + u.y - 30) * sc;
            c.strokeText(n, X, Y);
            c.fillText(n, X, Y);
        }
    }
}
/* ---------- the map: a plain working map of the real lands, to be dressed in the period style later ---------- */
const MAP_K = Math.cos(50 * Math.PI / 180);
const MAP_ASPECT = (MAP_BOX.e - MAP_BOX.w) * MAP_K / (MAP_BOX.n - MAP_BOX.s);
const MAP_SEAS = [['The Black Sea', 31.4, 45.2], ['The Sea of Azov', 36.9, 46.2], ['The Baltic Sea', 16.6, 55.35]];
// The place nearest a point on the map, within a finger's width; drawMap leaves where each place sits.
function placeAt(cv, x, y) {
    let best = null, bd = 16;
    for (const p of cv.hits || []) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) {
            bd = d;
            best = p.id;
        }
    }
    return best;
}
// plan: the legs of a course to show, as routeTo lists them, or null.
function drawMap(cv, st, plan) {
    if (!cv || !st)
        return;
    cv.style.aspectRatio = String(MAP_ASPECT);
    const w = cv.clientWidth || 900, h = w / MAP_ASPECT, dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d'), s = w / ((MAP_BOX.e - MAP_BOX.w) * MAP_K);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = (lon) => (lon - MAP_BOX.w) * MAP_K * s, Y = (lat) => (MAP_BOX.n - lat) * s;
    const at = (id) => [X(PLACES[id].lon), Y(PLACES[id].lat)];
    const line = (pts) => { g.beginPath(); for (let i = 0; i < pts.length; i += 2) {
        if (i)
            g.lineTo(X(pts[i]), Y(pts[i + 1]));
        else
            g.moveTo(X(pts[i]), Y(pts[i + 1]));
    } };
    // sea, then the land over it
    g.fillStyle = '#bcbdb3';
    g.fillRect(0, 0, w, h);
    g.beginPath();
    for (const ring of COAST) {
        for (let i = 0; i < ring.length; i += 2) {
            if (i)
                g.lineTo(X(ring[i]), Y(ring[i + 1]));
            else
                g.moveTo(X(ring[i]), Y(ring[i + 1]));
        }
        g.closePath();
    }
    g.fillStyle = PAL.paper;
    g.fill('evenodd');
    g.strokeStyle = PAL.ink;
    g.lineWidth = 1;
    g.stroke();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = PAL.blue;
    g.globalAlpha = 0.5;
    g.lineWidth = 1.4;
    for (const k in RIVERS) {
        line(RIVERS[k]);
        g.stroke();
    }
    g.globalAlpha = 1;
    // every road, then the roads open from here, then the road travelled
    g.setLineDash([2, 3]);
    g.strokeStyle = 'rgba(28,26,23,.45)';
    g.lineWidth = 1;
    for (const r of ROADS) {
        if (r.river)
            continue;
        const a = at(r.a), b = at(r.b);
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
    }
    g.setLineDash([]);
    const here0 = at(st.at), out = st.over ? [] : roadsFrom(st);
    g.strokeStyle = PAL.ink;
    g.lineWidth = 2;
    for (const r of out) {
        const b = at(r.to);
        g.beginPath();
        g.moveTo(here0[0], here0[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
    }
    g.strokeStyle = PAL.red;
    g.lineWidth = 3;
    g.beginPath();
    st.path.forEach((id, i) => { const p = at(id); if (i)
        g.lineTo(p[0], p[1]);
    else
        g.moveTo(p[0], p[1]); });
    g.stroke();
    // a course set from here, dashed in weld
    const target = plan && plan.length ? plan[plan.length - 1].to : null;
    if (target) {
        g.setLineDash([7, 5]);
        g.strokeStyle = PAL.ochre;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(here0[0], here0[1]);
        for (const l of plan) {
            const p = at(l.to);
            g.lineTo(p[0], p[1]);
        }
        g.stroke();
        g.setLineDash([]);
    }
    // places: a filled dot where there is a market, an open one where there is none
    const q = questOf(st), named = new Set([st.at, q.to].concat(target ? [target] : [], out.map(r => r.to), [q.from]));
    cv.hits = Object.keys(PLACES).map(id => { const xy = at(id); return { id, x: xy[0], y: xy[1] }; });
    for (const id in PLACES) {
        const p = PLACES[id], xy = at(id), shop = (SERVICES[p.kind] || {}).market;
        g.beginPath();
        g.arc(xy[0], xy[1], 2.6, 0, Math.PI * 2);
        g.fillStyle = shop ? PAL.ink : PAL.paper;
        g.fill();
        g.strokeStyle = PAL.ink;
        g.lineWidth = 1.2;
        g.stroke();
        if (p.major)
            named.add(id);
    }
    const dest = at(q.to);
    g.strokeStyle = PAL.ochre;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(dest[0], dest[1], 7.5, 0, Math.PI * 2);
    g.stroke();
    if (target && target !== q.to) {
        const t = at(target);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(t[0], t[1], 5.5, 0, Math.PI * 2);
        g.stroke();
    }
    g.fillStyle = PAL.ink;
    g.fillRect(here0[0] - 1, here0[1] - 19, 2, 19);
    g.fillStyle = PAL.red;
    g.beginPath();
    g.moveTo(here0[0] + 1, here0[1] - 19);
    g.lineTo(here0[0] + 13, here0[1] - 15);
    g.lineTo(here0[0] + 1, here0[1] - 11);
    g.closePath();
    g.fill();
    // names, with a paper halo so they read over roads and rivers
    const fs = Math.round(clamp(w / 82, 10, 14));
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.font = 'italic ' + Math.round(fs * 1.1) + "px 'Alegreya', Georgia, serif";
    g.fillStyle = PAL.blue;
    g.textAlign = 'center';
    for (const m of MAP_SEAS)
        g.fillText(m[0], X(m[1]), Y(m[2]));
    g.font = fs + "px 'Alegreya SC', Georgia, serif";
    const boxes = [], hit = (b) => boxes.some(o => o[0] < b[0] + b[2] && b[0] < o[0] + o[2] && o[1] < b[1] + b[3] && b[1] < o[1] + o[3]);
    for (const id of named) {
        const xy = at(id), name = cap1(PLACES[id].name), tw = g.measureText(name).width, x = xy[0], y = xy[1];
        const tries = [[x + 7, y, 'left'], [x - 7, y, 'right'], [x + 4, y + fs, 'left'], [x + 4, y - fs, 'left'], [x - 4, y + fs, 'right'], [x - 4, y - fs, 'right']];
        for (const t of tries) {
            const bx = t[2] === 'left' ? t[0] : t[0] - tw, box = [bx - 2, t[1] - fs / 2 - 1, tw + 4, fs + 2];
            if (box[0] < 1 || box[0] + box[2] > w - 1 || box[1] < 1 || box[1] + box[3] > h - 1 || hit(box))
                continue;
            boxes.push(box);
            g.textAlign = t[2];
            g.lineWidth = 3.5;
            g.strokeStyle = PAL.paper;
            g.strokeText(name, t[0], t[1]);
            g.fillStyle = id === st.at ? PAL.red : PAL.ink;
            g.fillText(name, t[0], t[1]);
            break;
        }
    }
}
/* ---------- the company in camp: sitting, lying, foraging, and the people of the baggage train ---------- */
/** How the post alone is drawn: what a camp shows when it knows no more of the man (an officer is drawn by his kind). */
const STATION_LOOK = {
    surgeon: { coat: '#5a4630', trim: PAL.white, hat: 'cap', hatCol: '#3b3128', prop: 'razor', apron: true },
    drill: { coat: '#6b6b66', trim: PAL.ochre, hat: 'morion', prop: 'pike' },
    qm: { coat: '#2a625a', trim: PAL.ochre, hat: 'cap', hatCol: '#8f3328', prop: 'purse' },
    chaplain: { coat: INK, trim: PAL.white, hat: 'biretta', prop: 'cross', long: true }
};
/** How each kind of officer is drawn: his coat, his hat and what he carries say what he is. */
const OFFICER_LOOK = {
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
const RETAINER_LOOK = {
    engineer: { coat: '#7a5a2a', trim: PAL.ochre, hat: 'wide', hatCol: '#3b3128', prop: 'spade' },
    cartographer: { coat: '#3a4a5a', trim: PAL.white, hat: 'wide', hatCol: '#2c2926', prop: 'scrolls' },
    informant: { coat: '#2a2725', trim: PAL.ochre, hat: 'wide', hatCol: '#2a2725', prop: 'letter' },
    wisewoman: { coat: '#6b4f6b', trim: PAL.white, hat: 'scarf', hatCol: '#d9c48a', prop: 'herbs', long: true },
    renegade: { coat: PAL.blue, trim: PAL.ochre, hat: 'felt', hatCol: '#2c2926', prop: 'halberd' },
    duellist: { coat: PAL.plum, trim: PAL.ochre, hat: 'plumed', hatCol: '#2c2926', prop: 'rapier' },
    kobzar: { coat: '#cfc8b4', trim: PAL.white, hat: 'cap', hatCol: '#4b3524', prop: 'bandura', grey: true, beard: true, blind: true },
    merchant: { coat: '#7a2230', trim: PAL.ochre, hat: 'turban', hatCol: '#d9d1bc', prop: 'bales', long: true }
};
// An ox, standing or lying, in the colour it should have by day or by firelight.
function drawOx(g, x, y, f, lying, hide) {
    const R = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(f > 0 ? x + dx : x - dx - w + 1, y + dy, w, h); };
    const dark = '#3a2a1a', horn = PAL.paperHi;
    if (lying) {
        R(-6, -5, 12, 5, hide);
        R(5, -7, 4, 4, hide);
        R(6, -9, 1, 2, horn);
        R(8, -9, 1, 2, horn);
        R(7, -6, 1, 1, INK);
        R(-7, -3, 1, 2, dark);
        return;
    }
    R(-6, -9, 12, 5, hide);
    R(-5, -4, 1, 4, dark);
    R(-3, -4, 1, 4, dark);
    R(3, -4, 1, 4, dark);
    R(5, -4, 1, 4, dark);
    R(6, -10, 4, 4, hide);
    R(7, -12, 1, 2, horn);
    R(9, -12, 1, 2, horn);
    R(8, -9, 1, 1, INK);
    R(-7, -9, 1, 4, dark);
}
// The cargo of the quest, by how it travels. x,y is the foot of its left end; load runs from 0 to 1.
function drawCargo(g, kind, x, y, load, night) {
    const F = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
    const wood = night ? '#4b3420' : PAL.wood, wood2 = night ? '#6a4a2c' : '#8a6440', keg = night ? '#5a3f27' : '#7a5a3a';
    const wheel = (a) => { g.strokeStyle = night ? '#2e2116' : INK; g.lineWidth = 2; g.beginPath(); g.arc(x + a, y + 4, 5.5, 0, Math.PI * 2); g.stroke(); F(a - 1, -1, 2, 10, night ? '#2e2116' : INK); F(a - 5, 3, 10, 2, night ? '#2e2116' : INK); };
    const wagon = () => { F(0, -6, 50, 6, wood); F(0, -6, 50, 1, wood2); F(-14, -3, 14, 1.5, wood); wheel(9); wheel(40); };
    if (kind === 'oxcart' || kind === 'chest') {
        drawOx(g, x - 10, y + 8, 1, true, night ? '#4a3c2f' : '#6b5338');
        wagon();
        if (kind === 'chest') {
            F(8, -15, 22, 9, night ? '#2e2116' : '#3b2a1c');
            F(8, -12, 22, 1, PAL.steel);
            F(8, -8, 22, 1, PAL.steel);
            F(18, -14, 2, 3, PAL.ochre);
            F(33, -14, 13, 8, night ? '#a89f8a' : PAL.paper);
        }
        else {
            const n = Math.max(1, Math.round(5 * load)), spots = [[3, -16], [14, -16], [25, -16], [8, -25], [19, -25]];
            for (let i = 0; i < n; i++) {
                const s = spots[i];
                F(s[0], s[1], 9, 10, keg);
                F(s[0], s[1] + 2, 9, 1, INK);
                F(s[0], s[1] + 7, 9, 1, INK);
                F(s[0] + 1, s[1] - 1, 7, 1, night ? '#a89f8a' : PAL.white);
            }
            F(36, -14, 11, 8, night ? '#a89f8a' : PAL.paper);
            F(38, -16, 7, 2, night ? '#a89f8a' : PAL.paper);
        }
    }
    else if (kind === 'herd') {
        const hide = night ? '#4a3c2f' : '#6b5338', hide2 = night ? '#5b4a3a' : '#8a6c4a';
        drawOx(g, x + 6, y - 2, 1, true, hide);
        drawOx(g, x + 30, y + 2, -1, true, hide2);
        drawOx(g, x + 50, y - 4, 1, false, hide);
        drawOx(g, x + 18, y + 10, 1, true, hide2);
    }
    else {
        F(-20, -8, 92, 16, night ? '#17222f' : '#9fb0b8');
        for (let i = 0; i < 9; i++)
            F(-16 + i * 10, -4 + (i % 3) * 4, 5, 1, night ? '#2d4b70' : PAL.white);
        F(0, -4, 48, 5, wood);
        for (let i = 0; i < 6; i++)
            F(i * 8, -4, 1, 5, INK);
        const n = Math.max(1, Math.round(4 * load));
        for (let i = 0; i < n; i++) {
            F(4 + i * 10, -10, 8, 6, night ? '#a89f8a' : PAL.paper);
            F(6 + i * 10, -11, 4, 1, night ? '#a89f8a' : PAL.paper);
            F(4 + i * 10, -7, 8, 1, PAL.drab);
        }
        F(44, -20, 1, 16, wood);
        F(36, -18, 8, 1, wood);
    }
}
/* ---------- card art: small woodcut pictures for the cards, drawn once and kept ---------- */
const artCache = {};
function artURL(key, W, H, fn) {
    if (artCache[key])
        return artCache[key];
    const c = sceneCanvas(W, H), g = c.getContext('2d');
    fn(g, W, H);
    return (artCache[key] = c.toDataURL());
}
/**
 * The backdrop of a card: a window onto the field backdrop of a land (see backdropOf), its horizon seven pixels above the foot of the
 * picture, or twenty when it is to show a site, which stands on the ground in front of the hills; the window is on the site then.
 */
function landscape(g, W, H, seed, land, site) {
    const back = backdropOf(land, seed % 3, 'clear', site), sw = W * SS, sh = H * SS, lift = site ? 20 : 7;
    const sx = site && back.siteX !== undefined ? clamp(Math.round(back.siteX - sw / 2), 0, back.width - sw) : (seed * 173 + W * 11) % (back.width - sw);
    g.drawImage(back, sx, HZ * SS - (H - lift) * SS, sw, sh, 0, 0, W, H);
}
// A man of the company on his card: standing in his arms and armour, or abed. gear tries other levels than he has, for a card to show what buying them would make of him.
function soldierArt(s, gear, land = landNow()) {
    const seed = s.id % 5, pose = s.wound ? 'lie' : 'stand', wpn = gear && gear.wpn != null ? gear.wpn : s.wpn, arm = gear && gear.arm != null ? gear.arm : s.arm;
    return artURL('m' + s.id + s.cls + pose + wpn + arm + land, 48, 36, (g, W, H) => { landscape(g, W, H, seed, land); drawCamper(g, 24, H - 3, { cls: s.cls, skin: 'own', face: 1, mode: 'idle', anim: 0, pose, wpn, arm, man: s.id, nation: nationOf(s.origin) }); });
}
// After a fight: how each man came out of it.
function fateArt(l, land = landNow()) {
    const seed = l.id % 5, cls = l.cls, fate = l.fate, kit = { wpn: l.wpn, arm: l.arm, man: l.id, nation: nationOf(l.origin) };
    return artURL('f' + l.id + cls + fate + l.wpn + l.arm + land, 48, 36, (g, W, H) => {
        landscape(g, W, H, seed, land);
        if (fate === 'killed' || fate === 'struck down')
            drawCamper(g, 24, H - 3, { cls, skin: 'own', pose: 'lie', bandage: fate !== 'killed', ...kit });
        else if (fate === 'fled')
            drawCamper(g, 24, H - 3, { cls, skin: 'own', face: -1, mode: 'rout', moving: true, anim: 1, ...kit });
        else
            drawCamper(g, 24, H - 3, { cls, skin: 'own', face: 1, mode: 'idle', anim: 0, bandage: fate === 'wounded', ...kit });
    });
}
// The other side of a contract or an ambush, facing the reader's company.
function foesArt(c) {
    const us = c.units.slice(0, 6), land = c.land || landNow(), site = SITE_OF[c.tpl];
    return artURL('e' + c.id + us.map(u => u.cls).join('') + land + (site || ''), 72, 36, (g, W, H) => {
        landscape(g, W, H, c.id % 5, land, site);
        const step = us.length > 4 ? 10 : 12, x0 = Math.round(W / 2 - (us.length - 1) * step / 2);
        us.forEach((u, i) => drawSoldier(g, x0 + i * step, H - 3 - (i % 2) * 2, { cls: u.cls, skin: c.skin || u.skin, face: -1, mode: 'idle', anim: 0, wpn: u.wpn, arm: u.arm, man: i + 2 }));
    });
}
/** The portrait of a person of the command, in a window onto the land the company is in. */
const personArt = (key, L, land) => artURL('p' + key + land, 48, 36, (g, W, H) => { landscape(g, W, H, key.length, land); drawPerson(g, 24, H - 3, L, 1); });
const officerArt = (kind, land = landNow()) => personArt(kind, OFFICER_LOOK[kind], land);
const retainerArt = (t, land = landNow()) => personArt(t, RETAINER_LOOK[t], land);
/** A retainer in the wide picture of the camp event in which he asks for a place. */
const retainerWideArt = (t, land = landNow()) => artURL('w' + t + land, 96, 30, (g, W, H) => { landscape(g, W, H, t.length, land); drawPerson(g, 48, H - 2, RETAINER_LOOK[t], 1); });
/** The station's own portrait, for a vacant post. */
const staffArt = (k, land = landNow()) => personArt('s' + k, STATION_LOOK[k], land);
/** A captain at the head of his company, in the dress of his nation and the gilt of his rank. */
const captainArt = (c, land = landNow()) => {
    const T = CAPTAINS[c.type];
    return artURL('c' + c.type + land, 48, 36, (g, W, H) => { landscape(g, W, H, c.type.length, land); drawCamper(g, 24, H - 3, { cls: T.cls, skin: 'own', face: 1, mode: 'idle', anim: 0, wpn: 2, arm: 2, man: c.name.length, nation: T.origin, rank: 'captain' }); });
};
function stanceArt(s, land = landNow()) {
    return artURL('t' + s + land, 60, 36, (g, W, H) => {
        landscape(g, W, H, s.length + 1, land);
        const y = H - 3, o = (cls, x, m) => drawSoldier(g, x, y - (x % 3 === 0 ? 1 : 0), Object.assign({ cls, skin: 'own', face: 1, mode: 'idle', anim: 0 }, m));
        // a company is of many nations: these are of the ones it is likely to have
        if (s === 'hold') {
            o('pike', 12, { nation: 'scot' });
            o('shot', 29, { mode: 'aim', flash: 1, nation: 'cossack' });
            o('pike', 46, { nation: 'german' });
        }
        else if (s === 'advance') {
            o('pike', 10, { moving: true, anim: 0, nation: 'pole' });
            o('sabre', 27, { moving: true, anim: 1, nation: 'magyar' });
            o('shot', 44, { moving: true, anim: 0, nation: 'swede' });
        }
        else {
            o('pike', 8, { moving: true, anim: 1, level: true, nation: 'german' });
            o('sabre', 36, { mode: 'fight', moving: true, anim: 0, nation: 'cossack' });
            o('sabre', 51, { mode: 'fight', moving: true, anim: 1, swing: 1, nation: 'tatar' });
        }
    });
}
function supplyArt(k) {
    return artURL('u' + k, 48, 36, (g, W, H) => {
        g.fillStyle = PAL.paperHi;
        g.fillRect(0, 0, W, H);
        g.fillStyle = PAL.ground;
        g.fillRect(0, H - 9, W, 9);
        g.fillStyle = INK;
        g.fillRect(0, H - 9, W, 1);
        const F = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
        if (k === 'bread') {
            [[8, 20], [24, 20], [16, 12]].forEach(([x, y]) => { F(x, y, 14, 7, PAL.ochre); F(x + 1, y - 1, 12, 1, PAL.ochre); F(x, y + 7, 14, 1, INK); F(x + 3, y + 1, 2, 1, '#e6c47a'); F(x + 7, y + 1, 2, 1, '#e6c47a'); F(x + 11, y + 2, 1, 1, '#e6c47a'); });
        }
        else {
            F(9, 10, 16, 18, '#4b3420');
            F(10, 9, 14, 1, '#4b3420');
            F(9, 13, 16, 1, INK);
            F(9, 24, 16, 1, INK);
            F(15, 17, 4, 4, INK);
            F(28, 18, 11, 4, PAL.paper);
            F(26, 20, 4, 3, PAL.paper);
            F(38, 16, 3, 3, PAL.wood);
            F(28, 22, 11, 1, INK);
        }
    });
}
// The quest's cargo (and, but for the raft, the man who guards it) for its card. frac is not used.
function questArt(q, frac) {
    return artURL('q' + q.id, 72, 36, (g, W, H) => {
        landscape(g, W, H, q.id.length, PLACES[q.from].land);
        if (q.transport === 'raft') {
            drawCargo(g, 'raft', 16, H - 6, 1, false);
            return;
        }
        if (q.transport === 'herd') {
            drawCargo(g, 'herd', 6, H - 6, 1, false);
            drawSoldier(g, 66, H - 3, { cls: 'sabre', skin: 'own', face: -1, mode: 'idle', anim: 0, nation: 'cossack' });
            return;
        }
        drawCargo(g, q.transport, 22, H - 8, 0.8, false);
        drawSoldier(g, 8, H - 3, { cls: q.transport === 'chest' ? 'shot' : 'pike', skin: 'own', face: 1, mode: 'idle', anim: 0, nation: q.transport === 'chest' ? 'pole' : 'german' });
    });
}
/* ---------- the pictures of the encyclopedia: lands and places, and men of a nation, a class or a people standing together ---------- */
/** A land as it looks on the field, whole, on a day of this weather. */
function landArt(land, weather = 'clear') {
    const key = 'land' + land + weather;
    return artCache[key] || (artCache[key] = backdropOf(land, 0, weather).toDataURL());
}
/** A place a fight is fought at, in a land where it is: the window of a card on it, with nobody there. */
function siteArt(site, land) {
    return artURL('site' + site + land, 72, 36, (g, W, H) => landscape(g, W, H, 0, land, site));
}
/** Men standing together on a card's landscape: each is where he stands along the picture (scene pixels, from the left) and what he looks like. */
function squadArt(key, W, seed, land, men) {
    return artURL(key, W, 36, (g, w, h) => { landscape(g, w, h, seed, land); for (const [x, look] of men)
        drawSoldier(g, x, h - 3, look); });
}
/** The classes a nation fields, each once, in the order its Origin lists them. */
const classesOf = (o) => o.cls.filter((c, i) => o.cls.indexOf(c) === i);
// A nation of the company: one man of each class it fields, side by side, in the better kit a man comes to.
function nationArt(o, land) {
    const cs = classesOf(o), at = cs.length === 1 ? [36] : cs.length === 2 ? [20, 50] : [14, 36, 58];
    return squadArt('cn' + o.id, 72, o.id.length, land, cs.map((cls, i) => [at[i], { cls, skin: 'own', nation: o.id, face: 1, mode: 'idle', anim: 0, wpn: i ? 2 : 1, arm: i ? 2 : 1, man: 3 + i * 2 }]));
}
// One unit of a nation: the worst kit a man of it starts with and the best he may come to, side by side.
function unitArt(o, cls, land) {
    const look = (lv, man) => ({ cls, skin: 'own', nation: o.id, face: 1, mode: 'idle', anim: 0, wpn: lv, arm: lv, man });
    return squadArt('cu' + o.id + cls, 72, o.id.length + 1, land, [[22, look(0, 3)], [52, look(3, 8)]]);
}
// A class: four men of the nations that field it, from the worst kit to the best.
function classArt(cls) {
    const from = ORIGINS.filter(o => o.cls.includes(cls)).slice(0, 4);
    return squadArt('cc' + cls, 100, cls.length, 'poland', from.map((o, i) => [14 + i * 24, { cls, skin: 'own', nation: o.id, face: 1, mode: 'idle', anim: 0, wpn: i, arm: i, man: 3 + i * 2 }]));
}
// The armours: one sabreur in each of the four, worst to best.
function armourArt() {
    return squadArt('car', 100, 5, 'poland', [0, 1, 2, 3].map((lv) => [14 + lv * 24, { cls: 'sabre', skin: 'own', nation: 'pole', face: 1, mode: 'idle', anim: 0, wpn: 1, arm: lv, man: 3 + lv * 2 }]));
}
// A people met on the road: a man of each class it fields, facing the company, in the gear its degree of drill carries (see TIER).
function peopleArt(skin, classes, tier, land) {
    const at = classes.length === 1 ? [40] : classes.length === 2 ? [26, 54] : [20, 42, 64], gear = Math.max(0, tier - 1);
    return squadArt('cp' + skin + classes.join('') + tier, 72, skin.length, land, classes.map((cls, i) => [at[i], { cls, skin, face: -1, mode: 'idle', anim: 0, wpn: gear, arm: gear, man: 2 + i * 3 }]));
}
// A corner of the camp at night, for the cards of camp events.
function eventArt() {
    return artURL('night', 96, 32, (g, W, H) => {
        const F = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
        F(0, 0, W, H, '#1f2a3e');
        F(0, 12, W, 6, '#26324a');
        [[9, 3], [22, 6], [47, 2], [74, 5], [60, 8], [88, 4]].forEach(p => F(p[0], p[1], 1, 1, PAL.paperHi));
        F(0, 18, W, 14, '#2b3446');
        F(0, 23, W, 9, '#3b3325');
        const gr = g.createRadialGradient(48, 24, 2, 48, 24, 26);
        gr.addColorStop(0, 'rgba(240,170,60,.55)');
        gr.addColorStop(1, 'rgba(240,170,60,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
        F(40, 21, 4, 1, '#d8642a');
        F(52, 21, 4, 1, '#d8642a');
        drawCamper(g, 36, 27, { cls: 'sabre', skin: 'own', pose: 'sit', face: 1, prop: 'bandura', nation: 'cossack' });
        drawCamper(g, 61, 27, { cls: 'pike', skin: 'own', pose: 'sit', face: -1, nation: 'scot' });
        F(46, 26, 6, 2, '#4b3420');
        F(46, 22, 6, 4, '#c2412b');
        F(47, 20, 4, 4, PAL.flash);
        F(48, 18, 2, 2, PAL.flash);
        F(48, 23, 2, 2, '#fff3c4');
    });
}
/* ---------- the camp at night: the company round its fire, each man where his order puts him ---------- */
const CW = 320, CH = 151;
const CAMP = {
    rest: [[130, 100, 1], [141, 90, 1], [179, 90, -1], [190, 100, -1], [136, 114, 1], [184, 114, -1], [150, 124, 1], [172, 124, -1]],
    drill: [[204, 126, 1], [228, 112, 1], [274, 132, 1], [196, 142, 1], [226, 140, 1], [258, 147, -1], [288, 144, -1], [242, 129, -1]],
    forage: [[20, 130, -1], [40, 138, -1], [10, 118, -1], [59, 142, -1], [30, 146, -1], [50, 124, -1], [70, 134, -1], [16, 146, -1]],
    abed: [[103, 88, 1], [87, 95, 1], [119, 95, -1], [103, 101, 1], [88, 106, 1], [118, 107, -1], [96, 112, 1], [112, 116, -1]],
    staff: { surgeon: [124, 86, -1], drill: [252, 121, -1], qm: [76, 98, -1], chaplain: [242, 90, -1] },
    captain: [213, 87, -1], retainer: [258, 114, -1]
};
// Where each man of the roll belongs tonight, and what he is doing there.
function campPlan(st) {
    const n = { rest: 0, drill: 0, forage: 0, abed: 0 }, out = [];
    let bard = false;
    for (const s of st.roster) {
        const k = s.wound ? 'abed' : s.order, list = CAMP[k], slot = list[Math.min(n[k]++, list.length - 1)];
        let prop = null;
        if (k === 'rest' && !bard && s.origin === 'Zaporozhian') {
            prop = 'bandura';
            bard = true;
        }
        else if (k === 'rest' && s.id % 3 === 1)
            prop = 'pipe';
        out.push({ id: s.id, s, k, x: slot[0], y: slot[1], f: slot[2], prop });
    }
    return out;
}
function campBack(st) {
    const c = sceneCanvas(CW, CH);
    const g = c.getContext('2d'), F = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const poly = (pts, col) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2)
        g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = col; g.fill(); };
    const r = mulberry(st.date * 31 + 7), stars = [];
    for (let i = 0; i < 46; i++) {
        const x = r() * CW | 0, y = r() * 58 | 0;
        if (Math.hypot(x - 52, y - 17) < 11)
            continue;
        stars.push({ x, y, k: r() * 6, big: r() < 0.08 });
    }
    poly([0, 74, 320, 74, 320, 151, 0, 151], '#192132');
    g.drawImage(skylineOf(here(st).land, st.date % 3 + 1, CW), 0, 81 - HZ, CW, HZ);
    poly([0, 83, 40, 80, 90, 83, 140, 79, 200, 82, 250, 79, 320, 81, 320, 151, 0, 151], '#221c15');
    F(0, 134, CW, 17, '#1a1510');
    for (let i = 0; i < 26; i++)
        F(r() * CW | 0, 86 + (r() * 62 | 0), 2 + (r() * 2 | 0), 1, '#2c241a');
    const tent = (l, rr, top, base, peak) => { poly([peak, top, l, base, rr, base], '#6c624f'); poly([peak, top, rr, base, peak + (rr - peak) * 0.5, base], '#564e40'); poly([peak, top + (base - top) * 0.34, peak - (rr - l) * 0.135, base, peak + (rr - l) * 0.135, base], '#120f0b'); F(peak - 0.5, top - 4, 1, 4, PAL.wood); };
    tent(75, 130, 49, 84, 102.5);
    tent(190, 235, 48, 80, 212.5);
    F(198, 68, 29, 2, '#7a2230');
    poly([213, 43, 220, 43, 218, 44.5, 220, 46, 213, 46], PAL.red);
    F(159, 20, 2, 62, '#5a3f26');
    F(158, 17, 4, 3, PAL.ochre);
    drawCargo(g, questOf(st).transport, 18, 92, st.cargo0 ? st.cargo / st.cargo0 : 1, true);
    F(236, 111, 2, 16, '#4b3420');
    F(233, 111, 8, 9, '#8a6d2c');
    F(231, 113, 12, 1.5, '#4b3420');
    F(233, 114, 8, 1, '#6e5622');
    F(233, 117, 8, 1, '#6e5622');
    for (const [x, y, f] of CAMP.rest) {
        const lx = f > 0 ? x - 4 : x - 3;
        F(lx, y - 4, 7, 3, '#4b3420');
        F(lx, y - 4, 7, 1, PAL.wood);
    }
    g.strokeStyle = '#3a2a1a';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(160, 79);
    g.lineTo(153, 103);
    g.moveTo(160, 79);
    g.lineTo(167, 103);
    g.stroke();
    F(160, 79, 1, 7, PAL.steel);
    F(156, 86, 8, 1, PAL.steel);
    F(157, 87, 6, 3, INK);
    F(146, 117, 9, 3, '#6b5338');
    F(154, 116, 3, 3, '#6b5338');
    F(155, 115, 1, 1, '#3a2a1a');
    F(145, 118, 1, 1, '#6b5338');
    // the noticeboard, with a paper pinned on it for each piece of work posted here, and the signpost where the roads leave
    if (has(st, 'work')) {
        F(262, 77, 2, 28, '#3a2a1a');
        F(282, 77, 2, 28, '#3a2a1a');
        F(259, 68, 28, 2, '#4b3420');
        F(260, 70, 26, 22, '#5a3f27');
        F(260, 70, 26, 1, PAL.wood);
        F(260, 91, 26, 1, '#3a2a1a');
        for (let i = 0; i < Math.min(st.contracts.length, 4); i++) {
            const x = 262 + (i % 2) * 11, y = 72 + Math.floor(i / 2) * 9;
            F(x, y, 9, 7, '#a89f8a');
            F(x + 1, y + 1, 7, 1, '#6b6455');
            F(x + 1, y + 3, 5, 1, '#6b6455');
            F(x + 4, y - 1, 1, 2, '#7a2230');
        }
    }
    F(304, 62, 2, 44, '#3a2a1a');
    F(302, 60, 6, 3, '#4b3420');
    for (let i = 0; i < Math.min(roadsFrom(st).length, 3); i++) {
        const y = 66 + i * 9;
        if (i % 2 === 0) {
            poly([292, y + 3, 296, y, 307, y, 307, y + 6, 296, y + 6], '#6b5338');
            F(297, y + 2, 8, 1, '#3a2a1a');
        }
        else {
            poly([318, y + 3, 314, y, 303, y, 303, y + 6, 314, y + 6], '#6b5338');
            F(305, y + 2, 8, 1, '#3a2a1a');
        }
    }
    c.stars = stars;
    return c;
}
const NIGHT_LIGHT = { d: 0, w: 0, sun: null, moon: 1 };
function lightAt(q) {
    const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const d = sm(0.12, 0.34, q) * (1 - sm(0.66, 0.88, q)), sq = (q - 0.14) / 0.72;
    return { d, w: Math.min(1, Math.max(0, 1 - Math.abs(q - 0.22) / 0.12) + Math.max(0, 1 - Math.abs(q - 0.78) / 0.12)), sun: sq > 0 && sq < 1 ? sq : null, moon: 1 - d };
}
const SKY_NIGHT = ['#0f1520', '#141c2b', '#1e2a42'], SKY_DAY = ['#5a8dc0', '#78a6cf', '#9fbed3'], SKY_GLOW = ['#4a3b66', '#c9805a', '#f0b27a'];
/** The sky over the camp: its bands, its stars, the moon and, by day, the sun, as the light has them. At night it is the sky the camp was always drawn under. */
function campSky(g, stars, L) {
    const F = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const band = (i) => mixHex(mixHex(SKY_NIGHT[i], SKY_DAY[i], L.d), SKY_GLOW[i], L.w * 0.6 * (1 - 0.4 * L.d));
    F(0, 0, CW, CH, band(0));
    F(0, 34, CW, 40, band(1));
    F(0, 58, CW, 24, band(2));
    const a = 0.75 * (1 - clamp(L.d * 2.4, 0, 1));
    if (a > 0.02) {
        g.globalAlpha = a;
        for (const s of stars)
            F(s.x, s.y, s.big ? 2 : 1, s.big ? 2 : 1, '#e6dfcc');
        g.globalAlpha = 1;
    }
    if (L.moon > 0.02) {
        g.globalAlpha = L.moon;
        g.fillStyle = PAL.paperHi;
        g.beginPath();
        g.arc(52, 17, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = band(0);
        g.beginPath();
        g.arc(55.5, 15, 6.3, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
    }
    if (L.sun !== null) {
        const x = 300 - 280 * L.sun, y = 78 - 64 * Math.sin(Math.PI * L.sun);
        g.fillStyle = 'rgba(246,220,151,.22)';
        g.beginPath();
        g.arc(x, y, 13, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(246,220,151,.4)';
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#fbeeb8';
        g.beginPath();
        g.arc(x, y, 6, 0, Math.PI * 2);
        g.fill();
    }
}
function newCamp(cv, pos) {
    const buf = sceneCanvas(CW, CH), sel = sceneCanvas(44, 44); // SS times finer than the scene, for the figures (see SS)
    const v = { cv, ctx: cv.getContext('2d'), buf, g: buf.getContext('2d'), sel, back: null, key: '', pos: pos || {}, parts: [], t: 0, btns: null };
    fitCamp(v);
    return v;
}
function fitCamp(v) {
    const w = v.cv.clientWidth || 640, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(w * dpr), H = Math.round(W * CH / CW);
    if (v.cv.width !== W || v.cv.height !== H) {
        v.cv.width = W;
        v.cv.height = H;
    }
}
function campFlag(g, t) {
    for (let x = 0; x < 23; x++) {
        const off = Math.round(Math.sin(t * 3.2 - x * 0.45) * (x / 22) * 1.4), X = 161 + x, Y = 22 + off;
        g.fillStyle = PAL.red;
        if (x < 19)
            g.fillRect(X, Y, 1, 11);
        else {
            const gap = (x - 18) * 2 - 1;
            g.fillRect(X, Y, 1, (11 - gap) >> 1);
            g.fillRect(X, Y + 11 - ((11 - gap) >> 1), 1, (11 - gap) >> 1);
        }
        g.fillStyle = PAL.ochre;
        if (x === 9 || x === 10)
            g.fillRect(X, Y + 2, 1, 7);
        if (x >= 7 && x <= 12)
            g.fillRect(X, Y + 4, 1, 2);
    }
}
function campFire(g, t, still) {
    const F = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(154 + x, 89 + y, w, h); };
    F(0, 12, 12, 2, '#4b3420');
    F(2, 12, 8, 1, PAL.wood);
    F(2, 11, 8, 1, '#d8642a');
    if (still || Math.floor(t * 4.8) % 2) {
        F(2, 7, 8, 4, '#c2412b');
        F(3, 5, 6, 5, PAL.flash);
        F(5, 8, 2, 2, '#fff3c4');
        F(4, 3, 2, 2, PAL.flash);
        F(7, 2, 1, 3, PAL.flash);
        F(2, 5, 1, 2, '#c2412b');
        F(9, 6, 1, 2, '#c2412b');
    }
    else {
        F(2, 8, 8, 3, '#c2412b');
        F(3, 6, 6, 4, PAL.flash);
        F(5, 8, 2, 2, '#fff3c4');
        F(6, 2, 2, 4, PAL.flash);
        F(3, 4, 1, 2, PAL.flash);
        F(9, 5, 1, 3, '#c2412b');
        F(1, 7, 1, 2, '#c2412b');
    }
}
const ledgerOf = (st) => ({ thalers: st.thalers, bread: st.bread, powder: st.powder, renown: st.renown, cargo: st.cargo });
// Draw the camp. dt is the time since the last frame; still draws it at rest, as for reduced motion; pass is a day going by, which changes the light and sends men out and in.
function drawCamp(v, st, sel, dt, still, pass) {
    if (!v || !st)
        return;
    v.t += dt;
    const t = v.t, g = v.g, key = st.quest + st.at + st.date + ':' + (st.cargo0 ? Math.round(5 * st.cargo / st.cargo0) : 0) + ':' + st.contracts.length;
    const u = pass ? clamp(pass.t / pass.dur, 0, 1) : 0, L = pass ? lightAt((u * pass.days) % 1) : NIGHT_LIGHT;
    let fade = 0; // how far the picture has gone to black, between the camp a march leaves and the one it comes to
    if (pass && pass.kind === 'march') {
        fade = Math.max(0, 1 - Math.abs(u - 0.5) / 0.12);
        if (u >= 0.5 && !pass.swapped) {
            pass.swapped = true;
            v.back = campBack(st);
            v.key = key;
            for (const p of campPlan(st))
                v.pos[p.id] = { x: -26, y: p.y };
        }
    }
    if (!v.back) {
        v.back = pass && pass.oldBack && !pass.swapped ? pass.oldBack : campBack(st);
        v.key = key;
    }
    else if (!pass && v.key !== key) {
        v.back = campBack(st);
        v.key = key;
    }
    campSky(g, v.back.stars, L);
    g.globalAlpha = 1;
    g.drawImage(v.back, 0, 0, CW, CH);
    if (!still && L.d < 0.5)
        for (const s of v.back.stars)
            if (s.k < 2) {
                g.globalAlpha = (0.5 + 0.5 * Math.sin(t * 1.3 + s.k * 9)) * (1 - 2 * L.d);
                g.fillStyle = PAL.paperHi;
                g.fillRect(s.x, s.y, 1, 1);
            }
    g.globalAlpha = 1;
    campFlag(g, still ? 0 : t);
    const plan = campPlan(st);
    for (const p of plan) {
        // a day passing sends the foragers out and brings them back; a march sends everybody out of one camp and into the next
        if (pass && pass.kind === 'rest' && p.k === 'forage' && u > 0.08 && u < 0.6)
            p.x = -18;
        if (pass && pass.kind === 'march' && !pass.swapped)
            p.x = CW + 26;
        let c = v.pos[p.id];
        if (!c || still)
            c = v.pos[p.id] = { x: p.x, y: p.y };
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), speed = pass ? (pass.kind === 'march' ? 150 : 64) : 42;
        if (d > 0.6) {
            const m = Math.min(d, speed * dt);
            c.x += dx / d * m;
            c.y += dy / d * m;
            c.moving = true;
            c.face = dx >= 0 ? 1 : -1;
            c.anim = (c.anim || 0) + dt * 6;
        }
        else {
            c.x = p.x;
            c.y = p.y;
            c.moving = false;
        }
    }
    const draw = (gg, p, x, y) => {
        const c = v.pos[p.id], s = p.s;
        const me = { cls: s.cls, skin: 'own', wpn: s.wpn, arm: s.arm, man: s.id, nation: nationOf(s.origin) };
        if (c.moving)
            return drawCamper(gg, x, y, { ...me, face: c.face, mode: 'idle', moving: true, anim: c.anim });
        if (p.k === 'abed')
            return drawCamper(gg, x, y, { ...me, face: p.f, pose: 'lie' });
        if (p.k === 'rest')
            return drawCamper(gg, x, y, { ...me, face: p.f, pose: 'sit', prop: p.prop, strum: Math.floor(t * 5) % 2 });
        if (p.k === 'forage')
            return drawCamper(gg, x, y, { ...me, face: p.f, pose: 'forage', anim: t * 1.6 + p.id });
        const ph = (t + p.id * 0.7) % 3;
        if (s.cls === 'sabre')
            return drawCamper(gg, x, y, { ...me, face: p.f, mode: 'fight', swing: ph % 1 < 0.35 ? 1 : 0 });
        if (s.cls === 'shot')
            return drawCamper(gg, x, y, { ...me, face: p.f, mode: ph > 1.2 ? 'aim' : 'idle', flash: ph > 2.6 && ph < 2.75 ? 1 : 0 });
        return drawCamper(gg, x, y, { ...me, face: p.f, mode: 'idle', level: ph % 1.5 > 0.75 });
    };
    for (const p of plan.slice().sort((a, b) => v.pos[a.id].y - v.pos[b.id].y)) {
        const c = v.pos[p.id], x = Math.round(c.x * SS) / SS, y = Math.round(c.y * SS) / SS;
        if (p.id === sel) {
            const sg = v.sel.getContext('2d');
            sg.clearRect(0, 0, 44, 44);
            draw(sg, p, 22, 40);
            sg.globalCompositeOperation = 'source-in';
            sg.fillStyle = '#e8c46a';
            sg.fillRect(0, 0, 44, 44);
            sg.globalCompositeOperation = 'source-over';
            for (const o of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]])
                g.drawImage(v.sel, x - 22 + o[0] / SS, y - 40 + o[1] / SS, 44, 44);
        }
        draw(g, p, x, y);
    }
    for (const o of officersOf(st)) {
        const s = CAMP.staff[o.station];
        drawPerson(g, s[0], s[1], OFFICER_LOOK[o.kind], s[2]);
    }
    if (st.retainer) {
        const s = CAMP.retainer;
        drawPerson(g, s[0], s[1], RETAINER_LOOK[st.retainer.type], s[2]);
    }
    {
        const c = CAPTAINS[st.captain.type], s = CAMP.captain;
        drawCamper(g, s[0], s[1], { cls: c.cls, skin: 'own', face: s[2], mode: 'idle', wpn: 2, arm: 2, man: st.captain.name.length, nation: c.origin, rank: 'captain' });
    }
    // the light of the day lifts what the night left dark, and warms it at dawn and dusk
    if (L.d > 0.01 || L.w > 0.01) {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(150,130,96,' + (0.5 * L.d).toFixed(3) + ')';
        g.fillRect(0, 0, CW, CH);
        g.fillStyle = 'rgba(150,66,12,' + (0.26 * L.w).toFixed(3) + ')';
        g.fillRect(0, 0, CW, CH);
        g.globalCompositeOperation = 'source-over';
    }
    const fl = still ? 1 : 1 + 0.05 * Math.sin(t * 7.1) + 0.03 * Math.sin(t * 17.3);
    let gr = g.createRadialGradient(160, 100, 40, 160, 100, 230);
    gr.addColorStop(0, 'rgba(5,8,14,0)');
    gr.addColorStop(1, 'rgba(5,8,14,' + (0.55 * (1 - 0.7 * L.d)).toFixed(3) + ')');
    g.fillStyle = gr;
    g.fillRect(0, 0, CW, CH);
    gr = g.createRadialGradient(160, 100, 2, 160, 100, 100 * fl);
    gr.addColorStop(0, 'rgba(240,170,60,' + (0.36 * (1 - L.d)).toFixed(3) + ')');
    gr.addColorStop(0.35, 'rgba(216,100,42,' + (0.15 * (1 - L.d)).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(216,100,42,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, CW, CH);
    campFire(g, t, still);
    if (!still) {
        if (Math.random() < dt * 5)
            v.parts.push({ k: 'e', x: 157 + Math.random() * 6, y: 94, vx: rnd(-3, 5), vy: rnd(-34, -20), life: 0, max: rnd(1.2, 2.4) });
        if (Math.random() < dt * 1.2)
            v.parts.push({ k: 's', x: 159 + Math.random() * 3, y: 84, vx: rnd(-1, 1), vy: -4, life: 0, max: 2.6 });
        for (const p of plan) {
            const c = v.pos[p.id];
            if (c.moving || p.k !== 'rest')
                continue;
            if (p.prop === 'bandura' && Math.random() < dt * 0.6)
                v.parts.push({ k: 'n', x: c.x + p.f * 3, y: c.y - 16, vx: p.f * 4, vy: -11, life: 0, max: 3 });
            if (p.prop === 'pipe' && Math.random() < dt * 0.5)
                v.parts.push({ k: 's', x: c.x + p.f * 5, y: c.y - 14, vx: p.f * 2, vy: -5, life: 0, max: 2.2 });
        }
        for (let i = v.parts.length - 1; i >= 0; i--) {
            const p = v.parts[i];
            p.life += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.life >= p.max) {
                v.parts.splice(i, 1);
                continue;
            }
            const a = 1 - p.life / p.max;
            g.globalAlpha = Math.min(1, a * 1.6);
            if (p.k === 'e') {
                g.fillStyle = a > 0.5 ? PAL.flash : '#d8642a';
                g.fillRect(p.x | 0, p.y | 0, 1, 1);
            }
            else if (p.k === 's') {
                g.fillStyle = PAL.smoke;
                g.fillRect(p.x | 0, p.y | 0, 1, 1);
            }
            else {
                g.fillStyle = '#e8c46a';
                const x = p.x | 0, y = p.y | 0;
                g.fillRect(x, y, 1, 4);
                g.fillRect(x - 2, y + 3, 2, 2);
                g.fillRect(x + 1, y, 1, 1);
                g.fillRect(x + 2, y + 1, 1, 1);
            }
        }
        g.globalAlpha = 1;
    }
    if (fade > 0) {
        g.fillStyle = 'rgba(8,6,4,' + fade.toFixed(3) + ')';
        g.fillRect(0, 0, CW, CH);
    }
    present(v.ctx, v.buf, v.cv.width, v.cv.height);
    // keep the clickable figures over the drawn ones as they walk
    if (v.btns)
        for (const b of v.btns) {
            const p = v.pos[b.dataset.id];
            if (!p)
                continue;
            const L = ((p.x - 9) / CW * 100).toFixed(2) + '%', T = ((p.y - (b.dataset.k === 'abed' ? 8 : b.dataset.k === 'rest' ? 18 : 31)) / CH * 100).toFixed(2) + '%';
            if (b.style.left !== L)
                b.style.left = L;
            if (b.style.top !== T)
                b.style.top = T;
        }
}
