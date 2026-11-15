"use strict";
/* ===== SOTNIA interface: actions, input, the frame loop and boot. Loaded last. ===== */
/* ---------- actions ---------- */
let oddsTimer = 0, acc = 0, hudT = 0, last = 0, demoWait = 0;
function queueOdds() {
  ui.odds = null; clearTimeout(oddsTimer);
  oddsTimer = setTimeout(() => {
    if (ui.screen !== 'muster') return;
    ui.odds = ui.pick.length ? stanceOdds(G, ui.c, ui.pick, 14) : null;
    if (!ui.stance && ui.odds) ui.stance = ui.odds.best;
    render();
  }, 30);
}
function newDemo() {
  const mix = () => ['pike', 'shot', 'sabre', 'pike', 'shot'].map(c => enemyUnit(c, 1, pick(['swede', 'imperial', 'raider', 'bandit'])));
  const skin = pick(['swede', 'imperial', 'raider', 'bandit']);
  const ours = ['pike', 'shot', 'sabre', 'pike', 'shot'].map((c, i) => { const u = enemyUnit(c, 1, 'own'); u.id = i; u.name = ''; u.morale = 60; return u; });
  const weather = pick(['clear', 'clear', 'rain', 'fog']);
  ui.demo = makeBattle(ours, mix().map(u => { u.skin = skin; u.morale = 60; return u; }), { stance: 'advance', ai: 'advance', weather, powder: 99, vis: true });
  ui.view = newView($('#field'), (Math.random() * 1e6) | 0, weather, false);
  demoWait = 0;
  drawField(ui.view, ui.demo, 0);
}
function nightfall() {
  const r = endDay(G);
  ui.news = r.lines;
  if (!G.roster.length && (!G.recruits.length || G.thalers < Math.min.apply(null, G.recruits.map(x => x.price)))) { G.over = 'dissolved'; ui.screen = 'end'; ui.modal = null; return; }
  ui.screen = 'camp';
  if (r.event) ui.modal = { type: 'event' };
  if (G.day >= DAYS) ui.tab = 'contracts';
}
function setStance(s) {
  const b = ui.b; if (!b || b.over || b.retreated) return;
  b.stance[0] = s;
  if (s === 'hold') for (const u of b.units) if (u.side === 0) { u.hx = u.x; u.hy = u.y; }
  paintHud();
}
function act(a, d) {
  wake();
  switch (a) {
    case 'new': G = newGame(); ui.screen = 'camp'; ui.tab = 'contracts'; ui.open = null; ui.news = null; ui.modal = null; break;
    case 'continue': { const s = loadSave(); if (s) { G = s; ui.screen = 'camp'; ui.news = null; if (G.pending && G.pending.id) ui.modal = { type: 'event' }; } break; }
    case 'tab': ui.tab = d.k; break;
    case 'open': ui.open = ui.open === +d.id ? null : +d.id; break;
    case 'order': { const s = man(+d.id); if (s) s.order = d.o; break; }
    case 'promo': promote(G, +d.id, d.k); G.odds = {}; break;
    case 'up': upgrade(G, +d.id, d.k); break;
    case 'dismiss': dismiss(G, +d.id); ui.open = null; break;
    case 'hire': hire(G, +d.i); break;
    case 'buy': buy(G, d.k); break;
    case 'staff': hireStaff(G, d.k); break;
    case 'muster': { const c = G.contracts.find(x => x.id === +d.id); if (!c) return; ui.c = c; ui.pick = defaultPick(G, c); ui.stance = null; ui.screen = 'muster'; queueOdds(); break; }
    case 'pick': {
      const id = +d.id, i = ui.pick.indexOf(id);
      if (i >= 0) ui.pick.splice(i, 1); else if (ui.c.cap === 1) ui.pick = [id]; else if (ui.pick.length < ui.c.cap) ui.pick.push(id); else return;
      queueOdds(); break;
    }
    case 'stance': ui.stance = d.s; break;
    case 'back': ui.screen = 'camp'; break;
    case 'fight': {
      if (!ui.pick.length) return;
      ui.b = battleFor(G, ui.c, ui.pick, ui.stance || (ui.odds ? ui.odds.best : 'advance'), true);
      ui.speed = 1; ui.overT = 0; ui.verdict = false; acc = 0; ui.screen = 'battle'; sfx('drum'); break;
    }
    case 'cmd': setStance(d.s); return;
    case 'retreat': if (ui.b) { orderRetreat(ui.b); paintHud(); } return;
    case 'speed': ui.speed = +d.v; paintHud(); return;
    case 'report': if (!ui.b || !ui.b.over) return; ui.rep = resolveBattle(G, ui.c, ui.b); ui.b = null; ui.screen = 'report'; break;
    case 'camp': if (G.over) ui.screen = 'end'; else nightfall(); break;
    case 'endday': nightfall(); break;
    case 'choice': { const e = EVENTS.find(x => x.id === (G.pending && G.pending.id)); const res = applyEvent(G, +d.i); ui.modal = { type: 'result', title: e ? e.title : '', text: res }; break; }
    case 'close': { const was = ui.modal; ui.modal = null; if (was && was.type === 'help') { renderModal(); return; } break; }
    case 'help': ui.modal = { type: 'help', prev: ui.modal }; renderModal(); return;
    case 'sound': {
      ui.sound = !ui.sound; try { localStorage.setItem('sotnia-sound', ui.sound ? 'on' : 'off'); } catch (e) { /* fine */ }
      document.querySelectorAll('[data-act="sound"]').forEach(el => { el.textContent = 'Sound ' + (ui.sound ? 'on' : 'off'); });
      if (ui.sound) wake(); return;
    }
    case 'music': {
      ui.music = !ui.music; try { localStorage.setItem('sotnia-music', ui.music ? 'on' : 'off'); } catch (e) { /* fine */ }
      document.querySelectorAll('[data-act="music"]').forEach(el => { el.textContent = 'Music ' + (ui.music ? 'on' : 'off'); });
      if (ui.music) { wake(); setCue(cueForScreen()); } else setCue(null);
      return;
    }
    case 'disband': G.over = 'dissolved'; ui.screen = 'end'; break;
    default: return;
  }
  render();
}
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && !el.disabled) act(el.dataset.act, el.dataset); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.modal && ui.modal.type === 'help') { act('close', {}); return; }
  if (ui.screen !== 'battle' || ui.modal || !ui.b) return;
  const k = { '1': 'hold', '2': 'advance', '3': 'charge' }[e.key];
  if (k && !(ui.c.duel && k === 'hold')) setStance(k);
  else if (e.key === ' ' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); ui.speed = ui.speed ? 0 : 1; paintHud(); }
});
window.addEventListener('resize', () => { if (ui.view) fitView(ui.view); });
document.addEventListener('visibilitychange', () => { if (AC) setCue(document.hidden ? null : cueForScreen()); });

/* ---------- the loop ---------- */
const STEP = 1 / 30;
const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
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

/* ---------- boot ---------- */
function start(data) {
  if (data && data.G && data.G.v === 1) { G = data.G; ui.screen = G.over ? 'end' : 'camp'; }
  render();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) document.fonts.load("12px 'Alegreya SC'").catch(() => {});
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => (G && ui.screen !== 'title' ? { G } : {}));
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
