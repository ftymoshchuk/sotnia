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
| `src/art.ts` | Palette, the woodcut backdrop, the battlefield and its particles, the camp at night, the pictures on the cards, and the map |
| `src/figures.ts` | Every man, hired hand and foe, drawn at twice the pixels of the scene around him and dressed in the weapon and armour he has bought; the pictures of gear for the cards; and the call that puts a scene on the screen |
| `src/music.ts` | The music engine, which knows nothing of the game: it reads a score, composes as it plays and synthesises every note with Web Audio (there are no recordings) |
| `src/score.ts` | The game's music, written out: the journey's pieces, the muster, the fight and the flourishes after it |
| `src/audio.ts` | Sound effects, and starting the right music for each screen |
| `src/icons.ts` | The icon set (`ICON`, drawn on a 24-unit square) and `ic()`, which writes one as markup |
| `src/screens.ts` | Shared state (`G` is the campaign, `ui` is the interface), saving, the card component, and the HTML for every screen |
| `src/main.ts` | Click and key handling, the frame loop and boot |
| `js/` | The scripts the page loads, one for each file in `src/`, written by `npm run build`. Generated: never edited by hand |
| `package.json`, `tsconfig.json` | TypeScript, the only dependency, and the compiler settings: strict, with every file a script (see below) |
| `tests/` | Headless tests of the rules, the music and the figures (they load the compiled `js/`), and the guard that keeps every workflow action pinned |
| `.github/` | CI, which ends in the `ci-passed` check, and Dependabot for the action pins and TypeScript |
| `docs/figures.html` | A sheet of every figure, weapon and piece of armour, drawn by the game's own scripts: open it after `npm run build`, or with `?zoom=6` for larger pixels |
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
- **Kit:** each man has a weapon level and an armour level, `wpn` and `arm`, from 0 to 3. Their names are `WPN` (for each class) and `ARM`, their prices `GEAR_COST`, and `upgrade()` buys the next level. The levels change what he does in a fight (`wpn` adds to the damage of his blows, `arm` to the armour that turns them) and what he looks like: see [Figures](#figures). A card shows each slot as a ladder of its four pieces (`gearHTML()` in `src/screens.ts`), and shows the man in the next piece while its button is under the pointer. Foes wear the gear of their tier.
- **The camp:** `campPlan()` in `src/art.ts` puts each man where his order sends him (by the fire to rest, the drill yard, out foraging, or abed by the tent), and `drawCamp()` draws the night, the fire and the men walking between places. The slots are in `CAMP`.
- **Music:** what plays is in `src/score.ts`: each piece's ground, tunes and figures, and the cues that say which pieces play on which screen and how loud each cue is against the others. `MUSIC_LEVEL` in `src/audio.ts` sets the loudness of all of it, and the instruments are `SOUNDS` in `src/music.ts`. See [Music](#music).
- **Saves:** the state built by `newGame()` is a `Campaign` (in `src/journey.ts`) and carries `v: 2`, and `loadSave()` ignores any other version. Bump it when the shape of `Campaign` changes, so old saves are dropped instead of loading broken.
- **Types:** each shape the game passes around is named beside the code that builds it: `Soldier`, `Battle`, `Contract` and `CampEvent` in `src/core.ts`; `Place`, `Road`, `Quest` and the saved `Campaign` in `src/journey.ts`; the interface's `UiState` in `src/screens.ts`; the format of a `Score` in `src/score.ts`. Ids are unions of strings and the lookup tables are `Record`s over them, so a misspelt place, land or troop class fails to compile. The campaign global `G` is `Campaign | null`, since it is null on the title screen, which is why the screens write `G!`.

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

`tests/figures.test.js` loads the figures against a canvas that records each rectangle painted, which is enough to check that:

- every level of weapon and of armour changes a man's picture, in every class and in every pose where the weapon is in his hand;
- every pose, in every kit, fits the frame the cards and the field leave for it;
- a man who faces left is exactly the mirror of one who faces right, and the same man is drawn the same each time;
- the pictures of gear differ at every level, and a battle unit and a line of the report carry the gear the picture shows.

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

## Figures

`src/figures.ts` draws every man. A figure has twice the pixels of the scene it stands in (`SS`, so a man is about 40 pixels tall where he used to be 18), which is room for a buckle, the lock of a musket and the comb of a helmet. The woodcut backdrops keep their coarse pixels and the men stand in front of them. A scene that holds figures keeps a canvas `SS` times larger, made by `sceneCanvas()`, whose context is scaled so that the scene's own coordinates draw as before; the field, the camp and every card picture are made so. `present()` puts such a buffer on the screen, blowing it up by a whole number before shrinking it the rest of the way, so that its pixels are all the same size on a screen that is not a whole number of times as big.

A figure is layers, drawn from the feet up in pixels from his feet (x forward, y up as a negative number), so that a man who faces left is the same drawing mirrored: legs, the coat and whatever armour he wears over it (`torso()`), his head, what is on it (`hat()`), his weapon, and his arms. `drawSoldier()` is given what he is (`cls`, his livery `skin`), what he has (`wpn`, `arm`, levels 0 to 3), which man he is (`man`, which settles his hair and moustache), and what he is doing (`mode`, `moving`, `swing`, `flash`; see `SoldierLook` in `src/art.ts`). `drawCamper()` adds the poses of camp, and `drawCivilian()` the hired hands.

What each level looks like:

| Level | Armour | Pike | Musket | Sabre |
| --- | --- | --- | --- | --- |
| 0 | Linen shirt, in the company's colour | Ash pike, a small leaf of iron | Old arquebus: short, dark, a bare serpentine | Notched sabre, dull iron |
| 1 | Buff coat; the company's colour moves to the sleeves and a sash | Ironbound pike: a longer head, straps down the shaft | Matchlock musket: banded barrel, ramrod, a glowing match | Hungarian sabre: steel, with a knuckle bow |
| 2 | Breastplate and gorget, a brass belt buckle | Partisan: a broad blade with lugs, and a tassel | Dutch musket: the longest, in walnut with brass | Karabela: a brighter blade, the bird's-head pommel |
| 3 | Cuirass, shoulder plates and tassets, and the plume of the finest hat | Master's halberd: an axe blade, a spike and a beak, gilt | Wheel-lock: shorter, black and gilt, a steel wheel and no match | Damascened sabre: streaked steel, a gilt hilt and a tassel |

Hats grow with the armour too: a pikeman's morion gains a brass band and, at the top, a plume; a musketeer's hat a bigger plume, a brooch and a gilt band; a sabreur's cap a clasp and a feather. A musketeer in armour wears a flask of powder where a lighter man has his bandolier.

To add a level or change one, edit the part for its class (`musketArt()`, `pikeArt()` or `sabreArt()` in the frame of the weapon itself: `a` runs along it from the butt and `c` across it, so one drawing serves a musket held level and held upright) or `torso()`. To add a pose, add a branch to `drawSoldier()`; the figure tests then draw it in every kit and check that it fits. `gearArt()` draws the pictures of weapons and armour that the cards show in their ladders, from the same code. Open `docs/figures.html` to see everything at once.

## Data

Coastlines come from Natural Earth's 1:50m land, which is in the public domain. Dates are shown in both calendars of the time: Gregorian, kept in Catholic Poland, and Julian, ten days behind, kept in Saxony and Orthodox Ukraine.

## History

The first commit holds the artifact's HTML exactly as exported, so the original is always one command away:

```bash
git show $(git rev-list --max-parents=0 HEAD):index.html > sotnia-original.html
```

The next commit split that file into separate files without changing the code. After that, the 24-day campaign and its final battle with the Black Regiment gave way to the journey ([issue 1](https://github.com/ftymoshchuk/sotnia/issues/1)). The Black Regiment is meant to come back as a set piece on the road.

Then the scripts became TypeScript: written in `src/` under `strict`, and compiled to the `js/` files the page loads. Nothing a player can see was meant to change, and three checks say nothing did. Each compiled script has the same syntax tree as the JavaScript it replaced (the comparison ignores layout and comments, but not a single name, operator or literal). Every comment of the original survives into `js/`. And a browser run that clicked through 1,600 steps of the old game, with fights, marches, trading and the map, is reproduced step for step by the new one. The last hand-written JavaScript is at `git show bca68a2:js/core.js`, and likewise for the other nine scripts.

After that the men were redrawn at twice the pixels, and dressed in the weapon and armour they have bought: until then the rules had levels of gear but the picture never showed them. See [Figures](#figures).

`src/main.ts` still checks for `window.claude.hot`. That only exists inside the Claude artifact runtime, where it keeps the campaign across hot reloads. Everywhere else it is absent and the game boots normally.
