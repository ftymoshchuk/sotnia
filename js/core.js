"use strict";
/* ===== SOTNIA core rules: no DOM in this block ===== */
// st, in most of the functions below, is the campaign: its type, Campaign, is declared in journey.ts above newGame().
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const chance = (p) => Math.random() < p;
const ROSTER_MAX = 8;
const CLS = {
    pike: { name: 'Pikeman', skill: 'Pike', vig: 66, mel: 9, aim: 0, grd: 7, spd: 15, reach: 19, cd: 1.5, dmg: [9, 14], arm: 3 },
    shot: { name: 'Musketeer', skill: 'Aim', vig: 48, mel: 5, aim: 9, grd: 4, spd: 17, reach: 8, cd: 1.3, dmg: [4, 7], arm: 0 },
    sabre: { name: 'Sabreur', skill: 'Blade', vig: 55, mel: 11, aim: 0, grd: 9, spd: 27, reach: 9, cd: 0.85, dmg: [7, 11], arm: 1 }
};
// Weapon and armour names by gear level, 0 to 3. GEAR_COST[n] is the price of raising either one from level n.
const WPN = {
    pike: ['Ash pike', 'Ironbound pike', 'Partisan', "Master's halberd"],
    shot: ['Old arquebus', 'Matchlock musket', 'Dutch musket', 'Wheel-lock'],
    sabre: ['Notched sabre', 'Hungarian sabre', 'Karabela', 'Damascened sabre']
};
const ARM = ['Linen shirt', 'Buff coat', 'Breastplate', 'Cuirass and tassets'];
const GEAR_COST = [22, 40, 65];
// Foes come in tiers 0 to 3, by how well drilled and armed they are. COST is what a unit of each tier adds to a contract's strength.
const TIER = ['rabble', 'trained', 'veteran', 'elite'];
const COST = [0.5, 1, 1.6, 2.4];
const ORIGINS = [
    { id: 'cossack', label: 'Zaporozhian', cls: ['sabre', 'sabre', 'shot'],
        first: ['Ostap', 'Taras', 'Danylo', 'Maksym', 'Pavlo', 'Hryts', 'Semen', 'Fedir'],
        last: ['Vovk', 'Shram', 'Bily', 'Chorny', 'Holota', 'Kryvy', 'Zaliznyi', 'Perebyinis'] },
    { id: 'pole', label: 'Polish', cls: ['sabre', 'pike', 'sabre'],
        first: ['Jan', 'Stanisław', 'Wojciech', 'Mikołaj', 'Jędrzej', 'Kacper', 'Paweł', 'Marcin'],
        last: ['Wilk', 'Sokół', 'Żuraw', 'Lis', 'Dąb', 'Bystry', 'Gozdawa', 'Zaręba'] },
    { id: 'german', label: 'German', cls: ['pike', 'shot', 'pike'],
        first: ['Hans', 'Jörg', 'Kaspar', 'Matthias', 'Ulrich', 'Veit', 'Konrad', 'Lorenz'],
        last: ['Schwarz', 'Lang', 'Kohl', 'Eisen', 'Roth', 'Krumm', 'Hartung', 'Vogel'] },
    { id: 'swede', label: 'Swedish', cls: ['shot', 'pike', 'shot'],
        first: ['Lars', 'Nils', 'Erik', 'Olof', 'Per', 'Anders', 'Sven', 'Mats'],
        last: ['Björn', 'Stål', 'Ek', 'Storm', 'Lind', 'Berg', 'Hjort', 'Falk'] },
    { id: 'scot', label: 'Scottish', cls: ['pike', 'shot', 'pike'],
        first: ['Angus', 'Duncan', 'Hamish', 'Robert', 'Ewan', 'Alasdair', 'Colin', 'Gavin'],
        last: ['Ross', 'Sinclair', 'Gordon', 'Hay', 'Innes', 'Forbes', 'Keith', 'Ramsay'] },
    { id: 'magyar', label: 'Hungarian', cls: ['sabre', 'shot', 'sabre'],
        first: ['István', 'Miklós', 'János', 'Gergely', 'Bálint', 'Mátyás', 'Ferenc', 'András'],
        last: ['Nagy', 'Kis', 'Farkas', 'Vörös', 'Fekete', 'Szabó', 'Varga', 'Balogh'] },
    { id: 'croat', label: 'Croat', cls: ['sabre'],
        first: ['Ivo', 'Marko', 'Luka', 'Josip', 'Stjepan', 'Petar'],
        last: ['Babić', 'Jurić', 'Knežević', 'Horvat', 'Marić', 'Kovač'] },
    { id: 'tatar', label: 'Lipka Tatar', cls: ['sabre'],
        first: ['Aslan', 'Murad', 'Selim', 'Kerim', 'Dawid', 'Adam'],
        last: ['Assan', 'Murza', 'Ułan', 'Bohdan', 'Alej', 'Tuhan'] }
];
const TRAITS = {
    'Steadfast': { good: true, desc: 'Never breaks and runs.' },
    'Keen-eyed': { good: true, desc: 'Shoots straighter than his fellows.' },
    'Brawler': { good: true, desc: 'Hits harder in the press.' },
    'Fleet': { good: true, desc: 'Covers ground quickly.' },
    'Hardy': { good: true, desc: 'Takes more killing than most.' },
    'Lucky': { good: true, desc: 'Tends to survive what should kill him.' },
    'Skittish': { good: false, desc: 'Runs sooner than the others.' },
    'Grasping': { good: false, desc: 'Wants three thalers more a month.' }
};
const SCARS = [
    { label: 'a ruined hand', fn: s => { if (s.cls === 'shot')
            s.aim = Math.max(1, s.aim - 2);
        else
            s.mel = Math.max(1, s.mel - 2); } },
    { label: 'a limp', fn: s => { s.grd = Math.max(1, s.grd - 2); } },
    { label: 'a rib that never set', fn: s => { s.vig = Math.max(24, s.vig - 6); s.hp = Math.min(s.hp, s.vig); } },
    { label: 'one eye', fn: s => { if (s.cls === 'shot')
            s.aim = Math.max(1, s.aim - 3);
        else
            s.grd = Math.max(1, s.grd - 1); } }
];
const STAFF = {
    surgeon: { name: 'Barber-surgeon', fee: 40, wage: 6, desc: 'Rest heals faster. Men struck down die less often.' },
    drill: { name: 'Drillmaster', fee: 45, wage: 6, desc: 'A day of drill teaches half as much again.' },
    qm: { name: 'Quartermaster', fee: 30, wage: 3, desc: 'The company eats a quarter less. Market prices fall 15%.' },
    chaplain: { name: 'Field chaplain', fee: 25, wage: 3, desc: 'Spirits rise a little every day.' }
};
/* ---------- soldiers ---------- */
function applyPromo(s, k) {
    if (k === 'vig') {
        s.vig += 8;
        s.hp = Math.min(s.vig, (s.hp || 0) + 8);
    }
    else if (k === 'skill') {
        if (s.cls === 'shot')
            s.aim += 2;
        else
            s.mel += 2;
    }
    else
        s.grd += 2;
}
function makeSoldier(st, cls, level, origin) {
    origin = origin || pick(ORIGINS.filter(o => o.cls.includes(cls)));
    const c = CLS[cls];
    const s = {
        id: st.nextId++, name: pick(origin.first) + ' ' + pick(origin.last), origin: origin.label, cls,
        level: 1, xp: 0, vig: c.vig + ri(-4, 4), mel: c.mel + ri(-1, 1), aim: c.aim ? c.aim + ri(-1, 1) : 0,
        grd: c.grd + ri(-1, 1), wpn: 0, arm: 0, morale: ri(55, 72), trait: null, order: 'drill',
        wound: 0, kills: 0, promos: 0, scars: [], fought: false
    }; // hp follows, once vig is settled
    if (chance(0.6))
        s.trait = pick(Object.keys(TRAITS));
    if (s.trait === 'Keen-eyed' && cls !== 'shot')
        s.trait = 'Brawler';
    if (s.trait === 'Hardy')
        s.vig += 10;
    s.hp = s.vig;
    for (let i = 1; i < level; i++) {
        s.level++;
        applyPromo(s, pick(['vig', 'skill', 'grd']));
    }
    s.hp = s.vig;
    return s;
}
const xpNeed = (level) => 30 + level * 18;
const wageOf = (s) => 3 + 2 * s.level + (s.trait === 'Grasping' ? 3 : 0); // thalers a month
const rating = (s) => s.vig / 8 + s.mel + (s.cls === 'shot' ? s.aim : 0) + s.grd * 0.6 + s.wpn * 2 + s.arm * 2;
function levelUps(st, L) {
    for (const s of st.roster) {
        while (s.xp >= xpNeed(s.level)) {
            s.xp -= xpNeed(s.level);
            s.level++;
            s.promos++;
            if (L)
                L.push(s.name + ' has earned a promotion.');
        }
    }
}
function promote(st, id, k) {
    const s = st.roster.find(r => r.id === id);
    if (!s || s.promos < 1)
        return false;
    s.promos--;
    applyPromo(s, k);
    return true;
}
const TVIG = [0.72, 0.9, 1.05, 1.2], TSK = [-3, 0, 2, 4], TMOR = [34, 48, 62, 78];
function enemyUnit(cls, tier, skin) {
    const c = CLS[cls];
    return {
        cls, tier, skin, name: '', vig: Math.round(c.vig * TVIG[tier]), mel: c.mel + TSK[tier],
        aim: c.aim ? c.aim + TSK[tier] : 0, grd: c.grd + TSK[tier],
        wpn: Math.max(0, tier - 1), arm: Math.max(0, tier - 1), morale: TMOR[tier], trait: null
    };
}
/* ---------- economy ---------- */
const priceMul = (st) => (st.staff.qm ? 0.85 : 1);
const breadPrice = (st) => Math.round(4 * priceMul(st));
const powderPrice = (st) => Math.round(14 * priceMul(st));
const gearPrice = (st, tier) => Math.round(GEAR_COST[tier] * priceMul(st));
function wagesDue(st) {
    let w = 0;
    for (const s of st.roster)
        w += wageOf(s);
    for (const k in STAFF)
        if (st.staff[k])
            w += STAFF[k].wage;
    return w;
}
const breadDue = (st) => Math.ceil(st.roster.length * (st.staff.qm ? 0.75 : 1));
function logLine(st, t) { st.log.unshift({ d: st.day, n: st.date, t }); if (st.log.length > 120)
    st.log.length = 120; }
