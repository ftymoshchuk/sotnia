"use strict";
/* ===== SOTNIA interface: screens (shared state, saving, the HTML for every screen) ===== */
const $ = <T extends Element = HTMLElement>(s: string, r?: ParentNode) => (r || document).querySelector<T>(s);
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c as '&' | '<' | '>' | '"']));
const pct = (a: number, b: number) => clamp(Math.round(100 * a / b), 0, 100);
const ORDER: Record<CampOrder, string> = { drill: 'Drill', rest: 'Rest', forage: 'Forage' };
/** An icon and a line of words: one thing a stance does, one thing a hired hand brings, one warning. */
type IconText = [icon: IconName, text: string];
/** A stance as the muster screen shows it: its name, its icon and what it does. */
interface StanceCard { name: string; icon: IconName; fx: IconText[] }
const STANCE: Record<Stance, StanceCard> = {
  hold: { name: 'Hold', icon: 'wall', fx: [['shield', 'Stand where you are'], ['shot', 'Muskets reload faster']] },
  advance: { name: 'Advance', icon: 'boot', fx: [['boot', 'March on them in line'], ['shot', 'Fire once in range']] },
  charge: { name: 'Charge', icon: 'forced', fx: [['swords', 'Hit hard on arrival'], ['shield', 'Guard badly after']] }
};
/** A duel allows no standing on the defensive: it is measured or rushed. */
type DuelStance = Exclude<Stance, 'hold'>;
const DUEL_STANCE: Record<DuelStance, StanceCard> = {
  advance: { name: 'Measure him', icon: 'eye', fx: [['eye', 'Close with care'], ['swords', 'Trade cuts']] },
  charge: { name: 'Rush him', icon: 'forced', fx: [['swords', 'A heavy first blow'], ['shield', 'A poorer guard after']] }
};
const STAFF_FX: Record<StaffId, IconText[]> = {
  surgeon: [['cross', 'Rest heals faster'], ['skull', 'Fewer of the fallen die']],
  drill: [['drill', 'Drill teaches half as much again']],
  qm: [['loaf', 'The company eats a quarter less'], ['scales', 'Market prices 15% lower']],
  chaplain: [['flame', 'Spirits rise a little every day']]
};
/** The colour of the bar along the foot of a card, which the stylesheet names (.type.woad and so on); ink is the default. */
type CardLook = 'ink' | 'madder' | 'woad' | 'steel' | 'weld' | 'moss' | 'wood' | 'grey' | 'pale';
const LOOK: Record<TroopClass, CardLook> = { pike: 'woad', shot: 'steel', sabre: 'madder' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = (n: number) => ROMAN[n] || String(n);

/** The screens: the title, camp, the muster before a fight, the fight, its report, and the end of the road. */
type ScreenId = 'title' | 'camp' | 'muster' | 'battle' | 'report' | 'end';
/** The tabs along the foot of the camp screen. */
type TabId = 'map' | 'roll' | 'market' | 'work' | 'staff' | 'log';
/**
 * A dialog over the screen. An ambush or a camp event waits in the campaign for its answer; a result tells how an event was answered;
 * the standing orders can open over any other dialog, and remember it in prev.
 */
type Modal =
  | { type: 'ambush' }
  | { type: 'event' }
  | { type: 'result'; title: string; text: string }
  | { type: 'help'; prev: Modal | null };
/** The state of the interface, as opposed to the campaign (G): which screen is up, and what is chosen or going on upon it. */
interface UiState {
  screen: ScreenId;
  tab: TabId; // the open tab of the camp screen
  course: PlaceId | null; // the place the course is set for
  open: number | null; // the id of the man whose card is open in camp
  c: Contract | null; // the fight being mustered or fought: a contract, a duel or an ambush
  pick: number[]; // the ids of the men chosen to fight it
  stance: Stance | null; // the opening order chosen, or null for the one the scouts like best
  odds: StanceOdds | null; // the scouts' odds for the men chosen, or null while they scout
  b: Battle | null; // the fight in progress
  speed: number; // 0 for paused, otherwise the multiple of real time it runs at
  rep: BattleReport | null; // the count of the fight just fought
  modal: Modal | null;
  news: string[] | null; // what the last march or day in camp reported
  sound: boolean; music: boolean; // the two switches in the bar, which are kept in localStorage
  view: FieldView | null; // the picture of the fight, or of the title's skirmish
  camp: CampView | null; campPos: CampPositions; // the picture of the camp, and where its men stand in it
  demo: Battle | null; // the skirmish on the title screen
  overT: number; verdict: boolean; // seconds since the fight was decided, and whether its verdict is up
  fresh: { id: number; k: GearSlot } | null; // the gear just bought, and by whom, for the card to show off once
}
// The campaign in play: null until one is raised or continued, so on the title screen. The screens after it are built only with a
// campaign in hand, which is why they write G!; save(), barHTML() and the frame loop are what look.
let G: Campaign | null = null;
const ui: UiState = { screen: 'title', tab: 'market', course: null, open: null, c: null, pick: [], stance: null, odds: null, b: null, speed: 1, rep: null, modal: null, news: null, sound: true, music: true, view: null, camp: null, campPos: {}, demo: null, overT: 0, verdict: false, fresh: null };

/* ---------- saving ---------- */
const SAVE = 'sotnia-save-2';
function save() { try { if (G && !G.over) localStorage.setItem(SAVE, JSON.stringify(G)); else localStorage.removeItem(SAVE); } catch (e) { /* no storage here */ } }
function loadSave(): Campaign | null { try { const s = JSON.parse(localStorage.getItem(SAVE) || 'null'); return s && s.v === 2 && !s.over && PLACES[s.at as PlaceId] ? s : null; } catch (e) { return null; } }
try { ui.sound = localStorage.getItem('sotnia-sound') !== 'off'; ui.music = localStorage.getItem('sotnia-music') !== 'off'; } catch (e) { /* default on */ }

/* ---------- small parts: every screen is built from these ---------- */
const man = (id: number | null) => G!.roster.find(s => s.id === id);
const foeName = (u: Foe) => TIER[u.tier] + ' ' + CLS[u.cls].name.toLowerCase();
const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);
const DANGER = ['A quiet road', 'Robbers about', 'Dangerous country', 'Deadly country'];
const sr = (t: string) => '<span class="sr">' + t + '</span>';
const meter = (kind: 'hp' | 'mo' | 'xp' | 'foe', v: number, max: number) => '<span class="meter ' + kind + '"><i style="width:' + pct(v, max) + '%"></i></span>';
const pips = (n: number, of: number, label: string) => '<span class="pips" role="img" aria-label="' + esc(label) + '">' + Array.from({ length: of }, (_, i) => '<i' + (i < n ? ' class="on"' : '') + '></i>').join('') + '</span>';
const oddsPips = (p: number) => (p >= 0.85 ? 5 : p >= 0.65 ? 4 : p >= 0.42 ? 3 : p >= 0.2 ? 2 : 1);
// An icon and its number; the word is there for screen readers and on hover.
const stat = (icon: IconName, v: string | number, label: string) => '<span class="st" title="' + esc(label) + '">' + ic(icon) + '<b>' + v + '</b>' + sr(' ' + esc(label)) + '</span>';
// An effect: an icon, an amount and what it is of, coloured by whether it helps.
function fxChip(f: FxChip) {
  const tone = /^\+/.test(f[1]) ? 'up' : /^[−-]/.test(f[1]) ? 'down' : 'even';
  return '<span class="fx ' + tone + '">' + ic(f[0]) + '<b>' + esc(f[1]) + '</b><span>' + esc(f[2]) + '</span></span>';
}
const fxLine = (f: IconText) => '<span class="line">' + ic(f[0]) + '<span>' + esc(f[1]) + '</span></span>';
/** The bar along the foot of a card: its words, a coin at its left for a price or a wage, a level at its right, and any markup after. */
interface CardType { look?: CardLook; text: string; coin?: number; coinLabel?: string; lvl?: string; end?: string }
/** What cardHTML builds a card from. The strings that are markup (title, badges, body, end) are escaped already. */
interface CardSpec {
  tag?: 'article' | 'button'; // the element: an article unless the whole card is a button
  cls?: string; attrs?: string; // classes to add, and attributes to add (with a space in front)
  title: string;
  art?: string; artCls?: string; // the picture (an image address), and classes to add to it
  badges?: string; body?: string; type?: CardType;
}
// The card: a name banner, a picture, its body, and the type bar along the foot with the coin at its left.
function cardHTML(o: CardSpec) {
  const tag = o.tag || 'article', head = tag === 'article' ? 'h3' : 'span';
  let h = '<' + tag + ' class="card ' + (o.cls || '') + '"' + (o.attrs || '') + '><span class="face">';
  h += '<' + head + ' class="banner">' + o.title + '</' + head + '>';
  if (o.art) h += '<span class="art ' + (o.artCls || '') + '"><img src="' + o.art + '" alt="">' + (o.badges || '') + '</span>';
  h += o.body || '';
  if (o.type) {
    const t = o.type;
    h += '<span class="type ' + (t.look || 'ink') + (t.coin != null ? ' coined' : '') + (t.lvl ? ' levelled' : '') + (t.end ? ' ended' : '') + '">' + (t.coin != null ? '<span class="coin" title="' + esc(t.coinLabel || '') + '">' + t.coin + sr(' ' + (t.coinLabel || '')) + '</span>' : '') +
      '<span class="tt">' + t.text + '</span>' + (t.lvl ? '<span class="lvl" title="Level">' + t.lvl + sr(' level') + '</span>' : '') + (t.end || '') + '</span>';
  }
  return h + '</span></' + tag + '>';
}
/** The colours of a man's country as a little flag, in stripes, to stand before the name of his nation. */
function flagHTML(origin: string) {
  const f = flagOf(origin);
  if (!f) return '';
  const n = f.length, stops = f.map((c, i) => c + ' ' + (100 * i / n).toFixed(1) + '% ' + (100 * (i + 1) / n).toFixed(1) + '%').join(',');
  return '<i class="flag" aria-hidden="true" style="background:linear-gradient(' + stops + ')"></i>';
}
function sectHTML(title: string, aside?: string) { return '<h2 class="sect"><span>' + title + '</span>' + (aside ? '<small>' + aside + '</small>' : '') + '</h2>'; }

