"use strict";
/* ===== SOTNIA interface: actions, input, the frame loop and boot. Loaded last. ===== */
/* ---------- actions ---------- */
let oddsTimer = 0, acc = 0, hudT = 0, last = 0, demoWait = 0, kittedAt = -9999;
function queueOdds() {
  ui.odds = null; clearTimeout(oddsTimer);
  oddsTimer = setTimeout(() => {
    if (ui.screen !== 'muster') return;
    ui.odds = ui.pick.length ? stanceOdds(G!, ui.c!, ui.pick, 14) : null;
    if (!ui.stance && ui.odds) ui.stance = ui.odds.best;
    render();
  }, 30);
}
function newDemo() {
  const mix = () => (['pike', 'shot', 'sabre', 'pike', 'shot'] as TroopClass[]).map(c => enemyUnit(c, 1, pick(['swede', 'imperial', 'muscovite', 'tatar', 'croat', 'bandit'])));
  const skin: Skin = pick(['swede', 'imperial', 'muscovite', 'tatar', 'croat', 'bandit']);
  const ours = (['pike', 'shot', 'sabre', 'pike', 'shot'] as TroopClass[]).map((c, i) => { const u = enemyUnit(c, 1, 'own') as Foe & { id: number }; u.id = i; u.name = ''; u.morale = 60; u.wpn = ri(0, 3); u.arm = ri(0, 3); u.origin = pick(ORIGINS.filter(o => o.cls.includes(c))).label; return u; });
  const weather: Weather = pick(['clear', 'clear', 'rain', 'fog']);
  ui.demo = makeBattle(ours, mix().map(u => { u.skin = skin; u.morale = 60; u.wpn = ri(0, 2); u.arm = ri(0, 2); return u; }), { stance: 'advance', ai: 'advance', weather, powder: 99, vis: true });
  ui.view = newView($<HTMLCanvasElement>('#field')!, (Math.random() * 1e6) | 0, weather, false, { land: pick(Object.keys(LANDS) as LandId[]) });
  demoWait = 0;
  drawField(ui.view, ui.demo, 0);
}
// Back to camp, unless nobody is left under the banner.
function toCamp() {
  ui.screen = 'camp'; ui.open = null;
  if (stranded(G!)) { G!.over = 'dissolved'; ui.screen = 'end'; ui.modal = null; return false; }
  return true;
}
// After a march or a day in camp: show the news, then any ambush or camp event.
function dayDone(r: DayNews) {
  ui.news = r.lines;
  if (!toCamp()) return;
  if (r.ambush) ui.modal = { type: 'ambush' };
  else if (r.event) ui.modal = { type: 'event' };
}
/** A day is done: its news, and what it changed in the ledger (see Ledger), which the bar shows once. */
function finishDay(r: DayNews, before: Ledger) {
  dayDone(r);
  const now = ledgerOf(G!), d: Partial<Ledger> = {};
  for (const k of Object.keys(now) as (keyof Ledger)[]) if (now[k] !== before[k]) d[k] = now[k] - before[k];
  ui.deltas = Object.keys(d).length ? d : null;
}
/**
 * Lets a day, or a march of days, go by. The rules are played out at once; the camp then shows the time passing (the sun going over, the foragers
 * out and in, or the company leaving one camp and coming to another) before the news is put to the player. Any key or click skips it. go does the
 * day's work and returns its news, or null if there was nothing to do.
 */