function genRecruits(st) {
    const top = clamp(1 + Math.floor(st.renown / 18), 1, 4);
    st.recruits = [];
    const want = ['pike', 'shot', 'sabre'].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 3; i++) {
        const lv = ri(1, top);
        const s = makeSoldier(st, want[i], lv, originFor(want[i], here(st).land));
        const good = s.trait && TRAITS[s.trait].good ? 6 : 0;
        const bad = s.trait && !TRAITS[s.trait].good ? -5 : 0;
        st.recruits.push({ s, price: Math.round((20 + lv * 14 + good + bad + ri(-2, 3)) * priceMul(st)) });
    }
}
function hire(st, i) {
    const r = st.recruits[i];
    if (!r || st.thalers < r.price || st.roster.length >= ROSTER_MAX)
        return false;
    st.thalers -= r.price;
    st.roster.push(r.s);
    st.recruits.splice(i, 1);
    logLine(st, r.s.name + ', ' + r.s.origin + ' ' + CLS[r.s.cls].name.toLowerCase() + ', makes his mark on the roll.');
    st.odds = {};
    return true;
}
function buy(st, what) {
    if (what === 'bread') {
        const p = breadPrice(st);
        if (st.thalers < p)
            return false;
        st.thalers -= p;
        st.bread += 10;
        return true;
    }
    if (what === 'powder') {
        const p = powderPrice(st);
        if (st.thalers < p)
            return false;
        st.thalers -= p;
        st.powder += 10;
        return true;
    }
    return false;
}
function upgrade(st, id, k) {
    const s = st.roster.find(r => r.id === id);
    if (!s || s[k] >= 3)
        return false;
    const p = gearPrice(st, s[k]);
    if (st.thalers < p)
        return false;
    st.thalers -= p;
    s[k]++;
    st.odds = {};
    return true;
}
function hireStaff(st, k) {
    if (st.staff[k] || st.thalers < STAFF[k].fee)
        return false;
    st.thalers -= STAFF[k].fee;
    st.staff[k] = true;
    logLine(st, 'A ' + STAFF[k].name.toLowerCase() + ' joins the baggage train.');
    return true;
}
function dismiss(st, id) {
    const s = st.roster.find(r => r.id === id);
    if (!s)
        return;
    st.roster = st.roster.filter(r => r !== s);
    logLine(st, s.name + ' is struck from the roll and sent on his way.');
    st.odds = {};
}
/* ---------- contracts ---------- */
const TEMPLATES = [
    { id: 'road', title: 'Road agents on the salt road', who: 'The salt-masters of Wieliczka',
        text: 'Cut-purses stop the carts between the mines and Kraków. Scatter them, and the salt-masters pay in coin.',
        skin: 'bandit', foe: 'road agents', mix: ['sabre', 'pike', 'sabre', 'shot'], tier: 1, ai: 'charge', min: 1, max: 16 },
    { id: 'mill', title: 'Deserters in the burnt mill', who: 'The starosta of Olkusz',
        text: 'Unpaid musketeers have dug into the mill and rob every traveller. They still have powder. Mind the first volley.',
        skin: 'deserter', foe: 'deserters', mix: ['shot', 'pike', 'shot'], tier: 1, ai: 'hold', min: 1, max: 18 },
    { id: 'ford', title: 'Raiders at the ford', who: 'Three villages on the Dunajec',
        text: 'Light horsemen burned the hamlets and now fight on foot among the reeds. They are quick and they come straight on.',
        skin: 'raider', foe: 'raiders', mix: ['sabre', 'sabre', 'sabre', 'shot'], tier: 1, ai: 'charge', min: 1, max: 23 },
    { id: 'toll', title: 'Storm the toll house', who: 'A cloth merchant of Breslau',
        text: 'The Imperial toll at the bridge bleeds his trade. He wants it emptied and will forget your names afterwards.',
        skin: 'imperial', foe: 'Imperial foot', mix: ['shot', 'pike', 'shot', 'pike'], tier: 1, ai: 'hold', min: 4, max: 23 },
    { id: 'wagons', title: 'Guard the powder wagons', who: 'The Crown artillery',
        text: "Six wagons for the Hetman's guns, and somebody has sold the route. Part of the pay comes in powder.",
        skin: 'bandit', foe: 'ambushers', mix: ['sabre', 'pike', 'shot', 'sabre', 'pike'], tier: 1, ai: 'charge', bonus: { powder: 10 }, min: 2, max: 23 },
    { id: 'river', title: 'Smugglers on the Vistula', who: 'The customs farmer of Sandomierz',
        text: 'Rafts of untaxed grain go downriver every night under guard. Meet the guard on the bank at dawn and the grain is forfeit.',
        skin: 'deserter', foe: 'hired guards', mix: ['pike', 'shot', 'sabre', 'shot'], tier: 1, ai: 'advance', min: 1, max: 15 },
    { id: 'quarrel', title: 'A quarrel over a mill-pond', who: 'A castellan with a grievance',
        text: 'Two noble houses dispute a pond, a weir and forty years of insults. One has hired you. The other has hired somebody else.',
        skin: 'champion', foe: "the neighbour's hirelings", mix: ['pike', 'sabre', 'shot', 'sabre', 'pike'], tier: 1, ai: 'advance', min: 3, max: 23 },
    { id: 'picket', title: 'Break the Swedish picket', who: "The Emperor's commissary",
        text: 'Blue-coats hold the crossroads with pike and shot, drilled in the new manner. Expect salvos, not single fire.',
        skin: 'swede', foe: 'Swedish foot', mix: ['shot', 'pike', 'shot', 'pike', 'shot'], tier: 2, ai: 'hold', min: 10, max: 23 },
    { id: 'forage', title: 'Imperial foragers', who: 'A Swedish quartermaster',
        text: 'Yellow-coats are stripping the valley of grain. Take it back and keep a share of the bread.',
        skin: 'imperial', foe: 'Imperial foot', mix: ['pike', 'sabre', 'pike', 'sabre', 'shot'], tier: 2, ai: 'advance', bonus: { bread: 14 }, min: 9, max: 23 }
];
const WEATHER = { clear: 'Clear', rain: 'Rain: matchlocks misfire', fog: 'Fog: short musket range' };
function rollWeather() { const r = Math.random(); return r < 0.6 ? 'clear' : r < 0.82 ? 'rain' : 'fog'; }
const GRADE = { easy: { dn: -1, dq: -0.5, pay: 1 }, fair: { dn: 0, dq: 0, pay: 1 }, hard: { dn: 1, dq: 0.35, pay: 1.15 } };
function powerOf(units) { let p = 0; for (const u of units)
    p += COST[u.tier]; return p * (1 + 0.12 * (units.length - 1)); }