/* ---------- the bar along the top: where, when, and what the company has ---------- */
function toolsHTML() {
  return '<div class="tools">' +
    '<button class="tool" data-act="help" aria-label="Standing orders" title="Standing orders">' + ic('scroll') + '</button>' +
    '<button class="tool' + (ui.music ? '' : ' off') + '" data-act="music" aria-pressed="' + ui.music + '" aria-label="Music" title="Music">' + ic('note') + '</button>' +
    '<button class="tool' + (ui.sound ? '' : ' off') + '" data-act="sound" aria-pressed="' + ui.sound + '" aria-label="Sound" title="Sound">' + ic('speaker') + '</button></div>';
}
function barHTML() {
  let h = '<header class="bar"><h1 class="logo">Sotnia</h1>';
  if (!G || ui.screen === 'title' || ui.screen === 'end') return h + '<p class="strap">A free company · Anno 1633</p><span class="grow"></span>' + toolsHTML() + '</header>';
  const q = questOf(G), left = daysLeft(G), done = Math.round(100 * progress(G)), camp = ui.screen === 'camp';
  const due = left >= 0 ? plural(left, 'day', 'days') + ' until ' + q.until : plural(-left, 'day', 'days') + ' late: the price is falling';
  const trip = '<span>' + esc(cap1(PLACES[q.from].name)) + '</span><span class="track"><i style="width:' + done + '%"></i><b style="left:' + done + '%"></b></span><span>' + esc(PLACES[q.to].name) + '</span>';
  h += '<div class="where"><b>' + esc(cap1(here(G).name)) + '</b><span>' + dateText(G.date) + '</span></div>' +
    (camp ? '<button class="trip" data-act="tab" data-k="map" aria-label="' + esc('The map: ' + done + '% of the way to ' + PLACES[q.to].name) + '">' + trip + '</button>' : '<span class="trip" aria-hidden="true">' + trip + '</span>') +
    '<span class="stat due' + (left < 0 ? ' late' : left < daysToGo(G) ? ' tight' : '') + '" title="' + esc(due) + '">' + ic('hourglass') + '<b>' + Math.abs(left) + '</b><small>' + (left < 0 ? 'late' : 'days') + '</small>' + sr(' ' + esc(due)) + '</span>' +
    '<span class="grow"></span><div class="stats" aria-label="The company ledger">' +
    '<span class="stat" title="' + esc(cap1(q.cargo.unit)) + '">' + ic(q.kind === 'commission' ? 'coin' : 'barrel') + '<b>' + G.cargo + '</b><small>of ' + G.cargo0 + '</small>' + sr(' ' + esc(q.cargo.unit)) + '</span>' +
    '<span class="stat" title="Thalers: ' + wagesDue(G) + ' of pay fall due on ' + dateText(G.payDue, true) + '">' + ic('coin') + '<b>' + G.thalers + '</b><small>pay ' + wagesDue(G) + '</small>' + sr(' thalers, ' + wagesDue(G) + ' of pay due on ' + dateText(G.payDue, true)) + '</span>' +
    '<span class="stat" title="Bread: the company eats ' + breadDue(G) + ' a day">' + ic('loaf') + '<b>' + G.bread + '</b><small>−' + breadDue(G) + ' a day</small>' + sr(' bread') + '</span>' +
    '<span class="stat" title="Charges of powder">' + ic('horn') + '<b>' + G.powder + '</b>' + sr(' charges of powder') + '</span>' +
    '<span class="stat" title="Renown">' + ic('mace') + '<b>' + G.renown + '</b>' + sr(' renown') + '</span></div>';
  return h + toolsHTML() + '</header>';
}

/* ---------- the cards ---------- */
/**
 * One slot of a man's kit as a ladder of its four pieces, worst to best: the ones he has passed lit but faded, the one he has framed
 * in gilt, the next in grey with its price, and the rest as silhouettes. The button buys the next piece, and a card shows the man in
 * it while the button is under the pointer or has focus (see tryOn in main.ts), even when he cannot yet pay.
 */
