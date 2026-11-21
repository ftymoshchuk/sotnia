'use strict';
/* What the page does with the player's clicks (js/main.js), run against a stand-in for the page (tests/dom-stub.js): a day going by over the camp, and the
 * notes that show beside a thing on hover. The stand-in lays nothing out and paints nothing, so how these look and feel is for the browser; what these
 * check is what the game decides: which page is open, what is out of reach, which note shows where. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./dom-stub');

// a camp at the salt lakes, as the game draws it once a banner is raised
const camp = opts => {
  const p = page(opts);
  p.run("G = newGame('salt', { type: 'hussar', name: 'Janos' }); ui.screen = 'camp'; ui.panel = null; render();");
  return p;
};

test('a day going by puts away the page it was ordered from, however the day goes by, so that the page does not hide the time passing', () => {
  for (const reduced of [false, true]) {
    for (const [what, panel, order] of [
      ['a leg marched from the road page', 'map', "act('march', { r: roadsFrom(G)[0].i })"],
      ['a course marched from the road page', 'map', "act('course', {})"],
      ['a day’s rest', 'roll', "act('halt', {})"]
    ]) {
      const p = camp({ reduced }), name = `${what}${reduced ? ', for a visitor who wants less motion' : ''}`;
      p.run(`act('panel', { k: '${panel}' })`);
      assert.equal(p.run('ui.panel'), panel, `${name}: the page opens`);
      assert.ok(p.found['#panel'].innerHTML.includes('class="drawer'), `${name}: it is on the screen`);
      assert.ok(p.found['.hub'].hasAttribute('inert'), `${name}: the camp under it is out of reach`);
      const day = p.run('G.day');
      p.run(order);
      assert.ok(p.run('G.day') > day, `${name}: the day went by`);
      assert.equal(p.run('ui.panel'), null, `${name}: the page is put away at once`);
      assert.equal(p.found['#panel'].innerHTML, '', `${name}: and is off the screen`);
      assert.ok(!p.found['.hub'].hasAttribute('inert'), `${name}: the camp has its clicks back`);
      assert.equal(p.run('!!ui.pass'), !reduced, `${name}: the time goes by over the camp, unless the visitor asked for less motion`);
      if (!reduced) p.run('endPass()');
      assert.equal(p.run('ui.panel'), null, `${name}: it stays shut when the day is done`);
      assert.equal(p.found['#panel'].innerHTML, '', `${name}: and off the screen`);
      assert.ok(!p.found['.hub'].hasAttribute('inert'), `${name}: and the camp stays in reach`);
    }
  }
});

test('a march that cannot be made leaves the page open: nothing happened, so there is nothing to put away', () => {
  const p = camp();
  p.run("act('panel', { k: 'map' }); G.roster = []");
  p.run("act('march', { r: roadsFrom(G)[0].i })");
  assert.equal(p.run('ui.panel'), 'map');
  assert.ok(p.found['.hub'].hasAttribute('inert') && p.found['#panel'].innerHTML.includes('class="drawer'), 'the page is as it was');
  assert.ok(!p.run('!!ui.pass') && p.run('G.at') === 'syvash', 'and the company has not moved');
});

/* ---------- the notes on hover ---------- */
// A thing with a note, as a test makes it: where its box is, and what the note says. The page's own #tip is the one the game writes to.
const thing = (rect, tip, extra = {}) => ({
  dataset: { tip: JSON.stringify(tip) }, isConnected: true, querySelector: () => null, matches: () => true, closest(sel) { return sel === '[data-tip]' ? this : null; }, contains(other) { return other === this; },
  classList: { contains: () => false }, id: '',
  getBoundingClientRect: () => ({ left: rect[0], top: rect[1], right: rect[0] + rect[2], bottom: rect[1] + rect[3], width: rect[2], height: rect[3] }), ...extra
});
const notes = opts => {
  const p = page(opts), box = (p.run("$('#tip')"), p.found['#tip']);
  Object.assign(box, { hidden: true, offsetWidth: 200, offsetHeight: 80 }); // a note 200 by 80 in a window 1280 by 720
  const at = (name, el) => { p.give(name, el); return name; };
  return { p, box, at, spot: () => /translate\((-?\d+)px,(-?\d+)px\)/.exec(box.style.transform).slice(1).map(Number) };
};
const TIP = { title: 'Bread', lines: ['100 loaves.', 'Ten cost 4.'] };

