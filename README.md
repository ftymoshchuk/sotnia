# Sotnia

A small strategy game about a free company of mercenaries in 1633. You take a commission to carry a cargo across the real lands of the year: salt from the Sea of Azov to the Leipzig fair, oxen from Podolia to Breslau, rye down the Vistula to Danzig, or the Crown's payroll to the army before Smolensk. Each has a day it must arrive by. Hire pikemen, musketeers and sabreurs; feed them every day and pay them every month; choose your roads; and fight whatever falls on the train, watching each fight play out on a pixel-art field and changing your orders as it goes.

It began as a single-file prototype built as a Claude artifact and moved here for further development.

## Running it

The game is written in TypeScript (`src/`) and compiled to the plain scripts in `js/`, which are committed, so there is nothing to build to play it. Open `index.html` in a browser, or serve the folder and visit http://localhost:8000:

```bash
python3 -m http.server 8000
```

- Fonts load from Google Fonts. Offline, the page falls back to local serif fonts.
- The campaign and the sound and music settings are kept in the browser's `localStorage` (`sotnia-save-2`, `sotnia-sound`, `sotnia-music`), separately for each origin.
- Because it is all static files, GitHub Pages can host it as is.

## Changing it

Edit the TypeScript in `src/`, never the scripts in `js/`. TypeScript is the only dependency, and it is needed only to build:

```bash
npm install         # once
npm run build       # compile src/*.ts to js/*.js, then commit both
npm run typecheck   # check the types without writing anything
```

`js/` is committed on purpose, so the game runs from a clone, from `file://` and from GitHub Pages with no build. CI rebuilds it and fails if the committed copy differs, so a change to `src/` that was never built cannot merge. Upgrading TypeScript can change how `js/` is printed: run `npm run build` on the upgrade's branch and commit the result.

## Layout