function gearHTML(s: Soldier, k: GearSlot) {
  const names = k === 'wpn' ? WPN[s.cls] : ARM, t = s[k], what = k === 'wpn' ? 'arms' : 'armour', fresh = !!ui.fresh && ui.fresh.id === s.id && ui.fresh.k === k;
  const rungs = '<span class="rungs" role="img" aria-label="' + esc(names[t] + ', ' + (t + 1) + ' of 4') + '">' + names.map((n, i) =>
    '<span class="rung ' + (i < t ? 'was' : i === t ? 'now' + (fresh ? ' fresh' : '') : i === t + 1 ? 'next' : 'far') + '" title="' + esc(n + (i === t ? ', his now' : i === t + 1 ? ', ' + gearPrice(G!, t) + ' thalers' : '')) + '"><img src="' + gearArt(k, s.cls, i, nationOf(s.origin)) + '" alt=""></span>').join('') + '</span>';
  const head = '<span class="gname">' + ic(k === 'wpn' ? s.cls : 'cuirass') + '<span>' + esc(names[t]) + '</span></span>';
  if (t >= 3) return '<span class="gear" data-slot="' + k + '">' + head + rungs + '<span class="best" title="The best there is">' + ic('star', 'The best there is') + '</span></span>';
  const p = gearPrice(G!, t), shop = has(G!, 'market');
  return '<span class="gear" data-slot="' + k + '">' + head + rungs + '<button class="mini" data-act="up" data-id="' + s.id + '" data-k="' + k + '"' + (!shop || G!.thalers < p ? ' aria-disabled="true"' : '') +
    ' aria-label="' + esc('Better ' + what + ' for ' + s.name + ': ' + names[t + 1] + ', ' + p + ' thalers') + '" title="' + esc(shop ? names[t + 1] + ', ' + p + ' thalers' : 'Bought only where there is a market') + '">' + ic('up') + p + '</button></span>';
}
function soldierCard(s: Soldier, where: 'roll' | 'camp') {
  const c = CLS[s.cls], skill = s.cls === 'shot' ? s.aim : s.mel, T = s.trait && TRAITS[s.trait];
  let badges = '';
  if (T) badges += '<span class="badge' + (T.good ? '' : ' bad') + '" title="' + esc(T.desc) + '">' + ic(T.good ? 'star' : 'warn') + esc(s.trait) + sr(': ' + esc(T.desc)) + '</span>';
  if (s.wound) badges += '<span class="badge red right">' + ic('cross') + 'Abed ' + s.wound + '</span>' + sr(' for ' + plural(s.wound, 'day', 'days'));
  else if (s.scars.length) badges += '<span class="badge right" title="' + esc('Carries ' + s.scars.join(', ')) + '">' + ic('limp') + s.scars.length + sr(' ' + esc('Carries ' + s.scars.join(', '))) + '</span>';
  if (s.promos) badges += '<span class="ribbon">' + ic('star') + 'Promotion earned</span>';
  let body = '<span class="bars">' + ic('drop') + meter('hp', s.hp, s.vig) + '<span class="n">' + s.hp + '/' + s.vig + sr(' blood') + '</span>' +
    ic('flame') + meter('mo', s.morale, 100) + '<span class="n">' + s.morale + sr(' spirit') + '</span>' +
    ic('star') + meter('xp', s.xp, xpNeed(s.level)) + '<span class="n">' + s.xp + '/' + xpNeed(s.level) + sr(' experience') + '</span></span>';
  body += '<span class="strip">' + stat('heart', s.vig, 'Vigour') + stat(s.cls, skill, c.skill) + stat('shield', s.grd, 'Guard') + stat('swords', s.kills, 'Kills') + '</span>';
  if (s.promos) {
    body += '<span class="choose" role="group" aria-label="' + esc('Choose a promotion for ' + s.name) + '">' +
      ([['vig', 'heart', '+8', 'Vigour +8'], ['skill', s.cls, '+2', c.skill + ' +2'], ['grd', 'shield', '+2', 'Guard +2']] satisfies [Promo, IconName, string, string][]).map(p =>
        '<button class="mini gold" data-act="promo" data-id="' + s.id + '" data-k="' + p[0] + '" aria-label="' + p[3] + '" title="' + p[3] + '">' + ic(p[1]) + p[2] + '</button>').join('') + '</span>';
  }
  body += s.wound ? '<span class="abed">' + ic('moon') + 'Resting until he can stand</span>' :
    '<span class="orders" role="group" aria-label="' + esc('Order in camp for ' + s.name) + '">' + (Object.keys(ORDER) as CampOrder[]).map(o =>
      '<button data-act="order" data-id="' + s.id + '" data-o="' + o + '" aria-pressed="' + (s.order === o) + '">' + ic(o === 'rest' ? 'moon' : o) + ORDER[o] + '</button>').join('') + '</span>';
  body += '<span class="gears">' + gearHTML(s, 'wpn') + gearHTML(s, 'arm') + '</span>';
  if (where === 'roll') body += '<button class="link" data-act="dismiss" data-id="' + s.id + '">Strike from the roll</button>';
  return cardHTML({
    cls: 'soldier' + (s.promos ? ' gilt' : '') + (where === 'camp' ? ' side-card' : ''), attrs: ' aria-label="' + esc(s.name) + '"', title: esc(s.name) + '<small>' + flagHTML(s.origin) + esc(s.origin) + '</small>',
    art: soldierArt(s), artCls: (s.wound ? 'hurt' : '') + (ui.fresh && ui.fresh.id === s.id ? ' fresh' : ''), badges, body,
    type: { look: LOOK[s.cls], text: c.name, coin: wageOf(s), coinLabel: 'Wage, thalers a month', lvl: roman(s.level) }
  });
}
function recruitCard(r: Recruit, i: number, full: boolean) {
  const s = r.s, c = CLS[s.cls], T = s.trait && TRAITS[s.trait], off = full || G!.thalers < r.price;
  const badges = T ? '<span class="badge' + (T.good ? '' : ' bad') + '" title="' + esc(T.desc) + '">' + ic(T.good ? 'star' : 'warn') + esc(s.trait) + '</span>' : '';
  return cardHTML({
    tag: 'button', cls: 'buy', attrs: ' data-act="hire" data-i="' + i + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc('Hire ' + s.name + ', ' + s.origin + ' ' + c.name.toLowerCase() + ', level ' + s.level + (s.trait ? ', ' + s.trait.toLowerCase() : '') + ', for ' + r.price + ' thalers') + '"',
    title: esc(s.name) + '<small>' + flagHTML(s.origin) + esc(s.origin) + '</small>', art: soldierArt(s), badges,
    body: '<span class="strip">' + stat('heart', s.vig, 'Vigour') + stat(s.cls, s.cls === 'shot' ? s.aim : s.mel, c.skill) + stat('shield', s.grd, 'Guard') + '</span>' +
      '<span class="line">' + ic('coin') + '<span>Wage ' + wageOf(s) + ' a month</span></span>',
    type: { look: LOOK[s.cls], text: c.name + ' · ' + roman(s.level), coin: r.price, coinLabel: 'Price to hire, thalers' }
  });
}
function supplyCard(k: Supply) {
  const bread = k === 'bread', p = bread ? breadPrice(G!) : powderPrice(G!);
  return '<div class="pile">' + cardHTML({
    tag: 'button', cls: 'buy', attrs: ' data-act="buy" data-k="' + k + '"' + (G!.thalers < p ? ' disabled' : '') + ' aria-label="' + (bread ? 'Buy ten loaves of bread' : 'Buy ten charges of powder') + ' for ' + p + ' thalers"',
    title: bread ? 'Bread' : 'Powder', art: supplyArt(k), badges: '<span class="badge right">×10</span>',
    body: fxLine(bread ? ['men', 'Each man eats one a day'] : ['shot', 'One charge a shot']),
    type: { look: 'weld', text: 'Supply', coin: p, coinLabel: 'Price, thalers' }
  }) + '</div>';
}
function cargoCard() {
  const q = questOf(G!), p = unitPrice(G!), chest = q.kind === 'commission';
  const sell = (n: number, label: string, aria: string) => '<button class="mini" data-act="sell" data-n="' + n + '"' + (G!.cargo < n ? ' disabled' : '') + ' aria-label="' + aria + '">' + label + '</button>';
  const body = chest ?
    '<span class="line">' + ic('warn') + '<span>Every thaler taken comes off the fee, and the Crown will remember it.</span></span><span class="choose">' + sell(10, '−10 ' + ic('coin'), 'Take 10 thalers from the chest') + sell(50, '−50 ' + ic('coin'), 'Take 50 thalers from the chest') + '</span>' :
    '<span class="compare"><span><small>Here</small><b>' + p + '</b></span><span class="there"><small>' + esc(PLACES[q.to].name) + '</small><b>' + q.price + '</b></span></span>' +
    '<span class="choose">' + sell(1, '−1 ' + ic('barrel'), 'Sell one ' + esc(q.cargo.one) + ' for ' + p + ' thalers') + sell(5, '−5 ' + ic('barrel'), 'Sell five ' + esc(q.cargo.many) + ' for ' + 5 * p + ' thalers') + '</span>';
  return cardHTML({ cls: 'cargo', attrs: ' aria-label="' + (chest ? 'The Crown’s chest' : 'The cargo') + '"', title: chest ? 'The Crown’s chest' : 'The ' + esc(q.cargo.many), art: questArt(q), body, type: { look: 'wood', text: 'Cargo · ' + G!.cargo } });
}
function staffCard(k: StaffId) {
  const s = STAFF[k], hired = !!G!.staff[k];
  return cardHTML({
    tag: 'button', cls: 'buy' + (hired ? ' hired' : ''), attrs: ' data-act="staff" data-k="' + k + '"' + (hired || G!.thalers < s.fee ? ' disabled' : '') + ' aria-label="' + esc(hired ? s.name + ', in your pay' : 'Engage the ' + s.name.toLowerCase() + ' for ' + s.fee + ' thalers, then ' + s.wage + ' a month: ' + s.desc) + '"',
    title: s.name, art: staffArt(k), badges: hired ? '<span class="badge moss right">' + ic('check') + 'In your pay</span>' : '',
    body: STAFF_FX[k].map(fxLine).join(''),
    type: { look: 'moss', text: '+' + s.wage + ' a month', coin: s.fee, coinLabel: 'Fee to engage, thalers' }
  });
}
function oddsFor(c: Contract) {
  if (!G!.odds[c.id]) { const ids = defaultPick(G!, c); G!.odds[c.id] = ids.length ? stanceOdds(G!, c, ids, 8) : { p: 0, best: 'advance', none: true }; }
  return G!.odds[c.id];
}
const WEATHER_ICON: Record<Exclude<Weather, 'clear'>, IconName> = { rain: 'rain', fog: 'fog' };
function contractCard(c: Contract, where: 'work' | 'muster') {
  const k = KIND[c.ai], o = where === 'work' ? oddsFor(c) : null;
  let badges = '<span class="badge">' + (c.duel ? 'Duel' : c.ambush ? 'Ambush' : k.tag) + '</span>';
  if (c.weather !== 'clear') badges += '<span class="badge light right" title="' + esc(WEATHER[c.weather]) + '">' + ic(WEATHER_ICON[c.weather]) + esc(WEATHER[c.weather].split(':')[0]) + sr(': ' + esc(WEATHER[c.weather].split(':')[1] || '')) + '</span>';
  let body = '<span class="who">' + esc(c.who) + '</span><span class="flavour">' + esc(c.text) + '</span>';
  const terms = c.ambush ? [] : [stat('mace', '+' + c.renown, 'renown'), stat('men', c.cap, c.cap === 1 ? 'one man' : 'men at most')];
  if (!c.ambush && !c.final) terms.push(stat('hourglass', c.ttl, c.ttl > 1 ? 'days open' : 'last day'));
  if (c.bonus) for (const x in c.bonus) terms.push(stat(x === 'bread' ? 'loaf' : 'horn', '+' + c.bonus[x as Supply], x));
  terms.push(stat('swords', c.units.length, c.units.length === 1 ? 'foe' : 'foes'));
  if (terms.length) body += '<span class="strip">' + terms.join('') + '</span>';
  if (o) body += '<span class="scouts">' + ic('eye') + (o.none ? '<span>No one fit to march</span>' : pips(oddsPips(o.p), 5, 'Scouts: ' + oddsWord(o.p)) + '<span>' + oddsWord(o.p) + '</span>') + '</span>';
  const end = where === 'work' ? '<button class="btn go sm" data-act="muster" data-id="' + c.id + '"' + (o && o.none ? ' disabled' : '') + '>' + ic('swords') + 'Muster</button>' : '';
  return cardHTML({
    cls: 'contract' + (c.final ? ' gilt' : ''), attrs: ' aria-label="' + esc(c.title) + '"', title: esc(c.title), art: foesArt(c), artCls: 'wide', badges, body,
    type: c.ambush ? { look: 'ink', text: 'No pay · ' + esc(cap1(c.foe)) } : { look: 'ink', text: c.duel ? 'Cold steel' : esc(cap1(c.foe)), coin: c.pay, coinLabel: 'Pay, thalers', end }
  });
}

