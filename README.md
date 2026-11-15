# Sotnia

A small strategy game about a free company of mercenaries in 1633. You take a commission to carry a cargo across the real lands of the year: salt from the Sea of Azov to the Leipzig fair, oxen from Podolia to Breslau, rye down the Vistula to Danzig, or the Crown's payroll to the army before Smolensk. Each has a day it must arrive by. Hire pikemen, musketeers and sabreurs; feed them every day and pay them every month; choose your roads; and fight whatever falls on the train, watching each fight play out on a pixel-art field and changing your orders as it goes.

It began as a single-file prototype built as a Claude artifact and moved here for further development.

## Running it

There is no build step and there are no dependencies. Open `index.html` in a browser, or serve the folder and visit http://localhost:8000:

```bash
python3 -m http.server 8000
```

- Fonts load from Google Fonts. Offline, the page falls back to local serif fonts.
- The campaign and the sound and music settings are kept in the browser's `localStorage` (`sotnia-save-2`, `sotnia-sound`, `sotnia-music`), separately for each origin.
- Because it is all static files, GitHub Pages can host it as is.

## Layout

| File | Contents |
| --- | --- |
| `index.html` | Page shell: fonts, stylesheet, the `#view` and `#modal` mount points, and the scripts in load order |
| `css/sotnia.css` | All styles, with the colour and type tokens on `:root` |
| `js/core.js` | The rules of the company, with no DOM: troop classes, origins, traits, soldiers, economy, contracts, the battle simulation, scouting odds, aftermath and camp events |
| `js/journey.js` | The rules of the road, with no DOM: the calendar, the lands, places and roads of 1633, quests, travel days, cargo, ambushes, selling and delivery |
| `js/geo.js` | Coastlines and rivers for the map (drawing data only) |
| `js/art.js` | Palette, pixel sprites, the woodcut backdrop, the battlefield and its particles, and the map |
| `js/audio.js` | Sound effects and music, synthesised with Web Audio (there are no recordings) |
| `js/screens.js` | Shared state (`G` is the campaign, `ui` is the interface), saving, and the HTML for every screen |
| `js/main.js` | Click and key handling, the frame loop and boot |
| `tests/` | Headless tests of the rules, and the guard that keeps every workflow action pinned |
| `.github/` | CI, which ends in the `ci-passed` check, and Dependabot for the action pins |
| `docs/default-branch.ruleset.json` | The branch rules for `main` |
| `scripts/apply-ruleset.sh` | Puts those rules on the repository, and checks them |

The scripts are plain `<script>` tags, not ES modules. They share one global scope and must load in the order `index.html` lists them, which keeps the game runnable straight from `file://` with no tooling. Top-level code in a file can only use what earlier files declare; functions can call anything, since they run after every file has loaded.

Keep `js/core.js` and `js/journey.js` free of DOM access. The scouts' odds come from running the battle simulation headless, dozens of times per estimate, and the same separation lets whole journeys be simulated outside a browser to check the balance.

### Where things live

- **Quests:** `QUESTS` in `js/journey.js`: start, destination, dates, cargo, price or fee, and the starting company and purse.
- **The map:** `PLACES` (with their land and what they offer) and `ROADS` (with their danger) in `js/journey.js`. Coastlines and rivers are in `js/geo.js`, and `drawMap()` in `js/art.js` draws it all.
- **The road:** march speeds and cargo losses in `TRANSPORT`, ambush rates in `AMBUSH_RATE`, and who you meet in each land in `LANDS` and `AMBUSHES` (all in `js/journey.js`).
- **Balance:** unit stats in `CLS`, contract templates in `TEMPLATES` with difficulty in `makeContract`, and prices and wages in the economy section of `js/core.js`. Contracts and ambushes grow harder as the company nears its goal (`threat()` in `js/journey.js`).
- **Battle behaviour:** `stepBattle`, `strike`, `fire` and `moraleTick` in `js/core.js`.
- **Camp events:** add entries to `EVENTS` in `js/core.js`.
- **Music:** `CUES` in `js/audio.js`.
- **Saves:** the state built by `newGame()` carries `v: 2`, and `loadSave()` ignores any other version. Bump it when the shape of the state changes, so old saves are dropped instead of loading broken.

## Checks and branch rules

CI checks that every script parses and runs the tests, with Node 22 and no npm install. Run the same thing locally:

```bash
for f in js/*.js; do node --check "$f"; done
node --test tests/*.test.js
```

`tests/journey.test.js` loads `js/core.js` and `js/journey.js` into a VM with a seeded random, checks that the map's places, roads and quests fit together, and plays every quest through to delivery with a simple player. A change that breaks the rules or leaves a quest impossible fails there before anyone has to play it.

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

## Data

Coastlines come from Natural Earth's 1:50m land, which is in the public domain. Dates are shown in both calendars of the time: Gregorian, kept in Catholic Poland, and Julian, ten days behind, kept in Saxony and Orthodox Ukraine.

## History

The first commit holds the artifact's HTML exactly as exported, so the original is always one command away:

```bash
git show $(git rev-list --max-parents=0 HEAD):index.html > sotnia-original.html
```

The next commit split that file into separate files without changing the code. After that, the 24-day campaign and its final battle with the Black Regiment gave way to the journey ([issue 1](https://github.com/ftymoshchuk/sotnia/issues/1)). The Black Regiment is meant to come back as a set piece on the road.

`js/main.js` still checks for `window.claude.hot`. That only exists inside the Claude artifact runtime, where it keeps the campaign across hot reloads. Everywhere else it is absent and the game boots normally.
