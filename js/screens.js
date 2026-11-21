"use strict";
/* ===== SOTNIA interface: screens (shared state, saving, the HTML for every screen) ===== */
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => clamp(Math.round(100 * a / b), 0, 100);
const ORDER = { drill: 'Drill', rest: 'Rest', forage: 'Forage' };
const STANCE = {
    hold: { name: 'Hold', icon: 'wall', fx: [['shield', 'Stand where you are'], ['shot', 'Muskets reload faster']] },
    advance: { name: 'Advance', icon: 'boot', fx: [['boot', 'March on them in line'], ['shot', 'Fire once in range']] },
    charge: { name: 'Charge', icon: 'forced', fx: [['swords', 'Hit hard on arrival'], ['shield', 'Guard badly after']] }
};
const DUEL_STANCE = {
    advance: { name: 'Measure him', icon: 'eye', fx: [['eye', 'Close with care'], ['swords', 'Trade cuts']] },
    charge: { name: 'Rush him', icon: 'forced', fx: [['swords', 'A heavy first blow'], ['shield', 'A poorer guard after']] }
};
const LOOK = { pike: 'woad', shot: 'steel', sabre: 'madder' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = (n) => ROMAN[n] || String(n);
// The campaign in play: null until one is raised or continued, so on the title screen. The screens after it are built only with a
// campaign in hand, which is why they write G!; save(), barHTML() and the frame loop are what look.
let G = null;
const ui = { screen: 'title', panel: null, scrollCard: null, course: null, open: null, c: null, pick: [], stance: null, odds: null, b: null, speed: 1, rep: null, modal: null, news: null, sound: true, music: true, view: null, camp: null, campPos: {}, demo: null, overT: 0, verdict: false, fresh: null, codex: 'nations', codexFrom: 'title', captains: null, post: 'captain', pass: null, deltas: null };
/* ---------- saving ---------- */
const SAVE = 'sotnia-save-3';
function save() { try {
    if (G && !G.over)
        localStorage.setItem(SAVE, JSON.stringify(G));
    else
        localStorage.removeItem(SAVE);
}
catch (e) { /* no storage here */ } }
function loadSave() { try {
    const s = JSON.parse(localStorage.getItem(SAVE) || 'null');
    return s && s.v === 3 && !s.over && PLACES[s.at] ? s : null;
}
catch (e) {
    return null;
} }
try {
    localStorage.removeItem('sotnia-save-2');
}
catch (e) { /* no storage here */ } // the campaigns of the old shape are dropped
try {
    ui.sound = localStorage.getItem('sotnia-sound') !== 'off';
    ui.music = localStorage.getItem('sotnia-music') !== 'off';
}
catch (e) { /* default on */ }
/* ---------- small parts: every screen is built from these ---------- */
const man = (id) => G.roster.find(s => s.id === id);
const foeName = (u) => TIER[u.tier] + ' ' + CLS[u.cls].name.toLowerCase();
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const DANGER = ['A quiet road', 'Robbers about', 'Dangerous country', 'Deadly country'];
const sr = (t) => '<span class="sr">' + t + '</span>';
const meter = (kind, v, max) => '<span class="meter ' + kind + '"><i style="width:' + pct(v, max) + '%"></i></span>';
const pips = (n, of, label) => '<span class="pips" role="img" aria-label="' + esc(label) + '">' + Array.from({ length: of }, (_, i) => '<i' + (i < n ? ' class="on"' : '') + '></i>').join('') + '</span>';
const oddsPips = (p) => (p >= 0.85 ? 5 : p >= 0.65 ? 4 : p >= 0.42 ? 3 : p >= 0.2 ? 2 : 1);
// An icon and its number; the word is there for screen readers and on hover.
const stat = (icon, v, label) => '<span class="st" title="' + esc(label) + '">' + ic(icon) + '<b>' + v + '</b>' + sr(' ' + esc(label)) + '</span>';
// An effect: an icon, an amount and what it is of, coloured by whether it helps.
function fxChip(f) {
    const tone = f[3] || (/^\+/.test(f[1]) ? 'up' : /^[−-]/.test(f[1]) ? 'down' : 'even');
    return '<span class="fx ' + tone + '">' + ic(f[0]) + '<b>' + esc(f[1]) + '</b><span>' + esc(f[2]) + '</span></span>';
}
const fxLine = (f) => '<span class="line">' + ic(f[0]) + '<span>' + esc(f[1]) + '</span></span>';
// The card: a name banner, a picture, its body, and the type bar along the foot with the coin at its left.
function cardHTML(o) {
    const tag = o.tag || 'article', head = tag === 'article' ? 'h3' : 'span';
    let h = '<' + tag + ' class="card ' + (o.cls || '') + '"' + (o.attrs || '') + '><span class="face">';
    h += '<' + head + ' class="banner">' + o.title + '</' + head + '>';
    if (o.art)
        h += '<span class="art ' + (o.artCls || '') + '"><img src="' + o.art + '" alt="">' + (o.badges || '') + '</span>';
    h += o.body || '';
    if (o.type) {
        const t = o.type;
        h += '<span class="type ' + (t.look || 'ink') + (t.coin != null ? ' coined' : '') + (t.lvl ? ' levelled' : '') + (t.end ? ' ended' : '') + '"' + (t.style ? ' style="' + t.style + '"' : '') + '>' + (t.coin != null ? '<span class="coin" title="' + esc(t.coinLabel || '') + '">' + t.coin + sr(' ' + (t.coinLabel || '')) + '</span>' : '') +
            '<span class="tt">' + t.text + '</span>' + (t.lvl ? '<span class="lvl" title="Level">' + t.lvl + sr(' level') + '</span>' : '') + (t.end || '') + '</span>';
    }
    return h + '</span></' + tag + '>';
}
/** The colours of a man's country as a little flag, in stripes, to stand before the name of his nation. */
function flagHTML(origin) {
    const f = flagOf(origin);
    if (!f)
        return '';
    const n = f.length, stops = f.map((c, i) => c + ' ' + (100 * i / n).toFixed(1) + '% ' + (100 * (i + 1) / n).toFixed(1) + '%').join(',');
    return '<i class="flag" aria-hidden="true" style="background:linear-gradient(' + stops + ')"></i>';
}
function sectHTML(title, aside) { return '<h2 class="sect"><span>' + title + '</span>' + (aside ? '<small>' + aside + '</small>' : '') + '</h2>'; }
/* ---------- the bar along the top: where, when, and what the company has ---------- */
function toolsHTML() {
    return '<div class="tools">' +
        (ui.screen === 'battle' || ui.screen === 'codex' ? '' : '<button class="tool" data-act="codex" aria-label="Encyclopedia" title="Encyclopedia">' + ic('book') + '</button>') +
        '<button class="tool" data-act="help" aria-label="Standing orders" title="Standing orders">' + ic('scroll') + '</button>' +
        '<button class="tool' + (ui.music ? '' : ' off') + '" data-act="music" aria-pressed="' + ui.music + '" aria-label="Music" title="Music">' + ic('note') + '</button>' +
        '<button class="tool' + (ui.sound ? '' : ' off') + '" data-act="sound" aria-pressed="' + ui.sound + '" aria-label="Sound" title="Sound">' + ic('speaker') + '</button></div>';
}
function barHTML() {
    let h = '<header class="bar"><h1 class="logo">Sotnia</h1>';
    if (!G || ui.screen === 'title' || ui.screen === 'captain' || ui.screen === 'end' || ui.screen === 'codex')
        return h + '<p class="strap">A free company · Anno 1633</p><span class="grow"></span>' + toolsHTML() + '</header>';
    const q = questOf(G), left = daysLeft(G), done = Math.round(100 * progress(G)), camp = ui.screen === 'camp';
    const dl = (k) => { const v = ui.deltas && ui.deltas[k]; return v ? '<i class="delta ' + (v > 0 ? 'up' : 'down') + '" aria-hidden="true">' + (v > 0 ? '+' : '−') + Math.abs(v) + '</i>' : ''; };
    const due = left >= 0 ? plural(left, 'day', 'days') + ' until ' + q.until : plural(-left, 'day', 'days') + ' late: the price is falling';
    const trip = '<span>' + esc(cap1(PLACES[q.from].name)) + '</span><span class="track"><i style="width:' + done + '%"></i><b style="left:' + done + '%"></b></span><span>' + esc(PLACES[q.to].name) + '</span>';
    h += '<div class="where"><b>' + esc(cap1(here(G).name)) + '</b><span>' + dateText(G.date) + '</span></div>' +
        (camp ? '<button class="trip" data-act="tab" data-k="map" aria-label="' + esc('The map: ' + done + '% of the way to ' + PLACES[q.to].name) + '">' + trip + '</button>' : '<span class="trip" aria-hidden="true">' + trip + '</span>') +
        '<span class="stat due' + (left < 0 ? ' late' : left < daysToGo(G) ? ' tight' : '') + '" title="' + esc(due) + '">' + ic('hourglass') + '<b>' + Math.abs(left) + '</b><small>' + (left < 0 ? 'late' : 'days') + '</small>' + sr(' ' + esc(due)) + '</span>' +
        '<span class="grow"></span><div class="stats" aria-label="The company ledger">' +
        '<span class="stat" title="' + esc(cap1(q.cargo.unit)) + '">' + ic(q.kind === 'commission' ? 'coin' : 'barrel') + '<b>' + G.cargo + '</b>' + dl('cargo') + '<small>of ' + G.cargo0 + '</small>' + sr(' ' + esc(q.cargo.unit)) + '</span>' +
        '<span class="stat" title="Thalers: ' + wagesDue(G) + ' of pay fall due on ' + dateText(G.payDue, true) + '">' + ic('coin') + '<b>' + G.thalers + '</b>' + dl('thalers') + '<small>pay ' + wagesDue(G) + '</small>' + sr(' thalers, ' + wagesDue(G) + ' of pay due on ' + dateText(G.payDue, true)) + '</span>' +
        '<span class="stat" title="Bread: the company eats ' + breadDue(G) + ' a day">' + ic('loaf') + '<b>' + G.bread + '</b>' + dl('bread') + '<small>−' + breadDue(G) + ' a day</small>' + sr(' bread') + '</span>' +
        '<span class="stat" title="Charges of powder">' + ic('horn') + '<b>' + G.powder + '</b>' + dl('powder') + sr(' charges of powder') + '</span>' +
        '<span class="stat" title="Renown">' + ic('mace') + '<b>' + G.renown + '</b>' + dl('renown') + sr(' renown') + '</span></div>';
    return h + toolsHTML() + '</header>';
}
/* ---------- the cards ---------- */
/**
 * One slot of a man's kit as a ladder of its four pieces, worst to best: the ones he has passed lit but faded, the one he has framed
 * in gilt, the next in grey with its price, and the rest as silhouettes. The button buys the next piece, and a card shows the man in
 * it while the button is under the pointer or has focus (see tryOn in main.ts), even when he cannot yet pay.
 */
function gearHTML(s, k) {
    const names = k === 'wpn' ? WPN[s.cls] : ARM, t = s[k], what = k === 'wpn' ? 'arms' : 'armour', fresh = !!ui.fresh && ui.fresh.id === s.id && ui.fresh.k === k;
    const rungs = '<span class="rungs" role="img" aria-label="' + esc(names[t] + ', ' + (t + 1) + ' of 4') + '">' + names.map((n, i) => '<span class="rung ' + (i < t ? 'was' : i === t ? 'now' + (fresh ? ' fresh' : '') : i === t + 1 ? 'next' : 'far') + '" title="' + esc(n + (i === t ? ', his now' : i === t + 1 ? ', ' + gearPrice(G, t) + ' thalers' : '')) + '"><img src="' + gearArt(k, s.cls, i, nationOf(s.origin)) + '" alt=""></span>').join('') + '</span>';
    const head = '<span class="gname">' + ic(k === 'wpn' ? s.cls : 'cuirass') + '<span>' + esc(names[t]) + '</span></span>';
    if (t >= 3)
        return '<span class="gear" data-slot="' + k + '">' + head + rungs + '<span class="best" title="The best there is">' + ic('star', 'The best there is') + '</span></span>';
    const p = gearPrice(G, t), shop = has(G, 'market');
    return '<span class="gear" data-slot="' + k + '">' + head + rungs + '<button class="mini" data-act="up" data-id="' + s.id + '" data-k="' + k + '"' + (!shop || G.thalers < p ? ' aria-disabled="true"' : '') +
        ' aria-label="' + esc('Better ' + what + ' for ' + s.name + ': ' + names[t + 1] + ', ' + p + ' thalers') + '" title="' + esc(shop ? names[t + 1] + ', ' + p + ' thalers' : 'Bought only where there is a market') + '">' + ic('up') + p + '</button></span>';
}
function soldierCard(s) {
    const c = CLS[s.cls], skill = s.cls === 'shot' ? s.aim : s.mel, T = s.trait && TRAITS[s.trait];
    let badges = '';
    if (T)
        badges += '<span class="badge' + (T.good ? '' : ' bad') + '" title="' + esc(T.desc) + '">' + ic(T.good ? 'star' : 'warn') + esc(s.trait) + sr(': ' + esc(T.desc)) + '</span>';
    if (s.wound)
        badges += '<span class="badge red right">' + ic('cross') + 'Abed ' + s.wound + '</span>' + sr(' for ' + plural(s.wound, 'day', 'days'));
    else if (s.scars.length)
        badges += '<span class="badge right" title="' + esc('Carries ' + s.scars.join(', ')) + '">' + ic('limp') + s.scars.length + sr(' ' + esc('Carries ' + s.scars.join(', '))) + '</span>';
    if (s.promos)
        badges += '<span class="ribbon">' + ic('star') + 'Promotion earned</span>';
    let body = '<span class="bars">' + ic('drop') + meter('hp', s.hp, s.vig) + '<span class="n">' + s.hp + '/' + s.vig + sr(' blood') + '</span>' +
        ic('flame') + meter('mo', s.morale, 100) + '<span class="n">' + s.morale + sr(' spirit') + '</span>' +
        ic('star') + meter('xp', s.xp, xpNeed(s.level)) + '<span class="n">' + s.xp + '/' + xpNeed(s.level) + sr(' experience') + '</span></span>';
    body += '<span class="strip">' + stat('heart', s.vig, 'Vigour') + stat(s.cls, skill, c.skill) + stat('shield', s.grd, 'Guard') + stat('swords', s.kills, 'Kills') + '</span>';
    if (s.promos) {
        body += '<span class="choose" role="group" aria-label="' + esc('Choose a promotion for ' + s.name) + '">' +
            [['vig', 'heart', '+8', 'Vigour +8'], ['skill', s.cls, '+2', c.skill + ' +2'], ['grd', 'shield', '+2', 'Guard +2']].map(p => '<button class="mini gold" data-act="promo" data-id="' + s.id + '" data-k="' + p[0] + '" aria-label="' + p[3] + '" title="' + p[3] + '">' + ic(p[1]) + p[2] + '</button>').join('') + '</span>';
    }
    body += s.wound ? '<span class="abed">' + ic('moon') + 'Resting until he can stand</span>' :
        '<span class="orders" role="group" aria-label="' + esc('Order in camp for ' + s.name) + '">' + Object.keys(ORDER).map(o => '<button data-act="order" data-id="' + s.id + '" data-o="' + o + '" aria-pressed="' + (s.order === o) + '">' + ic(o === 'rest' ? 'moon' : o) + ORDER[o] + '</button>').join('') + '</span>';
    body += '<span class="gears">' + gearHTML(s, 'wpn') + gearHTML(s, 'arm') + '</span>';
    body += '<button class="link" data-act="dismiss" data-id="' + s.id + '">Strike from the roll</button>';
    return cardHTML({
        cls: 'soldier' + (s.promos ? ' gilt' : '') + (s.id === ui.open ? ' sel' : ''), attrs: ' data-card="' + s.id + '" aria-label="' + esc(s.name) + '"', title: esc(s.name) + '<small>' + flagHTML(s.origin) + esc(s.origin) + '</small>',
        art: soldierArt(s), artCls: (s.wound ? 'hurt' : '') + (ui.fresh && ui.fresh.id === s.id ? ' fresh' : ''), badges, body,
        type: { look: LOOK[s.cls], text: c.name, coin: wageOf(s, G), coinLabel: 'Wage, thalers a month', lvl: roman(s.level) }
    });
}
function recruitCard(r, i, full) {
    const s = r.s, c = CLS[s.cls], T = s.trait && TRAITS[s.trait], off = full || G.thalers < recruitPrice(G, r);
    const badges = T ? '<span class="badge' + (T.good ? '' : ' bad') + '" title="' + esc(T.desc) + '">' + ic(T.good ? 'star' : 'warn') + esc(s.trait) + '</span>' : '';
    return cardHTML({
        tag: 'button', cls: 'buy', attrs: ' data-act="hire" data-i="' + i + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc('Hire ' + s.name + ', ' + s.origin + ' ' + c.name.toLowerCase() + ', level ' + s.level + (s.trait ? ', ' + s.trait.toLowerCase() : '') + ', for ' + recruitPrice(G, r) + ' thalers') + '"',
        title: esc(s.name) + '<small>' + flagHTML(s.origin) + esc(s.origin) + '</small>', art: soldierArt(s), badges,
        body: '<span class="strip">' + stat('heart', s.vig, 'Vigour') + stat(s.cls, s.cls === 'shot' ? s.aim : s.mel, c.skill) + stat('shield', s.grd, 'Guard') + '</span>' +
            '<span class="line">' + ic('coin') + '<span>Wage ' + wageOf(s, G) + ' a month</span></span>',
        type: { look: LOOK[s.cls], text: c.name + ' · ' + roman(s.level), coin: recruitPrice(G, r), coinLabel: 'Price to hire, thalers' }
    });
}
function supplyCard(k) {
    const bread = k === 'bread', p = bread ? breadPrice(G) : powderPrice(G);
    return '<div class="pile">' + cardHTML({
        tag: 'button', cls: 'buy', attrs: ' data-act="buy" data-k="' + k + '"' + (G.thalers < p ? ' disabled' : '') + ' aria-label="' + (bread ? 'Buy ten loaves of bread' : 'Buy ten charges of powder') + ' for ' + p + ' thalers"',
        title: bread ? 'Bread' : 'Powder', art: supplyArt(k), badges: '<span class="badge right">×10</span>',
        body: fxLine(bread ? ['men', 'Each man eats one a day'] : ['shot', 'One charge a shot']),
        type: { look: 'weld', text: 'Supply', coin: p, coinLabel: 'Price, thalers' }
    }) + '</div>';
}
function cargoCard() {
    const q = questOf(G), p = unitPrice(G), chest = q.kind === 'commission';
    const sell = (n, label, aria) => '<button class="mini" data-act="sell" data-n="' + n + '"' + (G.cargo < n ? ' disabled' : '') + ' aria-label="' + aria + '">' + label + '</button>';
    const body = chest ?
        '<span class="line">' + ic('warn') + '<span>Every thaler taken comes off the fee, and the Crown will remember it.</span></span><span class="choose">' + sell(10, '−10 ' + ic('coin'), 'Take 10 thalers from the chest') + sell(50, '−50 ' + ic('coin'), 'Take 50 thalers from the chest') + '</span>' :
        '<span class="compare"><span><small>Here</small><b>' + p + '</b></span><span class="there"><small>' + esc(PLACES[q.to].name) + '</small><b>' + q.price + '</b></span></span>' +
            '<span class="choose">' + sell(1, '−1 ' + ic('barrel'), 'Sell one ' + esc(q.cargo.one) + ' for ' + p + ' thalers') + sell(5, '−5 ' + ic('barrel'), 'Sell five ' + esc(q.cargo.many) + ' for ' + 5 * p + ' thalers') + '</span>';
    return cardHTML({ cls: 'cargo', attrs: ' aria-label="' + (chest ? 'The Crown’s chest' : 'The cargo') + '"', title: chest ? 'The Crown’s chest' : 'The ' + esc(q.cargo.many), art: questArt(q), body, type: { look: 'wood', text: 'Cargo · ' + G.cargo } });
}
/* ---------- the command: the captain, the officers and the retainer ---------- */
const fxRow = (chips) => chips.length ? '<span class="fxrow">' + chips.map(fxChip).join('') + '</span>' : '';
const modChips = (mods) => mods.map(m => modChip(m).chip);
const trait = (kind, icon, name) => '<span class="trait ' + kind + '">' + ic(icon) + '<b>' + esc(name) + '</b></span>';
/** A captain: where he is from, what he is good and bad at, and the order he gives in a fight. pick makes the card the button that takes him as the captain of the commission. */
function captainCard(c, pick) {
    const T = CAPTAINS[c.type], O = ORDERS[T.order], label = originLabel(T.origin);
    return cardHTML({
        tag: pick ? 'button' : 'article', cls: 'captain' + (pick ? ' buy' : ''), attrs: pick ? ' data-act="new" data-q="' + pick.q + '" data-c="' + pick.i + '" aria-label="' + esc('Take ' + c.name + ', ' + T.title.toLowerCase() + ', as captain') + '"' : ' aria-label="' + esc(c.name) + '"',
        title: esc(c.name) + '<small>' + flagHTML(label) + esc(label) + '</small>', art: captainArt(c),
        body: '<span class="flavour">' + esc(T.blurb) + '</span>' + trait('good', 'star', T.perk.name) + fxRow(modChips(T.perk.mods)) + trait('bad', 'warn', T.flaw.name) + fxRow(modChips(T.flaw.mods)) +
            trait('order', O.icon, 'Order: ' + O.name) + '<span class="line">' + ic('flag') + '<span>' + esc(O.text) + ' Given once in a fight.</span></span>',
        type: { look: LOOK[T.cls], text: esc(T.title), end: pick ? '<span class="btn go sm">' + ic('flag') + 'Take command</span>' : undefined }
    });
}
/** An officer: in post (seated, with the button that lets him go), or one of the men looking for the post (an offer, the button that engages him). */
function officerCard(o, how, i = 0) {
    const S = SPECIALTIES[o.kind], seated = how === 'seated', label = originLabel(o.origin), g = G;
    const held = !!g.officers[o.station], place = held || officersOf(g).length < officerSlots(g), off = !seated && (g.thalers < o.fee || !place);
    const why = seated ? '' : !place ? 'No place for another officer until ' + nextSlotRenown(g) + ' renown' : g.thalers < o.fee ? 'The fee is ' + o.fee + ' thalers' : '';
    let body = '<span class="flavour">' + esc(S.blurb) + '</span>' + fxRow(officerChips(o.kind).map(c => c.chip));
    body += seated ? '<button class="link" data-act="letgo" data-k="' + o.station + '">Let him go</button>' : fxLine(['coin', 'Then ' + o.wage + ' thalers a month']) + (held ? fxLine(['up', 'Takes the place of ' + g.officers[o.station].name]) : '');
    return cardHTML({
        tag: seated ? 'article' : 'button', cls: 'officer ' + (seated ? 'hired' : 'buy'),
        attrs: seated ? ' aria-label="' + esc(o.name + ', ' + STAFF[o.station].name.toLowerCase() + ', in your pay') + '"' :
            ' data-act="engage" data-k="' + o.station + '" data-i="' + i + '"' + (off ? ' disabled title="' + esc(why) + '"' : '') + ' aria-label="' + esc('Engage ' + o.name + ', ' + S.title.toLowerCase() + ', for ' + o.fee + ' thalers, then ' + o.wage + ' a month' + (why ? '. ' + why : '')) + '"',
        title: esc(o.name) + '<small>' + flagHTML(label) + esc(label) + '</small>', art: officerArt(o.kind),
        badges: seated ? '<span class="badge moss right">' + ic('check') + 'In your pay</span>' : '', body,
        type: { look: 'moss', text: esc(cap1(S.title.replace(/^an? /i, ''))), coin: seated ? o.wage : o.fee, coinLabel: seated ? 'Wage, thalers a month' : 'Fee to engage, thalers' }
    });
}
function retainerCard(r) {
    const T = RETAINERS[r.type];
    return cardHTML({
        cls: 'officer hired', attrs: ' aria-label="' + esc(r.name + ', ' + T.title.toLowerCase() + ', with the train') + '"', title: esc(r.name), art: retainerArt(r.type),
        badges: '<span class="badge moss right">' + ic('check') + 'With the train</span>',
        body: '<span class="flavour">' + esc(T.blurb) + '</span>' + fxRow(modChips(T.mods)) + '<button class="link" data-act="letgoR">Pay ' + (T.she ? 'her' : 'him') + ' off</button>',
        type: { look: 'moss', text: esc(cap1(T.title.replace(/^an? /i, ''))), coin: r.wage, coinLabel: 'Wage, thalers a month' }
    });
}
const vacant = (icon, title, text) => '<div class="vacant">' + ic(icon) + '<b>' + esc(title) + '</b><span>' + esc(text) + '</span></div>';
function commandPanel() {
    const g = G, held = officersOf(g).length, slots = officerSlots(g), next = nextSlotRenown(g), town = has(g, 'staff');
    const item = (k, icon, title, sub) => '<button role="tab" data-act="post" data-k="' + k + '" aria-selected="' + (ui.post === k) + '">' + ic(icon) + '<span><b>' + title + '</b><small>' + esc(sub) + '</small></span></button>';
    let rail = item('captain', 'flag', 'Captain', g.captain.name);
    for (const k of STATIONS)
        rail += item(k, STAFF[k].icon, STAFF[k].name, g.officers[k] ? g.officers[k].name : held >= slots ? 'No place yet' : 'Vacant');
    rail += item('retainer', 'wagon', 'Retainer', g.retainer ? g.retainer.name : 'None');
    let h = '<div class="command"><nav class="rail" role="tablist" aria-label="Who leads the company" aria-orientation="vertical">' + rail +
        '<p class="slots">' + ic('men') + '<span>' + held + ' of ' + slots + ' places held' + (next != null ? '; the next opens at ' + next + ' renown' : '') + '</span></p></nav><section class="post" role="tabpanel">';
    if (ui.post === 'captain') {
        const T = CAPTAINS[g.captain.type], O = ORDERS[T.order];
        h += sectHTML('The captain', 'commands from the first day to the last') + '<div class="duo"><div class="cards">' + captainCard(g.captain) + '</div><div class="prose">' +
            '<p><b>His ways.</b> ' + esc(T.perk.name) + ' and ' + esc(T.flaw.name.charAt(0).toLowerCase() + T.flaw.name.slice(1)) + ' hold for the whole road, in everything the company does.</p>' +
            '<p><b>His order.</b> ' + esc(g.captain.name.split(' ')[0]) + ' leads from behind the line and does not fight in it. In a fight, ' + esc(O.name.toLowerCase()) + ' can be called once, at the moment you choose: ' + esc(O.text.charAt(0).toLowerCase() + O.text.slice(1)) + ' It lasts ' + O.secs + ' seconds, and the scouts do not count on it.</p>' +
            '<p><b>The rest of the command.</b> ' + (held ? held + ' of ' + slots + ' places held' : 'No officer is engaged yet') + (next != null ? '; a place opens at ' + next + ' renown' : '') + '. A surgeon, a drillmaster, a quartermaster and a chaplain are engaged in the towns, three men to choose from for each post. Now and then someone asks to ride with the train.</p></div></div>';
    }
    else if (ui.post === 'retainer') {
        h += sectHTML('The retainer', 'one at a time, and not for hire in a market') + (g.retainer ? '<div class="cards">' + retainerCard(g.retainer) + '</div>' :
            vacant('wagon', 'Nobody rides with the train', 'Now and then, in a town, someone asks for a place: an engineer, a map-maker, a singer, a merchant. Take one on, and the company has a new way of its own. They are not found by looking.'));
    }
    else {
        const k = ui.post, O = g.officers[k], offers = g.pool[k] || [];
        h += sectHTML(STAFF[k].name, esc(STAFF[k].owns)) + (O ? '<div class="cards">' + officerCard(O, 'seated') + '</div>' : vacant(STAFF[k].icon, held >= slots ? 'No place for another officer' : 'The post is vacant', held >= slots ? 'The company holds ' + held + ' officers, as many as its renown allows' + (next != null ? ' until ' + next + ' renown' : '') + '. Let one go, or engage a man in the place of one in post.' : 'Nobody holds it. Engage one of the men below.'));
        if (town)
            h += sectHTML(O ? 'Or in his place' : 'Looking for the post', 'in ' + esc(here(g).name)) + (offers.length ? '<div class="cards">' + offers.map((o, i) => officerCard(o, 'offer', i)).join('') + '</div>' : '<p class="empty">' + ic('hourglass') + 'Nobody else is looking for this post today. New faces come every few days.</p>');
        else
            h += '<p class="empty">' + ic('hourglass') + 'Nobody here is looking for a post. Officers are found in the towns.</p>';
    }
    return h + '</section></div>';
}
/** The page where the captain of a new company is chosen: three men, each with a perk and a flaw and an order of his own. */
function captainsHTML() {
    const cs = ui.captains, q = QUESTS.find(x => x.id === cs.q);
    return '<section class="captains">' + sectHTML('Who leads the company?', 'chosen once, for the whole road') +
        '<p class="lede">' + esc(q.title) + ': ' + esc(cap1(PLACES[q.from].name)) + ' to ' + esc(PLACES[q.to].name) + '. Three captains are willing to take the banner. Each is good at something and bad at something, and each calls one order in a fight. The company is his from the first morning.</p>' +
        '<div class="cards wide">' + cs.list.map((c, i) => captainCard(c, { q: cs.q, i })).join('') + '</div><div><button class="btn ghost" data-act="title">' + ic('retreat') + 'Back to the commissions</button></div></section>';
}
function oddsFor(c) {
    if (!G.odds[c.id]) {
        const ids = defaultPick(G, c);
        G.odds[c.id] = ids.length ? stanceOdds(G, c, ids, 8) : { p: 0, best: 'advance', none: true };
    }
    return G.odds[c.id];
}
const WEATHER_ICON = { rain: 'rain', fog: 'fog' };
function contractCard(c, where) {
    const k = KIND[c.ai], o = where === 'work' ? oddsFor(c) : null;
    let badges = '<span class="badge">' + (c.duel ? 'Duel' : c.ambush ? 'Ambush' : k.tag) + '</span>';
    if (c.weather !== 'clear')
        badges += '<span class="badge light right" title="' + esc(WEATHER[c.weather]) + '">' + ic(WEATHER_ICON[c.weather]) + esc(WEATHER[c.weather].split(':')[0]) + sr(': ' + esc(WEATHER[c.weather].split(':')[1] || '')) + '</span>';
    let body = '<span class="who">' + esc(c.who) + '</span><span class="flavour">' + esc(c.text) + '</span>';
    const terms = c.ambush ? [] : [stat('mace', '+' + renownFor(G, c), 'renown'), stat('men', c.cap, c.cap === 1 ? 'one man' : 'men at most')];
    if (!c.ambush && !c.final)
        terms.push(stat('hourglass', c.ttl, c.ttl > 1 ? 'days open' : 'last day'));
    if (c.bonus)
        for (const x in c.bonus)
            terms.push(stat(x === 'bread' ? 'loaf' : 'horn', '+' + c.bonus[x], x));
    terms.push(stat('swords', c.units.length, c.units.length === 1 ? 'foe' : 'foes'));
    if (terms.length)
        body += '<span class="strip">' + terms.join('') + '</span>';
    if (o)
        body += '<span class="scouts">' + ic('eye') + (o.none ? '<span>No one fit to march</span>' : pips(oddsPips(o.p), 5, 'Scouts: ' + oddsWord(o.p)) + '<span>' + oddsWord(o.p) + '</span>') + '</span>';
    const end = where === 'work' ? '<button class="btn go sm" data-act="muster" data-id="' + c.id + '"' + (o && o.none ? ' disabled' : '') + '>' + ic('swords') + 'Muster</button>' : '';
    return cardHTML({
        cls: 'contract' + (c.final ? ' gilt' : ''), attrs: ' aria-label="' + esc(c.title) + '"', title: esc(c.title), art: foesArt(c), artCls: 'wide', badges, body,
        type: c.ambush ? { look: 'ink', text: 'No pay · ' + esc(cap1(c.foe)) } : { look: 'ink', text: c.duel ? 'Cold steel' : esc(cap1(c.foe)), coin: payFor(G, c), coinLabel: 'Pay, thalers', end }
    });
}
const PANELS = {
    map: { icon: 'map', title: 'The road', short: 'Road' },
    roll: { icon: 'men', title: 'The roll', short: 'Roll' },
    market: { icon: 'scales', title: 'The market', short: 'Market', need: 'market' },
    work: { icon: 'swords', title: 'Work', short: 'Work', need: 'work' },
    command: { icon: 'flag', title: 'Command', short: 'Command' },
    log: { icon: 'book', title: 'The chronicle', short: 'Chronicle' }
};
const PANEL_ORDER = ['map', 'roll', 'market', 'work', 'command', 'log'];
const panelsHere = () => PANEL_ORDER.filter(k => !PANELS[k].need || has(G, PANELS[k].need));
/** How many things a page holds, for the dock and the scene to say. */
const panelCount = (k) => k === 'roll' ? G.roster.length : k === 'market' ? (has(G, 'recruits') ? G.recruits.length : null) : k === 'work' ? G.contracts.length : k === 'command' ? officersOf(G).length : null;
const HOTSPOTS = [
    { k: 'roll', what: 'the men, their orders, their kit and their promotions', rect: [76, 44, 54, 42] },
    { k: 'command', what: 'the captain, the officers and the retainer', rect: [190, 44, 46, 38] },
    { k: 'market', what: 'bread, powder, the cargo, and men to hire', rect: [8, 72, 64, 28] },
    { k: 'work', what: 'the paid fights posted here', rect: [258, 66, 30, 40] },
    { k: 'map', what: 'the map, and the way on', rect: [294, 56, 24, 52] },
    { k: 'log', what: 'what has happened on the road, told on the banner', rect: [157, 15, 28, 22] }
];
/** A rectangle of the scene (scene pixels) as the style that lays a button over it. */
const sceneRect = (x, y, w, h) => 'left:' + (x / CW * 100).toFixed(2) + '%;top:' + (y / CH * 100).toFixed(2) + '%;width:' + (w / CW * 100).toFixed(2) + '%;height:' + (h / CH * 100).toFixed(2) + '%';
/** The little card that opens over the man picked in camp: his blood and spirit, his order for the day, and the way to his whole card. */
function camperPop(s) {
    const c = CLS[s.cls];
    return '<div class="pop" role="group" aria-label="' + esc('Orders for ' + s.name) + '"><span class="pn"><b>' + esc(s.name) + '</b><small>' + c.name + ' · ' + roman(s.level) + '</small></span>' +
        '<span class="pb">' + ic('drop') + meter('hp', s.hp, s.vig) + ic('flame') + meter('mo', s.morale, 100) + '</span>' +
        (s.wound ? '<span class="pa">' + ic('moon') + 'Abed ' + plural(s.wound, 'day', 'days') + '</span>' :
            '<span class="po">' + Object.keys(ORDER).map(o => '<button data-act="order" data-id="' + s.id + '" data-o="' + o + '" aria-pressed="' + (s.order === o) + '" aria-label="' + ORDER[o] + '" title="' + ORDER[o] + '">' + ic(o === 'rest' ? 'moon' : o) + '</button>').join('') + '</span>') +
        '<button class="pc" data-act="card" data-id="' + s.id + '">' + ic('scroll') + 'Card' + (s.promos ? ic('star', 'Promotion earned') : '') + '</button></div>';
}
/** What the last march or day in camp reported, over the top of the scene until it is put away. */
function newsRibbon() {
    if (!ui.news || !ui.news.length)
        return '';
    const news = [];
    for (const t of ui.news) {
        const prev = news[news.length - 1];
        if (prev && prev.t === t)
            prev.k++;
        else
            news.push({ t, k: 1 });
    }
    return '<aside class="dawn" aria-label="On the road"><ul>' + news.slice(-5).map(n => '<li>' + ic('lantern') + '<span>' + esc(n.t) + (n.k > 1 ? ' <small>(' + n.k + ' days)</small>' : '') + '</span></li>').join('') + '</ul>' +
        '<button class="x" data-act="newsClose" aria-label="Put the news away">' + ic('x') + '</button></aside>';
}
function campScene() {
    const g = G, plan = campPlan(g), q = questOf(g), here0 = panelsHere();
    const label = 'The company in camp at ' + here(g).name + ': ' + (plan.length ? plan.map(p => p.s.name + (p.k === 'abed' ? ' abed' : p.k === 'rest' ? ' by the fire' : p.k === 'drill' ? ' at drill' : ' foraging')).join(', ') : 'nobody under the banner') + '. The ' + q.cargo.many + ' wait by the tents.';
    let h = '<div class="scene"><canvas id="camp" role="img" aria-label="' + esc(label) + '"></canvas>' + newsRibbon();
    for (const s of HOTSPOTS) {
        if (!here0.includes(s.k))
            continue;
        const P = PANELS[s.k], n = panelCount(s.k);
        h += '<button class="spot" data-act="panel" data-k="' + s.k + '" style="' + sceneRect(...s.rect) + '" aria-label="' + esc(P.title + ': ' + s.what) + '"><span class="plate">' + ic(P.icon) + esc(P.short) + (n ? '<b>' + n + '</b>' : '') + '</span></button>';
    }
    h += '<button class="spot fire" data-act="halt" style="' + sceneRect(147, 82, 28, 28) + '" aria-label="Rest a day by the fire"><span class="plate">' + ic('moon') + 'Rest a day</span></button>';
    // the people of the command stand where the camp puts them; a click on one opens his page
    const person = (post, slot, name, what) => '<button class="spot person" data-act="panel" data-k="command" data-post="' + post + '" style="' + sceneRect(slot[0] - 9, slot[1] - 31, 18, 32) + '" aria-label="' + esc(what + ', ' + name) + '"><span class="plate">' + esc(what) + '</span></button>';
    h += person('captain', CAMP.captain, g.captain.name, 'Captain');
    for (const o of officersOf(g))
        h += person(o.station, CAMP.staff[o.station], o.name, STAFF[o.station].name);
    if (g.retainer)
        h += person('retainer', CAMP.retainer, g.retainer.name, cap1(RETAINERS[g.retainer.type].title.replace(/^an? /i, '')));
    for (const p of plan) {
        const on = p.id === ui.open, w = p.k === 'abed' ? 20 : 18, hh = p.k === 'abed' ? 9 : p.k === 'rest' ? 19 : 32, top = p.y - (p.k === 'abed' ? 8 : p.k === 'rest' ? 18 : 31);
        h += '<div class="camper' + (on ? ' on' : '') + '" data-id="' + p.id + '" data-k="' + p.k + '" style="' + sceneRect(p.x - 9, top, w, hh) + '">' +
            '<button class="hit" data-act="sel" data-id="' + p.id + '" aria-pressed="' + on + '" aria-label="' + esc(p.s.name + ', ' + CLS[p.s.cls].name.toLowerCase() + (p.k === 'abed' ? ', abed' : ', ' + ORDER[p.k].toLowerCase())) + '">' +
            '<span class="plate">' + ic(p.k === 'abed' ? 'cross' : p.k === 'rest' ? 'moon' : p.k) + esc(p.s.name.split(' ')[0]) + (p.s.promos ? ic('star', 'Promotion earned') : '') + '</span></button>' + (on ? camperPop(p.s) : '') + '</div>';
    }
    return h + '</div>';
}
function courseBlock(off) {
    const q = questOf(G), days = searchRoutes(G).best;
    const places = Object.keys(PLACES).filter(id => id !== G.at && days[id] != null).sort((a, b) => (a === q.to ? -1 : b === q.to ? 1 : days[a] - days[b]));
    if (!places.length)
        return '';
    if (!places.includes(ui.course))
        ui.course = places[0];
    const route = routeTo(G, ui.course), steady = route.reduce((n, r) => n + r.days, 0), forced = route.reduce((n, r) => n + r.forced, 0);
    const need = breadDue(G), fed = need ? Math.floor(G.bread / need) : 99, md = courseMarketDays(route, false);
    let h = '<div class="course"><label for="course-to">' + ic('flag') + 'Course</label><select id="course-to" data-act="course-pick">' + places.map(id => '<option value="' + id + '"' + (id === ui.course ? ' selected' : '') + '>' +
        esc(cap1(PLACES[id].name)) + (id === q.to ? ', the destination' : '') + ' · ' + plural(days[id], 'day', 'days') + '</option>').join('') + '</select>' +
        '<div class="go-row"><button class="btn go" data-act="course"' + off + '>' + ic('boot') + 'March · ' + plural(steady, 'day', 'days') + '</button>' +
        (forced < steady ? '<button class="btn" data-act="course" data-f="1"' + off + ' title="Forced: sooner, but it costs cargo and wears the men">' + ic('forced') + plural(forced, 'day', 'days') + sr(' forced march') + '</button>' : '') + '</div>' +
        '<span class="meta">' + ic('calendar') + 'In by ' + dateText(G.date + steady, true) + ' · ' + plural(route.length, 'leg', 'legs') + (need ? ' · eats ' + need * steady + ' ' + ic('loaf') : '') + '</span>';
    if (need && fed < md)
        h += '<span class="warn">' + ic('warn') + 'Bread for ' + plural(fed, 'day', 'days') + '; first market ' + md + ' days on</span>';
    return h + '</div>';
}
function dockHTML() {
    const q = questOf(G), nobody = !G.roster.length, off = nobody ? ' disabled' : '', need = breadDue(G);
    const t = { drill: 0, rest: 0, forage: 0, abed: 0 };
    G.roster.forEach(s => t[s.wound ? 'abed' : s.order]++);
    let h = '<div class="dock"><nav class="menu" aria-label="The company’s business">' + panelsHere().map(k => {
        const P = PANELS[k], n = panelCount(k);
        return '<button data-act="panel" data-k="' + k + '" aria-haspopup="dialog" aria-expanded="' + (ui.panel === k) + '" title="' + esc(P.title) + '">' + ic(P.icon) + P.short + (n ? '<span class="count">' + n + '</span>' : '') + '</button>';
    }).join('') + '</nav><div class="doing"><div class="tally"><span class="k">Tonight</span><span class="chips">' +
        [['drill', 'drill', 'at drill'], ['rest', 'moon', 'resting'], ['forage', 'forage', 'foraging'], ['abed', 'cross', 'abed']].map(x => '<span class="tchip" title="' + x[2] + '">' + ic(x[1]) + '<b>' + t[x[0]] + '</b>' + sr(' ' + x[2]) + '</span>').join('') +
        '</span><span class="meta">' + ic('coin') + wagesDue(G) + ' pay on ' + dateText(G.payDue, true) + '</span></div>';
    if (atEnd(G)) {
        return h + '<div class="deliver"><button class="btn go big" data-act="deliver">' + ic(q.kind === 'commission' ? 'coin' : 'scales') + (q.kind === 'commission' ? 'Hand over the chest' : 'Sell the ' + esc(q.cargo.many)) + ' · ' + cargoValue(G) + ' thalers</button>' +
            (lateDays(G) ? '<span class="warn">' + ic('hourglass') + plural(lateDays(G), 'day', 'days') + ' late: the price has fallen</span>' : '<span class="meta">' + ic('check') + 'In time</span>') + '</div></div></div>';
    }
    h += '<button class="act" data-act="halt" title="Each man drills, rests or forages, as ordered">' + ic('moon') + '<span>' + (nobody ? 'Wait a day' : 'Rest a day') + '</span><small>' + (need ? '−' + need + ' ' + ic('loaf') : 'new faces may come') + '</small></button>';
    h += courseBlock(off);
    const warns = [];
    if (nobody)
        warns.push(['men', 'Nobody to drive the train: hire at the market']);
    else if (G.thalers < wagesDue(G))
        warns.push(['coin', 'The pay chest is short: ' + wagesDue(G) + ' due, ' + G.thalers + ' in hand']);
    if (!nobody && G.bread < need)
        warns.push(['loaf', 'Not enough bread for tomorrow']);
    if (warns.length)
        h += '<div class="warns">' + warns.map(w => '<span class="warn">' + ic(w[0]) + esc(w[1]) + '</span>').join('') + '</div>';
    return h + '</div></div>';
}
function mapPanel() {
    const q = questOf(G), T = transportOf(G), need = breadDue(G), fed = need ? Math.floor(G.bread / need) : 99, to = PLACES[q.to], togo = daysToGo(G), left = daysLeft(G);
    let h = '<div class="mapgrid"><div class="mapwrap"><div class="plate mapplate"><canvas id="map" role="img" aria-label="' + esc('Map: the company is at ' + here(G).name + ', bound for ' + to.name) + '"></canvas></div>' +
        '<p class="caption">' + esc(q.title) + ': ' + esc(cap1(PLACES[q.from].name)) + ' to ' + esc(to.name) + '. Red is the road so far, black the roads from here. Pick a place to set the course.</p></div>';
    if (atEnd(G))
        return h + '</div>';
    const nobody = !G.roster.length, off = nobody ? ' disabled' : '';
    h += '<div class="roads">' + sectHTML('One leg at a time', esc(T.name) + (need ? ' · bread for ' + plural(fed, 'day', 'days') : '')) + '<ul>';
    h += roadsFrom(G).map(r => {
        const P2 = PLACES[r.to], rest = daysToGo(G, r.to), shop = (SERVICES[P2.kind] || {}).market || r.to === q.to, md = shop ? r.days : marketDays(G, r);
        return '<li class="road"><div class="what"><b>' + esc(cap1(P2.name)) + '</b><span class="chips">' +
            stat('road', r.km + ' km', 'through ' + LANDS[r.land].name) + '<span class="st danger d' + r.danger + '" title="' + DANGER[r.danger] + '">' + ic('swords') + '<b>' + DANGER[r.danger] + '</b></span>' +
            (shop ? stat('scales', 'Market', 'a market there') : '<span class="st muted" title="No market there">' + ic('scales') + '<b>Next ' + md + 'd</b>' + sr(' no market there; the next is ' + plural(md, 'day', 'days') + ' on') + '</span>') +
            stat('calendar', dateText(G.date + r.days, true), 'in by') + (r.to !== q.to && rest < Infinity ? stat('flag', rest + 'd', 'then to ' + to.name) : '') + '</span>' +
            (need && fed < md ? '<span class="warn">' + ic('loaf') + 'Bread for ' + plural(fed, 'day', 'days') + (shop ? ' of the ' + r.days : '; market ' + md + ' days on') + '</span>' : '') + '</div>' +
            '<div class="go2"><button class="btn sm" data-act="march" data-r="' + r.i + '"' + off + '>' + ic('boot') + plural(r.days, 'day', 'days') + sr(' march to ' + esc(P2.name)) + '</button>' +
            (r.forced < r.days ? '<button class="btn sm ghost" data-act="march" data-r="' + r.i + '" data-f="1"' + off + ' title="Forced march">' + ic('forced') + plural(r.forced, 'day', 'days') + sr(' forced march to ' + esc(P2.name)) + '</button>' : '') + '</div></li>';
    }).join('') + '</ul><p class="note">' + ic('flag') + esc(to.name) + ': ' + plural(togo, 'day', 'days') + ' by the shortest road · ' + (left >= 0 ? plural(left, 'day', 'days') + ' left' : 'the date has passed') + '. Forced marches cost ' + esc(q.cargo.many) + ' and wear the men.</p></div>';
    return h + '</div>';
}
function marketPanel() {
    const full = G.roster.length >= ROSTER_MAX;
    let h = '';
    if (has(G, 'recruits')) {
        h += '<section>' + sectHTML('For hire', full ? 'the roll is full: ' + G.roster.length + ' of ' + ROSTER_MAX : G.roster.length + ' of ' + ROSTER_MAX + ' on the roll') +
            (G.recruits.length ? '<div class="cards">' + G.recruits.map((r, i) => recruitCard(r, i, full)).join('') + '</div>' : '<p class="empty">' + ic('hourglass') + 'Nobody is looking for work. New faces turn up every third day.</p>') + '</section>';
    }
    h += '<section>' + sectHTML('Supplies and cargo') + '<div class="cards">' + supplyCard('bread') + supplyCard('powder') + (atEnd(G) ? '' : cargoCard()) + '</div></section>';
    return h;
}
/** What a page of the company's business holds. */
function panelBody(k) {
    if (k === 'map')
        return mapPanel();
    if (k === 'roll')
        return G.roster.length ? '<div class="cards">' + G.roster.map(soldierCard).join('') + '</div>' : '<p class="empty">' + ic('men') + 'Nobody stands under the banner. Hire men at the market.</p>';
    if (k === 'market')
        return marketPanel();
    if (k === 'work')
        return G.contracts.length ? '<div class="cards wide">' + G.contracts.map(c => contractCard(c, 'work')).join('') + '</div>' : '<p class="empty">' + ic('swords') + 'No work posted here today.</p>';
    if (k === 'command')
        return commandPanel();
    return '<ol class="log">' + G.log.map(l => '<li><span class="d">' + (l.n != null ? dateText(l.n, true) : 'Day ' + l.d) + '</span><span>' + esc(l.t) + '</span></li>').join('') + '</ol>';
}
/** The camp: the scene, with everything in it that can be clicked, and the dock beneath with the day's orders. A page of the business opens over it (see panelHTML). */
function campHTML() { return '<main class="hub"><section class="stage">' + campScene() + '</section>' + dockHTML() + '</main>'; }
/** The page open over the camp: a drawer under the bar, so that the ledger stays in view, with the page in it. */
function panelHTML() {
    const k = ui.panel;
    if (!k || !G || ui.screen !== 'camp')
        return '';
    const P = PANELS[k], q = questOf(G);
    const sub = k === 'map' ? esc(cap1(PLACES[q.from].name)) + ' to ' + esc(PLACES[q.to].name) : k === 'roll' ? G.roster.length + ' of ' + ROSTER_MAX + ' on the roll' : k === 'market' ? esc(cap1(here(G).name)) :
        k === 'work' ? plural(G.contracts.length, 'fight', 'fights') + ' posted in ' + esc(here(G).name) : k === 'command' ? officersOf(G).length + ' of ' + officerSlots(G) + ' places held' : 'day ' + G.day;
    return '<div class="pveil"><section class="drawer p-' + k + '" role="dialog" aria-modal="true" aria-labelledby="pt"><header class="dhead"><h2 id="pt">' + ic(P.icon) + P.title + '</h2><span class="dsub">' + sub + '</span>' +
        '<button class="x" data-act="panelClose" aria-label="Close ' + esc(P.title.toLowerCase()) + '">' + ic('x') + '</button></header><div class="dbody">' + panelBody(k) + '</div></section></div>';
}
/* ---------- muster: who fights, and how they open ---------- */
function tokenHTML(s, on, full) {
    const off = !!s.wound;
    return '<button class="token' + (on ? ' on' : '') + '" data-act="pick" data-id="' + s.id + '" aria-pressed="' + on + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc(s.name + ', ' + CLS[s.cls].name.toLowerCase() + ', level ' + s.level + (off ? ', abed' : '')) + '">' +
        '<span class="art' + (off ? ' hurt' : '') + '"><img src="' + soldierArt(s) + '" alt=""></span>' +
        '<span class="tname">' + ic(s.cls) + esc(s.name.split(' ')[0]) + '</span>' +
        '<span class="tbars">' + ic('drop') + meter('hp', s.hp, s.vig) + ic('flame') + meter('mo', s.morale, 100) + '</span>' +
        '<span class="badge-dot">' + ic(off ? 'cross' : on ? 'check' : 'plus') + '</span></button>';
}
function musterHTML() {
    const c = ui.c, o = ui.odds, list = c.duel ? ['advance', 'charge'] : ['hold', 'advance', 'charge'];
    const cur = ui.stance || (o ? o.best : null), cap = Math.min(c.cap, G.roster.length);
    let h = '<div class="muster"><div class="mcontract">' + contractCard(c, 'muster') +
        '<p class="note">' + ic('eye') + esc(c.duel ? 'No powder, no seconds. The loser may yield.' : KIND[c.ai].note) + '</p>' +
        (c.ambush ? '<p class="note warn">' + ic('barrel') + 'Beaten, they take ' + plural(raidLoss(G, false), cargoName(G, 1), cargoName(G, 2)) + '. Sound the retreat and they take ' + raidLoss(G, true) + '.</p>' : '') + '</div>';
    h += '<section class="mstances">' + sectHTML('Opening order', 'you can change it in the fight') + '<div class="stances" role="group" aria-label="Opening order">' + list.map(s => {
        const S = c.duel ? DUEL_STANCE[s] : STANCE[s], on = cur === s, p = o ? o[s] : null;
        return cardHTML({
            tag: 'button', cls: 'stance' + (on ? ' on' : ''), attrs: ' data-act="stance" data-s="' + s + '" aria-pressed="' + on + '"', title: S.name, art: stanceArt(s),
            body: S.fx.map(fxLine).join(''),
            type: { look: on ? 'ink' : 'pale', text: ic('eye') + (p != null ? pips(oddsPips(p), 5, S.name + ': ' + oddsWord(p)) : '<span>Scouting…</span>') }
        });
    }).join('') + '</div></section>';
    const p = o && cur ? o[cur] : null, n = p != null ? oddsPips(p) : 0, shots = ui.pick.some(id => man(id) && man(id).cls === 'shot');
    h += '<aside class="verdict-box"><span class="k">The scouts say</span><span class="bigpips">' + Array.from({ length: 5 }, (_, i) => '<i' + (i < n ? ' class="on"' : '') + '></i>').join('') + '</span>' +
        '<span class="word" aria-live="polite">' + (p != null ? oddsWord(p) : ui.pick.length ? 'Scouting…' : 'Choose men') + '</span>' +
        '<span class="chips">' + stat('men', ui.pick.length + ' of ' + cap, 'chosen') + (cur ? stat((c.duel ? DUEL_STANCE : STANCE)[cur].icon, (c.duel ? DUEL_STANCE : STANCE)[cur].name, 'opening order') : '') + (c.duel ? '' : stat('horn', G.powder, 'powder')) + '</span>' +
        (G.powder < 1 && shots && !c.duel ? '<span class="warn">' + ic('horn') + 'No powder: muskets fight with the butt</span>' : '') +
        '<span class="meta">' + ic(c.ambush ? 'warn' : 'sun') + (c.ambush ? 'They are on the train. No going back.' : 'Fighting takes the whole day.') + '</span>' +
        '<button class="btn go huge" data-act="fight"' + (ui.pick.length ? '' : ' disabled') + '>' + ic('swords') + 'To arms</button>' +
        (c.ambush ? '' : '<button class="btn ghost" data-act="back">' + ic('tent') + 'Back to camp</button>') + '</aside></div>';
    h += '<section class="who">' + sectHTML('Who fights', ui.pick.length + ' of ' + cap + ' chosen') + '<div class="tokens" role="group" aria-label="Who fights">' + G.roster.map(s => tokenHTML(s, ui.pick.includes(s.id))).join('') + '</div></section>';
    return h;
}
/* ---------- the fight ---------- */
/** The button of the captain's order: its name, and what the order does as its hint. */
function orderButton() {
    const O = ORDERS[CAPTAINS[G.captain.type].order];
    return '<button class="btn order" id="captain" data-act="captain" aria-label="' + esc(G.captain.name.split(' ')[0] + ' calls ' + O.name.toLowerCase() + ': ' + O.text) + '" title="' + esc(O.text) + '">' + ic(O.icon) + '<span><b>' + esc(O.name) + '</b><small id="capsub"></small></span><kbd>O</kbd></button>';
}
function battleHTML() {
    const c = ui.c, key = (k, s, label, icon) => '<button data-act="cmd" data-s="' + s + '">' + ic(icon) + label + '<kbd>' + k + '</kbd></button>';
    return '<section class="fight"><div class="plate field"><canvas id="field" role="img" aria-label="The fight, drawn as it happens"></canvas><div id="verdict"></div></div>' +
        '<p class="caption"><span>' + esc(c.title) + ', as it befell on ' + dateText(G.date) + '.</span><span id="clock" class="num"></span></p>' +
        '<div class="cmd"><div class="seg big" role="group" aria-label="Order to the company" id="orders">' +
        (c.duel ? key('1', 'advance', 'Measure', 'eye') + key('2', 'charge', 'Rush', 'forced') : key('1', 'hold', 'Hold', 'wall') + key('2', 'advance', 'Advance', 'boot') + key('3', 'charge', 'Charge', 'forced')) + '</div>' +
        '<button class="btn ghost" data-act="retreat" id="retreat">' + ic('white') + (c.duel ? 'Yield' : 'Sound the retreat') + '</button>' + (c.duel ? '' : orderButton()) + '<span class="spacer"></span>' +
        '<div class="seg" role="group" aria-label="Speed" id="speed"><button data-act="speed" data-v="0" aria-label="Pause">' + ic('pause') + '</button><button data-act="speed" data-v="1">1×</button><button data-act="speed" data-v="2">2×</button><button data-act="speed" data-v="4">4×</button></div></div>' +
        '<div class="sides"><div class="side-box"><div class="head">' + ic('flag') + 'Your men<span id="powder"></span></div><div class="units" id="ours"></div></div><div class="side-box theirs"><div class="head">' + ic('swords') + esc(cap1(c.foe)) + '</div><div class="units" id="theirs"></div></div></div>' +
        '<ol class="blog" id="blog" aria-live="polite"></ol></section>';
}
function paintHud() {
    const b = ui.b;
    if (!b || ui.screen !== 'battle')
        return;
    const chip = (u) => '<span class="unit' + (alive(u) ? '' : ' out') + (u.routing && alive(u) ? ' run' : '') + '">' + ic(u.cls) + '<span>' + (u.side === 0 ? esc(u.name.split(' ')[0]) : cap1(TIER[u.tier])) +
        (u.routing && alive(u) ? ' runs' : '') + '</span>' + meter(u.side ? 'foe' : 'hp', u.hp, u.max) + '</span>';
    $('#ours').innerHTML = b.units.filter(u => u.side === 0).map(chip).join('');
    $('#theirs').innerHTML = b.units.filter(u => u.side === 1).map(chip).join('');
    $('#powder').innerHTML = ui.c.duel ? 'cold steel' : ic('horn') + Math.max(0, b.powder);
    const left = Math.max(0, Math.ceil(TLIMIT - b.t));
    $('#clock').textContent = b.over ? '' : left <= 45 ? 'The light is going: ' + left + ' s' : '';
    document.querySelectorAll('#orders button').forEach(el => { el.setAttribute('aria-pressed', String(b.stance[0] === el.dataset.s)); el.disabled = b.over || b.retreated; });
    document.querySelectorAll('#speed button').forEach(el => el.setAttribute('aria-pressed', String(ui.speed === +el.dataset.v)));
    $('#retreat').disabled = b.over || b.retreated;
    const ob = $('#captain');
    if (ob && b.order) {
        const left = b.buffs[b.order];
        ob.disabled = !canOrder(b);
        ob.classList.toggle('on', left != null);
        $('#capsub').textContent = left != null ? Math.ceil(left) + ' s' : b.ordered ? 'called' : 'once in a fight';
    }
    $('#blog').innerHTML = b.log.slice(-4).reverse().map(l => '<li class="' + (l.side === 1 ? 'bad' : '') + '">' + esc(l.s) + '</li>').join('');
}
function verdictWord(won, c, retreated, draw) {
    if (won)
        return c.duel ? 'Honour satisfied' : c.final ? 'The ford is taken' : c.ambush ? 'They are driven off' : 'The field is yours';
    if (retreated)
        return c.duel ? 'Yielded' : 'Withdrawn';
    if (draw)
        return 'Night falls';
    return c.duel ? 'Bested' : c.ambush ? 'The train is plundered' : 'The company is beaten';
}
function showVerdict() {
    const b = ui.b, c = ui.c, won = b.winner === 0 && !b.retreated;
    sting(won);
    $('#verdict').innerHTML = '<div class="verdict' + (won ? '' : ' lost') + '"><h2 class="ribbon-word">' + verdictWord(won, c, b.retreated, b.draw) + '</h2><button class="btn go big" data-act="report">' + ic('scroll') + 'Count the cost</button></div>';
    const btn = $('#verdict button');
    if (btn)
        btn.focus();
}
/* ---------- after the fight, and at the end of the road ---------- */
const FATE = {
    unhurt: { word: 'Unhurt', icon: 'check', tone: 'ink' }, wounded: { word: 'Wounded', icon: 'drop', tone: 'weld' },
    'struck down': { word: 'Struck down', icon: 'cross', tone: 'madder' }, killed: { word: 'Killed', icon: 'skull', tone: 'ink' },
    fled: { word: 'Ran', icon: 'run', tone: 'weld' }, yielded: { word: 'Yielded', icon: 'white', tone: 'weld' }
};
function bannerHTML(word, bad) { return '<div class="ribbon-banner' + (bad ? ' bad' : '') + '"><h2>' + word + '</h2></div>'; }
function reportHTML() {
    const r = ui.rep, kills = r.lines.reduce((n, l) => n + l.kills, 0);
    let h = '<section class="report">' + bannerHTML(verdictWord(r.won, r, r.retreated, r.draw), !r.won) +
        '<p class="facts"><i>' + esc(r.title) + ' · ' + dateText(G.date) + '</i>' + stat('hourglass', r.secs + ' s', 'of fighting') + (r.shots ? stat('shot', r.shots, r.shots === 1 ? 'shot fired' : 'shots fired') : '') + stat('skull', kills, 'felled') + '</p>' +
        sectHTML('The butcher’s bill') + '<div class="cards bill">' + r.lines.map(l => {
        const s = man(l.id), F = FATE[l.fate], dead = l.fate === 'killed';
        const note = l.fate === 'killed' ? ['skull', 'Buried by the road'] : l.scar ? ['limp', 'Now carries ' + l.scar] : l.fate === 'struck down' && s ? ['moon', 'Abed ' + plural(s.wound, 'day', 'days')] :
            s && s.promos ? ['star', 'Promotion earned'] : l.fate === 'fled' ? ['run', 'Ran from the field'] : l.fate === 'wounded' ? ['drop', 'Cut, but standing'] : ['check', 'Not a scratch'];
        return cardHTML({
            cls: 'fate' + (dead ? ' dead' : '') + (s && s.promos ? ' gilt' : ''), attrs: ' aria-label="' + esc(l.name + ': ' + F.word) + '"', title: esc(l.name),
            art: fateArt(l, ui.c ? settingOf(G, ui.c).land : undefined), artCls: dead ? 'dead' : l.fate === 'struck down' ? 'hurt' : '',
            badges: '<span class="stamp ' + F.tone + '">' + ic(F.icon) + F.word + '</span>',
            body: '<span class="strip">' + stat('swords', l.kills, l.kills === 1 ? 'kill' : 'kills') + stat('star', l.xp ? '+' + l.xp : '—', 'experience') + '</span>' + fxLine(note),
            type: { look: dead ? 'grey' : LOOK[l.cls], text: CLS[l.cls].name }
        });
    }).join('') + '</div><div class="spoils">';
    const coin = (icon, v, label, cls) => '<span class="spoil ' + cls + '">' + '<span class="disc">' + ic(icon) + '</span><b>' + v + '</b><small>' + label + '</small></span>';
    if (r.won)
        h += (r.pay ? coin('coin', '+' + r.pay, 'thalers', 'gold') : '') + coin('mace', '+' + r.renown, 'renown', 'red') + (r.loot && r.loot.bread ? coin('loaf', '+' + r.loot.bread, 'bread', 'pale') : '') + (r.loot && r.loot.powder ? coin('horn', '+' + r.loot.powder, 'powder', 'steel') : '');
    else if (r.ambush)
        h += coin('barrel', '−' + r.cargoLost, esc(cargoName(G, r.cargoLost)) + ' taken', 'red');
    else
        h += coin('coin', '0', 'no fee', 'pale') + (r.renown ? coin('mace', String(r.renown).replace('-', '−'), 'renown', 'red') : '');
    return h + '<span class="grow"></span><button class="btn go huge" data-act="camp">' + ic(G.over ? 'book' : r.ambush ? 'boot' : 'tent') + (G.over ? 'Close the ledger' : r.ambush ? 'On to ' + esc(here(G).name) : 'Back to camp') + '</button></div></section>';
}
function endHTML() {
    // r is the delivery, which only the ending 'arrived' has and reads.
    const st = G.stats, q = questOf(G), r = G.result, to = PLACES[q.to].name;
    let word = 'The ledger is closed', lede = '';
    if (G.over === 'arrived') {
        const kept = r.cargo / r.cargo0, profit = G.thalers - st.start;
        word = !r.late && kept >= 0.75 ? 'The banner is made' : !r.late ? 'In time, but thinner' : r.late <= 10 ? 'In, but late' : 'Late, and sold cheap';
        lede = q.kind === 'commission' ?
            'The chest comes into ' + to + (r.cargo < r.cargo0 ? ' ' + (r.cargo0 - r.cargo) + ' thalers short' : ' whole') + (r.late ? ', ' + plural(r.late, 'day', 'days') + ' after ' + q.until : ', before ' + q.until) + '. The fee comes to ' + r.pay + ' thalers.' :
            'Of ' + r.cargo0 + ' ' + q.cargo.many + ', ' + r.cargo + ' reach ' + to + (r.late ? ', ' + plural(r.late, 'day', 'days') + ' after ' + q.until : ' before ' + q.until) + ', and fetch ' + r.pay + ' thalers' + (r.late ? '. The middlemen take their share for the delay.' : '.');
        lede += ' The company ends the road with ' + G.thalers + ' thalers, ' + (profit >= 0 ? profit + ' more' : -profit + ' fewer') + ' than it set out with.';
    }
    else if (G.over === 'dissolved') {
        word = 'The banner is furled';
        lede = 'No men, or no coin to keep them. The pole is sold for firewood at ' + cap1(here(G).name) + ' on ' + dateText(G.date) + '.';
    }
    else if (G.over === 'victory') {
        word = 'The banner is made';
        lede = 'The Black Regiment breaks at the ford with the whole of the Hetman’s muster looking on. There will be a colonel’s commission, winter quarters, and work for as long as there is war. There is always war.';
    }
    else if (G.over === 'defeat') {
        word = 'Broken at the ford';
        lede = 'Krafft’s black-coats held. What is left of the company scatters into the hills, and the Hetman’s clerks strike its name from the muster book.';
    }
    const good = (G.over === 'arrived' && !r.late && r.cargo / r.cargo0 >= 0.75) || G.over === 'victory';
    const lost = [['rain', 'rain', 'spoiled by rain'], ['forced', 'forced', 'lost on forced marches'], ['raid', 'swords', 'taken on the road'], ['pilfered', 'warn', 'pilfered by your own men']].filter(x => st.lost[x[0]]).map((x) => [x[1], '−' + st.lost[x[0]], x[2]]);
    if (st.sold)
        lost.push(['scales', '−' + st.sold, q.kind === 'commission' ? 'taken from the chest' : 'sold on the way']);
    let h = '<section class="report end">' + bannerHTML(word, !good) + '<p class="lede">' + esc(lede) + '</p>' +
        '<div class="tiles">' + [['calendar', G.date - q.start, 'days on the road'], ['swords', st.won + ' of ' + st.battles, 'fights won'], ['skull', st.kills, 'enemies felled'], ['coin', st.earned, 'thalers earned'], ['mace', G.renown, 'renown']]
        .map(t => '<span class="tile">' + ic(t[0]) + '<b>' + t[1] + '</b><small>' + t[2] + '</small></span>').join('') + '</div>';
    if (lost.length)
        h += sectHTML('Where the ' + esc(q.cargo.many) + ' went') + '<div class="fxrow">' + lost.map(fxChip).join('') + '</div>';
    if (G.roster.length)
        h += sectHTML('Still under the banner') + '<div class="tokens still">' + G.roster.map(s => '<span class="token on">' + '<span class="art"><img src="' + soldierArt(s) + '" alt=""></span><span class="tname">' + ic(s.cls) + esc(s.name) + '</span><span class="tbars">' + stat('swords', s.kills, 'kills') + stat('star', roman(s.level), 'level') + '</span></span>').join('') + '</div>';
    if (st.dead.length)
        h += sectHTML('The fallen') + '<ol class="log fallen">' + st.dead.map(d => '<li><span class="d">' + (d.date != null ? dateText(d.date, true) : 'day ' + d.day) + '</span><span>' + ic('skull') + '<b>' + esc(d.name) + '</b>, ' + d.origin + ' ' + CLS[d.cls].name.toLowerCase() + ', level ' + d.level + ' · ' + esc(d.where) + '</span></li>').join('') + '</ol>';
    return h + '<div><button class="btn go huge" data-act="title">' + ic('flag') + 'Raise a new banner</button></div></section>';
}
/* ---------- the title: the commissions of 1633 ---------- */
// button: whether the card has the button that raises the banner; the encyclopedia shows the commissions without it.
function questCard(q, button = true) {
    const days = daysToGo({ quest: q.id, at: q.from }), worth = q.kind === 'commission' ? q.fee : q.cargo.n * q.price;
    return cardHTML({
        cls: 'quest', attrs: ' aria-label="' + esc(q.title) + '"', title: esc(q.title), art: questArt(q), artCls: 'wide',
        badges: '<span class="badge">' + (q.kind === 'commission' ? 'Commission' : 'Venture') + '</span><span class="badge gold right" title="Playing time">' + ic('hourglass') + esc(q.play) + '</span>',
        body: '<span class="route">' + esc(cap1(PLACES[q.from].name)) + ic('road') + esc(PLACES[q.to].name) + '</span><span class="who">' + esc(q.who) + '</span><span class="flavour">' + esc(q.text) + '</span>' +
            '<span class="strip">' + stat('calendar', dateText(q.start, true) + '–' + dateText(q.deadline, true), 'from and by') + stat('boot', '~' + days + 'd', 'on the road, ' + (q.deadline - q.start) + ' to spare them') + stat(q.kind === 'commission' ? 'coin' : 'barrel', q.cargo.n, q.cargo.unit) + stat('wagon', esc(TRANSPORT[q.transport].name), 'how it travels') + '</span>',
        type: { look: 'ink', text: button ? '' : cap1(q.cargo.many), coin: worth, coinLabel: q.kind === 'commission' ? 'Fee, thalers' : 'Worth at the destination, thalers', end: button ? '<button class="btn go sm" data-act="captains" data-q="' + q.id + '">' + ic('flag') + 'Raise the banner</button>' : undefined }
    });
}
function titleHTML() {
    const sv = loadSave();
    return '<div class="hero"><div><div class="plate field"><canvas id="field" role="img" aria-label="A skirmish between two small companies"></canvas></div>' +
        '<p class="caption">A true likeness of how such affairs are settled: pike, shot and sabre.</p></div>' +
        '<div class="intro"><p class="lede">The German war is in its fifteenth year, and every prince between the Rhine and the Dnieper is hiring. You have a banner, a handful of men, and a long road.</p>' +
        '<ol class="how">' + [['flag', 'Take a commission', 'Carry a cargo across the lands of 1633 by the day it names.'], ['road', 'Choose the road', 'March steady or forced; rest, drill and buy bread.'], ['men', 'Keep the roll', 'Hire pike, shot and sabre; pay them; fight what falls on the train.']]
        .map(x => '<li><span class="disc">' + ic(x[0]) + '</span><span><b>' + x[1] + '</b>' + x[2] + '</span></li>').join('') + '</ol>' +
        '<div class="actions">' + (sv ? '<button class="btn go big" data-act="continue">' + ic('tent') + 'Continue: ' + esc(cap1(PLACES[sv.at].name)) + ', ' + dateText(sv.date, true) + '</button>' : '') +
        '<button class="btn big" data-act="codex">' + ic('book') + 'Encyclopedia</button></div></div></div>' +
        '<section>' + sectHTML('Commissions for the year 1633', 'choose one to raise the banner') + '<div class="cards wide quests">' + QUESTS.map(q => questCard(q)).join('') + '</div></section>';
}
/* ---------- dialogs ---------- */
function choiceHTML(attrs, label, fx, hint, off) {
    return '<button class="choice"' + attrs + (off ? ' disabled' : '') + '><span class="cl">' + esc(label) + '</span>' +
        (fx && fx.length ? '<span class="fxrow">' + fx.map(fxChip).join('') + '</span>' : '<span class="hint">' + esc(hint) + '</span>') + '</button>';
}
function modalHTML() {
    const m = ui.modal;
    if (!m)
        return '';
    let inner = '', cls = '';
    if (m.type === 'event') {
        const e = eventOf(G.pending.id), id = G.pending.id, ret = id.startsWith('retainer-') ? id.slice(9) : null;
        cls = ' event';
        inner = '<span class="strip-head woad">' + ic('lantern') + (ret ? 'Someone asks for a place' : 'Camp event') + ' · ' + dateText(G.date, true) + '</span><span class="art wide"><img src="' + (ret ? retainerWideArt(ret) : eventArt()) + '" alt=""></span>' +
            '<h2 class="banner" id="mt">' + esc(e.title) + '</h2><p class="flavour">' + esc(e.text(G)) + '</p><div class="choices">' +
            e.choices.map((ch, i) => choiceHTML(' data-act="choice" data-i="' + i + '" aria-label="' + esc(ch.label + ': ' + ch.hint) + '"', ch.label, ch.fx, ch.hint)).join('') + '</div>';
    }
    else if (m.type === 'result') {
        inner = '<h2 class="banner" id="mt">' + esc(m.title) + '</h2><p class="flavour">' + esc(m.text) + '</p><div><button class="btn go" data-act="close">' + ic('check') + 'Carry on</button></div>';
    }
    else if (m.type === 'ambush') {
        const c = G.ambush, o = oddsFor(c), q = questOf(G), lose = raidLoss(G, false), short = G.thalers < c.payoff.coin;
        cls = ' ambush';
        inner = '<span class="strip-head madder">' + ic('warn') + 'On the road · short of ' + esc(here(G).name) + '</span><span class="art wide"><img src="' + foesArt(c) + '" alt=""></span>' +
            '<h2 class="banner" id="mt">' + esc(c.title) + '</h2><p class="who">' + esc(c.who) + '</p><p class="flavour">' + esc(c.text) + '</p>' +
            '<p class="scouts">' + ic('eye') + (o.none ? '<span>Nobody is fit to fight</span>' : pips(oddsPips(o.p), 5, 'Scouts: ' + oddsWord(o.p)) + '<span>' + oddsWord(o.p) + '</span>') + '</p><div class="choices">' +
            choiceHTML(' data-act="fightambush"', 'Stand and fight', [['swords', String(c.units.length), c.units.length === 1 ? 'foe' : 'foes'], [q.kind === 'commission' ? 'coin' : 'barrel', '−' + lose, 'if beaten']], '', o.none) +
            choiceHTML(' data-act="payoff" data-k="cargo"', q.kind === 'commission' ? 'Pay them from the Crown’s chest' : 'Give them ' + q.cargo.many, [[q.kind === 'commission' ? 'coin' : 'barrel', '−' + c.payoff.cargo, q.kind === 'commission' ? 'from the chest' : cargoName(G, c.payoff.cargo)], ['road', 'pass', 'the train goes on']], '') +
            choiceHTML(' data-act="payoff" data-k="coin"', 'Pay them out of your own purse', short ? [] : [['coin', '−' + c.payoff.coin, 'thalers'], ['check', 'whole', 'the cargo stays whole']], 'More than the company has: ' + c.payoff.coin + ' thalers.', short) + '</div>';
    }
    else {
        inner = '<h2 class="banner" id="mt">Standing orders</h2><div class="rules">' + [
            ['road', 'The road', 'A commission names a cargo, a destination and a day. Each road takes as many days as the distance needs at the pace of the cargo. A forced march gets there sooner, but costs cargo and wears the men down. Arriving late is never the end of it, but the price falls every day. Set a course to march several legs at once: the company keeps going until something needs you.'],
            ['men', 'The company', 'Every man eats a loaf a day, and wages fall due once a month. Unpaid or hungry men lose spirit, and men without spirit desert. Buy bread before empty country: there are no markets in the Wild Fields. A day in camp lets each man drill, rest or forage: you see where each one goes.'],
            ['warn', 'Trouble on the road', 'Raiders fall on the train. Fight them, or pay them off in cargo or coin. Beaten, or sounding the retreat, costs cargo. Towns post paid work; a fight there takes the day.'],
            ['swords', 'The three arms', 'Pikemen hold a line and keep sabres off. Musketeers kill from afar, burn powder, and die quickly in a brawl. Sabreurs are fast and hunt musketeers.'],
            ['flag', 'The fight', 'One order to the whole company, changed at any moment: keys 1, 2 and 3, and space to pause. Men whose spirit breaks run. Sounding the retreat saves lives, but costs the fee, or in an ambush, cargo.'],
            ['cross', 'Afterwards', 'A man struck down either dies or lies abed for days. Promotions, better arms and a good surgeon keep them alive longer.'],
            ['flag', 'Command', 'The captain you chose calls one order in every fight. In the towns you can engage officers for four posts, a surgeon, a drillmaster, a quartermaster and a chaplain, three to choose from for each; the places open with renown. Now and then someone asks to ride with the train.']
        ].map(x => '<p>' + ic(x[0]) + '<span><b>' + x[1] + '.</b> ' + x[2] + '</span></p>').join('') +
            '<p class="arms" aria-label="Pike beats sabre, sabre beats shot, shot beats pike">' + ic('pike') + '<span>beats</span>' + ic('sabre') + '<span>beats</span>' + ic('shot') + '<span>beats</span>' + ic('pike') + '</p></div>' +
            '<div><button class="btn go" data-act="close">' + ic('check') + 'Understood</button></div>';
    }
    return '<div class="veil"><div class="dialog' + cls + '" role="dialog" aria-modal="true" aria-labelledby="mt">' + inner + '</div></div>';
}
function renderModal() {
    $('#modal').innerHTML = modalHTML();
    const b = $('#modal button:not(:disabled)');
    if (b)
        b.focus();
}
/** The page open over the camp is drawn apart from the screen, so that doing business in it does not send it back to the top of its page. */
function renderPanel() {
    const el = $('#panel'), body = el.querySelector('.dbody'), same = el.dataset.k === String(ui.panel), top = same && body ? body.scrollTop : 0;
    el.innerHTML = panelHTML();
    el.dataset.k = String(ui.panel);
    const now = el.querySelector('.dbody');
    if (now)
        now.scrollTop = top;
    if (ui.panel && !same) {
        const x = el.querySelector('.x');
        if (x)
            x.focus();
    }
    if (ui.panel === 'map')
        drawMap($('#map'), G, !atEnd(G) && ui.course ? routeTo(G, ui.course) : null);
    if (ui.panel === 'roll' && ui.scrollCard != null) {
        const c = el.querySelector('[data-card="' + ui.scrollCard + '"]');
        if (c)
            c.scrollIntoView({ block: 'center' });
        ui.scrollCard = null;
    }
}
/** The height of the bar, which the page open over the camp starts under (see .pveil). */
function fitBar() { const bar = $('.bar'); if (bar)
    document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px'); }
function render() {
    const a = document.activeElement, key = a && a.dataset && a.dataset.act ? '[data-act="' + a.dataset.act + '"]' + ['id', 'k', 'o', 's', 'i', 'v', 'r', 'f', 'n', 'q', 'post'].map(k => (a.dataset[k] != null ? '[data-' + k + '="' + a.dataset[k] + '"]' : '')).join('') : null;
    if (ui.panel && (ui.screen !== 'camp' || !G || !panelsHere().includes(ui.panel)))
        ui.panel = null;
    let h = barHTML();
    if (ui.screen === 'title')
        h += titleHTML();
    else if (ui.screen === 'captain')
        h += captainsHTML();
    else if (ui.screen === 'camp')
        h += campHTML();
    else if (ui.screen === 'muster')
        h += musterHTML();
    else if (ui.screen === 'battle')
        h += battleHTML();
    else if (ui.screen === 'report')
        h += reportHTML();
    else if (ui.screen === 'codex')
        h += codexHTML();
    else
        h += endHTML();
    if (ui.screen !== 'camp')
        h += '<p class="foot">A prototype. A commission takes from a few weeks to a few months of the year 1633 on the road, and from a quarter of an hour to an hour to play. Your place is kept in this browser. Music and sound are made in the browser as you play.</p>';
    $('#view').innerHTML = h;
    document.body.classList.toggle('hubmode', ui.screen === 'camp');
    fitBar();
    ui.view = null;
    ui.camp = null;
    if (ui.screen === 'battle') {
        ui.view = newView($('#field'), ui.c.id * 7919 + G.day * 31, ui.c.weather, true, settingOf(G, ui.c));
        ui.view.captain = ui.c.duel ? undefined : G.captain;
        paintHud();
    }
    else if (ui.screen === 'title') {
        newDemo();
    }
    else if (ui.screen === 'camp') {
        const cv = $('#camp');
        if (cv) {
            ui.camp = newCamp(cv, ui.campPos);
            ui.camp.btns = Array.from(document.querySelectorAll('.camper'));
            drawCamp(ui.camp, G, ui.open, 0, calm);
        }
    }
    if (ui.screen === 'camp' || ui.screen === 'end')
        save();
    renderPanel();
    renderModal();
    if (AC)
        setCue(cueForScreen());
    if (key && !ui.modal) {
        const el = (ui.panel ? $('#panel') : document).querySelector(key);
        if (el && !el.disabled)
            el.focus({ preventScroll: true });
    }
}