/* ---------- camp: the company round its fire, the way on, and the work of the day ---------- */
function campScene() {
  const plan = campPlan(G!), q = questOf(G!);
  const label = 'The company in camp at ' + here(G!).name + ': ' + (plan.length ? plan.map(p => p.s.name + (p.k === 'abed' ? ' abed' : p.k === 'rest' ? ' by the fire' : p.k === 'drill' ? ' at drill' : ' foraging')).join(', ') : 'nobody under the banner') + '. The ' + q.cargo.many + ' wait by the tents.';
  let h = '<div class="scene"><canvas id="camp" role="img" aria-label="' + esc(label) + '"></canvas>';
  for (const p of plan) {
    const on = p.id === ui.open, w = p.k === 'abed' ? 20 : 18, hh = p.k === 'abed' ? 9 : p.k === 'rest' ? 19 : 32, top = p.y - (p.k === 'abed' ? 8 : p.k === 'rest' ? 18 : 31);
    h += '<button class="camper' + (on ? ' on' : '') + '" data-act="sel" data-id="' + p.id + '" data-k="' + p.k + '" aria-pressed="' + on + '" aria-label="' + esc(p.s.name + ', ' + CLS[p.s.cls].name.toLowerCase() + (p.k === 'abed' ? ', abed' : ', ' + ORDER[p.k].toLowerCase())) + '"' +
      ' style="left:' + ((p.x - 9) / CW * 100).toFixed(2) + '%;top:' + (top / CH * 100).toFixed(2) + '%;width:' + (w / CW * 100).toFixed(2) + '%;height:' + (hh / CH * 100).toFixed(2) + '%">' +
      '<span class="plate">' + ic(p.k === 'abed' ? 'cross' : p.k === 'rest' ? 'moon' : p.k) + esc(p.s.name.split(' ')[0]) + '</span></button>';
  }
  return h + '</div>';
}
function courseBlock(off: string) {
  const q = questOf(G!), days = searchRoutes(G!).best;
  const places = (Object.keys(PLACES) as PlaceId[]).filter(id => id !== G!.at && days[id] != null).sort((a, b) => (a === q.to ? -1 : b === q.to ? 1 : days[a]! - days[b]!));
  if (!places.length) return '';
  if (!(places as (PlaceId | null)[]).includes(ui.course)) ui.course = places[0];
  const route = routeTo(G!, ui.course!)!, steady = route.reduce((n, r) => n + r.days, 0), forced = route.reduce((n, r) => n + r.forced, 0);
  const need = breadDue(G!), fed = need ? Math.floor(G!.bread / need) : 99, md = courseMarketDays(route, false);
  let h = '<div class="course"><label for="course-to">' + ic('flag') + 'Course</label><select id="course-to" data-act="course-pick">' + places.map(id => '<option value="' + id + '"' + (id === ui.course ? ' selected' : '') + '>' +
    esc(cap1(PLACES[id].name)) + (id === q.to ? ', the destination' : '') + ' · ' + plural(days[id]!, 'day', 'days') + '</option>').join('') + '</select>' +
    '<div class="go-row"><button class="btn go" data-act="course"' + off + '>' + ic('boot') + 'March · ' + plural(steady, 'day', 'days') + '</button>' +
    (forced < steady ? '<button class="btn" data-act="course" data-f="1"' + off + ' title="Forced: sooner, but it costs cargo and wears the men">' + ic('forced') + plural(forced, 'day', 'days') + sr(' forced march') + '</button>' : '') + '</div>' +
    '<span class="meta">' + ic('calendar') + 'In by ' + dateText(G!.date + steady, true) + ' · ' + plural(route.length, 'leg', 'legs') + (need ? ' · eats ' + need * steady + ' ' + ic('loaf') : '') + '</span>';
  if (need && fed < md) h += '<span class="warn">' + ic('warn') + 'Bread for ' + plural(fed, 'day', 'days') + '; first market ' + md + ' days on</span>';
  return h + '</div>';
}
function dockHTML() {
  const q = questOf(G!), nobody = !G!.roster.length, off = nobody ? ' disabled' : '', need = breadDue(G!);
  const t: Record<CampSpot, number> = { drill: 0, rest: 0, forage: 0, abed: 0 };
  G!.roster.forEach(s => t[s.wound ? 'abed' : s.order]++);
  let h = '<div class="dock"><div class="tally"><span class="k">Tonight</span><span class="chips">' +
    ([['drill', 'drill', 'at drill'], ['rest', 'moon', 'resting'], ['forage', 'forage', 'foraging'], ['abed', 'cross', 'abed']] satisfies [CampSpot, IconName, string][]).map(x => '<span class="tchip" title="' + x[2] + '">' + ic(x[1]) + '<b>' + t[x[0]] + '</b>' + sr(' ' + x[2]) + '</span>').join('') +
    '</span><span class="meta">' + ic('coin') + wagesDue(G!) + ' pay on ' + dateText(G!.payDue, true) + '</span></div>';
  if (atEnd(G!)) {
    return h + '<div class="deliver"><button class="btn go big" data-act="deliver">' + ic(q.kind === 'commission' ? 'coin' : 'scales') + (q.kind === 'commission' ? 'Hand over the chest' : 'Sell the ' + esc(q.cargo.many)) + ' · ' + cargoValue(G!) + ' thalers</button>' +
      (lateDays(G!) ? '<span class="warn">' + ic('hourglass') + plural(lateDays(G!), 'day', 'days') + ' late: the price has fallen</span>' : '<span class="meta">' + ic('check') + 'In time</span>') + '</div></div>';
  }
  h += '<button class="act" data-act="halt" title="Each man drills, rests or forages, as ordered">' + ic('moon') + '<span>' + (nobody ? 'Wait a day' : 'Rest a day') + '</span><small>' + (need ? '−' + need + ' ' + ic('loaf') : 'new faces may come') + '</small></button>';
  h += courseBlock(off);
  const warns: IconText[] = [];
  if (nobody) warns.push(['men', 'Nobody to drive the train: hire at the market']);
  else if (G!.thalers < wagesDue(G!)) warns.push(['coin', 'The pay chest is short: ' + wagesDue(G!) + ' due, ' + G!.thalers + ' in hand']);
  if (!nobody && G!.bread < need) warns.push(['loaf', 'Not enough bread for tomorrow']);
  if (warns.length) h += '<div class="warns">' + warns.map(w => '<span class="warn">' + ic(w[0]) + esc(w[1]) + '</span>').join('') + '</div>';
  return h + '</div>';
}
function mapPanel() {
  const q = questOf(G!), T = transportOf(G!), need = breadDue(G!), fed = need ? Math.floor(G!.bread / need) : 99, to = PLACES[q.to], togo = daysToGo(G!), left = daysLeft(G!);
  let h = '<div class="mapgrid"><div class="mapwrap"><div class="plate mapplate"><canvas id="map" role="img" aria-label="' + esc('Map: the company is at ' + here(G!).name + ', bound for ' + to.name) + '"></canvas></div>' +
    '<p class="caption">' + esc(q.title) + ': ' + esc(cap1(PLACES[q.from].name)) + ' to ' + esc(to.name) + '. Red is the road so far, black the roads from here. Pick a place to set the course.</p></div>';
  if (atEnd(G!)) return h + '</div>';
  const nobody = !G!.roster.length, off = nobody ? ' disabled' : '';
  h += '<div class="roads">' + sectHTML('One leg at a time', esc(T.name) + (need ? ' · bread for ' + plural(fed, 'day', 'days') : '')) + '<ul>';
  h += roadsFrom(G!).map(r => {
    const P2 = PLACES[r.to], rest = daysToGo(G!, r.to), shop = (SERVICES[P2.kind] || {}).market || r.to === q.to, md = shop ? r.days : marketDays(G!, r);
    return '<li class="road"><div class="what"><b>' + esc(cap1(P2.name)) + '</b><span class="chips">' +
      stat('road', r.km + ' km', 'through ' + LANDS[r.land].name) + '<span class="st danger d' + r.danger + '" title="' + DANGER[r.danger] + '">' + ic('swords') + '<b>' + DANGER[r.danger] + '</b></span>' +
      (shop ? stat('scales', 'Market', 'a market there') : '<span class="st muted" title="No market there">' + ic('scales') + '<b>Next ' + md + 'd</b>' + sr(' no market there; the next is ' + plural(md, 'day', 'days') + ' on') + '</span>') +
      stat('calendar', dateText(G!.date + r.days, true), 'in by') + (r.to !== q.to && rest < Infinity ? stat('flag', rest + 'd', 'then to ' + to.name) : '') + '</span>' +
      (need && fed < md ? '<span class="warn">' + ic('loaf') + 'Bread for ' + plural(fed, 'day', 'days') + (shop ? ' of the ' + r.days : '; market ' + md + ' days on') + '</span>' : '') + '</div>' +
      '<div class="go2"><button class="btn sm" data-act="march" data-r="' + r.i + '"' + off + '>' + ic('boot') + plural(r.days, 'day', 'days') + sr(' march to ' + esc(P2.name)) + '</button>' +
      (r.forced < r.days ? '<button class="btn sm ghost" data-act="march" data-r="' + r.i + '" data-f="1"' + off + ' title="Forced march">' + ic('forced') + plural(r.forced, 'day', 'days') + sr(' forced march to ' + esc(P2.name)) + '</button>' : '') + '</div></li>';
  }).join('') + '</ul><p class="note">' + ic('flag') + esc(to.name) + ': ' + plural(togo, 'day', 'days') + ' by the shortest road · ' + (left >= 0 ? plural(left, 'day', 'days') + ' left' : 'the date has passed') + '. Forced marches cost ' + esc(q.cargo.many) + ' and wear the men.</p></div>';
  return h + '</div>';
}
function marketPanel() {
  const full = G!.roster.length >= ROSTER_MAX;
  let h = '';
  if (has(G!, 'recruits')) {
    h += '<section>' + sectHTML('For hire', full ? 'the roll is full: ' + G!.roster.length + ' of ' + ROSTER_MAX : G!.roster.length + ' of ' + ROSTER_MAX + ' on the roll') +
      (G!.recruits.length ? '<div class="cards">' + G!.recruits.map((r, i) => recruitCard(r, i, full)).join('') + '</div>' : '<p class="empty">' + ic('hourglass') + 'Nobody is looking for work. New faces turn up every third day.</p>') + '</section>';
  }
  h += '<section>' + sectHTML('Supplies and cargo') + '<div class="cards">' + supplyCard('bread') + supplyCard('powder') + (atEnd(G!) ? '' : cargoCard()) + '</div></section>';
  return h;
}
/** A tab of the camp screen: its id, its icon, its name and, if it has any, how many things it holds. */
type TabSpec = [k: TabId, icon: IconName, label: string, count?: number | null];
function campHTML() {
  let h = '';
  if (ui.news && ui.news.length) {
    const news: { t: string; k: number }[] = [];
    for (const t of ui.news) { const prev = news[news.length - 1]; if (prev && prev.t === t) prev.k++; else news.push({ t, k: 1 }); }
    h += '<ul class="news" aria-label="On the road">' + news.map(n => '<li>' + ic('lantern') + '<span>' + esc(n.t) + (n.k > 1 ? ' <small>(' + n.k + ' days)</small>' : '') + '</span></li>').join('') + '</ul>';
  }
  if (!man(ui.open)) ui.open = G!.roster.length ? G!.roster[0].id : null;
  const sel = man(ui.open);
  h += '<section class="stage">' + campScene() + '<aside class="side">' + (sel ? soldierCard(sel, 'camp') :
    '<div class="card side-card empty-card"><span class="face"><span class="banner">Nobody under the banner</span><span class="line">' + ic('men') + '<span>Hire men at the market before marching.</span></span></span></div>') + '</aside></section>';
  h += dockHTML();
  const tabs: TabSpec[] = [['map', 'map', 'The road']];
  tabs.push(['roll', 'men', 'The roll', G!.roster.length]);
  if (has(G!, 'market')) tabs.push(['market', 'scales', 'Market', has(G!, 'recruits') ? G!.recruits.length : null]);
  if (has(G!, 'work')) tabs.push(['work', 'swords', 'Work', G!.contracts.length]);
  if (has(G!, 'staff')) tabs.push(['staff', 'wagon', 'Baggage train']);
  tabs.push(['log', 'book', 'Chronicle']);
  if (!tabs.some(t => t[0] === ui.tab)) ui.tab = tabs[0][0];
  h += '<nav class="tabs" role="tablist" aria-label="The company’s business">' + tabs.map(t => '<button role="tab" data-act="tab" data-k="' + t[0] + '" aria-selected="' + (ui.tab === t[0]) + '">' + ic(t[1]) + t[2] +
    (t[3] ? '<span class="count">' + t[3] + '</span>' : '') + '</button>').join('') + '</nav><div class="panel" role="tabpanel">';
  if (ui.tab === 'map') h += mapPanel();
  else if (ui.tab === 'roll') h += G!.roster.length ? '<div class="cards">' + G!.roster.map(s => soldierCard(s, 'roll')).join('') + '</div>' : '<p class="empty">' + ic('men') + 'Nobody stands under the banner. Hire men at the market.</p>';
  else if (ui.tab === 'market') h += marketPanel();
  else if (ui.tab === 'work') h += G!.contracts.length ? '<div class="cards wide">' + G!.contracts.map(c => contractCard(c, 'work')).join('') + '</div>' : '<p class="empty">' + ic('swords') + 'No work posted here today.</p>';
  else if (ui.tab === 'staff') h += '<div class="cards">' + (Object.keys(STAFF) as StaffId[]).map(staffCard).join('') + '</div>';
  else h += '<ol class="log">' + G!.log.map(l => '<li><span class="d">' + (l.n != null ? dateText(l.n, true) : 'Day ' + l.d) + '</span><span>' + esc(l.t) + '</span></li>').join('') + '</ol>';
  return h + '</div>';
}