test('a note shows under the thing it is about, or over it where there is no room under, and never off the page', () => {
  const { p, box, at, spot } = notes();
  p.run(`showTip(${at('a', thing([100, 10, 60, 30], TIP))})`);
  assert.equal(box.hidden, false);
  assert.deepEqual(spot(), [30, 50], 'under the thing, 10 below it, and centred on it');
  assert.ok(box.innerHTML.includes('<b>Bread</b>') && box.innerHTML.includes('<p>100 loaves.</p>') && box.innerHTML.includes('<p>Ten cost 4.</p>'), 'its title and its lines');
  p.run(`showTip(${at('b', thing([100, 680, 60, 30], TIP))})`);
  assert.deepEqual(spot(), [30, 590], 'with no room under it, over it');
  p.run(`showTip(${at('c', thing([1240, 10, 30, 30], TIP))})`);
  assert.equal(spot()[0], 1280 - 200 - 8, 'not off the right of the page');
  p.run(`showTip(${at('d', thing([0, 10, 20, 30], TIP))})`);
  assert.equal(spot()[0], 8, 'nor off the left');
  // a thing that has a label of its own in the scene (the fire, whose label hangs below it) is cleared as a whole
  const plate = { getBoundingClientRect: () => ({ top: 40, bottom: 70 }) };
  p.run(`showTip(${at('e', thing([100, 10, 60, 30], TIP, { querySelector: sel => (sel === '.plate' ? plate : null) }))})`);
  assert.deepEqual(spot(), [30, 80], 'under its label, not over it');
  // what a note says is text: it cannot become markup
  p.run(`showTip(${at('f', thing([100, 10, 60, 30], { title: '<img src=x onerror=alert(1)>', lines: ['a < b & "c"'] }))})`);
  assert.ok(!box.innerHTML.includes('<img') && box.innerHTML.includes('&lt;img') && box.innerHTML.includes('a &lt; b &amp; &quot;c&quot;'), 'a note is escaped');
  // a warning is shown as one, with its sign
  p.run(`showTip(${at('g', thing([100, 10, 60, 30], { ...TIP, warns: ['Not enough bread for tomorrow'] }))})`);
  assert.ok(/<p class="w"><svg[^>]*>.*<\/svg>Not enough bread for tomorrow<\/p>/.test(box.innerHTML), 'a warning line');
  // a thing no longer on the page, or with a note that is not one, shows nothing
  p.run('hideTip()');
  p.run(`showTip(${at('h', thing([100, 10, 60, 30], TIP, { isConnected: false }))})`);
  p.run(`showTip(${at('i', thing([100, 10, 60, 30], TIP, { dataset: { tip: 'not a note' } }))})`);
  assert.equal(box.hidden, true);
});

test('a note comes after a short wait, changes at once from one thing to the next, and goes with the pointer or when the screen is drawn again', () => {
  const { p, box, at } = notes();
  const a = at('a', thing([100, 10, 60, 30], { ...TIP, title: 'A' })), b = at('b', thing([200, 10, 60, 30], { ...TIP, title: 'B' }));
  const none = at('none', { closest: () => null });
  p.run(`tipOn({ type: 'mouseover', target: ${a} })`);
  assert.equal(box.hidden, true, 'not at once, so that a pointer crossing the bar does not flash every note');
  p.tick();
  assert.equal(box.hidden, false);
  assert.ok(box.innerHTML.includes('<b>A</b>'));
  p.run(`tipOn({ type: 'mouseover', target: ${b} })`);
  assert.ok(box.innerHTML.includes('<b>B</b>'), 'from one thing to the next with no wait');
  p.run(`tipOff({ type: 'mouseout', target: ${b}, relatedTarget: ${a} })`);
  assert.equal(box.hidden, false, 'going on to another thing with a note keeps the note up for it to take over');
  p.run(`tipOff({ type: 'mouseout', target: ${b}, relatedTarget: ${none} })`);
  assert.equal(box.hidden, true, 'going on to a thing with none puts it away');
  // a pointer that leaves before the wait is over shows nothing
  p.run(`tipOn({ type: 'mouseover', target: ${a} })`);
  p.run(`tipOff({ type: 'mouseout', target: ${a}, relatedTarget: ${none} })`);
  p.tick();
  assert.equal(box.hidden, true, 'a pointer just passing through');
  // the keyboard: only the focus that the keyboard made counts, not the one that follows a click
  const click = at('click', thing([100, 10, 60, 30], TIP, { matches: () => false })), key = at('key', thing([100, 10, 60, 30], TIP, { matches: sel => sel === ':focus-visible' }));
  p.run(`tipOn({ type: 'focusin', target: ${click} })`); p.tick();
  assert.equal(box.hidden, true, 'focus after a mouse click shows nothing');
  p.run(`tipOn({ type: 'focusin', target: ${key} })`); p.tick();
  assert.equal(box.hidden, false, 'focus from the keyboard shows the note');
  // drawing the screen afresh takes the thing away, so it takes the note too
  p.run('render()');
  assert.equal(box.hidden, true);
});

