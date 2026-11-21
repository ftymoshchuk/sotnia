'use strict';
/* A stand-in for the page's canvases, for the tests of the pictures: the same js files the page loads, run in a VM context whose canvas is a
 * recorder. It notes the rectangles painted on it and the pictures drawn onto it (by what they are), and shrugs at the rest, and its address (toDataURL) is a hash of what was painted and how
 * many rectangles there were, so that two pictures can be told apart, or found the same, without a browser. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const RECORDER = `
const hash = s => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (b >>> 0).toString(16) + (a >>> 0).toString(16); };
function rec() {
  const calls = [];
  const g = { fillStyle: '#000', globalAlpha: 1, fillRect(x, y, w, h) { calls.push([x, y, w, h, this.fillStyle]); }, drawImage(img, ...a) { calls.push(['image', img && img.toDataURL ? img.toDataURL() : '', ...a]); }, createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), measureText: s => ({ width: 6 * String(s).length }) };
  return { g: new Proxy(g, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }), calls };
}
const document = { createElement: () => { const { g, calls } = rec(); return { width: 0, height: 0, getContext: () => g, toDataURL: () => 'data:' + hash(JSON.stringify(calls)) + '-' + calls.length }; } };
`;
/**
 * Loads these scripts of the game (names under js/, in the order the page loads them) into a fresh context, and returns a function that runs code in it.
 * setup, if given, is called with the context once the recording canvas is in it and before any script runs, to put more of a page there (see dom-stub.js).
 */
function load(files, setup) {
  const ctx = vm.createContext({});
  vm.runInContext(RECORDER, ctx);
  if (setup) setup(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: 'js/' + f + '.js' });
  return code => vm.runInContext(code, ctx);
}
// Values built inside the VM have its own Array and Object, which strict equality treats as different types.
const plain = (r, code) => JSON.parse(r('JSON.stringify(' + code + ')'));
module.exports = { load, plain };