/* ---------- muster: who fights, and how they open ---------- */
function tokenHTML(s: Soldier, on: boolean, full?: boolean) {
  const off = !!s.wound;
  return '<button class="token' + (on ? ' on' : '') + '" data-act="pick" data-id="' + s.id + '" aria-pressed="' + on + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc(s.name + ', ' + CLS[s.cls].name.toLowerCase() + ', level ' + s.level + (off ? ', abed' : '')) + '">' +
    '<span class="art' + (off ? ' hurt' : '') + '"><img src="' + soldierArt(s) + '" alt=""></span>' +
    '<span class="tname">' + ic(s.cls) + esc(s.name.split(' ')[0]) + '</span>' +
    '<span class="tbars">' + ic('drop') + meter('hp', s.hp, s.vig) + ic('flame') + meter('mo', s.morale, 100) + '</span>' +
    '<span class="badge-dot">' + ic(off ? 'cross' : on ? 'check' : 'plus') + '</span></button>';
}
function musterHTML() {
  const c = ui.c!, o = ui.odds, list: Stance[] = c.duel ? ['advance', 'charge'] : ['hold', 'advance', 'charge'];
  const cur = ui.stance || (o ? o.best : null), cap = Math.min(c.cap, G!.roster.length);
  let h = '<div class="muster"><div class="mcontract">' + contractCard(c, 'muster') +
    '<p class="note">' + ic('eye') + esc(c.duel ? 'No powder, no seconds. The loser may yield.' : KIND[c.ai].note) + '</p>' +
    (c.ambush ? '<p class="note warn">' + ic('barrel') + 'Beaten, they take ' + plural(raidLoss(G!, false), cargoName(G!, 1), cargoName(G!, 2)) + '. Sound the retreat and they take ' + raidLoss(G!, true) + '.</p>' : '') + '</div>';
  h += '<section class="mstances">' + sectHTML('Opening order', 'you can change it in the fight') + '<div class="stances" role="group" aria-label="Opening order">' + list.map(s => {
    const S = c.duel ? DUEL_STANCE[s as DuelStance] : STANCE[s], on = cur === s, p = o ? o[s] : null;
    return cardHTML({
      tag: 'button', cls: 'stance' + (on ? ' on' : ''), attrs: ' data-act="stance" data-s="' + s + '" aria-pressed="' + on + '"', title: S.name, art: stanceArt(s),
      body: S.fx.map(fxLine).join(''),
      type: { look: on ? 'ink' : 'pale', text: ic('eye') + (p != null ? pips(oddsPips(p), 5, S.name + ': ' + oddsWord(p)) : '<span>Scouting…</span>') }
    });
  }).join('') + '</div></section>';
  const p = o && cur ? o[cur] : null, n = p != null ? oddsPips(p) : 0, shots = ui.pick.some(id => man(id) && man(id)!.cls === 'shot');
  h += '<aside class="verdict-box"><span class="k">The scouts say</span><span class="bigpips">' + Array.from({ length: 5 }, (_, i) => '<i' + (i < n ? ' class="on"' : '') + '></i>').join('') + '</span>' +
    '<span class="word" aria-live="polite">' + (p != null ? oddsWord(p) : ui.pick.length ? 'Scouting…' : 'Choose men') + '</span>' +
    '<span class="chips">' + stat('men', ui.pick.length + ' of ' + cap, 'chosen') + (cur ? stat((c.duel ? DUEL_STANCE : STANCE)[cur as DuelStance].icon, (c.duel ? DUEL_STANCE : STANCE)[cur as DuelStance].name, 'opening order') : '') + (c.duel ? '' : stat('horn', G!.powder, 'powder')) + '</span>' +
    (G!.powder < 1 && shots && !c.duel ? '<span class="warn">' + ic('horn') + 'No powder: muskets fight with the butt</span>' : '') +
    '<span class="meta">' + ic(c.ambush ? 'warn' : 'sun') + (c.ambush ? 'They are on the train. No going back.' : 'Fighting takes the whole day.') + '</span>' +
    '<button class="btn go huge" data-act="fight"' + (ui.pick.length ? '' : ' disabled') + '>' + ic('swords') + 'To arms</button>' +
    (c.ambush ? '' : '<button class="btn ghost" data-act="back">' + ic('tent') + 'Back to camp</button>') + '</aside></div>';
  h += '<section class="who">' + sectHTML('Who fights', ui.pick.length + ' of ' + cap + ' chosen') + '<div class="tokens" role="group" aria-label="Who fights">' + G!.roster.map(s => tokenHTML(s, ui.pick.includes(s.id))).join('') + '</div></section>';
  return h;
}

