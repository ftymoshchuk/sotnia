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
const ui = { screen: 'title', tab: 'contracts', open: null, c: null, pick: [], stance: null, odds: null, b: null, speed: 1, rep: null, modal: null, news: null, sound: true, music: true, view: null, demo: null, overT: 0, verdict: false };

/* ---------- saving ---------- */
const SAVE = 'sotnia-save-1';
function save() { try { if (G && !G.over) localStorage.setItem(SAVE, JSON.stringify(G)); else localStorage.removeItem(SAVE); } catch (e) { /* no storage here */ } }
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE) || 'null'); return s && s.v === 1 && !s.over ? s : null; } catch (e) { return null; } }
try { ui.sound = localStorage.getItem('sotnia-sound') !== 'off'; ui.music = localStorage.getItem('sotnia-music') !== 'off'; } catch (e) { /* default on */ }

/* ---------- screens ---------- */
const man = id => G.roster.find(s => s.id === id);
const foeName = u => TIER[u.tier] + ' ' + CLS[u.cls].name.toLowerCase();
function mastHTML() {
  let h = '<header class="mast"><h1>Sotnia</h1><p class="strap">The ledger of a free company &middot; Anno 1633</p><div class="tools">' +
    '<button class="btn ghost sm" data-act="help">Standing orders</button>' +
    '<button class="btn ghost sm" data-act="music">Music ' + (ui.music ? 'on' : 'off') + '</button>' +
    '<button class="btn ghost sm" data-act="sound">Sound ' + (ui.sound ? 'on' : 'off') + '</button></div></header>';
  if (G && ui.screen !== 'title' && ui.screen !== 'end') {
    const ticks = Array.from({ length: DAYS }, (_, i) => '<i class="' + (i + 1 < G.day ? 'done' : i + 1 === G.day ? 'now' : i + 1 === DAYS ? 'end' : '') + '"></i>').join('');
    h += '<section class="ledger" aria-label="The company ledger">' +
      '<div class="days"><span class="k">Day</span><span class="v">' + G.day + '<small>of ' + DAYS + ', then the Black Regiment</small></span><div class="ticks" aria-hidden="true">' + ticks + '</div></div>' +
      '<div><span class="k">Thalers</span><span class="v">' + G.thalers + '<small>&minus;' + wagesDue(G) + ' a night</small></span></div>' +
      '<div><span class="k">Bread</span><span class="v">' + G.bread + '<small>&minus;' + breadDue(G) + ' a night</small></span></div>' +
      '<div><span class="k">Powder</span><span class="v">' + G.powder + '<small>charges</small></span></div>' +
      '<div><span class="k">Renown</span><span class="v">' + G.renown + '</span></div></section>';
  }
  return h;
}
function barsHTML(s) {
  return '<span class="man-bars"><span class="lab">Blood ' + s.hp + '/' + s.vig + '<span class="bar"><i style="width:' + pct(s.hp, s.vig) + '%"></i></span></span>' +
    '<span class="lab">Spirit ' + s.morale + '<span class="bar mo"><i style="width:' + s.morale + '%"></i></span></span></span>';
}
function manHTML(s) {
  const open = ui.open === s.id, c = CLS[s.cls];
  const flags = (s.promos ? '<span class="tag gold">Promotion</span>' : '') + (s.wound ? '<span class="tag red">Abed ' + s.wound + (s.wound > 1 ? ' days' : ' day') + '</span>' : '');
  let h = '<li class="man"><button class="man-head" data-act="open" data-id="' + s.id + '" aria-expanded="' + open + '">' +
    '<img class="spr" src="' + icon(s.cls, 'own') + '" alt="">' +
    '<span class="man-id"><span class="man-name">' + esc(s.name) + ' ' + flags + '</span>' +
    '<span class="man-sub">' + s.origin + ' ' + c.name.toLowerCase() + ', level ' + s.level + (s.trait ? ' &middot; ' + s.trait.toLowerCase() : '') + '</span>' + barsHTML(s) + '</span></button>';
  h += s.wound ? '<span class="tag" style="margin-right:6px">Resting</span>' :
    '<div class="seg" role="group" aria-label="Order for ' + esc(s.name) + '">' + Object.keys(ORDER).map(o => '<button data-act="order" data-id="' + s.id + '" data-o="' + o + '" aria-pressed="' + (s.order === o) + '">' + ORDER[o] + '</button>').join('') + '</div>';
  if (open) {
    const skill = s.cls === 'shot' ? s.aim : s.mel;
    h += '<div class="man-body"><div class="stats"><span><b>Vigour</b>' + s.vig + '</span><span><b>' + c.skill + '</b>' + skill + '</span><span><b>Guard</b>' + s.grd + '</span><span><b>Wage</b>' + wageOf(s) + ' a night</span><span><b>Kills</b>' + s.kills + '</span></div>' +
      '<span class="lab">Experience ' + s.xp + '/' + xpNeed(s.level) + '<span class="bar xp"><i style="width:' + pct(s.xp, xpNeed(s.level)) + '%"></i></span></span>';
    if (s.trait) h += '<div><b>' + s.trait + '.</b> ' + TRAITS[s.trait].desc + '</div>';
    if (s.scars.length) h += '<div class="muted">Carries ' + s.scars.join(', ') + '.</div>';
    if (s.promos) h += '<div class="rowline"><b>Promotion earned. Choose one:</b>' +
      '<button class="btn sm go" data-act="promo" data-id="' + s.id + '" data-k="vig">Vigour +8</button>' +
      '<button class="btn sm go" data-act="promo" data-id="' + s.id + '" data-k="skill">' + c.skill + ' +2</button>' +
      '<button class="btn sm go" data-act="promo" data-id="' + s.id + '" data-k="grd">Guard +2</button></div>';
    h += '<div class="rowline"><span class="grow"><b>Arms:</b> ' + WPN[s.cls][s.wpn] + '</span>' + (s.wpn < 3 ? '<button class="btn sm" data-act="up" data-id="' + s.id + '" data-k="wpn"' + (G.thalers < gearPrice(G, s.wpn) ? ' disabled' : '') + '>' + WPN[s.cls][s.wpn + 1] + ' &middot; ' + gearPrice(G, s.wpn) + ' th</button>' : '<span class="tag">The best there is</span>') + '</div>' +
      '<div class="rowline"><span class="grow"><b>Armour:</b> ' + ARM[s.arm] + '</span>' + (s.arm < 3 ? '<button class="btn sm" data-act="up" data-id="' + s.id + '" data-k="arm"' + (G.thalers < gearPrice(G, s.arm) ? ' disabled' : '') + '>' + ARM[s.arm + 1] + ' &middot; ' + gearPrice(G, s.arm) + ' th</button>' : '<span class="tag">The best there is</span>') + '</div>' +
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
function deskHTML() {
  const tabs = [['contracts', 'Contracts'], ['market', 'Market'], ['staff', 'Baggage train'], ['log', 'Chronicle']];
  let h = '<div class="tabs" role="tablist">' + tabs.map(t => '<button role="tab" data-act="tab" data-k="' + t[0] + '" aria-selected="' + (ui.tab === t[0]) + '">' + t[1] + '</button>').join('') + '</div><div class="panel" role="tabpanel">';
  if (ui.tab === 'contracts') {
    h += G.contracts.length ? G.contracts.map(contractHTML).join('') : '<p class="empty">No work posted today.</p>';
  } else if (ui.tab === 'market') {
    const full = G.roster.length >= ROSTER_MAX;
    h += '<div class="head">Men for hire<span>' + G.roster.length + ' of ' + ROSTER_MAX + ' on the roll</span></div><ul>';
    h += G.recruits.length ? G.recruits.map((r, i) => {
      const s = r.s, c = CLS[s.cls];
      return '<li class="offer"><img class="spr" src="' + icon(s.cls, 'own') + '" alt=""><div class="what"><b>' + esc(s.name) + '</b><div>' + s.origin + ' ' + c.name.toLowerCase() + ', level ' + s.level + (s.trait ? ' &middot; ' + s.trait.toLowerCase() : '') +
        '</div><div class="num">Vigour ' + s.vig + ' &middot; ' + c.skill + ' ' + (s.cls === 'shot' ? s.aim : s.mel) + ' &middot; Guard ' + s.grd + ' &middot; wage ' + wageOf(s) + '</div></div>' +
        '<button class="btn sm" data-act="hire" data-i="' + i + '"' + (full || G.thalers < r.price ? ' disabled' : '') + '>Hire &middot; ' + r.price + ' th</button></li>';
    }).join('') : '<li class="empty">Nobody is looking for work. New faces arrive every third day.</li>';
    h += '</ul><div class="head">Supplies</div><ul>' +
      '<li class="offer"><div class="what"><b>Ten loaves of bread</b><div>Each man eats one a night.</div></div><button class="btn sm" data-act="buy" data-k="bread"' + (G.thalers < breadPrice(G) ? ' disabled' : '') + '>Buy &middot; ' + breadPrice(G) + ' th</button></li>' +
      '<li class="offer"><div class="what"><b>Ten charges of powder</b><div>One charge a shot. Without powder a musket is a club.</div></div><button class="btn sm" data-act="buy" data-k="powder"' + (G.thalers < powderPrice(G) ? ' disabled' : '') + '>Buy &middot; ' + powderPrice(G) + ' th</button></li></ul>';
  } else if (ui.tab === 'staff') {
    h += '<ul>' + Object.keys(STAFF).map(k => {
      const s = STAFF[k];
      return '<li class="offer"><div class="what"><b>' + s.name + '</b><div>' + s.desc + ' Wage ' + s.wage + ' a night.</div></div>' +
        (G.staff[k] ? '<span class="tag ink">In your pay</span>' : '<button class="btn sm" data-act="staff" data-k="' + k + '"' + (G.thalers < s.fee ? ' disabled' : '') + '>Engage &middot; ' + s.fee + ' th</button>') + '</li>';
    }).join('') + '</ul>';
  } else {
    h += '<ol class="log">' + G.log.map(l => '<li><span class="d">Day ' + l.d + '</span><span>' + esc(l.t) + '</span></li>').join('') + '</ol>';
  }
  return h + '</div>';
}
function campHTML() {
  const last = G.day >= DAYS, w = wagesDue(G), short = G.thalers < w, hungry = G.bread < breadDue(G);
  let h = '';
  if (ui.news && ui.news.length) h += '<ul class="news" aria-label="Since yesterday">' + ui.news.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>';
  h += '<div class="camp"><section><div class="head">The muster roll<span>' + G.roster.length + ' of ' + ROSTER_MAX + ' men</span></div><ul>' +
    (G.roster.length ? G.roster.map(manHTML).join('') : '<li class="empty">Nobody stands under the banner. Hire men at the market.</li>') + '</ul></section><section>' + deskHTML() + '</section></div>';
  h += '<div class="daybar">';
  if (last) h += '<p><b>The Hetman’s muster is today.</b> There is no tomorrow to wait for. Arm the men and march on the ford.</p><button class="btn ghost" data-act="disband">Furl the banner</button>';
  else h += '<p>Tonight the men draw <b>' + w + ' thalers</b> and eat <b>' + breadDue(G) + ' loaves</b>.' +
    (short ? ' <b style="color:var(--madder)">The chest cannot cover it. Unpaid men lose heart.</b>' : '') + (hungry ? ' <b style="color:var(--madder)">There is not enough bread.</b>' : '') +
    ' Taking a contract also uses up the day.</p><button class="btn go big" data-act="endday">End the day</button>';
  return h + '</div>';
}
function musterHTML() {
  const c = ui.c, k = KIND[c.ai], o = ui.odds, list = c.duel ? ['advance', 'charge'] : ['hold', 'advance', 'charge'];
  let h = '<div class="muster"><section class="stack"><article class="notice' + (c.final ? ' final' : '') + '"><div class="rowline"><span class="tag ink">' + (c.duel ? 'Duel' : k.tag) + '</span><span class="tag">' + WEATHER[c.weather] + '</span></div>' +
    '<h3>' + esc(c.title) + '</h3><p>' + esc(c.text) + '</p><p><b>' + (c.duel ? 'No powder, no seconds. The loser may yield.' : k.note) + '</b></p>' + foesHTML(c) +
    '<div class="terms"><span class="pay">' + c.pay + ' thalers</span><span>+' + c.renown + ' renown</span></div></article>' +
    '<div><div class="head">Opening order<span>you can change it during the fight</span></div><div class="stances" style="padding-top:8px">' +
    list.map(s => '<button class="stance" data-act="stance" data-s="' + s + '" aria-pressed="' + (ui.stance === s) + '"><b>' + (c.duel ? (s === 'advance' ? 'Measure him' : 'Rush him') : STANCE[s].name) + '</b><span>' +
      (c.duel ? (s === 'advance' ? 'Close with care and trade cuts.' : 'A heavy first blow, and a poorer guard after it.') : STANCE[s].desc) + '</span>' +
      '<span class="tag' + (o && o[s] < 0.42 ? ' red' : '') + '">' + (o ? oddsWord(o[s]) : 'Scouting…') + '</span></button>').join('') + '</div></div></section>';
  h += '<section class="stack"><div><div class="head">Who marches<span>' + ui.pick.length + ' of ' + c.cap + ' chosen</span></div><ul>' +
    G.roster.map(s => {
      const on = ui.pick.includes(s.id);
      return '<li><button class="pickrow" data-act="pick" data-id="' + s.id + '" aria-pressed="' + on + '"' + (s.wound ? ' disabled' : '') + '><span class="box" aria-hidden="true">' + (on ? '✓' : '') + '</span>' +
        '<img class="spr" src="' + icon(s.cls, 'own') + '" alt=""><span class="man-id"><span class="man-name">' + esc(s.name) + (s.wound ? ' <span class="tag red">Abed</span>' : '') + '</span>' +
        '<span class="man-sub">' + CLS[s.cls].name + ', level ' + s.level + '</span>' + barsHTML(s) + '</span></button></li>';
    }).join('') + '</ul></div>' +
    '<p class="muted">' + (G.powder < 1 && ui.pick.some(id => man(id) && man(id).cls === 'shot') && !c.duel ? '<b style="color:var(--madder)">You have no powder. Your musketeers will fight with the butt.</b> ' : '') + 'Marching and fighting takes the whole day.</p>' +
    '<div class="rowline"><button class="btn ghost" data-act="back">Back to camp</button><button class="btn go big" data-act="fight"' + (ui.pick.length ? '' : ' disabled') + '>To arms</button></div></section></div>';
  return h;
}
function battleHTML() {
  const c = ui.c;
  return '<section class="stack"><div><div class="plate"><canvas id="field" role="img" aria-label="The fight, drawn as it happens"></canvas><div id="verdict"></div></div>' +
    '<div class="caption"><span>' + esc(c.title) + ', as it befell on the ' + G.day + ordinal(G.day) + ' day.</span><span id="clock" class="num"></span></div></div>' +
    '<div class="cmd"><div class="seg" role="group" aria-label="Order to the company" id="orders">' +
    (c.duel ? '' : '<button data-act="cmd" data-s="hold">Hold</button>') + '<button data-act="cmd" data-s="advance">' + (c.duel ? 'Measure' : 'Advance') + '</button><button data-act="cmd" data-s="charge">' + (c.duel ? 'Rush' : 'Charge') + '</button></div>' +
    '<button class="btn ghost sm" data-act="retreat" id="retreat">' + (c.duel ? 'Yield' : 'Sound the retreat') + '</button><span class="spacer"></span>' +
    '<div class="seg" role="group" aria-label="Speed" id="speed"><button data-act="speed" data-v="0">Pause</button><button data-act="speed" data-v="1">1&times;</button><button data-act="speed" data-v="2">2&times;</button><button data-act="speed" data-v="4">4&times;</button></div></div>' +
    '<div class="sides"><div><div class="head">Your men<span id="powder"></span></div><div class="chips" id="ours"></div></div><div><div class="head">' + esc(cap1(c.foe)) + '</div><div class="chips" id="theirs"></div></div></div>' +
    '<ol class="blog" id="blog" aria-live="polite"></ol></section>';
}
const ordinal = n => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
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
function showVerdict() {
  const b = ui.b, c = ui.c, won = b.winner === 0 && !b.retreated;
  const word = won ? (c.duel ? 'Honour satisfied' : c.final ? 'The ford is taken' : 'The field is yours') : b.retreated ? (c.duel ? 'Yielded' : 'Withdrawn') : b.draw ? 'Night falls' : c.duel ? 'Bested' : 'The company is beaten';
  sting(won);
  $('#verdict').innerHTML = '<div class="verdict' + (won ? '' : ' lost') + '"><h2>' + word + '</h2><button class="btn go big" data-act="report">Count the cost</button></div>';
  const btn = $('#verdict button'); if (btn) btn.focus();
}
function reportHTML() {
  const r = ui.rep, FATE = { unhurt: 'Unhurt', wounded: 'Wounded', 'struck down': 'Struck down', killed: 'Killed', fled: 'Ran', yielded: 'Yielded' };
  const word = r.won ? (r.duel ? 'Honour satisfied' : r.final ? 'The ford is taken' : 'The field is yours') : r.retreated ? 'Withdrawn' : r.draw ? 'Night falls, nothing won' : 'Beaten';
  let h = '<section class="report"><h2 class="bigword' + (r.won ? '' : ' bad') + '">' + word + '</h2><p class="muted">' + esc(r.title) + ' &middot; ' + r.secs + ' seconds of fighting' + (r.shots ? ', ' + r.shots + ' shots fired' : '') + '</p>' +
    '<div><div class="head">The butcher’s bill</div><ul class="bill">' + r.lines.map(l => {
      const s = man(l.id);
      return '<li><span><b>' + esc(l.name) + '</b><small>' + CLS[l.cls].name + (l.kills ? ' &middot; ' + l.kills + (l.kills > 1 ? ' kills' : ' kill') : '') + (l.scar ? ' &middot; now carries ' + l.scar : '') + (l.fate === 'struck down' && s ? ' &middot; abed ' + s.wound + ' days' : '') + (s && s.promos ? ' &middot; promotion earned' : '') + '</small></span>' +
        '<span class="num muted">' + (l.xp ? '+' + l.xp + ' exp.' : '') + '</span><span class="tag' + (l.fate === 'killed' ? ' red' : l.fate === 'unhurt' ? '' : ' ink') + '">' + FATE[l.fate] + '</span></li>';
    }).join('') + '</ul></div><div class="sum">';
  if (r.won) h += '<span><b>+' + r.pay + '</b> thalers</span><span><b>+' + r.renown + '</b> renown</span>' + (r.loot && r.loot.bread ? '<span><b>+' + r.loot.bread + '</b> bread</span>' : '') + (r.loot && r.loot.powder ? '<span><b>+' + r.loot.powder + '</b> powder</span>' : '');
  else h += '<span>No fee.</span>' + (r.renown ? '<span><b>' + r.renown + '</b> renown</span>' : '');
  return h + '</div><div><button class="btn go big" data-act="camp">' + (G.over ? 'Close the ledger' : 'Back to camp') + '</button></div></section>';
}
function endHTML() {
  const T = {
    victory: ['The banner is made', 'The Black Regiment breaks at the ford with the whole of the Hetman’s muster looking on. There will be a colonel’s commission, winter quarters, and work for as long as there is war. There is always war.'],
    defeat: ['Broken at the ford', 'Krafft’s black-coats held. What is left of the company scatters into the hills, and the Hetman’s clerks strike its name from the muster book.'],
    dissolved: ['The banner is furled', 'No men, or no coin to keep them. The pole is sold for firewood on day ' + G.day + '.']
  }[G.over] || ['The ledger is closed', ''];
  const st = G.stats;
  return '<section class="report"><h2 class="bigword' + (G.over === 'victory' ? '' : ' bad') + '">' + T[0] + '</h2><p class="lede">' + T[1] + '</p>' +
    '<div class="sum"><span><b>' + G.day + '</b> days</span><span><b>' + st.won + '</b> of ' + st.battles + ' fights won</span><span><b>' + st.kills + '</b> enemies felled</span><span><b>' + st.earned + '</b> thalers earned</span><span><b>' + G.renown + '</b> renown</span></div>' +
    (G.roster.length ? '<div><div class="head">Still under the banner</div><ul class="bill">' + G.roster.map(s => '<li><span><b>' + esc(s.name) + '</b><small>' + s.origin + ' ' + CLS[s.cls].name.toLowerCase() + ', level ' + s.level + '</small></span><span></span><span class="num muted">' + s.kills + ' kills</span></li>').join('') + '</ul></div>' : '') +
    (st.dead.length ? '<div><div class="head">The fallen</div><ul class="bill">' + st.dead.map(d => '<li><span><b>' + esc(d.name) + '</b><small>' + d.origin + ' ' + CLS[d.cls].name.toLowerCase() + ', level ' + d.level + ' &middot; ' + esc(d.where) + '</small></span><span></span><span class="num muted">day ' + d.day + '</span></li>').join('') + '</ul></div>' : '') +
    '<div><button class="btn go big" data-act="new">Raise a new banner</button></div></section>';
}
function titleHTML() {
  const sv = loadSave();
  return '<div class="title-grid"><section><div class="plate"><canvas id="field" role="img" aria-label="A skirmish between two small companies"></canvas></div>' +
    '<div class="caption"><span>A true likeness of how such affairs are settled: pike, shot and sabre.</span></div></section>' +
    '<section class="stack"><p class="lede">The German war is in its fifteenth year, and every prince between the Rhine and the Dnieper is hiring. You have a banner, three men, and twenty-four days.</p>' +
    '<ol class="how"><li><span><b>Keep the roll.</b> Hire pikemen, musketeers and sabreurs. Drill them, arm them, feed them, pay them.</span></li>' +
    '<li><span><b>Take contracts.</b> Choose who marches and how they open: hold, advance or charge. Then watch, and change the order when it goes wrong.</span></li>' +
    '<li><span><b>Break the Black Regiment.</b> On day 24 it holds the ford in front of the Hetman’s whole muster.</span></li></ol>' +
    '<div class="rowline"><button class="btn go big" data-act="new">Raise the banner</button>' + (sv ? '<button class="btn ghost big" data-act="continue">Continue, day ' + sv.day + '</button>' : '') + '</div></section></div>';
}
function modalHTML() {
  const m = ui.modal; if (!m) return '';
  let inner = '';
  if (m.type === 'event') {
    const e = EVENTS.find(x => x.id === G.pending.id);
    inner = '<h2 id="mt">' + esc(e.title) + '</h2><p>' + esc(e.text(G)) + '</p>' + e.choices.map((ch, i) => '<button class="choice" data-act="choice" data-i="' + i + '"><b>' + esc(ch.label) + '</b><span>' + esc(ch.hint) + '</span></button>').join('');
  } else if (m.type === 'result') {
    inner = '<h2 id="mt">' + esc(m.title) + '</h2><p>' + esc(m.text) + '</p><div><button class="btn go" data-act="close">Carry on</button></div>';
  } else {
    inner = '<h2 id="mt">Standing orders</h2><div class="rules">' +
      '<p><b>The three arms.</b> Pikemen hold a line and keep sabres off. Musketeers kill from afar, burn powder, and die quickly in a brawl. Sabreurs are fast and hunt musketeers. Pike beats sabre, sabre beats shot, shot beats pike.</p>' +
      '<p><b>The day.</b> Each man drills for experience, rests to heal, or forages for bread. Every night you pay wages and eat. Unpaid or hungry men lose spirit, and men without spirit desert.</p>' +
      '<p><b>Contracts.</b> A fight takes the whole day. An ambush comes at you, so hold. Dug-in men will not come out, so advance or charge. Scouts give odds for each opening order.</p>' +
      '<p><b>The fight.</b> You give one order to the whole company and may change it at any moment. Keys 1, 2 and 3 give the orders, space pauses. Men whose spirit breaks run. Sounding the retreat saves lives and costs the fee.</p>' +
      '<p><b>Afterwards.</b> A man struck down either dies or lies abed for days. Promotions, better arms and a barber-surgeon keep them alive longer.</p></div>' +
      '<div><button class="btn go" data-act="close">Understood</button></div>';
  }
  return '<div class="veil"><div class="card" role="dialog" aria-modal="true" aria-labelledby="mt">' + inner + '</div></div>';
}
function renderModal() {
  $('#modal').innerHTML = modalHTML();
  const b = $('#modal button'); if (b) b.focus();
}
function render() {
  const a = document.activeElement, key = a && a.dataset && a.dataset.act ? '[data-act="' + a.dataset.act + '"]' + ['id', 'k', 'o', 's', 'i', 'v'].map(k => (a.dataset[k] != null ? '[data-' + k + '="' + a.dataset[k] + '"]' : '')).join('') : null;
  let h = mastHTML();
  if (ui.screen === 'title') h += titleHTML();
  else if (ui.screen === 'camp') h += campHTML();
  else if (ui.screen === 'muster') h += musterHTML();
  else if (ui.screen === 'battle') h += battleHTML();
  else if (ui.screen === 'report') h += reportHTML();
  else h += endHTML();
  h += '<p class="foot">A prototype. One campaign runs twenty-four days, about a quarter of an hour. Your place is kept in this browser. Music and sound are made in the browser as you play.</p>';
  $('#view').innerHTML = h;
  ui.view = null;
  if (ui.screen === 'battle') { ui.view = newView($('#field'), ui.c.id * 7919 + G.day * 31, ui.c.weather, true); paintHud(); }
  else if (ui.screen === 'title') { newDemo(); }
  if (ui.screen === 'camp' || ui.screen === 'end') save();
  renderModal();
  if (AC) setCue(cueForScreen());
  if (key && !ui.modal) { const el = document.querySelector(key); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}
