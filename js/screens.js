"use strict";
/* ===== SOTNIA interface: screens (shared state, saving, the HTML for every screen) ===== */
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => clamp(Math.round(100 * a / b), 0, 100);
const ORDER = { drill: 'Drill', rest: 'Rest', forage: 'Forage' };
const STANCE = {
  hold: { name: 'Hold', desc: 'Stand where you are. Muskets reload faster. Best when they have to come to you.' },
  advance: { name: 'Advance', desc: 'March on them in line. Muskets fire as soon as they are in range.' },
  charge: { name: 'Charge', desc: 'Pikes and blades run in and hit hard on arrival, but guard badly. Muskets cover them.' }
};

let G = null;
const ui = { screen: 'title', tab: 'market', open: null, c: null, pick: [], stance: null, odds: null, b: null, speed: 1, rep: null, modal: null, news: null, sound: true, music: true, view: null, demo: null, overT: 0, verdict: false };

/* ---------- saving ---------- */
const SAVE = 'sotnia-save-2';
function save() { try { if (G && !G.over) localStorage.setItem(SAVE, JSON.stringify(G)); else localStorage.removeItem(SAVE); } catch (e) { /* no storage here */ } }
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE) || 'null'); return s && s.v === 2 && !s.over && PLACES[s.at] ? s : null; } catch (e) { return null; } }
try { ui.sound = localStorage.getItem('sotnia-sound') !== 'off'; ui.music = localStorage.getItem('sotnia-music') !== 'off'; } catch (e) { /* default on */ }