/* ---------- the fight ---------- */
function battleHTML() {
  const c = ui.c!, key = (k: string, s: Stance, label: string, icon: IconName) => '<button data-act="cmd" data-s="' + s + '">' + ic(icon) + label + '<kbd>' + k + '</kbd></button>';
  return '<section class="fight"><div class="plate field"><canvas id="field" role="img" aria-label="The fight, drawn as it happens"></canvas><div id="verdict"></div></div>' +
    '<p class="caption"><span>' + esc(c.title) + ', as it befell on ' + dateText(G!.date) + '.</span><span id="clock" class="num"></span></p>' +
    '<div class="cmd"><div class="seg big" role="group" aria-label="Order to the company" id="orders">' +
    (c.duel ? key('1', 'advance', 'Measure', 'eye') + key('2', 'charge', 'Rush', 'forced') : key('1', 'hold', 'Hold', 'wall') + key('2', 'advance', 'Advance', 'boot') + key('3', 'charge', 'Charge', 'forced')) + '</div>' +
    '<button class="btn ghost" data-act="retreat" id="retreat">' + ic('white') + (c.duel ? 'Yield' : 'Sound the retreat') + '</button><span class="spacer"></span>' +
    '<div class="seg" role="group" aria-label="Speed" id="speed"><button data-act="speed" data-v="0" aria-label="Pause">' + ic('pause') + '</button><button data-act="speed" data-v="1">1×</button><button data-act="speed" data-v="2">2×</button><button data-act="speed" data-v="4">4×</button></div></div>' +
    '<div class="sides"><div class="side-box"><div class="head">' + ic('flag') + 'Your men<span id="powder"></span></div><div class="units" id="ours"></div></div><div class="side-box theirs"><div class="head">' + ic('swords') + esc(cap1(c.foe)) + '</div><div class="units" id="theirs"></div></div></div>' +
    '<ol class="blog" id="blog" aria-live="polite"></ol></section>';
}
function paintHud() {
  const b = ui.b; if (!b || ui.screen !== 'battle') return;
  const chip = (u: BattleUnit) => '<span class="unit' + (alive(u) ? '' : ' out') + (u.routing && alive(u) ? ' run' : '') + '">' + ic(u.cls) + '<span>' + (u.side === 0 ? esc(u.name.split(' ')[0]) : cap1(TIER[u.tier])) +
    (u.routing && alive(u) ? ' runs' : '') + '</span>' + meter(u.side ? 'foe' : 'hp', u.hp, u.max) + '</span>';
  $('#ours')!.innerHTML = b.units.filter(u => u.side === 0).map(chip).join('');
  $('#theirs')!.innerHTML = b.units.filter(u => u.side === 1).map(chip).join('');
  $('#powder')!.innerHTML = ui.c!.duel ? 'cold steel' : ic('horn') + Math.max(0, b.powder);
  const left = Math.max(0, Math.ceil(TLIMIT - b.t));
  $('#clock')!.textContent = b.over ? '' : left <= 45 ? 'The light is going: ' + left + ' s' : '';
  document.querySelectorAll<HTMLButtonElement>('#orders button').forEach(el => { el.setAttribute('aria-pressed', String(b.stance[0] === el.dataset.s)); el.disabled = b.over || b.retreated; });
  document.querySelectorAll<HTMLButtonElement>('#speed button').forEach(el => el.setAttribute('aria-pressed', String(ui.speed === +el.dataset.v!)));
  $<HTMLButtonElement>('#retreat')!.disabled = b.over || b.retreated;
  $('#blog')!.innerHTML = b.log.slice(-4).reverse().map(l => '<li class="' + (l.side === 1 ? 'bad' : '') + '">' + esc(l.s) + '</li>').join('');
}
function verdictWord(won: boolean, c: Pick<Contract, 'duel' | 'final' | 'ambush'>, retreated: boolean, draw?: boolean) {
  if (won) return c.duel ? 'Honour satisfied' : c.final ? 'The ford is taken' : c.ambush ? 'They are driven off' : 'The field is yours';
  if (retreated) return c.duel ? 'Yielded' : 'Withdrawn';
  if (draw) return 'Night falls';
  return c.duel ? 'Bested' : c.ambush ? 'The train is plundered' : 'The company is beaten';
}
function showVerdict() {
  const b = ui.b!, c = ui.c!, won = b.winner === 0 && !b.retreated;
  sting(won);
  $('#verdict')!.innerHTML = '<div class="verdict' + (won ? '' : ' lost') + '"><h2 class="ribbon-word">' + verdictWord(won, c, b.retreated, b.draw) + '</h2><button class="btn go big" data-act="report">' + ic('scroll') + 'Count the cost</button></div>';
  const btn = $('#verdict button'); if (btn) btn.focus();
}
/** How the report tells a man's fate: a word, an icon and the colour of the stamp on his card. */
interface FateStamp { word: string; icon: IconName; tone: 'ink' | 'weld' | 'madder' }

