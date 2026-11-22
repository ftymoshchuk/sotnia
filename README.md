# Sotnia

A small strategy game about a free company of mercenaries in 1633. You take a commission to carry a cargo across the real lands of the year: salt from the Sea of Azov to the Leipzig fair, oxen from Podolia to Breslau, rye down the Vistula to Danzig, or the Crown's payroll to the army before Smolensk. Each has a day it must arrive by. Hire pikemen, musketeers and sabreurs; feed them every day and pay them every month; choose your roads; and fight whatever falls on the train, watching each fight play out on a pixel-art field and changing your orders as it goes.

It began as a single-file prototype built as a Claude artifact and moved here for further development.

## Running it

The game is written in TypeScript (`src/`) and compiled to the plain scripts in `js/`, which are committed, so there is nothing to build to play it. Open `index.html` in a browser, or serve the folder and visit http://localhost:8000:

```bash
python3 -m http.server 8000
```

- Fonts load from Google Fonts. Offline, the page falls back to local serif fonts.
- The campaign and the sound and music settings are kept in the browser's `localStorage` (`sotnia-save-3`, `sotnia-sound`, `sotnia-music`), separately for each origin.
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
| `index.html` | Page shell: fonts, stylesheet, the `#view`, `#panel`, `#modal` and `#tip` mount points, and the scripts in load order |
| `css/sotnia.css` | All styles, with the colour and type tokens on `:root` (the dyes of the game's ramps and its four typefaces): plaques on a calm plank table, one notched two-pixel line for every edge, paper for documents (see [The look](#the-look)) |
| `src/core.ts` | The rules of the company, with no DOM: troop classes, origins, traits, soldiers, economy, contracts, the battle simulation (with the captain's order), scouting odds, aftermath and camp events |
| `src/command.ts` | Who leads the company, with no DOM: the captains, the four posts and the men who hold them, the retainers, the places that open with renown, and `effectsOf()`, which adds up what they all change for the rules to read |
| `src/journey.ts` | The rules of the road, with no DOM: the calendar, the lands, places and roads of 1633, quests, travel days, cargo, ambushes, selling and delivery |
| `src/geo.ts` | Coastlines and rivers for the map (drawing data only) |
| `src/art.ts` | Palette, the battlefield and its particles, the camp (the night it is drawn at, and the light of a day passing over it), the pictures on the cards, and the map |
| `src/figures.ts` | Every man, officer, retainer and foe, drawn at twice the pixels of the scene around him and dressed in the colours of his nation and the weapon and armour he has bought; the pictures of gear for the cards; and the call that puts a scene on the screen |
| `src/terrain.ts` | The scenery behind a fight, drawn as finely as the figures: the hills, trees, buildings and ground of each land in each weather, the places a piece of work can put a fight at, and the skyline the camp stands against by night |
| `src/music.ts` | The music engine, which knows nothing of the game: it reads a score, composes as it plays and synthesises every note with Web Audio (there are no recordings) |
| `src/score.ts` | The game's music, written out: the journey's pieces, the muster, the fight and the flourishes after it |
| `src/audio.ts` | Sound effects, and starting the right music for each screen |
| `src/icons.ts` | The icon set (`ICON`: pixel pictures, eight by eight, in a few colours), the one hidden sprite they are drawn from, and `ic()`, which writes a use of one as markup |
| `src/screens.ts` | Shared state (`G` is the campaign, `ui` is the interface), saving, the card component, and the HTML for every screen: the camp as the hub, the pages of the company's business that open over it, the command page, and the choice of a captain |
| `src/encyclopedia.ts` | The encyclopedia: the nations, the units with their weapons and armour, the foes, the lands, the captains, officers and retainers, and the goods, read out of the game's own tables, with the few words those tables do not hold |
| `src/main.ts` | Click and key handling, the notes on hover, the days going by over the camp, the frame loop and boot |
| `js/` | The scripts the page loads, one for each file in `src/`, written by `npm run build`. Generated: never edited by hand |
| `package.json`, `tsconfig.json` | TypeScript, the only dependency, and the compiler settings: strict, with every file a script (see below) |
| `tests/` | Headless tests of the rules, the command, the music, the figures, the terrain, the encyclopedia and the page's clicks (they load the compiled `js/`; the last runs against `tests/dom-stub.js`, a stand-in for the page), and the guard that keeps every workflow action pinned |
| `.github/` | CI, which ends in the `ci-passed` check, and Dependabot for the action pins and TypeScript |
| `docs/figures.html` | A sheet of every figure, weapon and piece of armour, drawn by the game's own scripts: open it after `npm run build`, or with `?zoom=6` for larger pixels |
| `docs/lands.html` | A sheet of every land in every weather, the sites a fight can be fought at, and the camp's skylines by night, drawn the same way; `?zoom=2` for larger |
| `docs/style.html` | The style sheet: the palette ramps, the four typefaces, a card, a notice, tags, buttons, meters and every icon, drawn with the game's own stylesheet and `js/icons.js` |
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
- **Camp events:** add entries to `EVENTS` in `src/core.ts`. Give each choice an `fx` list of `[icon, amount, what]` (and, where the sign would mislead, a tone: a price that falls is good news) as well as its `hint`: the dialog shows those as chips, and falls back to the hint where there are none. The events in which a retainer asks for a place are made from `RETAINERS` in `src/command.ts`, and `eventOf()` finds any of them by id.
- **The look:** every man, recruit, supply, job, captain, officer, retainer, opening order and fallen man is a card, built by `cardHTML()` in `src/screens.ts`: a name over a rule in the colour of its kind, a picture in a dark window, the body, and a foot with what it is and the price or wage on a small bronze plate. Icons stand in for words wherever a number says enough; the word stays for screen readers and on hover. The rules of the style are under [The look](#the-look).
- **Kit:** each man has a weapon level and an armour level, `wpn` and `arm`, from 0 to 3. Their names are `WPN` (for each class) and `ARM`, their prices `GEAR_COST`, and `upgrade()` buys the next level. The levels change what he does in a fight (`wpn` adds to the damage of his blows, `arm` to the armour that turns them) and what he looks like: see [Figures](#figures). A card shows each slot as a ladder of its four pieces (`gearHTML()` in `src/screens.ts`), and shows the man in the next piece while its button is under the pointer. Foes wear the gear of their tier.
- **Nations:** every man of the company is dressed as his nation, the `Origin` he was raised from. `NATIONS` in `src/figures.ts` gives each its colours, its legs and boots, what it wears on its head, and the one thing in its dress that no other nation has (see [Figures](#figures)). The same table dresses the foes who are a people of their own, by their skins: `swede`, `imperial`, `muscovite`, `tatar` and `croat`. A card shows the colours of a man's country as a little flag before the name of his nation (`flagOf()`).
- **The encyclopedia:** `codexHTML()` in `src/encyclopedia.ts` builds its six tabs (nations, units, foes, lands, command, goods) out of the tables the rules run on (`ORIGINS`, `CLS`, `WPN`, `ARM`, `GEAR_COST`, `TRAITS`, `AMBUSHES`, `TEMPLATES`, `TIER`, `CAPTAINS`, `SPECIALTIES`, `RETAINERS`, `FAITHS`, `ORDERS`, `QUESTS`, `LANDS`, `PLACES`, `SITE_OF`, the weather's constants, and `NATIONS` for dress), so a nation, a weapon or a foe added to a table turns up on its page by itself. The words the tables lack are `NATION_TEXT`, `FOE_TEXT`, `LAND_TEXT`, `SITE_TEXT` and `WEATHER_TEXT`, `Record`s over the ids, so one left out fails to compile. The numbers of the gear rules are named constants in `src/core.ts` (`WPN_BLOW`, `WPN_BALL`, `ARM_PLATE`, `BALL_DMG`) that the battle and the page both read, so they cannot disagree. Its pictures are `nationArt()`, `unitArt()`, `classArt()`, `armourArt()` and `peopleArt()` in `src/art.ts`. It opens from the title's button or the book in the top bar (never in a battle); Esc or its back button return to the screen it was opened from, and `#encyclopedia`, `#encyclopedia-units`, `-foes`, `-lands`, `-command` and `-goods` link to a tab.
- **Terrain:** the scenery behind a fight is the land it is fought in. A contract and an ambush carry their `land` (the company's place stands for it in a contract saved before they did), and `settingOf()` in `src/terrain.ts` turns one into a `Setting`: the land, and the site its work names (`SITE_OF`). `TONES`, `LAND_ART` and `SITE_ART` hold the colours, the drawing of each land and of each site, `Record`s over the ids, so a land or a site added without its drawing fails to compile (and `LAND_TEXT`, `SITE_TEXT` and the homes of nations and peoples in `src/encyclopedia.ts` likewise). `PROPS` are the things that stand in a land, and `makeBackdrop()` draws the lot. See [Terrain](#terrain).
- **The weather:** `WEATHER_ODDS`, `MISFIRE`, `MUSKET_RANGE` and `FOG_AIM` in `src/core.ts` are what the day's weather does to a fight and how often each is dealt; the battle plays by them and the encyclopedia quotes them. How a weather looks is `weatherTone()` and `weatherArt()` in `src/terrain.ts`, and the rain and the moving fog drawn over the field as it is played, `drawField()` in `src/art.ts`.
- **The camp:** `campPlan()` in `src/art.ts` puts each man where his order sends him (by the fire to rest, the drill yard, out foraging, or abed by the tent), and `drawCamp()` draws the night, the fire and the men walking between places. The slots are in `CAMP` (which also has the captain's, each officer's and the retainer's), and the skyline is the land's (`skylineOf()`). The camp is the hub of the game: see [The camp as the hub](#the-camp-as-the-hub).
- **Command:** `src/command.ts` holds who leads the company. `CAPTAINS` (a perk, a flaw and an order each, three offered by `genCaptains()` when a banner is raised), `SPECIALTIES` (the five kinds of man for each of the four posts in `STATIONS`, with their fee, wage, the nations they come from and what they change; a chaplain has a `FAITHS` entry instead, which lifts the spirits of the nations that share it), `RETAINERS` and `OFFICER_RENOWN` (the renown at which each place opens). Everything a person does is a `Mod` (a key of `MODS` and a number), `effectsOf()` adds them into one `Effects` and the rules read that: `priceMul`, `breadDue`, `wageOf`, `recruitPrice`, `payFor` and `renownFor` in `src/core.ts`, `passDay`, `payDay` and `march` in `src/journey.ts`, `resolveBattle`, and `fighterOf()`, which gives a man the skill and guard the captain, the officers and the retainer add. To add a kind of officer, add it to `OfficerKind` and `SPECIALTIES` and the compiler asks for his picture (`OFFICER_LOOK` in `src/art.ts`) and his words; the candidates in each town are dealt by `genOfficers()`, weighted by the land. To add a modifier, add a key to `ModKey` and `MODS`, and make the rule that reads it.
- **The captain's order:** `giveOrder()` in `src/core.ts` does what the captain's `ORDERS` entry says (rally, volley, stand fast, charge home), once in a fight, and sets `b.buffs` for the seconds it lasts, which `strike`, `fire`, `moraleTick` and `stepBattle` read. `battleFor()` gives the order to a fight that is played (`vis`) and not to the scouts' runs, so the odds never count on it.
- **Music:** what plays is in `src/score.ts`: each piece's ground, tunes and figures, and the cues that say which pieces play on which screen and how loud each cue is against the others. `MUSIC_LEVEL` in `src/audio.ts` sets the loudness of all of it, and the instruments are `SOUNDS` in `src/music.ts`. See [Music](#music).
- **Saves:** the state built by `newGame()` is a `Campaign` (in `src/journey.ts`) and carries `v: 3`, and `loadSave()` ignores any other version. Bump it when the shape of `Campaign` changes, so old saves are dropped instead of loading broken.
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

`tests/journey.test.js` loads the compiled `js/core.js`, `js/journey.js` and `js/command.js` into a VM with a seeded random, checks that the map's places, roads and quests fit together, and plays every quest through to delivery with a simple player. A change that breaks the rules or leaves a quest impossible fails there before anyone has to play it.

`tests/music.test.js` does the same for the music. It reads the score and composes half an hour of road music, then checks that:

- every note is one its instrument can play;
- the same seed always plays the same music;
- nothing long comes round again soon;
- the music rests between pieces.

It also plays every cue for ten minutes against `tests/webaudio-stub.js`, a stand-in for Web Audio that throws wherever a browser would. In the game a throw from the music would only mean silence, so it is caught here instead.

`tests/command.test.js` runs who leads the company, with the same seeded random, and the camp that is the hub against the recording canvas. It checks that:

- every captain, kind of officer and retainer is made of things the game has (nations, lands, orders, modifiers), and each post has three men to choose from;
- what the people change adds up, and the rules read it: prices, bread, wages, recruits, pay, renown, healing, drill, forage, spirit and the ambush;
- the places open with renown, an officer is engaged for his fee and replaces the man in post, and a retainer asks for a place only in a town, in his own lands, now and then;
- the captain calls his order once, each order does what it says, and an order at a fair moment raises the company's chance in a close fight but does not win it;
- the camp is one screen with its things to click and nothing round it (no dock, no column of buttons), every page of the business has its content, and the road's page is where the course is set;
- each figure of the ledger carries a note that says what it is and what it comes to, with the game's own numbers, and says the same to a reader of the screen; trouble (no men, a short chest, too little bread) shows over the scene, and the sale at the end of the road is there instead of it;
- the command page offers men in a town and none out of one, the title raises a banner in two steps, and the light of a day passing goes from night round to night, with the pictures telling dawn, noon and dusk apart.

How it feels (the time-lapse, the pages opening, the card by a man in the scene) is for the eye and for a real browser.

`tests/main.test.js` loads every script, `main.js` among them, into `tests/dom-stub.js`: a stand-in for the page whose elements keep their attributes and what is put in them, lay nothing out and paint nothing (its canvases are the recording canvas again, and its timers go off when a test says so). It drives the real `act()` and `render()`, and checks that:

- a day going by (a leg, a course or a day's rest, with the time shown going by and without it) puts away the page it was ordered from, takes it off the screen, gives the camp its clicks back and leaves the page shut when the day is done, and a march that cannot be made leaves the page as it was;
- a note on hover shows under its thing, or over it where there is no room, never off the page and clear of the thing's own label; it is text and cannot become markup; it comes after a short wait the first time and at once from one thing to the next; and the keyboard's focus shows it but the focus a click leaves behind does not;
- on a screen with no pointer a tap shows the note, a second tap or a tap elsewhere puts it away, and the mouse events a tap leaves behind do not undo it; with a pointer a click does nothing of its own;
- Esc puts a note and a page away, a click on the dimmed ground round a page puts it away, and Space pauses a fight even with a figure of the ledger focused, though not with a button that has a use for it.

`tests/figures.test.js` loads the figures against a canvas that records each rectangle painted, which is enough to check that:

- every level of weapon and of armour changes a man's picture, in every class and in every pose where the weapon is in his hand;
- every nation dresses a man differently, the company's red sash is on every man of it, and a foe of the same people has none;
- every pose, in every kit, fits the frame the cards and the field leave for it;
- a man who faces left is exactly the mirror of one who faces right, and the same man is drawn the same each time;
- the pictures of gear differ at every level, and a battle unit and a line of the report carry the gear the picture shows.

`tests/encyclopedia.test.js` loads the screens and the encyclopedia against the same kind of canvas, builds each tab as text and checks that:

- every nation, class, weapon, piece of armour, trait, foe, degree of drill, captain, officer, retainer, supply and commission is on its page, with the lands, prices and numbers the game gives it, and nothing reads `undefined` or `NaN`;
- what it says of armour is what the battle does with it, and the classes are named in the plural as people say it;
- every nation, unit and people has a picture of its own;
- the ink on a bar in the colour of a nation can be read (contrast of at least 4.5), and the colour is kept as near itself as that allows;
- the way into it is on every screen but the battle, and the way out of it is worded for each screen it can be opened from.

It also checks the Lands tab: every land with its places, its men, its dangers and its work, the three weathers with the numbers the battle plays by, and every site with the work fought there, each with a picture of its own.

Its clicks, Escape and addresses (`act()` and `start()` in `src/main.ts`) need a page, so these tests do not cover them; `tests/main.test.js` runs some of `src/main.ts` against a stand-in for one.

`tests/terrain.test.js` loads the terrain the same way, onto a canvas that records what is painted (`tests/canvas-stub.js`, which the encyclopedia's tests use too), and checks that:

- every land has a drawing and its colours, and is drawn in every weather as a picture of its own, the same each time and different from another seed's;
- a site is drawn over its land and says where it stands, every piece of work that names a site names one that exists, and every site is used;
- a contract and an ambush are fought in the land they are posted in, an old contract falls back on where the company stands, and a duel is fought where the company is;
- the camp's skyline, a card's landscape and a man's picture follow the land;
- the odds and the rules of the weather the page quotes are those the battle plays by.

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

## The camp as the hub

The camp is one screen. The scene fills the window under a bar of one row that stays in view, and everything else is in the scene or in a page that opens over it: there is no column of buttons beside the scene and no dock under it, since each said again what the scene already says. No page scrolls while the company is in camp on a screen of a laptop's size or larger. On a phone, where the scene is too small to click things in and their labels are hidden, the same pages are a grid of buttons under it (`menuHTML()`, which the stylesheet shows only there), and the page scrolls.

- **Things to click.** The tents, the wagon, the noticeboard, the signpost, the banner and the fire are buttons laid over the drawing (`HOTSPOTS` in `src/screens.ts`, in scene pixels, over the things `campBack()` draws in `src/art.ts`). The roll is in its tent, the market at the wagon (where the place has one), work on the noticeboard (where work is posted), the road at the signpost, the command in the captain's tent, the chronicle on the banner, and the fire rests a day. The captain, each officer and the retainer stand in the camp and open their own page of the command. Each of them is named in the scene, in plain type with a dark edge round it, and, under the pointer, has a note that says what it is for.
- **The ledger.** What the company has is one row of figures in the bar (`barHTML()`): the days left, the cargo, the thalers, the bread, the powder and the renown, each an icon and a number and nothing else. What each comes to is its note (`ledgerTips()`): the pay due and when, the days the bread will last, what the cargo would fetch at the end of the road, and the officers' place that renown opens next. A figure that is going wrong turns the colour of an alarm, with a madder line under it, and its note says why. The same words are what a reader of the screen is told, so nothing is only on hover. The road in the bar, with how far the company has come, opens the map.
- **Notes.** A note is a `Tip` (a title, a line or two and any warnings), written into a thing as `data-tip` by `tipAttr()`, and shown by `showTip()` in `src/main.ts` beside the thing under the pointer, on the keyboard's focus, or for a tap on a screen with no pointer. It is for the eye only (the `#tip` it is shown in is hidden from a reader), so whatever a thing needs to be read aloud is on the thing: put the words on it with `aria-label`, and never put a native `title` beside a note. A note is put away when the pointer leaves, on Esc, when the window scrolls or is resized, and whenever the screen is drawn afresh.
- **Trouble, and the sale.** What is going wrong (`troubles()`: nobody to drive the train, a chest that will not cover the pay, bread that will not last the night) is said in a few words over the scene, where the sky is empty (`campAlerts()`); where there is a market it is a button to it. At the end of the road the sale takes its place (`deliverBlock()`), and the company has nothing left to feed.
- **Pages.** A page of the company's business (`PANELS`) opens over the camp as a drawer under the bar (`panelHTML()`), so the ledger stays in view; it scrolls inside itself and keeps its place while business is done in it (`renderPanel()` draws it apart from the screen for that reason). Esc, its cross or a click beside it close it, and while it is open the camp beneath is `inert`. The road's page is where the company's way on is set: the course to a place, march leg after leg until something needs the player (`courseBlock()`), and the legs one at a time under it.
- **The men.** A man picked in the scene has a small card at his side with his blood, his spirit and his order for the day (`camperPop()`); his whole card is in the roll.
- **A day going by.** Resting, marching a leg and following a course play the rules out at once and then show the time passing (`startPass()` in `src/main.ts`, `drawCamp()` with a `PassState`): `lightAt()` gives the day's light, `campSky()` paints the sky, the sun and the moon afresh each frame, the foragers walk out and come back, and a march sends the company out of one camp and into the next through the dark. A key or a click skips it, reduced motion goes straight to the news, and the bar shows once what the day changed (`Ledger`). The page the day was ordered from is put away as it starts, so that it does not hide the time going by (or keep the old road on show after it).

## The look

The game is a pixel game of the earthy, dark and serious kind of the old historical strategies, with its chrome kept light so that the painted pictures carry the weight. One art pixel is two screen pixels everywhere: the icons, the figures, the scenery and the lines of the interface are on that grid.

- **Frames.** Everything that has an edge has one two-pixel line, notched at its corners: four hard shadows (`0 -2px 0`, `0 2px 0`, `-2px 0 0` and `2px 0 0`), no `border-radius` and no blur. A small plate may have a two-pixel light lip as well (`inset 2px 2px 0`). There are no drop shadows, rings, ribbons or bevels, and nothing eases: a press sinks a thing two pixels and a hover lifts its light. `tests/style.test.js` fails on a rounded corner or a blurred shadow.
- **Kinds.** What kind a thing is, is told by the colour of the rule under its name, not by a block of colour: madder for the sabre, woad for the pike, iron for shot, ochre for supplies, moss for the staff, bronze for cargo, and the colours of its people for a nation. `cardHTML()` gives a card a `k-` class for its look and the stylesheet turns it into `--rule`. A chosen thing's line turns bright bronze, and a chosen button is a plate of bronze.
- **Surfaces.** Plaques are dark soot-brown, with a dark-bronze line, on a table of calm planks. Documents are paper with ink on it: the work posted and the commissions of the year, the map, the chronicle, the legs of the road. A price is a small bronze plate with a coin on it, a main action is madder, and what the camp holds is named in plain type with a dark edge round it, as a map names its places.
- **Meters** are rows of segments, six pixels lit and two dark. `meter()` writes its fill as `--v`, a percentage, and the stylesheet rounds it to a whole segment where the browser can (`round()` in a `@supports`).
- **Type.** Jacquard 24 for the wordmark, the verdicts and the one big action; IM Fell English SC for names, labels and buttons; IM Fell DW Pica for prose; Pixelify Sans for figures only (its 5 and its S are one glyph, so it is not for words).
- **Colour.** One set of ramps, dark to light: soot, bone, paper, bronze, madder, woad, moss, ochre, iron. No pure black or white, shadows lean cool and lights warm, and the dyes are those of 1633 (madder, woad, weld, moss, verdigris), not primaries. The tokens are on `:root` in `css/sotnia.css` (`--s0` to `--s7` soot, `--b0` to `--b5` bone, `--p0` to `--p5` paper, `--br0` to `--br6` bronze, `--md` madder, `--wd` woad, `--ms` moss, `--oc` ochre, `--ir` iron), and the dyes of the figures (`PAL`, `SKINS` in `src/art.ts` and `NATIONS` in `src/figures.ts`) are the same colours, so a man's coat is a dye and not a candy. The pairs of ink and ground that the stylesheet sets are held at 4.5 to 1 by a test.
- **Icons.** `ICON` in `src/icons.ts` is a picture of eight rows of eight characters, each standing for a colour of its own palette, lit from the upper left; a dark edge is added round it when it is drawn, so that it is ten pixels square, and at 20 screen pixels each of its pixels is two. All of them are held in one hidden SVG sprite, which `installIcons()` puts in the page when `icons.js` loads, and `ic()` writes a `<use>` of one: a page of a hundred icons does not carry a hundred drawings.

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

`src/figures.ts` draws every man. A figure has twice the pixels of the scene it stands in (`SS`, so a man is about 40 pixels tall where he used to be 18), which is room for a buckle, the lock of a musket and the comb of a helmet. The backdrops are drawn that fine too (see [Terrain](#terrain)). A scene that holds figures keeps a canvas `SS` times larger, made by `sceneCanvas()`, whose context is scaled so that the scene's own coordinates draw as before; the field, the camp and every card picture are made so. `present()` puts such a buffer on the screen, blowing it up by a whole number before shrinking it the rest of the way, so that its pixels are all the same size on a screen that is not a whole number of times as big.

A figure is layers, drawn from the feet up in pixels from his feet (x forward, y up as a negative number), so that a man who faces left is the same drawing mirrored: legs, the coat and whatever armour he wears over it (`torso()`), his head, what is on it (`hat()`), his weapon, and his arms. `drawSoldier()` is given what he is (`cls`, his livery `skin`), what he has (`wpn`, `arm`, levels 0 to 3), which man he is (`man`, which settles his hair and moustache), and what he is doing (`mode`, `moving`, `swing`, `flash`; see `SoldierLook` in `src/art.ts`). `drawCamper()` adds the poses of camp (and the captain's rank: gilt where the men wear red), and `drawPerson()` the people of the command, who have no nation: a `PersonLook` (a coat, a hat, a thing carried) for each kind of officer and each retainer, in `OFFICER_LOOK` and `RETAINER_LOOK` in `src/art.ts`.

What each level looks like:

| Level | Armour | Pike | Musket | Sabre |
| --- | --- | --- | --- | --- |
| 0 | Linen shirt, in the company's colour | Ash pike, a small leaf of iron | Old arquebus: short, dark, a bare serpentine | Notched sabre, dull iron |
| 1 | Buff coat; the company's colour moves to the sleeves and a sash | Ironbound pike: a longer head, straps down the shaft | Matchlock musket: banded barrel, ramrod, a glowing match | Hungarian sabre: steel, with a knuckle bow |
| 2 | Breastplate and gorget, a brass belt buckle | Partisan: a broad blade with lugs, and a tassel | Dutch musket: the longest, in walnut with brass | Karabela: a brighter blade, the bird's-head pommel |
| 3 | Cuirass, shoulder plates and tassets, and the plume of the finest hat | Master's halberd: an axe blade, a spike and a beak, gilt | Wheel-lock: shorter, black and gilt, a steel wheel and no match | Damascened sabre: streaked steel, a gilt hilt and a tassel |

Hats grow with the armour too (a nation's cap grows the same way): a pikeman's morion gains a brass band and, at the top, a plume; a musketeer's hat a bigger plume, a brooch and a gilt band; a sabreur's cap a clasp and a feather. A musketeer in armour wears a flask of powder where a lighter man has his bandolier.

### Nations

A man of the company is dressed as his nation, in its colours, and wears the company's red sash over them. The sash is the field sign: it tells a Swede of the company from a Swedish foe, who has the same colours. A foe takes his coat and trim from his skin, and the rest of his dress from his people, if his skin is one (`NATION_OF_SKIN`).

| Nation | Colours | Head | And |
| --- | --- | --- | --- |
| Zaporozhian | blue and yellow | kolpak with a red bag, in every class | yellow boots, dark blue hose, usually a long moustache |
| Polish | crimson and white | morion; broad hat with a white plume; kolpak with a heron's feather | the kontusz sleeve thrown back, the white żupan showing, white cuffs, red boots |
| German | black and gold | morion; broad hat with a red plume | slashed sleeves, one leg red and the other dark |
| Swedish | yellow and blue | morion; broad hat with a yellow plume | blue hose |
| Scottish | navy and white | blue bonnet with a diced band and a red tuft | a tartan plaid hung from the shoulders, red hose |
| Hungarian | green and white | kalpak with a red bag and a white feather | white braid, red hose |
| Croat | brown and red | broad hat with a red plume | a red cravat |
| Lipka Tatar | teal and white | turban | |

The foes with a dress of their own are the Swedes, the Imperials, the Muscovites, the Tatars and the Croats. The Tatar raiders and the Croat horse used to share one livery, and now each has its own. Armour hides the coat, so from the buff coat up a nation is carried by its sleeves, its legs, its cap and its mark.

To add a level or change one, edit the part for its class (`musketArt()`, `pikeArt()` or `sabreArt()` in the frame of the weapon itself: `a` runs along it from the butt and `c` across it, so one drawing serves a musket held level and held upright) or `torso()`. To add a pose, add a branch to `drawSoldier()`; the figure tests then draw it in every kit and check that it fits. `gearArt()` draws the pictures of weapons and armour that the cards show in their ladders, from the same code. Open `docs/figures.html` to see everything at once.

## Terrain

The backdrop of a fight is the land it is fought in. `src/terrain.ts` draws it at twice the pixels of the scene, as the figures are (`SS`), onto a canvas of 600 by 248 of them with the horizon where it always was, so that the men stand where they did, in the lower half of the picture. What is drawn there is kept quiet; the landmarks stand on the hills, along the horizon and a little below it.

A land is drawn in this order: the sky (bands of tone from the zenith to the haze, ruled across as an engraver would, the sun and the strokes of the clouds), the far hills, the near hills (a sum of waves, which the landmarks stand on), the landmarks, the ground (the horizon and its gradient) and what lies on it. `place()` spaces a land's landmarks along the picture in an order the seed deals, so that no two fights look alike. The colours are in `TONES`, pale as the paper of the old backdrops was, so that the ink does the drawing and the tone only says which country it is. Everything that stands (`PROPS`: trees, houses, churches, mills, towers, tents, wagons) is made of a few shapes (`rect`, `line`, `disc`, `poly`) in ink, with a flat fill and the hatching an engraver gives a roof.

| Land | What stands in it |
| --- | --- |
| The Wild Fields | an almost flat horizon; burial mounds, one with its stone woman and one with a Cossack watchtower; a lone thorn tree; a herd far off; a well with its sweep; feather grass |
| Ukraine | rolling hills; a hamlet of whitewashed huts under thatch, between willows; a wooden church of three domes or a windmill, or both; poplars; a ploughed field and haystacks |
| The Crown of Poland | a village church with its spire and its cottages, a storks' nest on a pole, a windmill or a manor, a birch grove, a wayside cross, a ploughed field |
| Royal Prussia | a dyke; the Baltic with ships on it, at one side; a brick church with a steep spire, half-timbered houses, a Dutch tower mill, pines; a ditch with reeds |
| Lithuania | walls of spruce and pine along the hills; a clearing with log huts and a wooden chapel; a lake; boulders, ferns and birches |
| The Smolensk front | the walled city with its towers on its hill; earthworks with gabions and a gun; tents; smoke from burning villages; bare trees; wagons |
| Silesia | blue mountains behind; a castle on its hill; a church and half-timbered farms among burnt ones, with smoke; an orchard; a gibbet |
| Saxony and Lusatia | far hills; vineyards on the slope; half-timbered houses round a church; a castle or a windmill; the Elbe with a barge and its reeds; hop poles |

### Weather

`weatherTone()` greys and darkens a land's colours in rain and pales them in fog, and the sky has no sun and heavier clouds in either. `weatherArt()` then lays fog over everything that stands far off, the thicker the nearer the horizon, so that the landmarks are ghosts and the hills a pale smear, and stands puddles on the ground in rain. The rain falling and the banks of fog drifting are drawn over the field as it is played (`drawField()`). What the weather does to a fight is `MISFIRE`, `MUSKET_RANGE` and `FOG_AIM` in `src/core.ts`, which the encyclopedia quotes.

### Sites

Work that names a place is fought there: a contract by its template, an ambush by who lays it (`SITE_OF`). A site is drawn over its land: a ford (a river across the picture, with stepping stones and reeds), the riverbank with its rafts, a burnt mill, a toll house with its bridge, a convoy of wagons, a mill-pond with its watermill, a picket, the foragers' barn and ricks, a burning village, a manor, a blockhouse, the wayside, a ravine, the edge of a forest. Each says where along the picture it stands, so that the card of the work can show it.

### Cards and camp

The pictures on the cards are windows onto the same backdrops (`backdropOf()`, `landscape()`): the roll shows the land the company is in, a contract the land and the site of its work (the window is lifted to show the ground a site stands on), and a nation or a people in the encyclopedia the land it is shown in as at home. The camp at night keeps its own sky and stars and takes its skyline from the land (`skylineOf()`): the field's backdrop without its sky, as one dark shape.

To add a land, add it to `LandId` and `LANDS`, and the compiler asks for its `TONES`, its `LAND_ART` and the rest. `docs/lands.html` shows every land in every weather, another day in each, every site, and the night skylines.

## Data

Coastlines come from Natural Earth's 1:50m land, which is in the public domain. Dates are shown in both calendars of the time: Gregorian, kept in Catholic Poland, and Julian, ten days behind, kept in Saxony and Orthodox Ukraine.

## History

The first commit holds the artifact's HTML exactly as exported, so the original is always one command away:

```bash
git show $(git rev-list --max-parents=0 HEAD):index.html > sotnia-original.html
```

The next commit split that file into separate files without changing the code. After that, the 24-day campaign and its final battle with the Black Regiment gave way to the journey ([issue 1](https://github.com/ftymoshchuk/sotnia/issues/1)). The Black Regiment is meant to come back as a set piece on the road.

Then the scripts became TypeScript: written in `src/` under `strict`, and compiled to the `js/` files the page loads. Nothing a player can see was meant to change, and three checks say nothing did. Each compiled script has the same syntax tree as the JavaScript it replaced (the comparison ignores layout and comments, but not a single name, operator or literal). Every comment of the original survives into `js/`. And a browser run that clicked through 1,600 steps of the old game, with fights, marches, trading and the map, is reproduced step for step by the new one. The last hand-written JavaScript is at `git show bca68a2:js/core.js`, and likewise for the other nine scripts.

After that the men were redrawn at twice the pixels, and dressed in the weapon and armour they have bought: until then the rules had levels of gear but the picture never showed them. See [Figures](#figures). Then each was dressed in the colours of his nation (see [Nations](#nations)), and the encyclopedia was added: one place to see every nation, unit, weapon, foe and good of the game. Then the backdrop was redrawn as the land the fight is in, at the same fineness as the men (see [Terrain](#terrain)), and the encyclopedia gained a tab for the lands. Then the camp became the hub of the game (see [The camp as the hub](#the-camp-as-the-hub)), a day in it became something to watch, and the company got a captain who calls an order in a fight, four officers to engage in the towns, and now and then a retainer: old saves were dropped for it. Last the camp was made lighter: the column of buttons beside the scene and the dock under it, which said again what the scene says, were taken away, and what they held went into the scene, the bar's ledger (each figure of it with a note on what it comes to) and the road's page.

`src/main.ts` still checks for `window.claude.hot`. That only exists inside the Claude artifact runtime, where it keeps the campaign across hot reloads. Everywhere else it is absent and the game boots normally.
