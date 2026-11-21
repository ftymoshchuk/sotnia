"use strict";
/* ===== SOTNIA journey rules: the calendar, the lands and roads of 1633, quests, travel. No DOM in this block ===== */
/* ---------- the calendar ---------- */
// A date is a day number counted from 1 January 1633 (new style). The Commonwealth's Catholics kept the
// Gregorian calendar; Saxony, Prussia's Lutherans and Orthodox Ukraine kept the Julian, ten days behind,
// so letters of the time gave both: "3/13 September 1633".
const EPOCH = Date.UTC(1633, 0, 1), DAY_MS = 864e5;
const dayOf = (m, d, y) => Math.round((Date.UTC(y || 1633, m - 1, d) - EPOCH) / DAY_MS);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
function ymd(n) { const t = new Date(EPOCH + n * DAY_MS); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }; }
function dateText(n, short) {
    const g = ymd(n), j = ymd(n - 10), M = short ? MON : MONTHS;
    if (j.y !== g.y)
        return j.d + ' ' + M[j.m] + ' ' + j.y + '/' + g.d + ' ' + M[g.m] + ' ' + g.y;
    if (j.m !== g.m)
        return j.d + ' ' + M[j.m] + '/' + g.d + ' ' + M[g.m] + (short ? '' : ' ' + g.y);
    return j.d + '/' + g.d + ' ' + M[g.m] + (short ? '' : ' ' + g.y);
}
/* ---------- the lands ---------- */
// danger: how often trouble finds a train on the road (see AMBUSH_RATE). origins: who signs on there.
const LANDS = {
    steppe: { name: 'the Wild Fields', danger: 3, origins: ['cossack', 'tatar'], ambush: ['tatars'] },
    ukraine: { name: 'Ukraine', danger: 2, origins: ['cossack', 'pole'], ambush: ['tatars', 'masterless'] },
    poland: { name: 'the Crown of Poland', danger: 1, origins: ['pole', 'scot', 'magyar', 'german'], ambush: ['roadagents', 'deserters'] },
    prussia: { name: 'Royal Prussia', danger: 1, origins: ['german', 'scot', 'pole'], ambush: ['riverthieves'] },
    lithuania: { name: 'Lithuania', danger: 1, origins: ['pole', 'tatar', 'german'], ambush: ['deserters', 'roadagents'] },
    front: { name: 'the Smolensk front', danger: 3, origins: ['pole', 'german', 'scot'], ambush: ['muscovites'] },
    silesia: { name: 'Silesia', danger: 2, origins: ['german', 'croat', 'scot', 'swede'], ambush: ['imperials', 'croats'] },
    saxony: { name: 'Saxony and Lusatia', danger: 2, origins: ['german', 'swede', 'scot'], ambush: ['imperials', 'swedes'] }
};
const SERVICES = {
    town: { market: true, recruits: true, staff: true, work: true },
    host: { market: true, recruits: true, work: true },
    fort: { market: true },
    ford: {}, lakes: {}, camp: {}
};
/* ---------- places ---------- */
// lon, lat in degrees. major places are always named on the map.
const P = (name, lon, lat, land, kind, major) => ({ name, lon, lat, land, kind: kind || 'town', major: !!major });
const PLACES = {
    leipzig: P('Leipzig', 12.37, 51.34, 'saxony', 'town', true),
    dresden: P('Dresden', 13.74, 51.05, 'saxony', 'town', true),
    bautzen: P('Bautzen', 14.42, 51.18, 'saxony'),
    gorlitz: P('Görlitz', 14.99, 51.15, 'saxony'),
    liegnitz: P('Liegnitz', 16.16, 51.21, 'silesia'),
    breslau: P('Breslau', 17.03, 51.11, 'silesia', 'town', true),
    oppeln: P('Oppeln', 17.93, 50.67, 'silesia'),
    olkusz: P('Olkusz', 19.56, 50.28, 'poland'),
    krakow: P('Kraków', 19.94, 50.06, 'poland', 'town', true),
    tarnow: P('Tarnów', 20.99, 50.01, 'poland'),
    sandomierz: P('Sandomierz', 21.75, 50.68, 'poland'),
    kazimierz: P('Kazimierz', 21.95, 51.32, 'poland'),
    lublin: P('Lublin', 22.57, 51.25, 'poland'),
    zamosc: P('Zamość', 23.25, 50.72, 'poland'),
    jaroslaw: P('Jarosław', 22.68, 50.02, 'poland'),
    przemysl: P('Przemyśl', 22.77, 49.78, 'poland'),
    lviv: P('Lviv', 24.03, 49.84, 'poland', 'town', true),
    warsaw: P('Warsaw', 21.01, 52.23, 'poland', 'town', true),
    plock: P('Płock', 19.70, 52.55, 'poland'),
    lomza: P('Łomża', 22.07, 53.18, 'poland'),
    torun: P('Toruń', 18.60, 53.01, 'prussia'),
    danzig: P('Danzig', 18.65, 54.35, 'prussia', 'town', true),
    brest: P('Brest', 23.69, 52.10, 'lithuania'),
    grodno: P('Grodno', 23.83, 53.68, 'lithuania'),
    slonim: P('Slonim', 25.32, 53.09, 'lithuania'),
    vilnius: P('Vilnius', 25.28, 54.69, 'lithuania', 'town', true),
    minsk: P('Minsk', 27.56, 53.90, 'lithuania'),
    barysaw: P('Barysaw', 28.50, 54.23, 'lithuania'),
    polotsk: P('Polotsk', 28.80, 55.49, 'lithuania'),
    vitebsk: P('Vitebsk', 30.20, 55.19, 'lithuania'),
    orsha: P('Orsha', 30.43, 54.51, 'lithuania'),
    smolensk: P('the camp before Smolensk', 32.04, 54.78, 'front', 'camp', true),
    lutsk: P('Lutsk', 25.33, 50.75, 'ukraine'),
    ostroh: P('Ostroh', 26.52, 50.33, 'ukraine'),
    ternopil: P('Ternopil', 25.59, 49.55, 'ukraine'),
    kamianets: P('Kamianets', 26.58, 48.68, 'ukraine', 'town', true),
    bar: P('Bar', 27.67, 49.08, 'ukraine'),
    vinnytsia: P('Vinnytsia', 28.47, 49.23, 'ukraine'),
    bratslav: P('Bratslav', 28.95, 48.82, 'ukraine'),
    zhytomyr: P('Zhytomyr', 28.66, 50.25, 'ukraine'),
    kyiv: P('Kyiv', 30.52, 50.45, 'ukraine', 'town', true),
    bilatserkva: P('Bila Tserkva', 30.12, 49.80, 'ukraine'),
    kaniv: P('Kaniv', 31.46, 49.75, 'ukraine'),
    cherkasy: P('Cherkasy', 32.06, 49.44, 'ukraine'),
    chyhyryn: P('Chyhyryn', 32.66, 49.08, 'ukraine'),
    uman: P('Uman', 30.22, 48.75, 'ukraine'),
    sich: P('the Zaporozhian Sich', 34.30, 47.50, 'steppe', 'host', true),
    inhul: P('the Inhul fords', 32.30, 47.70, 'steppe', 'ford'),
    tavan: P('the Tavan crossing', 33.40, 46.80, 'steppe', 'ford'),
    perekop: P('Perekop', 33.69, 46.15, 'steppe', 'fort', true),
    syvash: P('the Syvash salt lakes', 33.95, 45.92, 'steppe', 'lakes')
};
function kmBetween(A, B) {
    const R = 6371, rad = Math.PI / 180, dLat = (B.lat - A.lat) * rad, dLon = (B.lon - A.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * rad) * Math.cos(B.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
/* ---------- roads ---------- */
// Roads wind, so a leg is the straight distance plus 15%; rivers meander, plus 25%. River legs run downstream from a to b.
const ROADS = [];
function road(a, b, danger, river) {
    const A = PLACES[a], B = PLACES[b], land = LANDS[A.land].danger >= LANDS[B.land].danger ? A.land : B.land;
    ROADS.push({ a, b, km: Math.round(kmBetween(A, B) * (river ? 1.25 : 1.15)), danger, land, river: !!river });
}
// the steppe and the lower Dnieper
road('syvash', 'perekop', 2);
road('perekop', 'tavan', 3);
road('perekop', 'sich', 3);
road('tavan', 'sich', 2);
road('tavan', 'inhul', 3);
road('inhul', 'uman', 3);
road('inhul', 'chyhyryn', 2);
road('sich', 'chyhyryn', 2);
// the Dnieper towns and Kyiv
road('chyhyryn', 'cherkasy', 1);
road('cherkasy', 'kaniv', 1);
road('kaniv', 'kyiv', 1);
road('cherkasy', 'bilatserkva', 2);
road('uman', 'bilatserkva', 2);
road('bilatserkva', 'kyiv', 1);
road('kyiv', 'zhytomyr', 1);
// Podolia and Bratslav
road('uman', 'bratslav', 2);
road('bratslav', 'vinnytsia', 2);
road('vinnytsia', 'bar', 2);
road('vinnytsia', 'zhytomyr', 1);
road('bar', 'kamianets', 2);
road('kamianets', 'ternopil', 2);
road('bar', 'ternopil', 2);
road('ternopil', 'lviv', 1);
// Volhynia
road('zhytomyr', 'ostroh', 1);
road('ostroh', 'lutsk', 1);
road('ostroh', 'ternopil', 1);
road('lutsk', 'lviv', 1);
road('lutsk', 'zamosc', 1);
// Red Ruthenia and Lesser Poland
road('lviv', 'przemysl', 1);
road('lviv', 'zamosc', 1);
road('przemysl', 'jaroslaw', 1);
road('jaroslaw', 'tarnow', 1);
road('jaroslaw', 'sandomierz', 1);
road('zamosc', 'lublin', 1);
road('lublin', 'kazimierz', 1);
road('lublin', 'sandomierz', 1);
road('lublin', 'warsaw', 1);
road('tarnow', 'krakow', 1);
road('sandomierz', 'krakow', 1);
road('krakow', 'olkusz', 1);
// Silesia, Lusatia and Saxony, where the German war is being fought this year
road('olkusz', 'oppeln', 2);
road('oppeln', 'breslau', 2);
road('breslau', 'liegnitz', 2);
road('liegnitz', 'gorlitz', 2);
road('gorlitz', 'bautzen', 2);
road('bautzen', 'dresden', 2);
road('bautzen', 'leipzig', 2);
road('dresden', 'leipzig', 2);
// Mazovia, Lithuania and the road to Smolensk
road('warsaw', 'brest', 1);
road('warsaw', 'lomza', 1);
road('lomza', 'grodno', 1);
road('brest', 'slonim', 1);
road('grodno', 'slonim', 1);
road('grodno', 'vilnius', 1);
road('slonim', 'minsk', 1);
road('vilnius', 'minsk', 1);
road('minsk', 'barysaw', 1);
road('barysaw', 'orsha', 2);
road('vilnius', 'polotsk', 1);
road('polotsk', 'vitebsk', 1);
road('orsha', 'vitebsk', 2);
road('orsha', 'smolensk', 3);
road('vitebsk', 'smolensk', 3);
// the Vistula, downstream
road('sandomierz', 'kazimierz', 1, true);
road('kazimierz', 'warsaw', 1, true);
road('warsaw', 'plock', 1, true);
road('plock', 'torun', 1, true);
road('torun', 'danzig', 1, true);
/* ---------- how the cargo travels ---------- */
// km a day at a steady and at a forced pace; the chance a day of rain or of forced marching costs cargo.
const TRANSPORT = {
    oxcart: { name: 'ox-carts', steady: 18, forced: 26, rain: 0.12, forcedLoss: 0.22, forcedMax: 1,
        rainText: 'Rain gets under the hides, and a cart of salt melts away.',
        forcedText: () => 'An ox founders on the forced march, and its cart is left by the road.' },
    herd: { name: 'a driven herd', steady: 16, forced: 23, rain: 0, forcedLoss: 0.35, forcedMax: 2,
        forcedText: n => (n > 1 ? n + ' oxen go down on the forced march and do not' : 'An ox goes down on the forced march and does not') + ' get up.' },
    raft: { name: 'rafts', river: true, steady: 32, forced: 46, rain: 0.12, forcedLoss: 0.18, forcedMax: 2,
        rainText: 'Rain soaks a raft of rye, and the wet grain goes over the side.',
        forcedText: n => 'Floating on through the night, a raft runs aground: ' + n + (n > 1 ? ' lasts' : ' last') + ' of rye lost.' },
    chest: { name: 'a light wagon', steady: 25, forced: 34, rain: 0, forcedLoss: 0 }
};
/* ---------- quests ---------- */
const QUESTS = [
    { id: 'salt', title: 'Salt for the Leipzig fair', who: "On the company's own account", kind: 'venture', transport: 'oxcart',
        from: 'syvash', to: 'leipzig', start: dayOf(6, 9), deadline: dayOf(10, 23), until: 'the Michaelmas fair closes',
        cargo: { n: 24, one: 'cart of salt', many: 'carts of salt', unit: 'carts' }, play: '25–35 minutes', price: 60, thalers: 180, bread: 100, men: ['pike', 'shot', 'sabre', 'sabre', 'shot'],
        text: 'Twenty-four ox-carts of salt, loaded at the lakes of the Syvash on the Sea of Azov. Take them past Perekop, across the Wild Fields and west through the Commonwealth to the Michaelmas fair at Leipzig, where salt sells dear.',
        opening: 'Twenty-four carts of salt stand loaded by the lakes of the Syvash. The road to Leipzig starts at Perekop.' },
    { id: 'oxen', title: 'Oxen for the Breslau market', who: "On the company's own account", kind: 'venture', transport: 'herd',
        from: 'kamianets', to: 'breslau', start: dayOf(9, 4), deadline: dayOf(11, 11), until: "St Martin's Day",
        cargo: { n: 60, one: 'ox', many: 'oxen', unit: 'head' }, play: '10–15 minutes', price: 12, thalers: 140, bread: 50, men: ['pike', 'shot', 'sabre', 'sabre'],
        text: "Sixty head of grey Podolian oxen, bought at Kamianets. Drive them west to the cattle market at Breslau before St Martin's Day. Drive them hard and they lose flesh, and some will not get up again.",
        opening: 'Sixty head of oxen low in the pens at Kamianets. Breslau is a long way west.' },
    { id: 'grain', title: 'Rye down the Vistula', who: "On the company's own account", kind: 'venture', transport: 'raft',
        from: 'sandomierz', to: 'danzig', start: dayOf(5, 28), deadline: dayOf(6, 24), until: "St John's Day",
        cargo: { n: 30, one: 'last of rye', many: 'lasts of rye', unit: 'lasts' }, play: '5–10 minutes', price: 20, thalers: 70, bread: 30, men: ['pike', 'shot', 'sabre'],
        text: "Thirty lasts of rye on rafts at Sandomierz. Float them down the Vistula to Danzig and sell them to the Dutch before St John's Day, while the spring water is high. Rafts go only where the river goes, and rain rots wet grain.",
        opening: 'The rafts are lashed and loaded at Sandomierz, and the Vistula is running high.' },
    { id: 'payroll', title: 'The payroll for Smolensk', who: 'The Crown Treasurer', kind: 'commission', transport: 'chest',
        from: 'warsaw', to: 'smolensk', start: dayOf(8, 12), deadline: dayOf(9, 29), until: 'Michaelmas, when their pay falls due',
        cargo: { n: 600, one: 'thaler', many: 'thalers', unit: 'thalers' }, play: '10–15 minutes', fee: 340, thalers: 100, bread: 40, men: ['pike', 'shot', 'sabre', 'shot'],
        text: 'Six hundred thalers in an iron-bound chest, for the regiments King Władysław has led to the relief of Smolensk. Bring it to the camp by Michaelmas, when their pay falls due. The fee is yours on delivery, less anything missing from the chest.',
        opening: "The Crown's chest is chained to the wagon bed in Warsaw. Smolensk is a long way east." }
];
const questOf = (st) => QUESTS.find(q => q.id === st.quest); // a campaign always names a quest in QUESTS
const transportOf = (st) => TRANSPORT[questOf(st).transport];
const here = (st) => PLACES[st.at];
const has = (st, k) => !!(SERVICES[here(st).kind] || {})[k];
const atEnd = (st) => st.at === questOf(st).to;
const cargoName = (st, n) => (n === 1 ? questOf(st).cargo.one : questOf(st).cargo.many);
/* ---------- where the company stands ---------- */
// How far along the journey, by straight distance: 0 at the start, 1 at the destination.
function progress(st) {
    const q = questOf(st), to = PLACES[q.to];
    return clamp(1 - kmBetween(here(st), to) / kmBetween(PLACES[q.from], to), 0, 1);
}
// Contracts and ambushes grow harder as the company nears its goal, as they did over the old 24 days.
const threat = (st) => clamp(1 + Math.round(23 * progress(st)), 1, 24);
const legDays = (km, speed) => Math.max(1, Math.ceil(km / speed));
function roadsFrom(st) {
    const T = transportOf(st), out = [];
    ROADS.forEach((r, i) => {
        if (r.river !== !!T.river)
            return;
        const to = r.a === st.at ? r.b : !T.river && r.b === st.at ? r.a : null;
        if (to)
            out.push({ i, to, km: r.km, days: legDays(r.km, T.steady), forced: legDays(r.km, T.forced), danger: r.danger, land: r.land });
    });
    const goal = PLACES[questOf(st).to];
    return out.sort((x, y) => kmBetween(PLACES[x.to], goal) - kmBetween(PLACES[y.to], goal));
}
// The quickest steady routes from a place to every other the cargo can reach: the days to each,
// and the road each is reached by (Dijkstra; the map is small enough for a plain list).
function searchRoutes(st, from) {
    const T = transportOf(st), start = from || st.at, best = { [start]: 0 }, prev = {}, open = [start];
    while (open.length) {
        open.sort((a, b) => best[a] - best[b]);
        const at = open.shift();
        ROADS.forEach((r, i) => {
            if (r.river !== !!T.river)
                return;
            const to = r.a === at ? r.b : !T.river && r.b === at ? r.a : null;
            if (!to)
                return;
            const d = best[at] + legDays(r.km, T.steady);
            if (best[to] == null || d < best[to]) {
                best[to] = d;
                prev[to] = { at, i };
                if (!open.includes(to))
                    open.push(to);
            }
        });
    }
    return { best, prev };
}
// Fewest steady days from here, or from another place, to the destination.
function daysToGo(st, from) {
    const d = searchRoutes(st, from).best[questOf(st).to];
    return d == null ? Infinity : d;
}
// The legs of the quickest steady route from here to a place, as roadsFrom lists them; null if there is none.
function routeTo(st, target) {
    const { prev } = searchRoutes(st), T = transportOf(st), legs = [];
    if (!PLACES[target] || target === st.at || !prev[target])
        return null;
    for (let to = target; to !== st.at; to = prev[to].at) {
        const r = ROADS[prev[to].i];
        legs.unshift({ i: prev[to].i, from: prev[to].at, to, km: r.km, days: legDays(r.km, T.steady), forced: legDays(r.km, T.forced), danger: r.danger, land: r.land });
    }
    return legs;
}
// Steady days to the nearest market if the company takes road r: what the bread has to last.
function marketDays(st, r) {
    const T = transportOf(st), best = { [r.to]: r.days }, open = [r.to];
    while (open.length) {
        open.sort((a, b) => best[a] - best[b]);
        const at = open.shift();
        if ((SERVICES[PLACES[at].kind] || {}).market || at === questOf(st).to)
            return best[at];
        for (const x of ROADS) {
            if (x.river !== !!T.river)
                continue;
            const to = x.a === at ? x.b : !T.river && x.b === at ? x.a : null;
            if (!to || to === st.at)
                continue;
            const d = best[at] + legDays(x.km, T.steady);
            if (best[to] == null || d < best[to]) {
                best[to] = d;
                if (!open.includes(to))
                    open.push(to);
            }
        }
    }
    return r.days;
}
const daysLeft = (st) => questOf(st).deadline - st.date;
const lateDays = (st) => Math.max(0, st.date - questOf(st).deadline);
const lateFactor = (st) => Math.max(0.5, 1 - 0.02 * lateDays(st));
// What a town on the way pays for one unit of cargo: little near the source, more as the road goes on.
function unitPrice(st) {
    const q = questOf(st);
    return q.kind === 'commission' ? 1 : Math.max(1, Math.round(q.price * (0.35 + 0.45 * progress(st))));
}
// What the cargo fetches at the destination today.
function cargoValue(st) {
    const q = questOf(st);
    if (q.kind === 'commission')
        return Math.max(0, Math.round(q.fee * lateFactor(st)) - (st.cargo0 - st.cargo));
    return Math.round(st.cargo * q.price * lateFactor(st));
}
/* ---------- paid work and ambushes by land ---------- */
const TEMPLATE_LANDS = {
    road: ['poland'], mill: ['poland'], ford: ['poland'], toll: ['silesia', 'saxony'], wagons: ['poland', 'ukraine', 'lithuania'],
    river: ['poland', 'prussia'], quarrel: ['poland', 'ukraine', 'lithuania', 'prussia'], picket: ['silesia', 'saxony'], forage: ['silesia', 'saxony']
};
TEMPLATES.forEach(t => { t.lands = TEMPLATE_LANDS[t.id]; });
TEMPLATES.push({ id: 'tatarhunt', title: 'Tatars driving off the villages', who: 'A Podolian starosta', lands: ['ukraine', 'steppe'],
    text: 'A Tatar band is driving cattle and captives south. Catch them at the river crossing before they reach the steppe.',
    skin: 'raider', foe: 'Tatar raiders', mix: ['sabre', 'sabre', 'shot', 'sabre'], tier: 1, ai: 'advance', min: 1, max: 24 }, { id: 'manor', title: 'Deserters in the manor', who: 'A Lithuanian castellan', lands: ['lithuania'],
    text: 'Soldiers who walked away from the Smolensk army without their pay have taken a manor and its cellar.',
    skin: 'deserter', foe: 'deserters', mix: ['shot', 'pike', 'shot'], tier: 1, ai: 'hold', min: 1, max: 24 }, { id: 'blockhouse', title: 'A Muscovite blockhouse', who: "The King's commissary before Smolensk", lands: ['lithuania', 'front'],
    text: "Shein's men hold a blockhouse on the Dnieper road. Clear it and the convoys can move.",
    skin: 'muscovite', foe: 'streltsy', mix: ['shot', 'pike', 'shot', 'sabre'], tier: 2, ai: 'hold', min: 6, max: 24 });
const AMBUSHES = {
    tatars: { title: 'Tatar raiders', skin: 'raider', foe: 'Tatar raiders', mix: ['sabre', 'sabre', 'shot', 'sabre'],
        text: 'A Nogai band rises out of the tall grass and dismounts to take the train.' },
    masterless: { title: 'Masterless men', skin: 'bandit', foe: 'masterless men', mix: ['sabre', 'pike', 'shot'],
        text: 'Runaways who answer to no lord are waiting in a ravine where the road narrows.' },
    roadagents: { title: 'Road agents', skin: 'bandit', foe: 'road agents', mix: ['sabre', 'pike', 'sabre', 'shot'],
        text: 'Cut-purses step out of the forest with the light behind them.' },
    deserters: { title: 'Deserters', skin: 'deserter', foe: 'deserters', mix: ['shot', 'pike', 'shot'],
        text: 'Unpaid musketeers have taken to the road, and they mean to collect their arrears from you.' },
    riverthieves: { title: 'River thieves', skin: 'deserter', foe: 'river thieves', mix: ['shot', 'sabre', 'shot'],
        text: 'Boats put out from the reeds, and men with muskets wade out for the rafts.' },
    muscovites: { title: 'Muscovite foragers', skin: 'muscovite', foe: 'Muscovite foragers', mix: ['shot', 'sabre', 'pike', 'shot'],
        text: "Streltsy from Shein's army are out looking for bread, and a train will do." },
    imperials: { title: 'Imperial foragers', skin: 'imperial', foe: 'Imperial foot', mix: ['shot', 'pike', 'sabre', 'shot'],
        text: "Wallenstein's yellow-coats are stripping the country, and they want your carts." },
    croats: { title: 'Croat horse', skin: 'raider', foe: 'Croats', mix: ['sabre', 'sabre', 'sabre', 'shot'],
        text: "The Emperor's Croats, the terror of Silesia, come off their horses with sabres out." },
    swedes: { title: 'Swedish foragers', skin: 'swede', foe: 'Swedish foot', mix: ['shot', 'pike', 'shot', 'pike'],
        text: 'Blue-coats in good order block the road and ask for a toll in bread.' }
};
// Chance a day on the road brings an ambush, by road danger 0 to 3.
const AMBUSH_RATE = [0.005, 0.02, 0.04, 0.06];
function makeAmbush(st, land, from) {
    const key = pick(LANDS[land].ambush), A = AMBUSHES[key];
    const c = makeContract(st, Object.assign({ id: key, who: '', tier: 1, ai: 'charge' }, A), threat(st) < 6 ? 'easy' : 'fair'); // Object.assign and the payoff below make it one
    Object.assign(c, { ambush: true, grade: 'ambush', who: 'On the road from ' + from, pay: 0, renown: 2, ttl: 1, bonus: null, cap: ROSTER_MAX, weather: st.weather });
    const share = clamp(Math.ceil(st.cargo * (0.05 + 0.02 * c.units.length)), 1, Math.max(1, st.cargo));
    c.payoff = { cargo: share, coin: Math.round(share * unitPrice(st) * 1.25) };
    return c;
}
// Beaten in an ambush, the raiders make off with a third of the cargo; sounding the retreat leaves a fifth behind.
const raidLoss = (st, retreated) => Math.min(st.cargo, Math.ceil(st.cargo * (retreated ? 0.2 : 0.35)));
function payOff(st, how) {
    const c = st.ambush;
    if (!c)
        return false;
    if (how === 'coin') {
        if (st.thalers < c.payoff.coin)
            return false;
        st.thalers -= c.payoff.coin;
        logLine(st, 'Paid ' + c.payoff.coin + ' thalers to ' + c.foe + ' for the road.');
    }
    else {
        const n = Math.min(st.cargo, c.payoff.cargo);
        st.cargo -= n;
        st.stats.lost.raid += n;
        logLine(st, 'Paid ' + c.foe + ' ' + n + ' ' + cargoName(st, n) + ' for the road.');
    }
    st.ambush = null;
    st.odds = {};
    return true;
}
/* ---------- days on the road and in camp ---------- */
function note(st, L, t) { logLine(st, t); L.push(t); }
// One day passes. mode: 'march', 'forced' or 'camp'.
function passDay(st, mode, L) {
    const T = transportOf(st), road = mode === 'march' || mode === 'forced';
    st.weather = rollWeather();
    for (const s of st.roster) {
        if (s.wound > 0) {
            s.wound--;
            s.hp = Math.min(s.vig, s.hp + (st.staff.surgeon ? 7 : 4));
            if (s.wound === 0)
                note(st, L, s.name + ' is back on his feet.');
        }
        else if (s.fought)
            s.hp = Math.min(s.vig, s.hp + 2);
        else if (road) {
            s.hp = Math.min(s.vig, s.hp + 2);
            s.xp += 1;
        }
        else if (s.order === 'rest') {
            s.hp = Math.min(s.vig, s.hp + (st.staff.surgeon ? 16 : 10));
            s.morale = clamp(s.morale + 4, 0, 100);
        }
        else if (s.order === 'forage') {
            st.bread += ri(1, 3);
            s.hp = Math.min(s.vig, s.hp + 2);
            s.xp += 3;
        }
        else {
            s.xp += st.staff.drill ? 15 : 10;
            s.hp = Math.min(s.vig, s.hp + 2);
        }
        if (mode === 'forced') {
            s.hp = Math.max(1, s.hp - 4);
            s.morale = clamp(s.morale - 2, 0, 100);
        }
        s.fought = false;
    }
    const need = breadDue(st);
    if (st.bread >= need)
        st.bread -= need;
    else {
        st.bread = 0;
        all(st, s => { bump(s, 'morale', -9); bump(s, 'hp', -5); });
        if (st.roster.length)
            note(st, L, 'No bread. The company goes hungry.');
    }
    all(st, s => { if (st.staff.chaplain)
        bump(s, 'morale', 1); if (s.morale < 55)
        s.morale++;
    else if (s.morale > 82)
        s.morale--; });
    if (road && st.cargo > 0) {
        if (st.weather === 'rain' && T.rain && chance(T.rain)) {
            st.cargo--;
            st.stats.lost.rain++;
            note(st, L, T.rainText);
        }
        if (mode === 'forced' && T.forcedLoss && chance(T.forcedLoss)) {
            const n = Math.min(st.cargo, ri(1, T.forcedMax));
            st.cargo -= n;
            st.stats.lost.forced += n;
            note(st, L, T.forcedText(n));
        }
    }
    st.date++;
    st.day++;
    if (st.date >= st.payDue)
        payDay(st, L);
    for (const s of st.roster.slice()) {
        if (s.morale < 15 && chance(0.45)) {
            st.roster = st.roster.filter(r => r !== s);
            st.stats.deserted++;
            note(st, L, s.name + ' deserts in the night.');
        }
    }
    levelUps(st, L);
}
// Wages fall due every thirty days. The payroll's own escort is tempted by the chest when the pay is late.
function payDay(st, L) {
    const w = wagesDue(st);
    st.payDue += 30;
    if (!st.roster.length)
        return;
    if (st.thalers >= w) {
        st.thalers -= w;
        note(st, L, 'Pay day. ' + w + ' thalers are counted out.');
        return;
    }
    st.thalers = 0;
    all(st, s => bump(s, 'morale', -15));
    note(st, L, 'Pay day, and the chest cannot cover it. The men go unpaid.');
    if (questOf(st).kind !== 'commission')
        return;
    for (const s of st.roster) {
        if (s.morale < 50 && st.cargo > 0 && chance(0.5)) {
            const n = Math.min(st.cargo, ri(3, 8));
            st.cargo -= n;
            st.stats.lost.pilfered += n;
            note(st, L, s.name + ' helps himself to ' + n + " thalers from the Crown's chest.");
        }
    }
}
// What a place has on offer when the company arrives.
function arrive(st) {
    st.contracts = [];
    st.recruits = [];
    if (has(st, 'work'))
        genContracts(st);
    if (has(st, 'recruits'))
        genRecruits(st);
}
// March one leg. Returns the day's news, and an ambush or camp event if one comes up.
function march(st, roadIndex, forced) {
    const r = roadsFrom(st).find(x => x.i === roadIndex);
    if (!r || st.over || st.ambush || !st.roster.length)
        return null;
    const L = [], days = forced ? r.forced : r.days, from = here(st), q = questOf(st);
    for (let d = 0; d < days; d++)
        passDay(st, forced ? 'forced' : 'march', L);
    st.at = r.to;
    st.path.push(r.to);
    note(st, L, 'After ' + days + (days > 1 ? ' days' : ' day') + (forced ? ' of forced marching' : ' on the road') + ', the company comes to ' + here(st).name + '.');
    arrive(st);
    let ambush = null, event = null;
    const rate = AMBUSH_RATE[r.danger] * (q.kind === 'commission' ? 1.3 : 1);
    if (st.roster.length && st.cargo > 0 && chance(1 - Math.pow(1 - rate, days))) {
        const a = makeAmbush(st, r.land, from.name);
        if (a.units.every(u => u.tier === 0) && st.renown >= 12)
            note(st, L, cap1(a.foe) + ' watch the banner go by and think better of it.');
        else
            ambush = a;
    }
    if (!ambush && st.roster.length && chance(0.35))
        event = rollEvent(st);
    st.ambush = ambush;
    st.odds = {};
    return { lines: L, event, ambush };
}
/* ---------- setting a course ---------- */
// Days along a course until it reaches a market: what the bread has to last.
function courseMarketDays(legs, forced) {
    let d = 0;
    for (const r of legs) {
        d += forced ? r.forced : r.days;
        if ((SERVICES[PLACES[r.to].kind] || {}).market)
            break;
    }
    return d;
}
// March leg after leg towards a place. The company stops for anything that needs the player: an
// encounter, the quest's destination on the way, or a market it should not leave because the bread
// or the pay would not last to the next one. `stop` says why it stopped.
function followCourse(st, target, forced) {
    const L = [];
    let legs = 0, stop = null, event = null, ambush = null;
    while (!stop && legs < 60) {
        if (st.over)
            stop = 'over';
        else if (st.at === target)
            stop = 'arrived';
        else if (legs && atEnd(st))
            stop = 'destination';
        if (stop)
            break;
        const route = routeTo(st, target);
        if (!route) {
            stop = 'noroad';
            break;
        }
        if (!st.roster.length) {
            stop = 'nobody';
            break;
        }
        if (has(st, 'market')) {
            const md = courseMarketDays(route, forced), name = here(st).name;
            if (st.bread < breadDue(st) * md) {
                stop = 'bread';
                note(st, L, 'The bread will not last the ' + md + ' days to the next market on the way, so the company halts at ' + name + '.');
                break;
            }
            if (st.thalers < wagesDue(st) && st.payDue - st.date <= md) {
                stop = 'pay';
                note(st, L, 'Pay falls due before the next market on the way, and the chest is short, so the company halts at ' + name + '.');
                break;
            }
        }
        const res = march(st, route[0].i, forced);
        if (!res) {
            stop = 'nobody';
            break;
        }
        legs++;
        L.push(...res.lines);
        if (res.ambush) {
            ambush = res.ambush;
            stop = 'ambush';
        }
        else if (res.event) {
            event = res.event;
            stop = 'event';
        }
    }
    return { lines: L, event, ambush, stop, legs };
}
// Stay a day where the company is: day orders apply. After paid work the day was spent fighting.
function campDay(st) {
    const L = [];
    passDay(st, 'camp', L);
    if (has(st, 'work')) {
        st.contracts.forEach(c => c.ttl--);
        st.contracts = st.contracts.filter(c => c.ttl > 0);
        genContracts(st);
    }
    if (has(st, 'recruits') && st.day % 3 === 0)
        genRecruits(st);
    st.odds = {};
    let event = null;
    if (st.roster.length && chance(0.12))
        event = rollEvent(st);
    return { lines: L, event };
}
function sellCargo(st, n) {
    if (!has(st, 'market') || atEnd(st))
        return false;
    n = Math.min(n, st.cargo);
    if (n < 1)
        return false;
    const p = unitPrice(st) * n, q = questOf(st);
    st.cargo -= n;
    st.thalers += p;
    st.stats.sold += n;
    logLine(st, q.kind === 'commission' ? 'Took ' + n + " thalers from the Crown's chest." : 'Sold ' + n + ' ' + cargoName(st, n) + ' at ' + here(st).name + ' for ' + p + ' thalers.');
    return true;
}
// The end of the road: sell the cargo, or hand over the chest for the fee.
function deliver(st) {
    const q = questOf(st);
    if (!atEnd(st) || st.over || st.ambush)
        return null;
    const pay = cargoValue(st), late = lateDays(st), missing = st.cargo0 - st.cargo;
    let ren = late ? 4 : 10;
    if (q.kind === 'commission')
        ren -= Math.floor(missing / 10);
    st.thalers += pay;
    st.stats.earned += pay;
    st.renown = Math.max(0, st.renown + ren);
    st.result = { pay, late, cargo: st.cargo, cargo0: st.cargo0, renown: ren, factor: lateFactor(st) };
    st.over = 'arrived';
    logLine(st, (q.kind === 'commission' ? 'The chest is handed over at ' : 'The cargo is sold at ') + PLACES[q.to].name + ' for ' + pay + ' thalers.');
    return st.result;
}
// With nobody under the banner and nobody to hire here, the company is finished.
function stranded(st) {
    if (st.roster.length)
        return false;
    const cheapest = st.recruits.length ? Math.min.apply(null, st.recruits.map(r => r.price)) : Infinity;
    return !(has(st, 'recruits') && st.thalers >= cheapest);
}
function originFor(cls, land) {
    const ok = ORIGINS.filter(o => o.cls.includes(cls) && LANDS[land].origins.includes(o.id));
    return pick(ok.length ? ok : ORIGINS.filter(o => o.cls.includes(cls)));
}
function newGame(questId) {
    const q = QUESTS.find(x => x.id === questId) || QUESTS[0];
    const st = {
        v: 2, quest: q.id, date: q.start, day: 1, at: q.from, path: [q.from], weather: 'clear',
        thalers: q.thalers, bread: q.bread, powder: 14, renown: 0, cargo: q.cargo.n, cargo0: q.cargo.n, payDue: q.start + 30,
        roster: [], recruits: [], contracts: [], ambush: null, result: null,
        staff: { surgeon: false, drill: false, qm: false, chaplain: false }, log: [], seen: [], pending: null, over: null,
        nextId: 1, odds: {}, stats: { battles: 0, won: 0, kills: 0, earned: 0, deserted: 0, dead: [], sold: 0, start: q.thalers, lost: { rain: 0, forced: 0, raid: 0, pilfered: 0 } }
    };
    const land = PLACES[q.from].land;
    q.men.forEach(cls => st.roster.push(makeSoldier(st, cls, 1, originFor(cls, land))));
    st.roster.forEach(s => { if (s.trait && !TRAITS[s.trait].good)
        s.trait = null; });
    arrive(st);
    logLine(st, q.opening);
    return st;
}