function makeContract(st, tpl, grade) {
    const day = threat(st), G = GRADE[grade];
    const dayN = 3 + Math.floor((day - 1) / 5), mine = st.roster.length;
    const n = clamp(grade === 'easy' ? Math.min(dayN - 1, mine - 1) : grade === 'fair' ? Math.min(dayN, Math.max(mine, 3)) : dayN + 1, 2, 8);
    const q = clamp(0.3 + (day - 1) / 10 + G.dq + (tpl.tier - 1) * 0.3, 0, 2.7);
    const units = [];
    for (let i = 0; i < n; i++) {
        const tier = Math.min(3, Math.floor(q) + (chance(q - Math.floor(q)) ? 1 : 0));
        units.push(enemyUnit(tpl.mix[i % tpl.mix.length], tier, tpl.skin));
    }
    units.sort((a, b2) => b2.tier - a.tier);
    return {
        id: st.nextId++, tpl: tpl.id, title: tpl.title, who: tpl.who, text: tpl.text, skin: tpl.skin, foe: tpl.foe,
        units, ai: tpl.ai, grade, weather: rollWeather(), ttl: ri(2, 4), bonus: tpl.bonus || null,
        pay: Math.round((11 + 11 * powerOf(units)) * G.pay * (1 + st.renown / 250)),
        renown: grade === 'easy' ? 3 : grade === 'hard' ? 8 : 5,
        cap: clamp(n + (grade === 'easy' ? 1 : 0), 2, ROSTER_MAX)
    };
}
function makeDuel(st) {
    const tl = threat(st), tier = tl < 8 ? 1 : tl < 16 ? 2 : 3;
    const u = enemyUnit('sabre', tier, 'champion');
    u.morale = 70;
    const who = pick(['A rotmistrz of the Crown horse', 'A Saxon captain', 'A Hungarian nobleman', 'The colonel of a rival company']);
    return {
        id: st.nextId++, tpl: 'duel', duel: true, title: 'An affair of honour', who,
        text: 'Your banner has been called a rabble of horse-thieves at table. One man from each side, cold steel, until one yields.',
        skin: 'champion', foe: 'a hired blade', units: [u], ai: 'advance', grade: 'duel', weather: 'clear', ttl: 2, bonus: null,
        pay: 22 + tl * 2, renown: 7, cap: 1
    };
}
// The Black Regiment: out of the journey until it returns as a set piece on the road.
function finalContract(st) {
    const mix = [['pike', 3], ['pike', 2], ['pike', 1], ['shot', 2], ['shot', 2], ['sabre', 3], ['sabre', 2]];
    return {
        id: st.nextId++, tpl: 'final', final: true, title: 'The Black Regiment at the ford', who: 'The Crown Hetman',
        text: "Colonel Krafft's black-coats have sold their swords to the other side and hold the only crossing. The Hetman's whole muster watches from the hill. Break them and your banner is made.",
        skin: 'black', foe: 'the Black Regiment', units: mix.map(m => enemyUnit(m[0], m[1], 'black')), ai: 'hold',
        grade: 'final', weather: rollWeather(), ttl: 99, bonus: null, pay: 300, renown: 30, cap: ROSTER_MAX
    };
}
function genContracts(st) {
    const have = new Set(st.contracts.map(c => c.grade));
    const used = new Set(st.contracts.map(c => c.tpl));
    const tl = threat(st), land = here(st).land;
    const fits = (t) => tl >= t.min && tl <= t.max && (!t.lands || t.lands.includes(land));
    for (const g of ['easy', 'fair', 'hard']) {
        if (have.has(g))
            continue;
        let pool = TEMPLATES.filter(t => fits(t) && !used.has(t.id));
        if (!pool.length)
            pool = TEMPLATES.filter(fits);
        if (!pool.length)
            continue;
        const tpl = pick(pool);
        used.add(tpl.id);
        st.contracts.push(makeContract(st, tpl, g));
    }
    if (!have.has('duel') && chance(0.22))
        st.contracts.push(makeDuel(st));
}
/* ---------- battle ---------- */
const BW = 300, BD = 44, PACE = 15.5, TLIMIT = 120;
const alive = (u) => !u.dead && !u.fled;
const fighting = (u) => !u.dead && !u.fled && !u.routing;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function toUnit(o, side, sid) {
    const c = CLS[o.cls];
    return {
        sid, side, name: o.name || '', cls: o.cls, skin: side === 0 ? 'own' : (o.skin || 'bandit'), tier: o.tier || 0, origin: side === 0 && o.origin || '',
        x: 0, y: 0, hx: 0, hy: 0, hp: o.hp != null ? o.hp : o.vig, max: o.vig, mel: o.mel, aim: o.aim, grd: o.grd,
        wpn: o.wpn, arm: o.arm, armv: c.arm + o.arm * 1.5, spd: c.spd * (o.trait === 'Fleet' ? 1.15 : 1), mor: o.morale,
        trait: o.trait, face: side ? -1 : 1, cd: rnd(0, 0.5), loaded: true, rl: 0, aimT: 0, aimNeed: rnd(0.5, 1),
        tgt: null, ret: 0, anim: rnd(0, 1), moving: false, swing: 0, flash: 0, hurt: 0, kills: 0,
        dead: false, fled: false, routing: false, mode: 'idle', run: 0
    };
}
function deploy(b, side) {
    const us = b.units.filter(u => u.side === side);
    const hx = { pike: 66, sabre: 52, shot: 34 };
    for (const cls of ['pike', 'shot', 'sabre']) {
        const g = us.filter(u => u.cls === cls);
        g.forEach((u, i) => {
            let y;
            if (cls === 'sabre')
                y = i % 2 === 0 ? 3 + (i / 2) * 8 : BD - 3 - ((i - 1) / 2) * 8;
            else
                y = BD * (i + 0.5) / g.length + rnd(-2, 2);
            let x = hx[cls] + rnd(-2, 2);
            if (b.duel) {
                x = 118;
                y = BD / 2;
            }
            u.x = u.hx = side ? BW - x : x;
            u.y = u.hy = clamp(y, 0, BD);
        });
    }
}
function makeBattle(ours, theirs, o) {
    const b = {
        W: BW, D: BD, t: 0, units: [], stance: [o.stance || 'advance', o.ai === 'hold' ? 'hold' : o.ai || 'advance'],
        ai: o.ai || 'advance', underFire: false, weather: o.weather || 'clear', powder: o.powder || 0,
        duel: !!o.duel, noShot: !!o.duel, range: o.weather === 'fog' ? 88 : 150, fx: [], log: [], vis: !!o.vis,
        over: false, winner: null, retreated: false, mt: 0.5, shots: 0, dry: false, lastShot: 0
    };
    ours.forEach(s => b.units.push(toUnit(s, 0, s.id)));
    theirs.forEach((e, i) => b.units.push(toUnit(e, 1, 'e' + i)));
    deploy(b, 0);
    deploy(b, 1);
    return b;
}
function blog(b, s, side) { b.log.push({ t: b.t, s, side }); if (b.log.length > 60)
    b.log.shift(); }