test('on a screen with no pointer the mouse events a tap leaves behind mean nothing: the note is the tap’s, and stays until it is put away', () => {
  const { p, box, at } = notes({ touch: true });
  const a = at('a', thing([100, 10, 60, 30], { ...TIP, title: 'A' })), none = at('none', { closest: () => null });
  p.run(`tipOn({ type: 'mouseover', target: ${a} })`); p.tick();
  assert.equal(box.hidden, true, 'a pointer “arriving” after a tap shows nothing');
  p.run(`showTip(${a})`); // what the tap itself does
  assert.equal(box.hidden, false);
  p.run(`tipOff({ type: 'mouseout', target: ${a}, relatedTarget: ${none} })`);
  assert.equal(box.hidden, false, 'and the pointer “leaving” straight after it does not take the note away');
  p.run('hideTip()');
  assert.equal(box.hidden, true, 'a second tap, or one elsewhere, does');
  // an external keyboard still gets the note from the focus it moves
  const key = at('key', thing([100, 10, 60, 30], TIP, { matches: sel => sel === ':focus-visible' }));
  p.run(`tipOn({ type: 'focusin', target: ${key} })`); p.tick();
  assert.equal(box.hidden, false);
});

/* ---------- the clicks and the keys that the notes and the pages meet ---------- */
test('a tap on a figure shows its note on a screen with no pointer, a second tap or a tap elsewhere puts it away, and with a pointer a click shows nothing of its own', () => {
  const { p, box, at } = notes({ touch: true });
  // the things themselves are what an event is aimed at; at() also puts each in the game's scope under a name, for code that runs there
  const A = thing([100, 10, 60, 30], { ...TIP, title: 'A' }), B = thing([200, 10, 60, 30], { ...TIP, title: 'B' });
  const floor = { classList: { contains: () => false }, id: '', dataset: {}, closest: () => null };
  at('a', A); at('b', B);
  p.fire('click', { target: A });
  assert.ok(!box.hidden && box.innerHTML.includes('<b>A</b>'), 'a tap shows the note, at once');
  p.fire('click', { target: A });
  assert.ok(box.hidden, 'a second tap puts it away');
  p.fire('click', { target: A }); p.fire('click', { target: B });
  assert.ok(!box.hidden && box.innerHTML.includes('<b>B</b>'), 'a tap on another figure swaps it');
  p.fire('click', { target: floor });
  assert.ok(box.hidden, 'a tap elsewhere puts it away');
  // a figure that is also a control (a thing in the camp) is for its action, and shows no note on a tap
  const spot = thing([100, 10, 60, 30], TIP, { dataset: { tip: JSON.stringify(TIP), act: 'panel', k: 'roll' } });
  p.fire('click', { target: spot });
  assert.ok(box.hidden, 'a tap on a control acts, and shows no note');
  // with a pointer, the hover shows the note, and a click on the figure neither toggles it nor takes it away
  const mouse = notes({ touch: false }), M = thing([100, 10, 60, 30], TIP), m = mouse.at('m', M);
  mouse.p.fire('click', { target: M });
  assert.ok(mouse.box.hidden, 'a click shows nothing of its own');
  mouse.p.run(`showTip(${m})`);
  mouse.p.fire('click', { target: M });
  assert.ok(!mouse.box.hidden, 'and does not take the hover’s note away');
});

test('Escape puts a note away, and a click on the dimmed ground round a page puts the page away', () => {
  const p = camp();
  p.give('a', thing([100, 10, 60, 30], TIP));
  p.run("$('#tip').hidden = true; showTip(a)");
  p.fire('keydown', { key: 'Escape', target: { closest: () => null } });
  assert.equal(p.found['#tip'].hidden, true, 'Escape puts the note away');
  p.run("act('panel', { k: 'roll' })");
  p.fire('keydown', { key: 'Escape', target: { closest: () => null } });
  assert.equal(p.run('ui.panel'), null, 'and the page, if there is one');
  p.run("act('panel', { k: 'roll' })");
  p.fire('click', { target: { classList: { contains: c => c === 'pveil' }, id: '', closest: () => null, dataset: {} } });
  assert.equal(p.run('ui.panel'), null, 'a click on the dimmed ground puts the page away');
  assert.equal(p.found['#panel'].innerHTML, '');
});

test('Space pauses a fight, unless it is for a button that does something with it: a figure of the ledger is a button that does nothing, and keeps no space', () => {
  const p = page();
  p.run("G = newGame('oxen', { type: 'hussar', name: 'Janos' }); G.at = 'kamianets'; arrive(G); ui.screen = 'camp'; render(); act('muster', { id: G.contracts[0].id }); act('fight', {});");
  assert.equal(p.run('ui.screen'), 'battle', 'a fight is on');
  const space = target => { p.fire('keydown', { key: ' ', target }); return p.run('ui.speed'); };
  const nothing = { closest: () => null };
  const figure = { closest: sel => (sel === 'button' ? figure : null) };                     // a button, but not "button:not(.stat)": it is a figure
  const control = { closest: sel => (sel === 'button' || sel === 'button:not(.stat)' ? control : null) }; // a button that is for something
  assert.equal(space(nothing), 0, 'with nothing focused, it pauses');
  assert.equal(space(nothing), 1, 'and resumes');
  assert.equal(space(figure), 0, 'with a figure of the ledger focused, it still pauses');
  assert.equal(space(figure), 1, 'and resumes');
  assert.equal(space(control), 1, 'with a button that is for something focused, the space is its: nothing is paused');
});
