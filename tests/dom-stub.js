'use strict';
/* A stand-in for the rest of a page, for the tests of js/main.js (what a click does, the notes on hover, a day going by): enough of the DOM that the game's
 * render() and act() run, and no more. Every selector the game asks for gets one element and keeps it, so that a test can look at what the game put there
 * (what is in #panel, whether the camp is inert); the game's canvases are the recording canvases of canvas-stub.js. Nothing is laid out and nothing is
 * painted: a thing's box is whatever a test says it is, and a test of how a page looks is for the browser. */
const vm = require('node:vm');
const { load } = require('./canvas-stub');

// every script of the game, in the order index.html loads them
const SCRIPTS = ['core', 'journey', 'command', 'geo', 'art', 'figures', 'terrain', 'music', 'score', 'audio', 'icons', 'screens', 'encyclopedia', 'main'];

/** An element that keeps its attributes, its classes and what is put in it, and does nothing else. base is whatever a test or a canvas adds to it. */
function element(tag, base) {
  const attrs = new Map(), classes = new Set();
  return Object.assign({
    tagName: String(tag).toUpperCase(), dataset: {}, style: { setProperty() {} }, innerHTML: '', textContent: '', className: '', hidden: false, id: '',
    clientWidth: 800, offsetWidth: 0, offsetHeight: 60, offsetParent: {}, scrollTop: 0, isConnected: true, children: [],
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), contains: c => classes.has(c),
      toggle: (c, on) => { const v = on === undefined ? !classes.has(c) : !!on; if (v) classes.add(c); else classes.delete(c); return v; }
    },
    setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: k => (attrs.has(k) ? attrs.get(k) : null), hasAttribute: k => attrs.has(k), removeAttribute: k => attrs.delete(k),
    toggleAttribute: (k, on) => { const v = on === undefined ? !attrs.has(k) : !!on; if (v) attrs.set(k, ''); else attrs.delete(k); return v; },
    querySelector: () => null, querySelectorAll: () => [], closest: () => null, matches: () => false, contains: () => false,
    appendChild(c) { this.children.push(c); return c; }, remove() { this.isConnected = false; }, focus() {}, addEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
  }, base);
}

/**
 * The game loaded into a page of this kind, booted as the page boots it (the title screen is drawn). Returns run, which runs code in the game's
 * scope; found, the elements by the selector that asked for them; tick, which lets the timers the game has set go off (none does by itself); fire, which
 * hands an event of the test's own (its type, and the fields the game reads: key, target) to the game's handlers for that type; and give, which puts a
 * thing of the test's own in the game's scope under a name. reduced is a visitor who asked for less motion, touch one whose screen has no pointer to rest
 * on a thing.
 */
function page({ reduced = false, touch = false } = {}) {
  const found = {}, root = element('html', { clientWidth: 1280, clientHeight: 720 }), body = element('body'), timers = new Map(), listeners = {};
  let nextTimer = 1;
  const on = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  const fire = (type, event) => (listeners[type] || []).forEach(fn => fn({ type, preventDefault() {}, ...event }));
  const win = { devicePixelRatio: 1, addEventListener: on, scrollTo() {}, matchMedia: q => ({ matches: (reduced && /reduce/.test(q)) || (touch && /hover:\s*none/.test(q)) }) };
  const tick = () => { const due = [...timers.values()]; timers.clear(); due.forEach(fn => fn()); };
  let scope;
  const run = load(SCRIPTS, ctx => {
    scope = ctx;
    Object.assign(ctx, {
      window: win, location: { hash: '', pathname: '/', search: '' }, history: { replaceState() {} }, performance: { now: () => 0 }, requestAnimationFrame: () => 0, setInterval: () => 0,
      setTimeout: fn => { timers.set(nextTimer, fn); return nextTimer++; }, clearTimeout: id => { timers.delete(id); }
    });
    ctx.__page = { element, found, body, root, on };
    vm.runInContext(`(() => {
      const make = document.createElement;
      document.createElement = tag => Object.assign(__page.element(tag), make(tag));
      document.querySelector = sel => __page.found[sel] || (__page.found[sel] = /^#(camp|field|map)$/.test(sel) ? Object.assign(__page.element('canvas'), make('canvas')) : __page.element('div'));
      document.querySelectorAll = () => [];
      document.addEventListener = __page.on;
      Object.assign(document, { body: __page.body, documentElement: __page.root, activeElement: null, hidden: false });
    })()`, ctx);
  });
  return { run, found, body, root, tick, fire, give: (name, value) => { scope[name] = value; } };
}
module.exports = { page, element };