| File | Contents |
| --- | --- |
| `index.html` | Page shell: fonts, stylesheet, the `#view` and `#modal` mount points, and the scripts in load order |
| `css/sotnia.css` | All styles, with the colour and type tokens on `:root`: walnut and gilt for the game's bars, parchment cards on a dark table |
| `src/core.ts` | The rules of the company, with no DOM: troop classes, origins, traits, soldiers, economy, contracts, the battle simulation, scouting odds, aftermath and camp events |
| `src/journey.ts` | The rules of the road, with no DOM: the calendar, the lands, places and roads of 1633, quests, travel days, cargo, ambushes, selling and delivery |
| `src/geo.ts` | Coastlines and rivers for the map (drawing data only) |
| `src/art.ts` | Palette, pixel sprites (standing, sitting, lying, foraging, and the baggage train's people), the woodcut backdrop, the battlefield and its particles, the camp at night, the pictures on the cards, and the map |
| `src/music.ts` | The music engine, which knows nothing of the game: it reads a score, composes as it plays and synthesises every note with Web Audio (there are no recordings) |
| `src/score.ts` | The game's music, written out: the journey's pieces, the muster, the fight and the flourishes after it |
| `src/audio.ts` | Sound effects, and starting the right music for each screen |
| `src/icons.ts` | The icon set (`ICON`, drawn on a 24-unit square) and `ic()`, which writes one as markup |
| `src/screens.ts` | Shared state (`G` is the campaign, `ui` is the interface), saving, the card component, and the HTML for every screen |
| `src/main.ts` | Click and key handling, the frame loop and boot |
| `js/` | The scripts the page loads, one for each file in `src/`, written by `npm run build`. Generated: never edited by hand |
| `package.json`, `tsconfig.json` | TypeScript, the only dependency, and the compiler settings: strict, with every file a script (see below) |
| `tests/` | Headless tests of the rules and the music (they load the compiled `js/`), and the guard that keeps every workflow action pinned |
| `.github/` | CI, which ends in the `ci-passed` check, and Dependabot for the action pins and TypeScript |
| `docs/default-branch.ruleset.json` | The branch rules for `main` |
| `scripts/apply-ruleset.sh` | Puts those rules on the repository, and checks them |

The sources are TypeScript *scripts*, not ES modules: no `import` or `export`, one global scope, loaded as plain `<script>` tags in the order `index.html` lists them. `tsc` only erases the types, so each `src/x.ts` becomes a `js/x.js` that is the same program, which keeps the game runnable straight from `file://` with no bundler. (`tsconfig.json` sets `erasableSyntaxOnly`, so `tsc` refuses the few TypeScript features that would emit code of their own.) Top-level code in a file can only use what earlier files declare; functions can call anything, since they run after every file has loaded. Top-level `interface`s and `type`s are global too, so none may be named like a browser type (`Event`, `Node`, `Text`, …): it would merge with the browser's silently.

Keep `src/core.ts` and `src/journey.ts` free of DOM access. The scouts' odds come from running the battle simulation headless, dozens of times per estimate, and the same separation lets whole journeys be simulated outside a browser to check the balance. `src/music.ts` and `src/score.ts` likewise touch nothing until they are asked to play, so the composing is tested the same way.

### Where things live

- **Quests:** `QUESTS` in `src/journey.ts`: start, destination, dates, cargo, price or fee, and the starting company and purse.
- **The map:** `PLACES` (with their land and what they offer) and `ROADS` (with their danger) in `src/journey.ts`. Coastlines and rivers are in `src/geo.ts`, and `drawMap()` in `src/art.ts` draws it all.
- **The road:** march speeds and cargo losses in `TRANSPORT`, ambush rates in `AMBUSH_RATE`, and who you meet in each land in `LANDS` and `AMBUSHES` (all in `src/journey.ts`).
- **Balance:** unit stats in `CLS`, contract templates in `TEMPLATES` with difficulty in `makeContract`, and prices and wages in the economy section of `src/core.ts`. Contracts and ambushes grow harder as the company nears its goal (`threat()` in `src/journey.ts`).
- **Battle behaviour:** `stepBattle`, `strike`, `fire` and `moraleTick` in `src/core.ts`.
- **Camp events:** add entries to `EVENTS` in `src/core.ts`. Give each choice an `fx` list of `[icon, amount, what]` as well as its `hint`: the dialog shows those as chips, and falls back to the hint where there are none.
- **The look:** every man, recruit, supply, job, member of the baggage train, opening order and fallen man is a card, built by `cardHTML()` in `src/screens.ts`: a name banner, a picture, the body, and a type bar coloured by kind, with the price or wage on a coin at its left. Icons stand in for words wherever a number says enough; the word stays for screen readers and on hover.
- **The camp:** `campPlan()` in `src/art.ts` puts each man where his order sends him (by the fire to rest, the drill yard, out foraging, or abed by the tent), and `drawCamp()` draws the night, the fire and the men walking between places. The slots are in `CAMP`.
- **Music:** what plays is in `src/score.ts`: each piece's ground, tunes and figures, and the cues that say which pieces play on which screen and how loud each cue is against the others. `MUSIC_LEVEL` in `src/audio.ts` sets the loudness of all of it, and the instruments are `SOUNDS` in `src/music.ts`. See [Music](#music).
- **Saves:** the state built by `newGame()` carries `v: 2`, and `loadSave()` ignores any other version. Bump it when the shape of the state changes, so old saves are dropped instead of loading broken.

## Checks and branch rules

CI installs TypeScript, type-checks `src/`, rebuilds `js/` and fails if it differs from the committed copy, checks that every script parses, and runs the tests, with Node 22. Run the same thing locally:

```bash
npm ci
npm run typecheck
npm run build && git status --short js/   # nothing listed: js/ was up to date
for f in js/*.js; do node --check "$f"; done
npm test
```

`tests/journey.test.js` loads the compiled `js/core.js` and `js/journey.js` into a VM with a seeded random, checks that the map's places, roads and quests fit together, and plays every quest through to delivery with a simple player. A change that breaks the rules or leaves a quest impossible fails there before anyone has to play it.

`tests/music.test.js` does the same for the music. It reads the score and composes half an hour of road music, then checks that:

- every note is one its instrument can play;
- the same seed always plays the same music;
- nothing long comes round again soon;
- the music rests between pieces.

It also plays every cue for ten minutes against `tests/webaudio-stub.js`, a stand-in for Web Audio that throws wherever a browser would. In the game a throw from the music would only mean silence, so it is caught here instead.

`main` carries the same branch ruleset as the Sigrix public repositories (see `docs/new-repository.md` in `sigrix-io/actions`):

- `main` cannot be deleted or force-pushed.
- Every change lands through a pull request. No approvals are required, because a single maintainer can't approve their own pull requests.
- The one required check is `ci-passed`, the last CI job, so adding a job never means editing the rules. A branch has to be up to date with `main` before it merges.
- The repository admin can merge past a broken check, but only through a pull request.
- A branch is deleted once its pull request merges. That is a repository setting rather than part of the ruleset.

The only difference from the Sigrix ruleset is the bypass: this repository belongs to a person, not the org, so it goes to the repository admin role rather than a team. The rules live in repository settings, where nothing reviews them, so the JSON in `docs/` is the reviewed copy. With the GitHub CLI signed in as the owner, run from the repository root:

```bash
scripts/apply-ruleset.sh
```

It also turns on the branch deletion. It never creates a second ruleset, since rulesets stack: if one exists, it leaves it alone. `scripts/apply-ruleset.sh --verify` prints what is in force.

## Music

The music is composed as it plays. `src/score.ts` writes it out as data: a piece is a ground of the time (a chord a bar), tunes over it, and figures for the lute. `src/music.ts` arranges each piece afresh each time it comes round:

- who carries the tune (recorder, viol or lute);
- whether it is ornamented, thinned or moved an octave;
- which figures the lute plays;
- whether the bass viol and the drone come in.

The chords are voice-led from bar to bar, each piece ends by echoing its last bars, softly and slowing, and the road rests for 8 to 20 seconds between pieces. Camp and the road go through a folia, a lament on the falling fourth, a cossack duma and a Polish dance, never the same one twice running. The muster and the fight move from section to section for as long as they last.

The instruments are built the way Pageant builds its music bed ([sigrix-io/pageant](https://github.com/sigrix-io/pageant), `src/pageant/music.py`):

- each tone is a few harmonics, with soft envelopes;
- each instrument has a gentle low-pass;
- a room of decaying noise sits over all of it.

Pageant's own pad, bass and pluck are in `SOUNDS`, with its numbers.

`MUSIC.render()` renders a cue outside the game, faster than it plays, and resolves to an `AudioBuffer`. To hear two minutes of road music, run this in the browser console on the game's page:

```js
const ac = new AudioContext(), src = ac.createBufferSource();
src.buffer = await MUSIC.render(SCORE, 'camp', 120, { seed: 1, level: 0.1 });
src.connect(ac.destination); src.start();
```

## Data

Coastlines come from Natural Earth's 1:50m land, which is in the public domain. Dates are shown in both calendars of the time: Gregorian, kept in Catholic Poland, and Julian, ten days behind, kept in Saxony and Orthodox Ukraine.

## History

The first commit holds the artifact's HTML exactly as exported, so the original is always one command away:

```bash
git show $(git rev-list --max-parents=0 HEAD):index.html > sotnia-original.html
```

The next commit split that file into separate files without changing the code. After that, the 24-day campaign and its final battle with the Black Regiment gave way to the journey ([issue 1](https://github.com/ftymoshchuk/sotnia/issues/1)). The Black Regiment is meant to come back as a set piece on the road.

`src/main.ts` still checks for `window.claude.hot`. That only exists inside the Claude artifact runtime, where it keeps the campaign across hot reloads. Everywhere else it is absent and the game boots normally.