function startPass(kind: 'rest' | 'march', go: () => DayNews | null) {
  if (ui.pass || !G) return;
  const ledger = ledgerOf(G), day0 = G.day, oldBack = ui.camp ? ui.camp.back : null;
  const r = go(); if (!r) return;
  const days = G.day - day0;
  if (calm || !ui.camp || ui.screen !== 'camp' || days < 1) { finishDay(r, ledger); render(); ui.deltas = null; return; }
  ui.pass = { kind, days, t: 0, dur: kind === 'rest' ? 2.4 : clamp(1.6 + 0.5 * days, 2.2, 3.6), res: r, ledger, oldBack, swapped: false };
  ui.open = null; ui.deltas = null;
  document.querySelectorAll('.pop, .dawn').forEach(el => el.remove());
  document.body.classList.add('passing');
  const veil = document.createElement('div'); veil.className = 'passveil'; veil.dataset.act = 'passSkip';
  veil.innerHTML = '<span class="passtag">' + ic(kind === 'rest' ? 'moon' : 'boot') + (kind === 'rest' ? 'A day passes' : days > 1 ? days + ' days on the road' : 'On the road') + '<small>click to skip</small></span>';
  document.body.appendChild(veil);
}
function endPass() {
  const P = ui.pass; if (!P) return;
  ui.pass = null; document.querySelectorAll('.passveil').forEach(el => el.remove()); document.body.classList.remove('passing');
  finishDay(P.res, P.ledger); render(); ui.deltas = null;
}
function setStance(s: Stance) {
  const b = ui.b; if (!b || b.over || b.retreated) return;
  b.stance[0] = s;
  if (s === 'hold') for (const u of b.units) if (u.side === 0) { u.hx = u.x; u.hy = u.y; }
  paintHud();
}
/** Keeps the address in step with the encyclopedia (#encyclopedia-units), so that a page of it can be linked to; where the page may not touch its address, nothing happens. */
function codexAddress(open: boolean) {
  try { history.replaceState(null, '', open ? '#encyclopedia-' + ui.codex : location.pathname + location.search); } catch (e) { /* no address to keep */ }
}
/** The data- attributes of the element that was clicked, which hold what its action needs (the HTML that sets them is in screens.ts). */
type ActData = Record<string, string>;
function act(a: string, d: ActData) {
  wake();
  if (ui.pass && a !== 'passSkip') return; // a day going by takes no orders
  switch (a) {
    case 'passSkip': endPass(); return;
    // the banner is raised in two steps: the commission, then the captain (a link to the new game may leave the second out, and gets one at random)
    case 'captains': if (!QUESTS.some(q => q.id === d.q)) return; ui.captains = { q: d.q, list: genCaptains() }; ui.screen = 'captain'; ui.modal = null; break;
    case 'new': {
      const cs = ui.captains, c = cs && cs.q === d.q ? cs.list[+d.c] : undefined;
      G = newGame(d.q, c); ui.captains = null; ui.screen = 'camp'; ui.panel = null; ui.post = 'captain'; ui.course = null; ui.open = null; ui.news = null; ui.modal = null; ui.campPos = {}; break;
    }
    case 'title': ui.screen = 'title'; ui.captains = null; ui.modal = null; break;
    case 'continue': {
      const s = loadSave(); if (!s) break;
      G = s; ui.screen = 'camp'; ui.panel = null; ui.post = 'captain'; ui.course = null; ui.news = null; ui.open = null; ui.campPos = {};
      ui.modal = G.ambush ? { type: 'ambush' } : G.pending && G.pending.id ? { type: 'event' } : null;
      break;
    }
    case 'panel': {
      if (!panelsHere().includes(d.k as TabId)) return;
      ui.panel = d.k as TabId; if (d.post) ui.post = d.post as CommandView; break;
    }
    case 'panelClose': { const k = ui.panel; ui.panel = null; render(); if (k) { const b = $('.menu [data-act="panel"][data-k="' + k + '"]'); if (b) b.focus(); } return; }
    case 'card': ui.open = +d.id; ui.panel = 'roll'; ui.scrollCard = +d.id; break;
    case 'newsClose': ui.news = null; break;
    case 'codex': if (ui.modal || ui.screen === 'battle' || ui.screen === 'codex') return; ui.codexFrom = ui.screen; ui.screen = 'codex'; codexAddress(true); break;
    case 'codexTab': ui.codex = d.k as CodexTab; codexAddress(true); break;
    // back to where it was opened from, which is the title if that is gone (the camp has no campaign to show)
    case 'codexBack': ui.screen = ui.codexFrom === 'camp' && !G ? 'title' : ui.codexFrom; codexAddress(false); break;
    case 'sel': ui.open = ui.open === +d.id ? null : +d.id; break;
    case 'order': { const s = man(+d.id); if (s) s.order = d.o as CampOrder; break; }
    case 'promo': promote(G!, +d.id, d.k as Promo); G!.odds = {}; break;
    case 'up': if (has(G!, 'market') && upgrade(G!, +d.id, d.k as GearSlot)) { ui.fresh = { id: +d.id, k: d.k as GearSlot }; kittedAt = performance.now(); sfx('clang'); } break;
    case 'dismiss': dismiss(G!, +d.id); ui.open = null; break;
    case 'hire': if (has(G!, 'recruits')) hire(G!, +d.i); break;
    case 'buy': if (has(G!, 'market')) buy(G!, d.k as Supply); break;
    case 'post': ui.post = d.k as CommandView; break;
    case 'engage': if (has(G!, 'staff') && hireOfficer(G!, d.k as StaffId, +d.i)) { ui.post = d.k as StaffId; sfx('clang'); } break;
    case 'letgo': dismissOfficer(G!, d.k as StaffId); break;
    case 'letgoR': dismissRetainer(G!); break;
    case 'sell': sellCargo(G!, +d.n); break;
    case 'march': startPass('march', () => march(G!, +d.r, d.f === '1')); return;
    case 'halt': startPass('rest', () => campDay(G!)); return;
    case 'course-pick': if (!routeTo(G!, d.v as PlaceId)) return; ui.course = d.v as PlaceId; break;
    case 'course': { const to = ui.course; if (!to) return; startPass('march', () => { const r = followCourse(G!, to, d.f === '1'); return !r.legs && !r.lines.length ? null : r; }); return; }
    case 'deliver': if (!deliver(G!)) return; ui.screen = 'end'; ui.modal = null; break;
    case 'payoff': if (!payOff(G!, d.k as 'coin' | 'cargo')) return; ui.modal = null; break;
    case 'fightambush': {
      const c = G!.ambush; if (!c) return;
      ui.c = c; ui.pick = defaultPick(G!, c); ui.stance = null; ui.modal = null; ui.panel = null; ui.screen = 'muster'; queueOdds(); break;
    }
    case 'muster': { const c = G!.contracts.find(x => x.id === +d.id); if (!c) return; ui.c = c; ui.pick = defaultPick(G!, c); ui.stance = null; ui.screen = 'muster'; queueOdds(); break; }
    case 'pick': {
      const id = +d.id, i = ui.pick.indexOf(id);
      if (i >= 0) ui.pick.splice(i, 1); else if (ui.c!.cap === 1) ui.pick = [id]; else if (ui.pick.length < ui.c!.cap) ui.pick.push(id); else return;
      queueOdds(); break;
    }
    case 'stance': ui.stance = d.s as Stance; break;
    case 'back': if (ui.c && ui.c.ambush) return; ui.screen = 'camp'; break;
    case 'fight': {
      if (!ui.pick.length) return;
      ui.b = battleFor(G!, ui.c!, ui.pick, ui.stance || (ui.odds ? ui.odds.best : 'advance'), true);
      ui.speed = 1; ui.overT = 0; ui.verdict = false; acc = 0; ui.panel = null; ui.screen = 'battle'; sfx('drum'); break;
    }
    case 'cmd': setStance(d.s as Stance); return;
    case 'captain': if (ui.b && giveOrder(ui.b)) { sfx('call'); paintHud(); } return;
    case 'retreat': if (ui.b) { orderRetreat(ui.b); paintHud(); } return;
    case 'speed': ui.speed = +d.v; paintHud(); return;
    case 'report': if (!ui.b || !ui.b.over) return; ui.rep = resolveBattle(G!, ui.c!, ui.b); ui.b = null; ui.screen = 'report'; break;
    // After an ambush the company goes on to where it was bound; paid work took the day.
    case 'camp': if (G!.over) ui.screen = 'end'; else if (ui.rep && ui.rep.ambush) toCamp(); else { const before = ledgerOf(G!); finishDay(campDay(G!), before); } break;
    case 'choice': { const e = eventOf(G!.pending && G!.pending.id); const res = applyEvent(G!, +d.i); ui.modal = { type: 'result', title: e ? e.title : '', text: res }; break; }
    case 'close': { const was = ui.modal; ui.modal = null; if (was && was.type === 'help') { ui.modal = was.prev || null; renderModal(); return; } break; }
    case 'help': if (ui.modal && ui.modal.type === 'help') return; ui.modal = { type: 'help', prev: ui.modal }; renderModal(); return;
    case 'sound': {
      ui.sound = !ui.sound; try { localStorage.setItem('sotnia-sound', ui.sound ? 'on' : 'off'); } catch (e) { /* fine */ }
      document.querySelectorAll('[data-act="sound"]').forEach(el => { el.setAttribute('aria-pressed', String(ui.sound)); el.classList.toggle('off', !ui.sound); });
      if (ui.sound) wake(); return;
    }
    case 'music': {
      ui.music = !ui.music; try { localStorage.setItem('sotnia-music', ui.music ? 'on' : 'off'); } catch (e) { /* fine */ }
      document.querySelectorAll('[data-act="music"]').forEach(el => { el.setAttribute('aria-pressed', String(ui.music)); el.classList.toggle('off', !ui.music); });
      if (ui.music) { wake(); setCue(cueForScreen()); } else setCue(null);
      return;
    }
    default: return;
  }
  render();
  ui.fresh = null; ui.deltas = null;
  if (a.slice(0, 5) === 'codex') window.scrollTo(0, 0);
}
document.addEventListener('click', e => {
  // a click on the dimmed ground round a page of the business puts it away
  if ((e.target as HTMLElement).classList.contains('pveil')) { act('panelClose', {}); return; }
  // and a click on the bare scene puts away the card of the man picked
  if ((e.target as HTMLElement).id === 'camp' && ui.open != null && !ui.modal) { ui.open = null; render(); return; }
  // A click on the map picks the place nearest it as the course.
  if ((e.target as HTMLElement).id === 'map' && G && ui.screen === 'camp' && !ui.modal) { const id = placeAt(e.target as HTMLCanvasElement, e.offsetX, e.offsetY); if (id) act('course-pick', { v: id }); return; }
  const el = (e.target as HTMLElement).closest<HTMLButtonElement | HTMLSelectElement>('[data-act]'); if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') act(el.dataset.act!, el.dataset as ActData);
});
// Trying on: while the pointer or focus is on the button that buys a man's next arms or armour, his card shows him wearing them. Not while
// a purchase is being shown off: the pointer is still over the button, which the page has drawn afresh, and the next piece would hide what was bought.
function tryOn(e: Event) {
  if (performance.now() - kittedAt < 1300) return;
  const b = (e.target as Element).closest<HTMLElement>('[data-act="up"]'), s = b && man(+b.dataset.id!), art = b && b.closest('.card')?.querySelector<HTMLElement>('.art'), img = art && art.querySelector('img');
  if (!b || !s || !art || !img) return;
  const k = b.dataset.k as GearSlot; if (s[k] >= 3 || art.classList.contains('trying')) return;
  art.dataset.was = img.src; img.src = soldierArt(s, { [k]: s[k] + 1 }); art.classList.add('trying');
}
function tryOff(e: Event) {
  const b = (e.target as Element).closest<HTMLElement>('[data-act="up"]'), to = (e as MouseEvent | FocusEvent).relatedTarget as Node | null;
  if (!b || (to && b.contains(to))) return;
  const art = b.closest('.card')?.querySelector<HTMLElement>('.art.trying'), img = art && art.querySelector('img');
  if (art && img) { img.src = art.dataset.was || img.src; art.classList.remove('trying'); }
}
document.addEventListener('mouseover', tryOn); document.addEventListener('focusin', tryOn);
document.addEventListener('mouseout', tryOff); document.addEventListener('focusout', tryOff);
document.addEventListener('change', e => { const el = e.target as HTMLSelectElement; if (el.dataset && el.dataset.act === 'course-pick') act('course-pick', { v: el.value }); });
document.addEventListener('keydown', e => {
  if (ui.pass) { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endPass(); } return; }
  if (e.key === 'Escape' && ui.modal && ui.modal.type === 'help') { act('close', {}); return; }
  if (e.key === 'Escape' && ui.screen === 'codex' && !ui.modal) { act('codexBack', {}); return; }
  if (e.key === 'Escape' && ui.screen === 'camp' && !ui.modal) { if (ui.panel) act('panelClose', {}); else if (ui.open != null) { ui.open = null; render(); } return; }
  if (ui.screen !== 'battle' || ui.modal || !ui.b) return;
  if ((e.key === 'o' || e.key === 'O') && !e.ctrlKey && !e.metaKey && !e.altKey) { act('captain', {}); return; }
  const k = ({ '1': 'hold', '2': 'advance', '3': 'charge' } as Partial<Record<string, Stance>>)[e.key];
  if (k && !(ui.c!.duel && k === 'hold')) setStance(k);
  else if (e.key === ' ' && !((e.target as Element).closest && (e.target as Element).closest('button'))) { e.preventDefault(); ui.speed = ui.speed ? 0 : 1; paintHud(); }
});
window.addEventListener('resize', () => {
  fitBar();
  if (ui.view) fitView(ui.view);
  if (ui.screen === 'camp' && G) { if (ui.camp) { fitCamp(ui.camp); drawCamp(ui.camp, G, ui.open, 0, calm); } if (ui.panel === 'map') drawMap($<HTMLCanvasElement>('#map'), G, !atEnd(G) && ui.course ? routeTo(G, ui.course) : null); }
});
document.addEventListener('visibilitychange', () => { if (AC) setCue(document.hidden ? null : cueForScreen()); });