/* ---------- after the fight, and at the end of the road ---------- */
const FATE: Record<Fate, FateStamp> = {
  unhurt: { word: 'Unhurt', icon: 'check', tone: 'ink' }, wounded: { word: 'Wounded', icon: 'drop', tone: 'weld' },
  'struck down': { word: 'Struck down', icon: 'cross', tone: 'madder' }, killed: { word: 'Killed', icon: 'skull', tone: 'ink' },
  fled: { word: 'Ran', icon: 'run', tone: 'weld' }, yielded: { word: 'Yielded', icon: 'white', tone: 'weld' }
};
function bannerHTML(word: string, bad: boolean) { return '<div class="ribbon-banner' + (bad ? ' bad' : '') + '"><h2>' + word + '</h2></div>'; }
function reportHTML() {
  const r = ui.rep!, kills = r.lines.reduce((n, l) => n + l.kills, 0);
  let h = '<section class="report">' + bannerHTML(verdictWord(r.won, r, r.retreated, r.draw), !r.won) +
    '<p class="facts"><i>' + esc(r.title) + ' · ' + dateText(G!.date) + '</i>' + stat('hourglass', r.secs + ' s', 'of fighting') + (r.shots ? stat('shot', r.shots, r.shots === 1 ? 'shot fired' : 'shots fired') : '') + stat('skull', kills, 'felled') + '</p>' +
    sectHTML('The butcher’s bill') + '<div class="cards bill">' + r.lines.map(l => {
      const s = man(l.id), F = FATE[l.fate], dead = l.fate === 'killed';
      const note: IconText = l.fate === 'killed' ? ['skull', 'Buried by the road'] : l.scar ? ['limp', 'Now carries ' + l.scar] : l.fate === 'struck down' && s ? ['moon', 'Abed ' + plural(s.wound, 'day', 'days')] :
        s && s.promos ? ['star', 'Promotion earned'] : l.fate === 'fled' ? ['run', 'Ran from the field'] : l.fate === 'wounded' ? ['drop', 'Cut, but standing'] : ['check', 'Not a scratch'];
      return cardHTML({
        cls: 'fate' + (dead ? ' dead' : '') + (s && s.promos ? ' gilt' : ''), attrs: ' aria-label="' + esc(l.name + ': ' + F.word) + '"', title: esc(l.name),
        art: fateArt(l), artCls: dead ? 'dead' : l.fate === 'struck down' ? 'hurt' : '',
        badges: '<span class="stamp ' + F.tone + '">' + ic(F.icon) + F.word + '</span>',
        body: '<span class="strip">' + stat('swords', l.kills, l.kills === 1 ? 'kill' : 'kills') + stat('star', l.xp ? '+' + l.xp : '—', 'experience') + '</span>' + fxLine(note),
        type: { look: dead ? 'grey' : LOOK[l.cls], text: CLS[l.cls].name }
      });
    }).join('') + '</div><div class="spoils">';
  const coin = (icon: IconName, v: string, label: string, cls: 'gold' | 'red' | 'pale' | 'steel') => '<span class="spoil ' + cls + '">' + '<span class="disc">' + ic(icon) + '</span><b>' + v + '</b><small>' + label + '</small></span>';
  if (r.won) h += (r.pay ? coin('coin', '+' + r.pay, 'thalers', 'gold') : '') + coin('mace', '+' + r.renown, 'renown', 'red') + (r.loot && r.loot.bread ? coin('loaf', '+' + r.loot.bread, 'bread', 'pale') : '') + (r.loot && r.loot.powder ? coin('horn', '+' + r.loot.powder, 'powder', 'steel') : '');
  else if (r.ambush) h += coin('barrel', '−' + r.cargoLost, esc(cargoName(G!, r.cargoLost)) + ' taken', 'red');
  else h += coin('coin', '0', 'no fee', 'pale') + (r.renown ? coin('mace', String(r.renown).replace('-', '−'), 'renown', 'red') : '');
  return h + '<span class="grow"></span><button class="btn go huge" data-act="camp">' + ic(G!.over ? 'book' : r.ambush ? 'boot' : 'tent') + (G!.over ? 'Close the ledger' : r.ambush ? 'On to ' + esc(here(G!).name) : 'Back to camp') + '</button></div></section>';
}
function endHTML() {
  // r is the delivery, which only the ending 'arrived' has and reads.
  const st = G!.stats, q = questOf(G!), r = G!.result!, to = PLACES[q.to].name;
  let word = 'The ledger is closed', lede = '';
  if (G!.over === 'arrived') {
    const kept = r.cargo / r.cargo0, profit = G!.thalers - st.start;
    word = !r.late && kept >= 0.75 ? 'The banner is made' : !r.late ? 'In time, but thinner' : r.late <= 10 ? 'In, but late' : 'Late, and sold cheap';
    lede = q.kind === 'commission' ?
      'The chest comes into ' + to + (r.cargo < r.cargo0 ? ' ' + (r.cargo0 - r.cargo) + ' thalers short' : ' whole') + (r.late ? ', ' + plural(r.late, 'day', 'days') + ' after ' + q.until : ', before ' + q.until) + '. The fee comes to ' + r.pay + ' thalers.' :
      'Of ' + r.cargo0 + ' ' + q.cargo.many + ', ' + r.cargo + ' reach ' + to + (r.late ? ', ' + plural(r.late, 'day', 'days') + ' after ' + q.until : ' before ' + q.until) + ', and fetch ' + r.pay + ' thalers' + (r.late ? '. The middlemen take their share for the delay.' : '.');
    lede += ' The company ends the road with ' + G!.thalers + ' thalers, ' + (profit >= 0 ? profit + ' more' : -profit + ' fewer') + ' than it set out with.';
  } else if (G!.over === 'dissolved') {
    word = 'The banner is furled';
    lede = 'No men, or no coin to keep them. The pole is sold for firewood at ' + cap1(here(G!).name) + ' on ' + dateText(G!.date) + '.';
  } else if (G!.over === 'victory') {
    word = 'The banner is made';
    lede = 'The Black Regiment breaks at the ford with the whole of the Hetman’s muster looking on. There will be a colonel’s commission, winter quarters, and work for as long as there is war. There is always war.';
  } else if (G!.over === 'defeat') {
    word = 'Broken at the ford';
    lede = 'Krafft’s black-coats held. What is left of the company scatters into the hills, and the Hetman’s clerks strike its name from the muster book.';
  }
  const good = (G!.over === 'arrived' && !r.late && r.cargo / r.cargo0 >= 0.75) || G!.over === 'victory';
  const lost = ([['rain', 'rain', 'spoiled by rain'], ['forced', 'forced', 'lost on forced marches'], ['raid', 'swords', 'taken on the road'], ['pilfered', 'warn', 'pilfered by your own men']] satisfies [keyof CampaignStats['lost'], IconName, string][]).filter(x => st.lost[x[0]]).map((x): FxChip => [x[1], '−' + st.lost[x[0]], x[2]]);
  if (st.sold) lost.push(['scales', '−' + st.sold, q.kind === 'commission' ? 'taken from the chest' : 'sold on the way']);
  let h = '<section class="report end">' + bannerHTML(word, !good) + '<p class="lede">' + esc(lede) + '</p>' +
    '<div class="tiles">' + ([['calendar', G!.date - q.start, 'days on the road'], ['swords', st.won + ' of ' + st.battles, 'fights won'], ['skull', st.kills, 'enemies felled'], ['coin', st.earned, 'thalers earned'], ['mace', G!.renown, 'renown']] satisfies [IconName, string | number, string][])
      .map(t => '<span class="tile">' + ic(t[0]) + '<b>' + t[1] + '</b><small>' + t[2] + '</small></span>').join('') + '</div>';
  if (lost.length) h += sectHTML('Where the ' + esc(q.cargo.many) + ' went') + '<div class="fxrow">' + lost.map(fxChip).join('') + '</div>';
  if (G!.roster.length) h += sectHTML('Still under the banner') + '<div class="tokens still">' + G!.roster.map(s => '<span class="token on">' + '<span class="art"><img src="' + soldierArt(s) + '" alt=""></span><span class="tname">' + ic(s.cls) + esc(s.name) + '</span><span class="tbars">' + stat('swords', s.kills, 'kills') + stat('star', roman(s.level), 'level') + '</span></span>').join('') + '</div>';
  if (st.dead.length) h += sectHTML('The fallen') + '<ol class="log fallen">' + st.dead.map(d => '<li><span class="d">' + (d.date != null ? dateText(d.date, true) : 'day ' + d.day) + '</span><span>' + ic('skull') + '<b>' + esc(d.name) + '</b>, ' + d.origin + ' ' + CLS[d.cls].name.toLowerCase() + ', level ' + d.level + ' · ' + esc(d.where) + '</span></li>').join('') + '</ol>';
  return h + '<div><button class="btn go huge" data-act="title">' + ic('flag') + 'Raise a new banner</button></div></section>';
}

/* ---------- the title: the commissions of 1633 ---------- */
function questCard(q: Quest) {
  const days = daysToGo({ quest: q.id, at: q.from }), worth = q.kind === 'commission' ? q.fee : q.cargo.n * q.price;
  return cardHTML({
    cls: 'quest', attrs: ' aria-label="' + esc(q.title) + '"', title: esc(q.title), art: questArt(q), artCls: 'wide',
    badges: '<span class="badge">' + (q.kind === 'commission' ? 'Commission' : 'Venture') + '</span><span class="badge gold right" title="Playing time">' + ic('hourglass') + esc(q.play) + '</span>',
    body: '<span class="route">' + esc(cap1(PLACES[q.from].name)) + ic('road') + esc(PLACES[q.to].name) + '</span><span class="who">' + esc(q.who) + '</span><span class="flavour">' + esc(q.text) + '</span>' +
      '<span class="strip">' + stat('calendar', dateText(q.start, true) + '–' + dateText(q.deadline, true), 'from and by') + stat('boot', '~' + days + 'd', 'on the road, ' + (q.deadline - q.start) + ' to spare them') + stat(q.kind === 'commission' ? 'coin' : 'barrel', q.cargo.n, q.cargo.unit) + stat('wagon', esc(TRANSPORT[q.transport].name), 'how it travels') + '</span>',
    type: { look: 'ink', text: '', coin: worth, coinLabel: q.kind === 'commission' ? 'Fee, thalers' : 'Worth at the destination, thalers', end: '<button class="btn go sm" data-act="new" data-q="' + q.id + '">' + ic('flag') + 'Raise the banner</button>' }
  });
}
/** A heading and its text, led by an icon: one step of the title's account of the game, one paragraph of the standing orders. */
type IconTitleText = [icon: IconName, title: string, text: string];
function titleHTML() {
  const sv = loadSave();
  return '<div class="hero"><div><div class="plate field"><canvas id="field" role="img" aria-label="A skirmish between two small companies"></canvas></div>' +
    '<p class="caption">A true likeness of how such affairs are settled: pike, shot and sabre.</p></div>' +
    '<div class="intro"><p class="lede">The German war is in its fifteenth year, and every prince between the Rhine and the Dnieper is hiring. You have a banner, a handful of men, and a long road.</p>' +
    '<ol class="how">' + ([['flag', 'Take a commission', 'Carry a cargo across the lands of 1633 by the day it names.'], ['road', 'Choose the road', 'March steady or forced; rest, drill and buy bread.'], ['men', 'Keep the roll', 'Hire pike, shot and sabre; pay them; fight what falls on the train.']] satisfies IconTitleText[])
      .map(x => '<li><span class="disc">' + ic(x[0]) + '</span><span><b>' + x[1] + '</b>' + x[2] + '</span></li>').join('') + '</ol>' +
    (sv ? '<button class="btn go big" data-act="continue">' + ic('tent') + 'Continue: ' + esc(cap1(PLACES[sv.at].name)) + ', ' + dateText(sv.date, true) + '</button>' : '') + '</div></div>' +
    '<section>' + sectHTML('Commissions for the year 1633', 'choose one to raise the banner') + '<div class="cards wide quests">' + QUESTS.map(questCard).join('') + '</div></section>';
}

