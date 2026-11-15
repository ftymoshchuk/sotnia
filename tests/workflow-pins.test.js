'use strict';
/* Every action the workflows run is pinned to a commit. This is what notices if
 * one stops being.
 *
 * A tag such as `@v7` is moved by whoever owns the action, so the code that ran
 * could change with nothing here recording it. Pinning the commit closes that,
 * and the `github-actions` entry in .github/dependabot.yml keeps the pins
 * current. Dependabot reads the `# vX.Y.Z` comment beside each SHA to know what
 * it is bumping from, so a pin written without one goes quietly stale. Both
 * halves are asserted below.
 *
 * Read as text rather than parsed: the assertions are about how the reference
 * is written, which a YAML loader normalises away. This is the guard from
 * sigrix-io/gatehouse (tests/workflow_pins.test.js), on Node's own test runner,
 * since this repository has no npm dependencies. */
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const WORKFLOWS_DIR = path.join(__dirname, '..', '.github', 'workflows');
const WORKFLOWS = fs.readdirSync(WORKFLOWS_DIR).filter(name => name.endsWith('.yml')).sort();

/* `uses: owner/action@<ref>`, with whatever trailing comment. */
const USES = /uses:\s*(\S+)@(\S+)(?:\s*#\s*(\S+))?/g;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

const referencesIn = text => [...text.matchAll(USES)].map(([, action, ref, comment]) => ({ action, ref, comment: comment || '' }));
const references = () => WORKFLOWS.flatMap(workflow =>
  referencesIn(fs.readFileSync(path.join(WORKFLOWS_DIR, workflow), 'utf8')).map(found => ({ workflow, ...found })));

test('matches the way these workflows write a reference', () => {
  // Guards the guard: a pattern matching nothing would pass every test below.
  assert.deepEqual(referencesIn('      - uses: actions/checkout@v6\n'), [{ action: 'actions/checkout', ref: 'v6', comment: '' }]);
  assert.deepEqual(referencesIn('- uses: a/b@abc # v1.2.3\n'), [{ action: 'a/b', ref: 'abc', comment: 'v1.2.3' }]);
  assert.ok(WORKFLOWS.length > 0);
  assert.ok(references().length > 0);
});

test('pins every action to a commit', () => {
  const floating = references().filter(({ ref }) => !COMMIT_SHA.test(ref)).map(({ workflow, action, ref }) => `${workflow}: ${action}@${ref}`);
  assert.deepEqual(floating, [], 'a tag is mutable and a branch moves on its own; pin the 40-character commit');
});

test('says which release each pin is', () => {
  // A bare SHA is safe and unreadable. The comment is what a reviewer reads,
  // and what Dependabot rewrites when it bumps the pin.
  const unnamed = references().filter(({ comment }) => !/^v\d+\.\d+(\.\d+)?$/.test(comment)).map(({ workflow, action, comment }) => `${workflow}: ${action} # ${comment}`);
  assert.deepEqual(unnamed, [], 'write the release it is, as `# v6.1.0`');
});