/* ---------- the loop ---------- */
const STEP = 1 / 30;
const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  // the camp: the fire burns and the men walk to where their orders put them
  if (ui.screen === 'camp' && ui.camp && G && !calm) {
    if (ui.pass) { ui.pass.t += dt; if (ui.pass.t >= ui.pass.dur) endPass(); else drawCamp(ui.camp, G, null, dt, false, ui.pass); return; }
    if (!ui.panel) drawCamp(ui.camp, G, ui.open, dt, false);
    return;
  }
  const v = ui.view; if (!v) return;
  if (ui.screen === 'battle' && ui.b) {
    const b = ui.b, sp = ui.modal ? 0 : ui.speed;
    if (!b.over && sp > 0) { acc += dt * sp; while (acc >= STEP) { stepBattle(b, STEP); acc -= STEP; } }
    drainFx(v, b, true); stepParts(v, dt * (sp || 0)); if (b.over) stepParts(v, dt);
    drawField(v, b, now / 1000);
    hudT -= dt; if (hudT <= 0) { hudT = 0.15; paintHud(); }
    if (b.over && !ui.verdict) { setCue(null); ui.overT += dt; if (ui.overT > 1.1) { ui.verdict = true; paintHud(); showVerdict(); } }
  } else if (ui.screen === 'title' && ui.demo && !calm) {
    const b = ui.demo;
    if (!b.over) { acc += dt; while (acc >= STEP) { stepBattle(b, STEP); acc -= STEP; } }
    else { demoWait += dt; if (demoWait > 3.5) { newDemo(); return; } }
    drainFx(v, b, false); stepParts(v, dt); drawField(v, b, now / 1000);
  }
}
/** What the Claude artifact runtime keeps across a hot reload: the campaign, if one was under way. */
interface HotState { G?: Campaign }
interface Window {
  // The artifact runtime is the only place this exists: there, a hot reload keeps the campaign.
  claude?: { hot?: { snapshot?(save: () => HotState): void; ready?(start: (data: HotState) => void): void; data?: HotState } };
}

/* ---------- boot ---------- */
function start(data: HotState) {
  if (data && data.G && data.G.v === 3) { G = data.G; ui.screen = G.over ? 'end' : 'camp'; }
  // a link to #encyclopedia, or to one of its tabs, opens it, with the way back to wherever the game was
  const link = new RegExp('^#encyclopedia(?:-(' + CODEX_TABS.map(t => t[0]).join('|') + '))?$').exec(location.hash);
  if (link) { ui.codexFrom = ui.screen; ui.screen = 'codex'; if (link[1]) ui.codex = link[1] as CodexTab; }
  render();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) document.fonts.load("12px 'Alegreya SC'").catch(() => {});
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => (G && ui.screen !== 'title' ? { G } : {}));
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