/* ---------- dialogs ---------- */
function choiceHTML(attrs: string, label: string, fx: FxChip[] | undefined, hint: string, off?: boolean) {
  return '<button class="choice"' + attrs + (off ? ' disabled' : '') + '><span class="cl">' + esc(label) + '</span>' +
    (fx && fx.length ? '<span class="fxrow">' + fx.map(fxChip).join('') + '</span>' : '<span class="hint">' + esc(hint) + '</span>') + '</button>';
}
function modalHTML() {
  const m = ui.modal; if (!m) return '';
  let inner = '', cls = '';
  if (m.type === 'event') {
    const e = EVENTS.find(x => x.id === G!.pending!.id)!;
    cls = ' event';
    inner = '<span class="strip-head woad">' + ic('lantern') + 'Camp event · ' + dateText(G!.date, true) + '</span><span class="art wide"><img src="' + eventArt() + '" alt=""></span>' +
      '<h2 class="banner" id="mt">' + esc(e.title) + '</h2><p class="flavour">' + esc(e.text(G!)) + '</p><div class="choices">' +
      e.choices.map((ch, i) => choiceHTML(' data-act="choice" data-i="' + i + '" aria-label="' + esc(ch.label + ': ' + ch.hint) + '"', ch.label, ch.fx, ch.hint)).join('') + '</div>';
  } else if (m.type === 'result') {
    inner = '<h2 class="banner" id="mt">' + esc(m.title) + '</h2><p class="flavour">' + esc(m.text) + '</p><div><button class="btn go" data-act="close">' + ic('check') + 'Carry on</button></div>';
  } else if (m.type === 'ambush') {
    const c = G!.ambush!, o = oddsFor(c), q = questOf(G!), lose = raidLoss(G!, false), short = G!.thalers < c.payoff.coin;
    cls = ' ambush';
    inner = '<span class="strip-head madder">' + ic('warn') + 'On the road · short of ' + esc(here(G!).name) + '</span><span class="art wide"><img src="' + foesArt(c) + '" alt=""></span>' +
      '<h2 class="banner" id="mt">' + esc(c.title) + '</h2><p class="who">' + esc(c.who) + '</p><p class="flavour">' + esc(c.text) + '</p>' +
      '<p class="scouts">' + ic('eye') + (o.none ? '<span>Nobody is fit to fight</span>' : pips(oddsPips(o.p), 5, 'Scouts: ' + oddsWord(o.p)) + '<span>' + oddsWord(o.p) + '</span>') + '</p><div class="choices">' +
      choiceHTML(' data-act="fightambush"', 'Stand and fight', [['swords', String(c.units.length), c.units.length === 1 ? 'foe' : 'foes'], [q.kind === 'commission' ? 'coin' : 'barrel', '−' + lose, 'if beaten']], '', o.none) +
      choiceHTML(' data-act="payoff" data-k="cargo"', q.kind === 'commission' ? 'Pay them from the Crown’s chest' : 'Give them ' + q.cargo.many, [[q.kind === 'commission' ? 'coin' : 'barrel', '−' + c.payoff.cargo, q.kind === 'commission' ? 'from the chest' : cargoName(G!, c.payoff.cargo)], ['road', 'pass', 'the train goes on']], '') +
      choiceHTML(' data-act="payoff" data-k="coin"', 'Pay them out of your own purse', short ? [] : [['coin', '−' + c.payoff.coin, 'thalers'], ['check', 'whole', 'the cargo stays whole']], 'More than the company has: ' + c.payoff.coin + ' thalers.', short) + '</div>';
  } else {
    inner = '<h2 class="banner" id="mt">Standing orders</h2><div class="rules">' + ([
      ['road', 'The road', 'A commission names a cargo, a destination and a day. Each road takes as many days as the distance needs at the pace of the cargo. A forced march gets there sooner, but costs cargo and wears the men down. Arriving late is never the end of it, but the price falls every day. Set a course to march several legs at once: the company keeps going until something needs you.'],
      ['men', 'The company', 'Every man eats a loaf a day, and wages fall due once a month. Unpaid or hungry men lose spirit, and men without spirit desert. Buy bread before empty country: there are no markets in the Wild Fields. A day in camp lets each man drill, rest or forage: you see where each one goes.'],
      ['warn', 'Trouble on the road', 'Raiders fall on the train. Fight them, or pay them off in cargo or coin. Beaten, or sounding the retreat, costs cargo. Towns post paid work; a fight there takes the day.'],
      ['swords', 'The three arms', 'Pikemen hold a line and keep sabres off. Musketeers kill from afar, burn powder, and die quickly in a brawl. Sabreurs are fast and hunt musketeers.'],
      ['flag', 'The fight', 'One order to the whole company, changed at any moment: keys 1, 2 and 3, and space to pause. Men whose spirit breaks run. Sounding the retreat saves lives, but costs the fee, or in an ambush, cargo.'],
      ['cross', 'Afterwards', 'A man struck down either dies or lies abed for days. Promotions, better arms and a barber-surgeon keep them alive longer.']
    ] satisfies IconTitleText[]).map(x => '<p>' + ic(x[0]) + '<span><b>' + x[1] + '.</b> ' + x[2] + '</span></p>').join('') +
      '<p class="arms" aria-label="Pike beats sabre, sabre beats shot, shot beats pike">' + ic('pike') + '<span>beats</span>' + ic('sabre') + '<span>beats</span>' + ic('shot') + '<span>beats</span>' + ic('pike') + '</p></div>' +
      '<div><button class="btn go" data-act="close">' + ic('check') + 'Understood</button></div>';
  }
  return '<div class="veil"><div class="dialog' + cls + '" role="dialog" aria-modal="true" aria-labelledby="mt">' + inner + '</div></div>';
}
function renderModal() {
  $('#modal')!.innerHTML = modalHTML();
  const b = $('#modal button:not(:disabled)'); if (b) b.focus();
}
function render() {
  const a = document.activeElement as HTMLElement | null, key = a && a.dataset && a.dataset.act ? '[data-act="' + a.dataset.act + '"]' + ['id', 'k', 'o', 's', 'i', 'v', 'r', 'f', 'n', 'q'].map(k => (a.dataset[k] != null ? '[data-' + k + '="' + a.dataset[k] + '"]' : '')).join('') : null;
  let h = barHTML();
  if (ui.screen === 'title') h += titleHTML();
  else if (ui.screen === 'camp') h += campHTML();
  else if (ui.screen === 'muster') h += musterHTML();
  else if (ui.screen === 'battle') h += battleHTML();
  else if (ui.screen === 'report') h += reportHTML();
  else h += endHTML();
  h += '<p class="foot">A prototype. A commission takes from a few weeks to a few months of the year 1633 on the road, and from a quarter of an hour to an hour to play. Your place is kept in this browser. Music and sound are made in the browser as you play.</p>';
  $('#view')!.innerHTML = h;
  ui.view = null; ui.camp = null;
  if (ui.screen === 'battle') { ui.view = newView($<HTMLCanvasElement>('#field')!, ui.c!.id * 7919 + G!.day * 31, ui.c!.weather, true); paintHud(); }
  else if (ui.screen === 'title') { newDemo(); }
  else if (ui.screen === 'camp') {
    const cv = $<HTMLCanvasElement>('#camp');
    if (cv) { ui.camp = newCamp(cv, ui.campPos); ui.camp.btns = Array.from(document.querySelectorAll<HTMLElement>('.camper')); drawCamp(ui.camp, G, ui.open, 0, calm); }
    if (ui.tab === 'map') drawMap($<HTMLCanvasElement>('#map'), G, !atEnd(G!) && ui.course ? routeTo(G!, ui.course) : null);
  }
  if (ui.screen === 'camp' || ui.screen === 'end') save();
  renderModal();
  if (AC) setCue(cueForScreen());
  if (key && !ui.modal) { const el = document.querySelector<HTMLButtonElement | HTMLSelectElement>(key); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}
