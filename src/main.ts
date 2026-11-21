"use strict";
/* ===== SOTNIA interface: actions, input, the frame loop and boot. Loaded last. ===== */
/* ---------- actions ---------- */
let oddsTimer = 0, acc = 0, hudT = 0, last = 0, demoWait = 0;
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
  const mix = () => (['pike', 'shot', 'sabre', 'pike', 'shot'] as TroopClass[]).map(c => enemyUnit(c, 1, pick(['swede', 'imperial', 'raider', 'bandit'])));
  const skin: Skin = pick(['swede', 'imperial', 'raider', 'bandit']);
  const ours = (['pike', 'shot', 'sabre', 'pike', 'shot'] as TroopClass[]).map((c, i) => { const u = enemyUnit(c, 1, 'own') as Foe & { id: number }; u.id = i; u.name = ''; u.morale = 60; return u; });
  const weather: Weather = pick(['clear', 'clear', 'rain', 'fog']);
  ui.demo = makeBattle(ours, mix().map(u => { u.skin = skin; u.morale = 60; return u; }), { stance: 'advance', ai: 'advance', weather, powder: 99, vis: true });
  ui.view = newView($<HTMLCanvasElement>('#field')!, (Math.random() * 1e6) | 0, weather, false);
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
function setStance(s: Stance) {
  const b = ui.b; if (!b || b.over || b.retreated) return;
  b.stance[0] = s;
  if (s === 'hold') for (const u of b.units) if (u.side === 0) { u.hx = u.x; u.hy = u.y; }
  paintHud();
}
/** The data- attributes of the element that was clicked, which hold what its action needs (the HTML that sets them is in screens.ts). */
type ActData = Record<string, string>;
function act(a: string, d: ActData) {
  wake();
  switch (a) {
    case 'new': G = newGame(d.q); ui.screen = 'camp'; ui.tab = 'market'; ui.course = null; ui.open = null; ui.news = null; ui.modal = null; ui.campPos = {}; break;
    case 'title': ui.screen = 'title'; ui.modal = null; break;
    case 'continue': {
      const s = loadSave(); if (!s) break;
      G = s; ui.screen = 'camp'; ui.tab = 'market'; ui.course = null; ui.news = null; ui.open = null; ui.campPos = {};
      ui.modal = G.ambush ? { type: 'ambush' } : G.pending && G.pending.id ? { type: 'event' } : null;
      break;
    }
    case 'tab': ui.tab = d.k as TabId; break;
    case 'sel': ui.open = +d.id; break;
    case 'order': { const s = man(+d.id); if (s) s.order = d.o as CampOrder; break; }
    case 'promo': promote(G!, +d.id, d.k as Promo); G!.odds = {}; break;
    case 'up': if (has(G!, 'market')) upgrade(G!, +d.id, d.k as GearSlot); break;
    case 'dismiss': dismiss(G!, +d.id); ui.open = null; break;
    case 'hire': if (has(G!, 'recruits')) hire(G!, +d.i); break;
    case 'buy': if (has(G!, 'market')) buy(G!, d.k as Supply); break;
    case 'staff': if (has(G!, 'staff')) hireStaff(G!, d.k as StaffId); break;
    case 'sell': sellCargo(G!, +d.n); break;
    case 'march': { const r = march(G!, +d.r, d.f === '1'); if (!r) return; dayDone(r); break; }
    case 'halt': dayDone(campDay(G!)); break;
    case 'course-pick': if (!routeTo(G!, d.v as PlaceId)) return; ui.course = d.v as PlaceId; break;
    case 'course': { if (!ui.course) return; const r = followCourse(G!, ui.course, d.f === '1'); if (!r.legs && !r.lines.length) return; dayDone(r); break; }
    case 'deliver': if (!deliver(G!)) return; ui.screen = 'end'; ui.modal = null; break;
    case 'payoff': if (!payOff(G!, d.k as 'coin' | 'cargo')) return; ui.modal = null; break;
    case 'fightambush': {
      const c = G!.ambush; if (!c) return;
      ui.c = c; ui.pick = defaultPick(G!, c); ui.stance = null; ui.modal = null; ui.screen = 'muster'; queueOdds(); break;
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
      ui.speed = 1; ui.overT = 0; ui.verdict = false; acc = 0; ui.screen = 'battle'; sfx('drum'); break;
    }
    case 'cmd': setStance(d.s as Stance); return;
    case 'retreat': if (ui.b) { orderRetreat(ui.b); paintHud(); } return;
    case 'speed': ui.speed = +d.v; paintHud(); return;
    case 'report': if (!ui.b || !ui.b.over) return; ui.rep = resolveBattle(G!, ui.c!, ui.b); ui.b = null; ui.screen = 'report'; break;
    // After an ambush the company goes on to where it was bound; paid work took the day.
    case 'camp': if (G!.over) ui.screen = 'end'; else if (ui.rep && ui.rep.ambush) toCamp(); else dayDone(campDay(G!)); break;
    case 'choice': { const e = EVENTS.find(x => x.id === (G!.pending && G!.pending.id)); const res = applyEvent(G!, +d.i); ui.modal = { type: 'result', title: e ? e.title : '', text: res }; break; }
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
}
document.addEventListener('click', e => {
  // A click on the map picks the place nearest it as the course.
  if ((e.target as HTMLElement).id === 'map' && G && ui.screen === 'camp' && !ui.modal) { const id = placeAt(e.target as HTMLCanvasElement, e.offsetX, e.offsetY); if (id) act('course-pick', { v: id }); return; }
  const el = (e.target as HTMLElement).closest<HTMLButtonElement | HTMLSelectElement>('[data-act]'); if (el && !el.disabled) act(el.dataset.act!, el.dataset as ActData);
});
document.addEventListener('change', e => { const el = e.target as HTMLSelectElement; if (el.dataset && el.dataset.act === 'course-pick') act('course-pick', { v: el.value }); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.modal && ui.modal.type === 'help') { act('close', {}); return; }
  if (ui.screen !== 'battle' || ui.modal || !ui.b) return;
  const k = ({ '1': 'hold', '2': 'advance', '3': 'charge' } as Partial<Record<string, Stance>>)[e.key];
  if (k && !(ui.c!.duel && k === 'hold')) setStance(k);
  else if (e.key === ' ' && !((e.target as Element).closest && (e.target as Element).closest('button'))) { e.preventDefault(); ui.speed = ui.speed ? 0 : 1; paintHud(); }
});
window.addEventListener('resize', () => {
  if (ui.view) fitView(ui.view);
  if (ui.screen === 'camp' && G) { if (ui.camp) { fitCamp(ui.camp); drawCamp(ui.camp, G, ui.open, 0, calm); } drawMap($<HTMLCanvasElement>('#map'), G, !atEnd(G) && ui.course ? routeTo(G, ui.course) : null); }
});
document.addEventListener('visibilitychange', () => { if (AC) setCue(document.hidden ? null : cueForScreen()); });

/* ---------- the loop ---------- */
const STEP = 1 / 30;
const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  // the camp: the fire burns and the men walk to where their orders put them
  if (ui.screen === 'camp' && ui.camp && G && !calm) { drawCamp(ui.camp, G, ui.open, dt, false); return; }
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
  if (data && data.G && data.G.v === 2) { G = data.G; ui.screen = G.over ? 'end' : 'camp'; }
  render();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) document.fonts.load("12px 'Alegreya SC'").catch(() => {});
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => (G && ui.screen !== 'title' ? { G } : {}));
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