/* ---------- screens ---------- */
const man = id => G.roster.find(s => s.id === id);
const foeName = u => TIER[u.tier] + ' ' + CLS[u.cls].name.toLowerCase();
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const DANGER = ['a quiet road', 'robbers about', 'dangerous country', 'deadly country'];
function mastHTML() {
  let h = '<header class="mast"><h1>Sotnia</h1><p class="strap">The ledger of a free company &middot; Anno 1633</p><div class="tools">' +
    '<button class="btn ghost sm" data-act="help">Standing orders</button>' +
    '<button class="btn ghost sm" data-act="music">Music ' + (ui.music ? 'on' : 'off') + '</button>' +
    '<button class="btn ghost sm" data-act="sound">Sound ' + (ui.sound ? 'on' : 'off') + '</button></div></header>';
  if (G && ui.screen !== 'title' && ui.screen !== 'end') {
    const q = questOf(G), left = daysLeft(G), done = Math.round(100 * progress(G));
    const due = left >= 0 ? plural(left, 'day', 'days') + ' until ' + q.until : plural(-left, 'day', 'days') + ' late: the price is falling';
    h += '<section class="ledger" aria-label="The company ledger">' +
      '<div class="days"><span class="k">' + esc(cap1(here(G).name)) + '</span><span class="v">' + dateText(G.date) + '</span>' +
      '<span class="due' + (left < 0 ? ' late' : left < daysToGo(G) ? ' tight' : '') + '">' + esc(due) + '</span>' +
      '<div class="ticks" aria-label="' + done + '% of the way"><i class="done" style="flex:' + done + '"></i><i style="flex:' + (100 - done) + '"></i></div></div>' +
      '<div><span class="k">Cargo</span><span class="v">' + G.cargo + '<small>' + esc(q.cargo.unit) + ' of ' + G.cargo0 + '</small></span></div>' +
      '<div><span class="k">Thalers</span><span class="v">' + G.thalers + '<small>pay ' + wagesDue(G) + ' on ' + dateText(G.payDue, true) + '</small></span></div>' +
      '<div><span class="k">Bread</span><span class="v">' + G.bread + '<small>&minus;' + breadDue(G) + ' a day</small></span></div>' +
      '<div><span class="k">Powder</span><span class="v">' + G.powder + '<small>charges</small></span></div>' +
      '<div><span class="k">Renown</span><span class="v">' + G.renown + '</span></div></section>';
  }
  return h;
}
function barsHTML(s) {
  return '<span class="man-bars"><span class="lab">Blood ' + s.hp + '/' + s.vig + '<span class="bar"><i style="width:' + pct(s.hp, s.vig) + '%"></i></span></span>' +
    '<span class="lab">Spirit ' + s.morale + '<span class="bar mo"><i style="width:' + s.morale + '%"></i></span></span></span>';
}
function gearHTML(s, k, names) {
  if (s[k] >= 3) return '<span class="tag">The best there is</span>';
  const p = gearPrice(G, s[k]), shop = has(G, 'market');
  return '<button class="btn sm" data-act="up" data-id="' + s.id + '" data-k="' + k + '"' + (!shop || G.thalers < p ? ' disabled' : '') + (shop ? '' : ' title="Bought only where there is a market"') + '>' + names[s[k] + 1] + ' &middot; ' + p + ' th</button>';
}
function manHTML(s) {
  const open = ui.open === s.id, c = CLS[s.cls];
  const flags = (s.promos ? '<span class="tag gold">Promotion</span>' : '') + (s.wound ? '<span class="tag red">Abed ' + s.wound + (s.wound > 1 ? ' days' : ' day') + '</span>' : '');
  let h = '<li class="man"><button class="man-head" data-act="open" data-id="' + s.id + '" aria-expanded="' + open + '">' +
    '<img class="spr" src="' + icon(s.cls, 'own') + '" alt="">' +
    '<span class="man-id"><span class="man-name">' + esc(s.name) + ' ' + flags + '</span>' +
    '<span class="man-sub">' + s.origin + ' ' + c.name.toLowerCase() + ', level ' + s.level + (s.trait ? ' &middot; ' + s.trait.toLowerCase() : '') + '</span>' + barsHTML(s) + '</span></button>';
  h += s.wound ? '<span class="tag" style="margin-right:6px">Resting</span>' :
    '<div class="seg" role="group" aria-label="Order in camp for ' + esc(s.name) + '">' + Object.keys(ORDER).map(o => '<button data-act="order" data-id="' + s.id + '" data-o="' + o + '" aria-pressed="' + (s.order === o) + '">' + ORDER[o] + '</button>').join('') + '</div>';
  if (open) {
    const skill = s.cls === 'shot' ? s.aim : s.mel;
    h += '<div class="man-body"><div class="stats"><span><b>Vigour</b>' + s.vig + '</span><span><b>' + c.skill + '</b>' + skill + '</span><span><b>Guard</b>' + s.grd + '</span><span><b>Wage</b>' + wageOf(s) + ' a month</span><span><b>Kills</b>' + s.kills + '</span></div>' +
      '<span class="lab">Experience ' + s.xp + '/' + xpNeed(s.level) + '<span class="bar xp"><i style="width:' + pct(s.xp, xpNeed(s.level)) + '%"></i></span></span>';
    if (s.trait) h += '<div><b>' + s.trait + '.</b> ' + TRAITS[s.trait].desc + '</div>';
    if (s.scars.length) h += '<div class="muted">Carries ' + s.scars.join(', ') + '.</div>';
    if (s.promos) h += '<div class="rowline"><b>Promotion earned. Choose one:</b>' +
      '<button class="btn sm go" data-act="promo" data-id="' + s.id + '" data-k="vig">Vigour +8</button>' +
      '<button class="btn sm go" data-act="promo" data-id="' + s.id + '" data-k="skill">' + c.skill + ' +2</button>' +
      '<button class="btn sm go" data-act="promo" data-id="' + s.id + '" data-k="grd">Guard +2</button></div>';
    h += '<div class="rowline"><span class="grow"><b>Arms:</b> ' + WPN[s.cls][s.wpn] + '</span>' + gearHTML(s, 'wpn', WPN[s.cls]) + '</div>' +
      '<div class="rowline"><span class="grow"><b>Armour:</b> ' + ARM[s.arm] + '</span>' + gearHTML(s, 'arm', ARM) + '</div>' +
      '<div class="rowline"><button class="btn sm ghost" data-act="dismiss" data-id="' + s.id + '">Strike from the roll</button></div></div>';
  }
  return h + '</li>';
}
function foesHTML(c) {
  const groups = {};
  c.units.forEach(u => { const k = u.cls + u.tier; (groups[k] = groups[k] || { u, n: 0 }).n++; });
  return '<div class="foes">' + Object.values(groups).map(g => '<span class="foe"><img class="spr" src="' + icon(g.u.cls, c.skin) + '" alt="">' + g.n + ' &times; ' + (c.duel ? 'hired blade, ' + TIER[g.u.tier] : foeName(g.u)) + '</span>').join('') + '</div>';
}
function oddsFor(c) {
  if (!G.odds[c.id]) { const ids = defaultPick(G, c); G.odds[c.id] = ids.length ? stanceOdds(G, c, ids, 8) : { p: 0, best: 'advance', none: true }; }
  return G.odds[c.id];
}
function contractHTML(c) {
  const o = oddsFor(c), k = KIND[c.ai];
  return '<article class="notice' + (c.final ? ' final' : '') + '"><div class="rowline">' +
    '<span class="tag ink">' + (c.duel ? 'Duel' : k.tag) + '</span>' + (c.weather !== 'clear' ? '<span class="tag">' + WEATHER[c.weather] + '</span>' : '') +
    '<span class="tag' + (o.p < 0.42 ? ' red' : '') + '">Scouts: ' + (o.none ? 'no one fit to march' : oddsWord(o.p).toLowerCase()) + '</span>' +
    (c.final ? '' : '<span class="muted">' + (c.ttl > 1 ? 'open ' + c.ttl + ' more days' : 'last day') + '</span>') + '</div>' +
    '<h3>' + esc(c.title) + '</h3><div class="who">Offered by ' + esc(c.who.charAt(0).toLowerCase() + c.who.slice(1)) + '</div><p>' + esc(c.text) + '</p>' + foesHTML(c) +
    '<div class="terms"><span class="pay">' + c.pay + ' thalers</span><span>+' + c.renown + ' renown</span>' + (c.bonus ? '<span>+' + Object.keys(c.bonus).map(x => c.bonus[x] + ' ' + x).join(', ') + '</span>' : '') +
    '<span class="muted">' + (c.cap === 1 ? 'one man' : 'up to ' + c.cap + ' men') + '</span>' +
    '<button class="btn go" data-act="muster" data-id="' + c.id + '"' + (o.none ? ' disabled' : '') + '>Muster for this</button></div></article>';
}
function roadHTML() {
  const q = questOf(G), T = transportOf(G), need = breadDue(G), fed = need ? Math.floor(G.bread / need) : 99, to = PLACES[q.to];
  let h = '<div class="head">' + (atEnd(G) ? 'The end of the road' : 'Roads from ' + esc(here(G).name)) + '<span>' + esc(T.name) + (need ? ' &middot; bread for ' + plural(fed, 'day', 'days') : '') + '</span></div>';
  if (atEnd(G)) {
    return h + '<p class="endroad">' + (q.kind === 'commission' ? 'Hand over the chest for a fee of ' : 'The ' + esc(q.cargo.many) + ' will fetch ') + cargoValue(G) + ' thalers here today' +
      (lateDays(G) ? ', less than they would have in time. <b class="warn">' + plural(lateDays(G), 'day', 'days') + ' late.</b>' : '.') + '</p>' +
      '<button class="btn go big" data-act="deliver">' + (q.kind === 'commission' ? 'Hand over the chest' : 'Sell the ' + esc(q.cargo.many)) + '</button>';
  }
  const roads = roadsFrom(G), togo = daysToGo(G), left = daysLeft(G), nobody = !G.roster.length, off = nobody ? ' disabled' : '';
  if (nobody) h += '<p class="warn endroad">Nobody stands under the banner to drive the train. Hire men at the market before marching.</p>';
  else if (G.thalers < wagesDue(G)) h += '<p class="warn endroad">The pay chest is short: ' + wagesDue(G) + ' thalers fall due on ' + dateText(G.payDue, true) + ' and the company has ' + G.thalers + '. ' +
    (q.kind === 'commission' ? 'Take from the Crown’s chest at a market, or take paid work,' : 'Sell some ' + esc(q.cargo.many) + ' at a market, or take paid work,') + ' or the men go unpaid.</p>';
  h += '<ul>' + roads.map(r => {
    const P2 = PLACES[r.to], rest = daysToGo(G, r.to), shop = (SERVICES[P2.kind] || {}).market || r.to === q.to, md = shop ? r.days : marketDays(G, r);
    return '<li class="offer road"><div class="what"><b>To ' + esc(P2.name) + '</b>' +
      '<div>' + r.km + ' km through ' + esc(LANDS[r.land].name) + ' &middot; ' + DANGER[r.danger] + (shop ? '' : ' &middot; no market there; the next is ' + plural(md, 'day', 'days') + ' on') + '</div>' +
      '<div class="num">In by ' + dateText(G.date + r.days, true) + (r.to === q.to ? '' : rest < Infinity ? ', then ' + plural(rest, 'day', 'days') + ' to ' + esc(to.name) : '') + '</div>' +
      (need && fed < md ? '<div class="warn">Bread for only ' + plural(fed, 'day', 'days') + (shop ? ' of the ' + r.days : ', and the next market is ' + md + ' days on') + '.</div>' : '') + '</div>' +
      '<div class="go2"><button class="btn sm" data-act="march" data-r="' + r.i + '"' + off + '>March &middot; ' + plural(r.days, 'day', 'days') + '</button>' +
      (r.forced < r.days ? '<button class="btn sm ghost" data-act="march" data-r="' + r.i + '" data-f="1"' + off + '>Forced &middot; ' + plural(r.forced, 'day', 'days') + '</button>' : '') + '</div></li>';
  }).join('') + '</ul>';
  h += '<div class="halt"><button class="btn ghost" data-act="halt">Make camp for a day</button><p>' + (nobody ? 'Waiting a day may bring new faces to the market.' :
    'Each man drills, rests or forages, as ordered on the roll. The company eats <b>' + plural(need, 'loaf', 'loaves') + '</b> a day; <b>' + wagesDue(G) + ' thalers</b> of pay fall due on ' + dateText(G.payDue, true) + '.' +
    (G.bread < need ? ' <b class="warn">There is not enough bread.</b>' : '')) + '</p></div>';
  return h + '<p class="muted">By the shortest road ' + esc(to.name) + ' is ' + plural(togo, 'day', 'days') + ' away at a steady pace, and ' +
    (left >= 0 ? esc(q.until) + ' in ' + plural(left, 'day', 'days') : 'the date has passed') + '. A forced march saves days, but costs ' + esc(q.cargo.many) + ' and wears the men down.</p>';
}
function marketHTML() {
  const q = questOf(G), full = G.roster.length >= ROSTER_MAX;
  let h = '';
  if (has(G, 'recruits')) {
    h += '<div class="head">Men for hire<span>' + G.roster.length + ' of ' + ROSTER_MAX + ' on the roll</span></div><ul>';
    h += G.recruits.length ? G.recruits.map((r, i) => {
      const s = r.s, c = CLS[s.cls];
      return '<li class="offer"><img class="spr" src="' + icon(s.cls, 'own') + '" alt=""><div class="what"><b>' + esc(s.name) + '</b><div>' + s.origin + ' ' + c.name.toLowerCase() + ', level ' + s.level + (s.trait ? ' &middot; ' + s.trait.toLowerCase() : '') +
        '</div><div class="num">Vigour ' + s.vig + ' &middot; ' + c.skill + ' ' + (s.cls === 'shot' ? s.aim : s.mel) + ' &middot; Guard ' + s.grd + ' &middot; wage ' + wageOf(s) + ' a month</div></div>' +
        '<button class="btn sm" data-act="hire" data-i="' + i + '"' + (full || G.thalers < r.price ? ' disabled' : '') + '>Hire &middot; ' + r.price + ' th</button></li>';
    }).join('') : '<li class="empty">Nobody is looking for work. New faces turn up every third day.</li>';
    h += '</ul>';
  }
  h += '<div class="head">Supplies</div><ul>' +
    '<li class="offer"><div class="what"><b>Ten loaves of bread</b><div>Each man eats one a day.</div></div><button class="btn sm" data-act="buy" data-k="bread"' + (G.thalers < breadPrice(G) ? ' disabled' : '') + '>Buy &middot; ' + breadPrice(G) + ' th</button></li>' +
    '<li class="offer"><div class="what"><b>Ten charges of powder</b><div>One charge a shot. Without powder a musket is a club.</div></div><button class="btn sm" data-act="buy" data-k="powder"' + (G.thalers < powderPrice(G) ? ' disabled' : '') + '>Buy &middot; ' + powderPrice(G) + ' th</button></li></ul>';
  if (atEnd(G)) return h;
  const p = unitPrice(G), sell = (n, label) => '<button class="btn sm" data-act="sell" data-n="' + n + '"' + (G.cargo < n ? ' disabled' : '') + '>' + label + '</button>';
  h += '<div class="head">' + (q.kind === 'commission' ? 'The Crown’s chest' : 'The cargo') + '<span>' + G.cargo + ' ' + esc(q.cargo.unit) + '</span></div><ul><li class="offer"><div class="what">';
  if (q.kind === 'commission') h += '<b>Take from the chest</b><div>Every thaler taken comes off the fee at ' + esc(PLACES[q.to].name) + ', and the Crown will remember it.</div></div><div class="go2">' + sell(10, 'Take 10 th') + sell(50, 'Take 50 th') + '</div>';
  else h += '<b>Sell ' + esc(q.cargo.many) + ' here</b><div>' + p + ' thalers each here, against ' + q.price + ' at ' + esc(PLACES[q.to].name) + ' in time.</div></div><div class="go2">' + sell(1, 'Sell 1 &middot; ' + p + ' th') + sell(5, 'Sell 5 &middot; ' + 5 * p + ' th') + '</div>';
  return h + '</li></ul>';
}
function deskHTML() {
  const tabs = [];
  if (has(G, 'market')) tabs.push(['market', 'Market']);
  if (has(G, 'staff')) tabs.push(['staff', 'Baggage train']);
  if (has(G, 'work')) tabs.push(['work', 'Work']);
  tabs.push(['log', 'Chronicle']);
  if (!tabs.some(t => t[0] === ui.tab)) ui.tab = tabs[0][0];
  let h = '<div class="tabs" role="tablist">' + tabs.map(t => '<button role="tab" data-act="tab" data-k="' + t[0] + '" aria-selected="' + (ui.tab === t[0]) + '">' + t[1] + '</button>').join('') + '</div><div class="panel" role="tabpanel">';
  if (ui.tab === 'work') h += G.contracts.length ? G.contracts.map(contractHTML).join('') : '<p class="empty">No work posted here today.</p>';
  else if (ui.tab === 'market') h += marketHTML();
  else if (ui.tab === 'staff') {
    h += '<ul>' + Object.keys(STAFF).map(k => {
      const s = STAFF[k];
      return '<li class="offer"><div class="what"><b>' + s.name + '</b><div>' + s.desc + ' Wage ' + s.wage + ' a month.</div></div>' +
        (G.staff[k] ? '<span class="tag ink">In your pay</span>' : '<button class="btn sm" data-act="staff" data-k="' + k + '"' + (G.thalers < s.fee ? ' disabled' : '') + '>Engage &middot; ' + s.fee + ' th</button>') + '</li>';
    }).join('') + '</ul>';
  } else {
    h += '<ol class="log">' + G.log.map(l => '<li><span class="d">' + (l.n != null ? dateText(l.n, true) : 'Day ' + l.d) + '</span><span>' + esc(l.t) + '</span></li>').join('') + '</ol>';
  }
  return h + '</div>';
}
function campHTML() {
  const q = questOf(G);
  let h = '';
  if (ui.news && ui.news.length) {
    const news = [];
    for (const t of ui.news) { const prev = news[news.length - 1]; if (prev && prev.t === t) prev.k++; else news.push({ t, k: 1 }); }
    h += '<ul class="news" aria-label="On the road">' + news.map(n => '<li>' + esc(n.t) + (n.k > 1 ? ' <span class="muted">(' + n.k + ' days)</span>' : '') + '</li>').join('') + '</ul>';
  }
  h += '<div class="journey"><div><div class="plate mapplate"><canvas id="map" role="img" aria-label="' + esc('Map: the company is at ' + here(G).name + ', bound for ' + PLACES[q.to].name) + '"></canvas></div>' +
    '<div class="caption"><span>' + esc(q.title) + ': ' + esc(PLACES[q.from].name) + ' to ' + esc(PLACES[q.to].name) + '. The road so far is in red, the roads open from here in black.</span></div></div>' +
    '<section class="roads">' + roadHTML() + '</section></div>';
  h += '<div class="camp"><section><div class="head">The muster roll<span>' + G.roster.length + ' of ' + ROSTER_MAX + ' men</span></div><ul>' +
    (G.roster.length ? G.roster.map(manHTML).join('') : '<li class="empty">Nobody stands under the banner. Hire men at the market.</li>') + '</ul></section><section>' + deskHTML() + '</section></div>';
  return h;
}
function musterHTML() {
  const c = ui.c, k = KIND[c.ai], o = ui.odds, list = c.duel ? ['advance', 'charge'] : ['hold', 'advance', 'charge'];
  const terms = c.ambush ? '<span>No pay. Beaten, they take ' + plural(raidLoss(G, false), cargoName(G, 1), cargoName(G, 2)) + '; sound the retreat and they take ' + raidLoss(G, true) + '.</span>' :
    '<span class="pay">' + c.pay + ' thalers</span><span>+' + c.renown + ' renown</span>';
  let h = '<div class="muster"><section class="stack"><article class="notice' + (c.final ? ' final' : '') + '"><div class="rowline"><span class="tag ink">' + (c.duel ? 'Duel' : k.tag) + '</span><span class="tag">' + WEATHER[c.weather] + '</span></div>' +
    '<h3>' + esc(c.title) + '</h3><p>' + esc(c.text) + '</p><p><b>' + (c.duel ? 'No powder, no seconds. The loser may yield.' : k.note) + '</b></p>' + foesHTML(c) +
    '<div class="terms">' + terms + '</div></article>' +
    '<div><div class="head">Opening order<span>you can change it during the fight</span></div><div class="stances" style="padding-top:8px">' +
    list.map(s => '<button class="stance" data-act="stance" data-s="' + s + '" aria-pressed="' + (ui.stance === s) + '"><b>' + (c.duel ? (s === 'advance' ? 'Measure him' : 'Rush him') : STANCE[s].name) + '</b><span>' +
      (c.duel ? (s === 'advance' ? 'Close with care and trade cuts.' : 'A heavy first blow, and a poorer guard after it.') : STANCE[s].desc) + '</span>' +
      '<span class="tag' + (o && o[s] < 0.42 ? ' red' : '') + '">' + (o ? oddsWord(o[s]) : 'Scouting…') + '</span></button>').join('') + '</div></div></section>';
  h += '<section class="stack"><div><div class="head">Who fights<span>' + ui.pick.length + ' of ' + Math.min(c.cap, G.roster.length) + ' chosen</span></div><ul>' +
    G.roster.map(s => {
      const on = ui.pick.includes(s.id);
      return '<li><button class="pickrow" data-act="pick" data-id="' + s.id + '" aria-pressed="' + on + '"' + (s.wound ? ' disabled' : '') + '><span class="box" aria-hidden="true">' + (on ? '✓' : '') + '</span>' +
        '<img class="spr" src="' + icon(s.cls, 'own') + '" alt=""><span class="man-id"><span class="man-name">' + esc(s.name) + (s.wound ? ' <span class="tag red">Abed</span>' : '') + '</span>' +
        '<span class="man-sub">' + CLS[s.cls].name + ', level ' + s.level + '</span>' + barsHTML(s) + '</span></button></li>';
    }).join('') + '</ul></div>' +
    '<p class="muted">' + (G.powder < 1 && ui.pick.some(id => man(id) && man(id).cls === 'shot') && !c.duel ? '<b class="warn">You have no powder. Your musketeers will fight with the butt.</b> ' : '') +
    (c.ambush ? 'They are on the train already. There is no going back to camp.' : 'Fighting takes the whole day.') + '</p>' +
    '<div class="rowline">' + (c.ambush ? '' : '<button class="btn ghost" data-act="back">Back to camp</button>') + '<button class="btn go big" data-act="fight"' + (ui.pick.length ? '' : ' disabled') + '>To arms</button></div></section></div>';
  return h;
}
function battleHTML() {
  const c = ui.c;
  return '<section class="stack"><div><div class="plate"><canvas id="field" role="img" aria-label="The fight, drawn as it happens"></canvas><div id="verdict"></div></div>' +
    '<div class="caption"><span>' + esc(c.title) + ', as it befell on ' + dateText(G.date) + '.</span><span id="clock" class="num"></span></div></div>' +
    '<div class="cmd"><div class="seg" role="group" aria-label="Order to the company" id="orders">' +
    (c.duel ? '' : '<button data-act="cmd" data-s="hold">Hold</button>') + '<button data-act="cmd" data-s="advance">' + (c.duel ? 'Measure' : 'Advance') + '</button><button data-act="cmd" data-s="charge">' + (c.duel ? 'Rush' : 'Charge') + '</button></div>' +
    '<button class="btn ghost sm" data-act="retreat" id="retreat">' + (c.duel ? 'Yield' : 'Sound the retreat') + '</button><span class="spacer"></span>' +
    '<div class="seg" role="group" aria-label="Speed" id="speed"><button data-act="speed" data-v="0">Pause</button><button data-act="speed" data-v="1">1&times;</button><button data-act="speed" data-v="2">2&times;</button><button data-act="speed" data-v="4">4&times;</button></div></div>' +
    '<div class="sides"><div><div class="head">Your men<span id="powder"></span></div><div class="chips" id="ours"></div></div><div><div class="head">' + esc(cap1(c.foe)) + '</div><div class="chips" id="theirs"></div></div></div>' +
    '<ol class="blog" id="blog" aria-live="polite"></ol></section>';
}
function paintHud() {
  const b = ui.b; if (!b || ui.screen !== 'battle') return;
  const chip = u => '<span class="chip' + (alive(u) ? '' : ' out') + '">' + (u.side === 0 ? esc(u.name.split(' ')[0]) + ', ' + CLS[u.cls].name.toLowerCase() : cap1(TIER[u.tier]) + ' ' + CLS[u.cls].name.toLowerCase()) +
    (u.routing && alive(u) ? ' (running)' : '') + '<span class="bar' + (u.side ? ' mo' : '') + '"><i style="width:' + pct(u.hp, u.max) + '%"></i></span></span>';
  $('#ours').innerHTML = b.units.filter(u => u.side === 0).map(chip).join('');
  $('#theirs').innerHTML = b.units.filter(u => u.side === 1).map(chip).join('');
  $('#powder').textContent = ui.c.duel ? 'cold steel' : 'powder ' + Math.max(0, b.powder);
  const left = Math.max(0, Math.ceil(TLIMIT - b.t));
  $('#clock').textContent = b.over ? '' : left <= 45 ? 'The light is going: ' + left + ' s' : '';
  document.querySelectorAll('#orders button').forEach(el => { el.setAttribute('aria-pressed', String(b.stance[0] === el.dataset.s)); el.disabled = b.over || b.retreated; });
  document.querySelectorAll('#speed button').forEach(el => el.setAttribute('aria-pressed', String(ui.speed === +el.dataset.v)));
  $('#retreat').disabled = b.over || b.retreated;
  $('#blog').innerHTML = b.log.slice(-4).reverse().map(l => '<li class="' + (l.side === 1 ? 'bad' : '') + '">' + esc(l.s) + '</li>').join('');
}
function verdictWord(won, c, retreated, draw) {
  if (won) return c.duel ? 'Honour satisfied' : c.final ? 'The ford is taken' : c.ambush ? 'They are driven off' : 'The field is yours';
  if (retreated) return c.duel ? 'Yielded' : 'Withdrawn';
  if (draw) return 'Night falls';
  return c.duel ? 'Bested' : c.ambush ? 'The train is plundered' : 'The company is beaten';
}
function showVerdict() {
  const b = ui.b, c = ui.c, won = b.winner === 0 && !b.retreated;
  sting(won);
  $('#verdict').innerHTML = '<div class="verdict' + (won ? '' : ' lost') + '"><h2>' + verdictWord(won, c, b.retreated, b.draw) + '</h2><button class="btn go big" data-act="report">Count the cost</button></div>';
  const btn = $('#verdict button'); if (btn) btn.focus();
}
function reportHTML() {
  const r = ui.rep, FATE = { unhurt: 'Unhurt', wounded: 'Wounded', 'struck down': 'Struck down', killed: 'Killed', fled: 'Ran', yielded: 'Yielded' };
  let h = '<section class="report"><h2 class="bigword' + (r.won ? '' : ' bad') + '">' + verdictWord(r.won, r, r.retreated, r.draw) + '</h2><p class="muted">' + esc(r.title) + ' &middot; ' + r.secs + ' seconds of fighting' + (r.shots ? ', ' + plural(r.shots, 'shot', 'shots') + ' fired' : '') + '</p>' +
    '<div><div class="head">The butcher’s bill</div><ul class="bill">' + r.lines.map(l => {
      const s = man(l.id);
      return '<li><span><b>' + esc(l.name) + '</b><small>' + CLS[l.cls].name + (l.kills ? ' &middot; ' + l.kills + (l.kills > 1 ? ' kills' : ' kill') : '') + (l.scar ? ' &middot; now carries ' + l.scar : '') + (l.fate === 'struck down' && s ? ' &middot; abed ' + s.wound + ' days' : '') + (s && s.promos ? ' &middot; promotion earned' : '') + '</small></span>' +
        '<span class="num muted">' + (l.xp ? '+' + l.xp + ' exp.' : '') + '</span><span class="tag' + (l.fate === 'killed' ? ' red' : l.fate === 'unhurt' ? '' : ' ink') + '">' + FATE[l.fate] + '</span></li>';
    }).join('') + '</ul></div><div class="sum">';
  if (r.won) h += (r.pay ? '<span><b>+' + r.pay + '</b> thalers</span>' : '') + '<span><b>+' + r.renown + '</b> renown</span>' + (r.loot && r.loot.bread ? '<span><b>+' + r.loot.bread + '</b> bread</span>' : '') + (r.loot && r.loot.powder ? '<span><b>+' + r.loot.powder + '</b> powder</span>' : '');
  else if (r.ambush) h += '<span><b>' + r.cargoLost + '</b> ' + esc(cargoName(G, r.cargoLost)) + ' taken</span>';
  else h += '<span>No fee.</span>' + (r.renown ? '<span><b>' + r.renown + '</b> renown</span>' : '');
  return h + '</div><div><button class="btn go big" data-act="camp">' + (G.over ? 'Close the ledger' : r.ambush ? 'On to ' + esc(here(G).name) : 'Back to camp') + '</button></div></section>';
}
function endHTML() {
  const st = G.stats, q = questOf(G), r = G.result, to = PLACES[q.to].name;
  let word = 'The ledger is closed', lede = '';
  if (G.over === 'arrived') {
    const kept = r.cargo / r.cargo0, profit = G.thalers - st.start;
    word = !r.late && kept >= 0.75 ? 'The banner is made' : !r.late ? 'In time, but thinner' : r.late <= 10 ? 'In, but late' : 'Late, and sold cheap';
    lede = q.kind === 'commission' ?
      'The chest comes into ' + to + (r.cargo < r.cargo0 ? ' ' + (r.cargo0 - r.cargo) + ' thalers short' : ' whole') + (r.late ? ', ' + plural(r.late, 'day', 'days') + ' after ' + q.until : ', before ' + q.until) + '. The fee comes to ' + r.pay + ' thalers.' :
      'Of ' + r.cargo0 + ' ' + q.cargo.many + ', ' + r.cargo + ' reach ' + to + (r.late ? ', ' + plural(r.late, 'day', 'days') + ' after ' + q.until : ' before ' + q.until) + ', and fetch ' + r.pay + ' thalers' + (r.late ? '. The middlemen take their share for the delay.' : '.');
    lede += ' The company ends the road with ' + G.thalers + ' thalers, ' + (profit >= 0 ? profit + ' more' : -profit + ' fewer') + ' than it set out with.';
  } else if (G.over === 'dissolved') {
    word = 'The banner is furled';
    lede = 'No men, or no coin to keep them. The pole is sold for firewood at ' + cap1(here(G).name) + ' on ' + dateText(G.date) + '.';
  } else if (G.over === 'victory') {
    word = 'The banner is made';
    lede = 'The Black Regiment breaks at the ford with the whole of the Hetman’s muster looking on. There will be a colonel’s commission, winter quarters, and work for as long as there is war. There is always war.';
  } else if (G.over === 'defeat') {
    word = 'Broken at the ford';
    lede = 'Krafft’s black-coats held. What is left of the company scatters into the hills, and the Hetman’s clerks strike its name from the muster book.';
  }
  const good = G.over === 'arrived' && !r.late && r.cargo / r.cargo0 >= 0.75;
  const lost = [['rain', 'spoiled by rain'], ['forced', 'lost on forced marches'], ['raid', 'taken on the road'], ['pilfered', 'pilfered by your own men']].filter(x => st.lost[x[0]]);
  if (st.sold) lost.push(['sold', q.kind === 'commission' ? 'taken from the chest on the way' : 'sold on the way']);
  const n = k => (k === 'sold' ? st.sold : st.lost[k]);
  return '<section class="report"><h2 class="bigword' + (good ? '' : ' bad') + '">' + word + '</h2><p class="lede">' + esc(lede) + '</p>' +
    '<div class="sum"><span><b>' + (G.date - q.start) + '</b> days on the road</span><span><b>' + st.won + '</b> of ' + st.battles + ' fights won</span><span><b>' + st.kills + '</b> enemies felled</span><span><b>' + st.earned + '</b> thalers earned</span><span><b>' + G.renown + '</b> renown</span></div>' +
    (lost.length ? '<div><div class="head">Where the ' + esc(q.cargo.many) + ' went</div><ul class="bill">' + lost.map(x => '<li><span><b>' + n(x[0]) + '</b> ' + esc(x[1]) + '</span><span></span><span></span></li>').join('') + '</ul></div>' : '') +
    (G.roster.length ? '<div><div class="head">Still under the banner</div><ul class="bill">' + G.roster.map(s => '<li><span><b>' + esc(s.name) + '</b><small>' + s.origin + ' ' + CLS[s.cls].name.toLowerCase() + ', level ' + s.level + '</small></span><span></span><span class="num muted">' + s.kills + ' kills</span></li>').join('') + '</ul></div>' : '') +
    (st.dead.length ? '<div><div class="head">The fallen</div><ul class="bill">' + st.dead.map(d => '<li><span><b>' + esc(d.name) + '</b><small>' + d.origin + ' ' + CLS[d.cls].name.toLowerCase() + ', level ' + d.level + ' &middot; ' + esc(d.where) + '</small></span><span></span><span class="num muted">' + (d.date != null ? dateText(d.date, true) : 'day ' + d.day) + '</span></li>').join('') + '</ul></div>' : '') +
    '<div><button class="btn go big" data-act="title">Raise a new banner</button></div></section>';
}
function questHTML(q) {
  const days = daysToGo({ quest: q.id, at: q.from }), worth = q.kind === 'commission' ? q.fee : q.cargo.n * q.price;
  return '<article class="notice quest"><div class="rowline"><span class="tag ink">' + (q.kind === 'commission' ? 'Commission' : 'Venture') + '</span><span class="tag">' + esc(TRANSPORT[q.transport].name) + '</span>' +
    '<span class="muted">about ' + days + ' days on the road, ' + (q.deadline - q.start) + ' to spare them</span></div>' +
    '<h3>' + esc(q.title) + '</h3><div class="who">' + esc(q.who) + ' &middot; ' + esc(cap1(PLACES[q.from].name)) + ' to ' + esc(PLACES[q.to].name) + '</div><p>' + esc(q.text) + '</p>' +
    '<div class="terms"><span class="pay">' + (q.kind === 'commission' ? worth + ' thalers fee' : worth + ' thalers') + '</span><span>' + (q.kind === 'commission' ? 'for ' + q.cargo.n + ' ' + esc(q.cargo.unit) : q.cargo.n + ' ' + esc(q.cargo.unit) + ' at ' + q.price) + '</span>' +
    '<span class="muted">' + dateText(q.start, true) + ' to ' + dateText(q.deadline, true) + '</span>' +
    '<button class="btn go" data-act="new" data-q="' + q.id + '">Raise the banner</button></div></article>';
}
function titleHTML() {
  const sv = loadSave();
  return '<div class="title-grid"><section><div class="plate"><canvas id="field" role="img" aria-label="A skirmish between two small companies"></canvas></div>' +
    '<div class="caption"><span>A true likeness of how such affairs are settled: pike, shot and sabre.</span></div></section>' +
    '<section class="stack"><p class="lede">The German war is in its fifteenth year, and every prince between the Rhine and the Dnieper is hiring. You have a banner, a handful of men, and a long road to travel.</p>' +
    '<ol class="how"><li><span><b>Take a commission.</b> Carry a cargo across the real lands of 1633 and deliver it by the day it names.</span></li>' +
    '<li><span><b>Choose the road.</b> March steady or forced, make camp to rest and drill, and buy bread before the empty country.</span></li>' +
    '<li><span><b>Keep the roll.</b> Hire pikemen, musketeers and sabreurs, pay them every month, and fight whatever falls on the train.</span></li></ol>' +
    (sv ? '<div class="rowline"><button class="btn go big" data-act="continue">Continue: ' + esc(cap1(PLACES[sv.at].name)) + ', ' + dateText(sv.date, true) + '</button></div>' : '') + '</section></div>' +
    '<section class="stack"><div class="head">Commissions for the year 1633<span>choose one to raise the banner</span></div><div class="quests">' + QUESTS.map(questHTML).join('') + '</div></section>';
}
function modalHTML() {
  const m = ui.modal; if (!m) return '';
  let inner = '';
  if (m.type === 'event') {
    const e = EVENTS.find(x => x.id === G.pending.id);
    inner = '<h2 id="mt">' + esc(e.title) + '</h2><p>' + esc(e.text(G)) + '</p>' + e.choices.map((ch, i) => '<button class="choice" data-act="choice" data-i="' + i + '"><b>' + esc(ch.label) + '</b><span>' + esc(ch.hint) + '</span></button>').join('');
  } else if (m.type === 'result') {
    inner = '<h2 id="mt">' + esc(m.title) + '</h2><p>' + esc(m.text) + '</p><div><button class="btn go" data-act="close">Carry on</button></div>';
  } else if (m.type === 'ambush') {
    const c = G.ambush, o = oddsFor(c), q = questOf(G), lose = raidLoss(G, false), short = G.thalers < c.payoff.coin;
    inner = '<h2 id="mt">' + esc(c.title) + '</h2><p class="muted">' + esc(c.who) + ', short of ' + esc(here(G).name) + '.</p><p>' + esc(c.text) + '</p>' + foesHTML(c) +
      '<p>Scouts: <b>' + (o.none ? 'nobody is fit to fight' : oddsWord(o.p).toLowerCase()) + '</b>.</p>' +
      '<button class="choice" data-act="fightambush"' + (o.none ? ' disabled' : '') + '><b>Stand and fight</b><span>Choose who fights and how they open. Beaten, they take ' + plural(lose, cargoName(G, 1), cargoName(G, 2)) + '.</span></button>' +
      '<button class="choice" data-act="payoff" data-k="cargo"><b>' + (q.kind === 'commission' ? 'Pay them ' + c.payoff.cargo + ' thalers from the Crown’s chest' : 'Give them ' + plural(c.payoff.cargo, cargoName(G, 1), cargoName(G, 2))) + '</b><span>They let the train pass.</span></button>' +
      '<button class="choice" data-act="payoff" data-k="coin"' + (short ? ' disabled' : '') + '><b>Pay them ' + c.payoff.coin + ' thalers of your own</b><span>' + (short ? 'More than the company has.' : 'The cargo stays whole.') + '</span></button>';
  } else {
    inner = '<h2 id="mt">Standing orders</h2><div class="rules">' +
      '<p><b>The road.</b> A commission names a cargo, a destination and a day. Each road takes as many days as the distance really needs at the pace of the cargo. A forced march gets there sooner, but costs cargo and wears the men down. Arriving late is never the end of it, but the price falls every day.</p>' +
      '<p><b>The company.</b> Every man eats a loaf a day, and wages fall due once a month. Unpaid or hungry men lose spirit, and men without spirit desert. Buy bread before empty country: there are no markets in the Wild Fields. Making camp for a day lets each man drill, rest or forage.</p>' +
      '<p><b>Trouble on the road.</b> Raiders fall on the train. Fight them, or pay them off in cargo or coin. Beaten, or sounding the retreat, costs cargo. Towns post paid work; a fight there takes the day.</p>' +
      '<p><b>The three arms.</b> Pikemen hold a line and keep sabres off. Musketeers kill from afar, burn powder, and die quickly in a brawl. Sabreurs are fast and hunt musketeers. Pike beats sabre, sabre beats shot, shot beats pike.</p>' +
      '<p><b>The fight.</b> You give one order to the whole company and may change it at any moment. Keys 1, 2 and 3 give the orders, space pauses. Men whose spirit breaks run. Sounding the retreat saves lives, but costs the fee, or in an ambush, cargo.</p>' +
      '<p><b>Afterwards.</b> A man struck down either dies or lies abed for days. Promotions, better arms and a barber-surgeon keep them alive longer.</p></div>' +
      '<div><button class="btn go" data-act="close">Understood</button></div>';
  }
  return '<div class="veil"><div class="card" role="dialog" aria-modal="true" aria-labelledby="mt">' + inner + '</div></div>';
}
function renderModal() {
  $('#modal').innerHTML = modalHTML();
  const b = $('#modal button:not(:disabled)'); if (b) b.focus();
}
function render() {
  const a = document.activeElement, key = a && a.dataset && a.dataset.act ? '[data-act="' + a.dataset.act + '"]' + ['id', 'k', 'o', 's', 'i', 'v', 'r', 'f', 'n', 'q'].map(k => (a.dataset[k] != null ? '[data-' + k + '="' + a.dataset[k] + '"]' : '')).join('') : null;
  let h = mastHTML();
  if (ui.screen === 'title') h += titleHTML();
  else if (ui.screen === 'camp') h += campHTML();
  else if (ui.screen === 'muster') h += musterHTML();
  else if (ui.screen === 'battle') h += battleHTML();
  else if (ui.screen === 'report') h += reportHTML();
  else h += endHTML();
  h += '<p class="foot">A prototype. A commission takes from a few weeks to a few months of the year 1633 on the road, and from a quarter of an hour to an hour to play. Your place is kept in this browser. Music and sound are made in the browser as you play.</p>';
  $('#view').innerHTML = h;
  ui.view = null;
  if (ui.screen === 'battle') { ui.view = newView($('#field'), ui.c.id * 7919 + G.day * 31, ui.c.weather, true); paintHud(); }
  else if (ui.screen === 'title') { newDemo(); }
  else if (ui.screen === 'camp') drawMap($('#map'), G);
  if (ui.screen === 'camp' || ui.screen === 'end') save();
  renderModal();
  if (AC) setCue(cueForScreen());
  if (key && !ui.modal) { const el = document.querySelector(key); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}