function fxp(b, f) { if (b.vis)
    b.fx.push(f); }
const uname = (b, u) => u.side === 0 ? u.name.split(' ')[0] : (b.duel ? 'the hired blade' : 'a ' + TIER[u.tier] + ' ' + CLS[u.cls].name.toLowerCase());
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function pickTarget(b, u) {
    let best = null, bs = 1e9;
    for (const e of b.units) {
        if (e.side === u.side || !alive(e))
            continue;
        let w = 1;
        if (u.cls === 'sabre')
            w = e.cls === 'shot' ? 0.65 : e.cls === 'pike' ? 1.3 : 1;
        else if (u.cls === 'shot')
            w = e.cls === 'pike' ? 0.85 : 1;
        if (e.routing)
            w *= 1.6;
        const s = dist(u, e) * w;
        if (s < bs) {
            bs = s;
            best = e;
        }
    }
    u.tgt = best;
}
function nearest(b, u) {
    let best = null, bd = 1e9;
    for (const e of b.units) {
        if (e.side === u.side || !alive(e))
            continue;
        const d = dist(u, e);
        if (d < bd) {
            bd = d;
            best = e;
        }
    }
    return { e: best, d: bd };
}
function moveTo(b, u, tx, ty, sp, dt, stop) {
    stop = stop || 0;
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d <= stop + 0.01)
        return;
    const m = Math.min(sp * dt, d - stop);
    u.x += dx / d * m;
    u.y = clamp(u.y + dy / d * m, 0, b.D);
    u.moving = true;
    u.anim += dt * sp / 9;
}
function checked(b, u) {
    if (u.cls === 'pike')
        return false;
    const r = CLS[u.cls].reach;
    for (const e of b.units) {
        if (e.side === u.side || e.cls !== 'pike' || e.tgt !== u || !fighting(e))
            continue;
        const d = dist(u, e);
        if (d <= CLS.pike.reach + 1 && d > r)
            return true;
    }
    return false;
}
function hurt(b, t, dmg, src, kind) {
    t.hp -= dmg;
    t.hurt = 0.2;
    t.aimT = 0;
    if (kind === 'ball' && t.side === 1)
        b.underFire = true;
    fxp(b, { k: 'blood', x: t.x, y: t.y, n: kind === 'ball' ? 8 : 4, f: src.face });
    if (dmg >= t.max * 0.3)
        t.mor -= 8;
    if (t.hp <= 0) {
        t.hp = 0;
        t.dead = true;
        src.kills++;
        fxp(b, { k: 'death', x: t.x, y: t.y });
        for (const o of b.units) {
            if (!alive(o))
                continue;
            if (o.side === t.side)
                o.mor -= dist(o, t) < 45 ? 15 : 9;
            else
                o.mor = Math.min(100, o.mor + 5);
        }
        const how = kind === 'ball' ? 'shoots down' : src.cls === 'pike' ? 'runs through' : src.cls === 'sabre' ? 'cuts down' : 'clubs down';
        blog(b, cap1(uname(b, src)) + ' ' + how + ' ' + uname(b, t) + '.', src.side);
    }
}
function strike(b, u, t, d) {
    const c = CLS[u.cls], st = b.stance[u.side], tst = b.stance[t.side];
    u.cd = c.cd * rnd(0.9, 1.15);
    u.swing = 0.22;
    const impact = u.run > 1;
    u.run = 0;
    let g = t.grd;
    if (tst === 'charge')
        g -= 3;
    let p = 0.56 + 0.025 * (u.mel - g);
    if (u.cls === 'pike' && d > CLS[t.cls].reach + 1)
        p += 0.15;
    if (impact)
        p += 0.2;
    if (t.routing)
        p += 0.2;
    p *= 0.82 + 0.18 * (clamp(u.mor, 0, 100) / 100);
    p = clamp(p, 0.15, 0.95);
    if (chance(p)) {
        let dmg = ri(c.dmg[0], c.dmg[1]) + u.wpn * 2 + (u.trait === 'Brawler' ? 2 : 0);
        if (impact) {
            dmg *= 1.5;
            t.mor -= 6;
        }
        hurt(b, t, Math.max(1, Math.round(dmg - t.armv)), u, 'steel');
    }
    else
        fxp(b, { k: 'parry', x: (u.x + t.x) / 2, y: (u.y + t.y) / 2 });
}
function fire(b, u, t, d) {
    u.loaded = false;
    u.rl = clamp(4.5 - 0.09 * u.aim, 2.6, 5);
    u.aimT = 0;
    u.flash = 0.14;
    b.shots++;
    b.lastShot = b.t;
    if (u.side === 0) {
        b.powder--;
        if (b.powder <= 0 && !b.dry) {
            b.dry = true;
            blog(b, 'The powder is spent. Muskets are clubs now.', 1);
        }
    }
    const mis = chance(b.weather === 'rain' ? 0.3 : 0.06);
    fxp(b, { k: 'shot', x: u.x + u.face * 10, y: u.y, f: u.face, mis });
    if (mis) {
        u.rl *= 0.6;
        if (u.side === 0)
            blog(b, uname(b, u) + "'s match hisses out. Misfire.", 1);
        return;
    }
    let p = 0.42 + 0.03 * u.aim - 0.0028 * d + (u.trait === 'Keen-eyed' ? 0.1 : 0) - (b.weather === 'fog' ? 0.06 : 0);
    if (t.cls === 'sabre' && t.moving)
        p *= 0.8;
    p = clamp(p, 0.08, 0.92);
    if (chance(p)) {
        let dmg = ri(19, 30) + u.wpn * 3;
        if (d < 40)
            dmg *= 1.25;
        hurt(b, t, Math.max(4, Math.round(dmg - t.armv / 2)), u, 'ball');
    }
    else
        fxp(b, { k: 'miss', x: t.x + rnd(-7, 7), y: t.y + rnd(-3, 3) });
}
function moraleTick(b) {
    const n = [0, 0];
    for (const u of b.units)
        if (fighting(u))
            n[u.side]++;
    for (const u of b.units) {
        if (!fighting(u))
            continue;
        const me = n[u.side], them = n[1 - u.side];
        if (them >= me * 2)
            u.mor -= 3;
        else if (me >= them * 2)
            u.mor = Math.min(100, u.mor + 1);
        if (u.trait === 'Steadfast')
            continue;
        const thr = u.trait === 'Skittish' ? 60 : 40;
        if (u.mor < 20 || (u.hp < u.max * 0.3 && u.mor < thr)) {
            if (chance(0.3)) {
                u.routing = true;
                u.tgt = null;
                if (b.duel) {
                    u.fled = true;
                    blog(b, cap1(uname(b, u)) + ' lowers his blade and yields.', 1 - u.side);
                }
                else {
                    blog(b, cap1(uname(b, u)) + ' breaks and runs.', 1 - u.side);
                    for (const o of b.units)
                        if (o.side === u.side && fighting(o))
                            o.mor -= 4;
                }
            }
        }
    }
}
function orderRetreat(b) {
    if (b.over)
        return;
    b.retreated = true;
    b.stance[0] = 'retreat';
    for (const u of b.units)
        if (u.side === 0 && alive(u)) {
            u.routing = true;
            u.tgt = null;
        }
    blog(b, 'The drum beats the retreat.', 1);
}
function stepBattle(b, dt) {
    if (b.over)
        return;
    b.t += dt;
    if (b.ai === 'hold') {
        let mine = 0, theirs = 0, inRange = false;
        for (const u of b.units) {
            if (!fighting(u) || u.cls !== 'shot')
                continue;
            if (u.side === 1) {
                mine++;
                if (u.tgt && dist(u, u.tgt) <= b.range - 14)
                    inRange = true;
            }
            else if (b.powder > 0 && !b.noShot)
                theirs++;
        }
        if ((!mine && b.underFire) || (mine && theirs > mine * 1.6 && b.underFire)) {
            b.stance[1] = 'charge';
            b.ai = 'charge';
            blog(b, 'They will not stand under fire. Here they come.', 1);
        }
        else if (mine && !inRange && b.underFire)
            for (const u of b.units)
                if (u.side === 1)
                    u.hx -= 13 * dt;
    }
    for (const u of b.units) {
        if (u.dead || u.fled)
            continue;
        u.cd -= dt;
        if (u.hurt > 0)
            u.hurt -= dt;
        if (u.swing > 0)
            u.swing -= dt;
        if (u.flash > 0)
            u.flash -= dt;
        u.moving = false;
        const st = b.stance[u.side];
        if (u.routing) {
            u.mode = 'rout';
            moveTo(b, u, u.side ? b.W + 30 : -30, u.y, u.spd * 1.25, dt);
            u.face = u.side ? 1 : -1;
            if (u.x < -10 || u.x > b.W + 10)
                u.fled = true;
            continue;
        }
        u.ret -= dt;
        if (!u.tgt || !alive(u.tgt) || u.ret <= 0) {
            pickTarget(b, u);
            u.ret = 0.45;
        }
        const t = u.tgt;
        if (!t) {
            u.mode = 'idle';
            continue;
        }
        const d = dist(u, t), c = CLS[u.cls];
        u.face = t.x >= u.x ? 1 : -1;
        const ne = nearest(b, u);
        const threatened = ne.d < 14;
        const canFire = u.cls === 'shot' && !b.noShot && (u.side === 1 || b.powder > 0);
        if (canFire && !threatened) {
            if (!u.loaded) {
                u.mode = 'reload';
                u.rl -= dt * (st === 'hold' ? 1.12 : 1);
                if (u.rl <= 0) {
                    u.loaded = true;
                    u.aimT = 0;
                    u.aimNeed = rnd(0.45, 0.95);
                }
                continue;
            }
            if (d <= b.range) {
                u.mode = 'aim';
                u.aimT += dt;
                if (u.aimT >= u.aimNeed)
                    fire(b, u, t, d);
                continue;
            }
            if (st === 'hold') {
                if (Math.hypot(u.hx - u.x, u.hy - u.y) > 3) {
                    moveTo(b, u, u.hx, u.hy, u.spd, dt);
                    u.mode = 'walk';
                }
                else
                    u.mode = 'idle';
                continue;
            }
            u.mode = 'walk';
            moveTo(b, u, t.x, t.y, Math.min(u.spd, PACE), dt);
            continue;
        }
        let mt = t, md = d;
        if (threatened && ne.e !== t && (u.cls === 'shot' || ne.d < d - 6)) {
            mt = ne.e;
            md = ne.d;
        }
        if (md <= c.reach) {
            u.mode = 'fight';
            u.face = mt.x >= u.x ? 1 : -1;
            if (u.cd <= 0)
                strike(b, u, mt, md);
            continue;
        }
        if (st === 'hold') {
            if (ne.d > 46) {
                if (Math.hypot(u.hx - u.x, u.hy - u.y) > 3) {
                    moveTo(b, u, u.hx, u.hy, u.spd, dt);
                    u.mode = 'walk';
                }
                else
                    u.mode = 'idle';
                continue;
            }
            mt = ne.e;
        }
        let sp = st === 'charge' ? u.spd * 1.45 : (ne.d > 30 ? Math.min(u.spd, PACE) : u.spd);
        if (checked(b, u))
            sp *= 0.4;
        else if (st === 'charge')
            u.run += dt;
        u.mode = 'walk';
        moveTo(b, u, mt.x, mt.y, sp, dt, c.reach - 1);
    }
    // keep bodies apart
    const U = b.units;
    for (let i = 0; i < U.length; i++) {
        const a = U[i];
        if (!fighting(a))
            continue;
        for (let j = i + 1; j < U.length; j++) {
            const c2 = U[j];
            if (!fighting(c2))
                continue;
            const dx = c2.x - a.x, dy = c2.y - a.y, d = Math.hypot(dx, dy);
            if (d < 6) {
                const k = (6 - d) / 2, nx = d > 0.01 ? dx / d : (i % 2 ? 1 : -1) * 0.3, ny = d > 0.01 ? dy / d : 0.95;
                a.x -= nx * k;
                a.y = clamp(a.y - ny * k, 0, b.D);
                c2.x += nx * k;
                c2.y = clamp(c2.y + ny * k, 0, b.D);
            }
        }
    }
    b.mt -= dt;
    if (b.mt <= 0) {
        b.mt = 0.5;
        moraleTick(b);
    }
    if (!b.hinted && b.t > 9 && b.ai === 'hold' && b.stance[0] === 'hold' && b.t - b.lastShot > 8) {
        b.hinted = true;
        blog(b, 'They sit behind their pikes and wait. You will have to go to them.', 1);
    }
    const a = [0, 0];
    for (const u of U)
        if (alive(u))
            a[u.side]++;
    if (a[0] === 0 || a[1] === 0) {
        b.over = true;
        b.winner = a[0] > 0 ? 0 : 1;
    }
    if (!b.over && b.t > TLIMIT) {
        b.over = true;
        b.winner = 1;
        b.draw = true;
    }
}
/* ---------- picking men, odds ---------- */
function fitFor(s, c) { return s.wound === 0; }
function defaultPick(st, c) {
    let pool = st.roster.filter(s => s.wound === 0 && s.hp >= s.vig * 0.5);
    if (!pool.length)
        pool = st.roster.filter(s => s.wound === 0);
    if (c.duel)
        pool = pool.slice().sort((a, b2) => (b2.mel + b2.grd + b2.hp / 10) - (a.mel + a.grd + a.hp / 10));
    else
        pool = pool.slice().sort((a, b2) => rating(b2) - rating(a));
    return pool.slice(0, c.cap).map(s => s.id);
}
function battleFor(st, c, ids, stance, vis) {
    const ours = st.roster.filter(s => ids.includes(s.id));
    return makeBattle(ours, c.units, { stance, ai: c.ai, weather: c.weather, powder: st.powder, duel: c.duel, vis });
}
function estimateOdds(st, c, ids, n, stance) {
    if (!ids.length)
        return 0;
    let w = 0;
    n = n || 12;
    for (let i = 0; i < n; i++) {
        const b = battleFor(st, c, ids, stance || 'advance', false);
        while (!b.over) {
            stepBattle(b, 1 / 10);
            if (b.t > 14 && b.t - b.lastShot > 12 && b.stance[0] === 'hold' && b.stance[1] === 'hold')
                break;
        }
        if (b.over && b.winner === 0)
            w++;
    }
    return w / n;
}
function stanceOdds(st, c, ids, n) {
    const o = {}; // best and p are filled in below
    for (const s of (c.duel ? ['advance', 'charge'] : ['hold', 'advance', 'charge']))
        o[s] = estimateOdds(st, c, ids, n || 12, s);
    o.best = Object.keys(o).reduce((a, k) => (o[k] > o[a] ? k : a));
    o.p = o[o.best];
    return o;
}
const KIND = {
    hold: { tag: 'Assault', note: 'They are dug in and will not come out. You must go to them.' },
    advance: { tag: 'Open field', note: 'They will march on you in good order.' },
    charge: { tag: 'Ambush', note: 'They will come at you in a rush.' }
};
function oddsWord(p) {
    return p >= 0.85 ? 'Easy pickings' : p >= 0.65 ? 'Favourable' : p >= 0.42 ? 'Even odds' : p >= 0.2 ? 'Hard' : 'Grim';
}
/* ---------- aftermath ---------- */
function resolveBattle(st, c, b) {
    const won = b.winner === 0 && !b.retreated;
    const rep = { won, retreated: !!b.retreated, draw: !!b.draw, lines: [], pay: 0, loot: null, renown: 0, dead: [], title: c.title, final: !!c.final, duel: !!c.duel, ambush: !!c.ambush, foe: c.foe, cargoLost: 0, shots: b.shots, secs: Math.round(b.t) };
    st.powder = Math.max(0, b.powder);
    st.stats.battles++;
    if (won)
        st.stats.won++;
    for (const u of b.units) {
        if (u.side !== 0)
            continue;
        const s = st.roster.find(r => r.id === u.sid);
        if (!s)
            continue;
        s.kills += u.kills;
        st.stats.kills += u.kills;
        const line = { id: s.id, name: s.name, cls: s.cls, origin: s.origin, wpn: s.wpn, arm: s.arm, kills: u.kills, fate: 'unhurt', xp: 0, scar: null };
        if (u.dead) {
            let p = c.duel ? 0.2 : 0.42;
            if (st.staff.surgeon)
                p -= 0.18;
            if (s.trait === 'Lucky')
                p *= 0.5;
            if (chance(p)) {
                line.fate = 'killed';
                st.roster = st.roster.filter(r => r !== s);
                st.stats.dead.push({ name: s.name, cls: s.cls, origin: s.origin, day: st.day, date: st.date, where: c.title, level: s.level, kills: s.kills });
                rep.dead.push(s.name);
            }
            else {
                s.hp = Math.max(1, Math.round(s.vig * 0.12));
                s.wound = ri(3, 5);
                s.order = 'rest';
                line.fate = 'struck down';
                if (chance(0.4)) {
                    const sc = pick(SCARS);
                    sc.fn(s);
                    s.scars.push(sc.label);
                    line.scar = sc.label;
                }
            }
        }
        else {
            s.hp = Math.max(1, Math.round(u.hp));
            if (u.fled && c.duel)
                line.fate = 'yielded';
            else if (u.fled && !b.retreated)
                line.fate = 'fled';
            else if (u.hp < u.max)
                line.fate = 'wounded';
        }
        if (line.fate !== 'killed') {
            line.xp = 20 + 15 * u.kills + (won ? 15 : 0);
            s.xp += line.xp;
            s.morale = clamp(s.morale + (won ? 9 : -10) + (line.fate === 'fled' ? -6 : 0), 0, 100);
            s.fought = true;
        }
        rep.lines.push(line);
    }
    if (rep.dead.length)
        st.roster.forEach(s => { s.morale = clamp(s.morale - 5 * rep.dead.length, 0, 100); });
    if (won) {
        rep.pay = c.pay;
        st.thalers += c.pay;
        st.renown += c.renown;
        rep.renown = c.renown;
        st.stats.earned += c.pay;
        const loot = { bread: ri(0, 3), powder: c.duel ? 0 : ri(0, 3) };
        if (c.bonus)
            for (const k in c.bonus)
                loot[k] = (loot[k] || 0) + c.bonus[k]; // for...in gives plain strings
        st.bread += loot.bread;
        st.powder += loot.powder;
        rep.loot = loot;
        logLine(st, (c.ambush ? 'Beat off ' + c.foe + ' on the road.' : 'Won: ' + c.title + '. ' + c.pay + ' thalers paid.') + (rep.dead.length ? ' Buried: ' + rep.dead.join(', ') + '.' : ''));
    }
    else if (c.ambush) {
        const n = raidLoss(st, b.retreated);
        st.cargo -= n;
        st.stats.lost.raid += n;
        rep.cargoLost = n;
        logLine(st, (b.retreated ? 'Fell back before ' : 'Beaten by ') + c.foe + ' on the road. ' + n + ' ' + cargoName(st, n) + ' lost.' + (rep.dead.length ? ' Buried: ' + rep.dead.join(', ') + '.' : ''));
    }
    else {
        const pen = b.retreated ? 3 : 5;
        rep.renown = -Math.min(pen, st.renown);
        st.renown = Math.max(0, st.renown - pen);
        logLine(st, (b.retreated ? 'Withdrew from: ' : 'Beaten at: ') + c.title + '.' + (rep.dead.length ? ' Buried: ' + rep.dead.join(', ') + '.' : ''));
    }
    st.contracts = st.contracts.filter(x => x.id !== c.id);
    if (c.ambush)
        st.ambush = null;
    levelUps(st);
    st.odds = {};
    if (c.final)
        st.over = won ? 'victory' : 'defeat';
    return rep;
}
/* ---------- events ---------- */
// Each choice: label, hint (its effects in words), fx (the same as [icon, amount, what] chips; none means nothing changes) and fn.
const all = (st, fn) => st.roster.forEach(fn);
const bump = (s, k, v) => { s[k] = clamp(s[k] + v, k === 'hp' ? 1 : 0, k === 'hp' ? s.vig : 100); };
const EVENTS = [
    { id: 'deserter', title: 'A deserter at the picket line',
        text: () => 'A Swedish musketeer, half starved, offers his matchlock and his oath for a place by the fire.',
        ok: st => st.roster.length < ROSTER_MAX,
        choices: [
            { label: 'Give him bread and a place', hint: 'A free musketeer. He eats and draws pay like the rest.', fx: [['men', '+1', 'musketeer'], ['coin', '+7', 'wages a month']],
                fn: st => { const s = makeSoldier(st, 'shot', 2, ORIGINS.find(o => o.id === 'swede')); s.morale = 45; st.roster.push(s); return s.name + ' makes his mark on the roll.'; } },
            { label: 'Sell him back to his colonel', hint: '+25 thalers. The men will not like it.', fx: [['coin', '+25', 'thalers'], ['flame', '−6', 'spirit, every man']],
                fn: st => { st.thalers += 25; all(st, s => bump(s, 'morale', -6)); return 'The provost counts out 25 thalers. The fire is quiet tonight.'; } },
            { label: 'Send him on his way', hint: 'Nothing gained, nothing lost.', fn: () => 'He walks east and does not look back.' }
        ] },
    { id: 'sutler', title: "The sutler's cart",
        text: () => 'A sutler-woman has a barrel of gorzałka and names a soldier’s price for it.',
        ok: st => st.thalers >= 12 && st.roster.length > 0,
        choices: [
            { label: 'Buy the barrel for the company', hint: '−12 thalers. Spirits rise. Fists may follow.', fx: [['coin', '−12', 'thalers'], ['flame', '+14', 'spirit, every man'], ['dice', '1 in 4', 'a brawl']],
                fn: st => { st.thalers -= 12; all(st, s => bump(s, 'morale', 14)); if (chance(0.25)) {
                    const s = pick(st.roster);
                    bump(s, 'hp', -10);
                    return 'A fine night, until ' + s.name + ' takes a stool to the face.';
                } return 'Songs in four languages until the watch changes.'; } },
            { label: 'Send her on', hint: 'The men grumble.', fx: [['flame', '−3', 'spirit, every man']], fn: st => { all(st, s => bump(s, 'morale', -3)); return 'The cart rolls on. So does the grumbling.'; } }
        ] },
    { id: 'fever', title: 'Camp fever',
        text: st => st.staff.surgeon ? 'Two men wake shivering. Your barber-surgeon is already boiling something foul.' : 'Two men wake shivering and cannot keep their bread down. The next village has an apothecary.',
        ok: st => st.roster.length >= 2,
        choices: [
            { label: 'Pay for physic', hint: '−15 thalers. Free if you keep a barber-surgeon.', fx: [['coin', '−15', 'thalers'], ['surgeon', '0', 'with a barber-surgeon']],
                fn: st => { if (st.staff.surgeon)
                    return 'Purged, bled and back in the line by evening.'; if (st.thalers < 15) {
                    st.roster.slice(0, 2).forEach(s => bump(s, 'hp', -14));
                    return 'The purse is too light. The fever runs its course.';
                } st.thalers -= 15; return 'The apothecary is paid and the fever breaks.'; } },
            { label: 'Let it burn out', hint: 'Two men lose strength.', fx: [['drop', '−14', 'blood, two men'], ['flame', '−5', 'spirit, two men']],
                fn: st => { const a = st.roster.slice().sort(() => Math.random() - 0.5).slice(0, 2); a.forEach(s => { bump(s, 'hp', -14); bump(s, 'morale', -5); }); return a.map(s => s.name).join(' and ') + ' sweat it out, and are the weaker for it.'; } }
        ] },
    { id: 'village', title: "A village asks for a night's guard",
        text: () => 'The elders of a hamlet stand in the road with their caps in their hands. Foragers are near, and they have bread to offer.',
        ok: st => st.roster.length > 0,
        choices: [
            { label: 'Stand watch for them', hint: '+12 bread, +3 renown. A sleepless night.', fx: [['loaf', '+12', 'bread'], ['mace', '+3', 'renown'], ['flame', '−4', 'spirit, every man']],
                fn: st => { st.bread += 12; st.renown += 3; all(st, s => bump(s, 'morale', -4)); return 'Nobody comes. The bread is still warm in the morning.'; } },
            { label: 'Take what they have', hint: '+22 bread, −6 renown.', fx: [['loaf', '+22', 'bread'], ['mace', '−6', 'renown']],
                fn: st => { st.bread += 22; st.renown = Math.max(0, st.renown - 6); return 'The ovens are emptied. Word of it will travel faster than you do.'; } },
            { label: 'March on', hint: 'Nothing gained, nothing lost.', fn: () => 'The company marches past without a word.' }
        ] },
    { id: 'dice', title: 'Dice and drawn steel',
        text: st => { const p = st.pending; return p.a + ' and ' + p.b + ' are on their feet over a throw of the dice, hands on hilts.'; },
        ok: st => st.roster.length >= 2,
        prep: st => { const a = st.roster.slice().sort(() => Math.random() - 0.5); return { a: a[0].name, b: a[1].name, ia: a[0].id, ib: a[1].id }; },
        choices: [
            { label: 'Let them settle it, to first blood', hint: 'One is cut. The company enjoys the show.', fx: [['drop', '−14', 'blood, the loser'], ['star', '+15', 'experience, the winner'], ['flame', '+4', 'spirit, every man']],
                fn: st => { const a = st.roster.find(s => s.id === st.pending.ia), b2 = st.roster.find(s => s.id === st.pending.ib); if (!a || !b2)
                    return 'It blows over.'; const w = chance(0.5) ? a : b2, l = w === a ? b2 : a; bump(l, 'hp', -14); w.xp += 15; all(st, s => bump(s, 'morale', 4)); return w.name + ' draws first blood. ' + l.name + ' pays the debt and keeps the scar.'; } },
            { label: 'Fine them both', hint: '+8 thalers. Both sulk.', fx: [['coin', '+8', 'thalers'], ['flame', '−8', 'spirit, the two']],
                fn: st => { st.thalers += 8; [st.pending.ia, st.pending.ib].forEach(id => { const s = st.roster.find(r => r.id === id); if (s)
                    bump(s, 'morale', -8); }); return 'Four thalers each into the chest. Neither speaks to you for a day.'; } }
        ] },
    { id: 'cart', title: 'An overturned cart',
        text: () => "A powder cart lies in the ditch, its driver gone. The barrels carry the Crown's mark.",
        ok: () => true,
        choices: [
            { label: 'Take the powder', hint: '+10 powder, −2 renown.', fx: [['horn', '+10', 'powder'], ['mace', '−2', 'renown']], fn: st => { st.powder += 10; st.renown = Math.max(0, st.renown - 2); return 'Ten charges richer, and nobody saw. Probably.'; } },
            { label: 'Return it to the Crown artillery', hint: '+5 renown, +10 thalers.', fx: [['mace', '+5', 'renown'], ['coin', '+10', 'thalers']], fn: st => { st.renown += 5; st.thalers += 10; return 'The artillery captain pays a finder’s fee and remembers your banner.'; } }
        ] },
    { id: 'pedlar', title: "The pedlar's bundle",
        text: () => 'A pedlar unrolls an oilcloth: a weapon far better than anything on your roll, and no questions asked about where it came from.',
        ok: st => st.thalers >= 30 && st.roster.some(s => s.wpn < 3),
        choices: [
            { label: 'Buy it', hint: '−30 thalers. Your worst-armed man gets better arms.', fx: [['coin', '−30', 'thalers'], ['up', '+1', 'arms, worst-armed man']],
                fn: st => { const s = st.roster.filter(r => r.wpn < 3).sort((a, b2) => a.wpn - b2.wpn || b2.level - a.level)[0]; st.thalers -= 30; s.wpn++; return s.name + ' now carries a ' + WPN[s.cls][s.wpn].toLowerCase() + '.'; } },
            { label: 'Wave him off', hint: 'Nothing gained, nothing lost.', fn: () => 'He rolls it up again, unbothered.' }
        ] },
    { id: 'weevils', title: 'Weevils in the bread',
        text: st => st.staff.qm ? 'Your quartermaster caught the spoiled sacks before they were loaded.' : 'Half a sack of biscuit is alive with weevils.',
        ok: st => st.bread >= 8,
        choices: [
            { label: 'Throw it out', hint: 'Lose 6 bread, unless you keep a quartermaster.', fx: [['loaf', '−6', 'bread'], ['qm', '0', 'with a quartermaster']],
                fn: st => { if (st.staff.qm)
                    return 'Nothing lost.'; st.bread = Math.max(0, st.bread - 6); return 'Six loaves’ worth goes to the crows.'; } },
            { label: 'Bread is bread', hint: 'Keep it. Someone may sicken.', fx: [['dice', '2 in 5', 'one man sickens'], ['drop', '−12', 'blood']],
                fn: st => { if (st.staff.qm)
                    return 'Nothing lost.'; if (chance(0.4) && st.roster.length) {
                    const s = pick(st.roster);
                    bump(s, 'hp', -12);
                    return s.name + ' spends the night behind the hedge.';
                } return 'Nobody complains. Nobody looks closely.'; } }
        ] }
];
function rollEvent(st) {
    let pool = EVENTS.filter(e => !st.seen.includes(e.id) && e.ok(st));
    if (!pool.length) {
        st.seen = [];
        pool = EVENTS.filter(e => e.ok(st));
    }
    if (!pool.length)
        return null;
    const e = pick(pool);
    st.seen.push(e.id);
    st.pending = e.prep ? e.prep(st) : {};
    st.pending.id = e.id;
    return e;
}
function applyEvent(st, i) {
    const e = EVENTS.find(x => x.id === (st.pending && st.pending.id));
    if (!e)
        return '';
    const res = e.choices[i].fn(st);
    logLine(st, e.title + ': ' + res);
    st.pending = null;
    st.odds = {};
    return res;
}
