# Sotnia

A small strategy game about a free company of mercenaries in 1633. You start with a banner, three men and twenty-four days. Hire pikemen, musketeers and sabreurs; drill, arm, feed and pay them; take contracts; and watch each fight play out on a pixel-art field, changing your orders as it goes. On day 24 the Black Regiment holds the ford.

It began as a single-file prototype built as a Claude artifact and moved here for further development.

## Running it

There is no build step and there are no dependencies. Open `index.html` in a browser, or serve the folder and visit http://localhost:8000:

```bash
python3 -m http.server 8000
```

- Fonts load from Google Fonts. Offline, the page falls back to local serif fonts.
- The campaign and the sound and music settings are kept in the browser's `localStorage` (`sotnia-save-1`, `sotnia-sound`, `sotnia-music`), separately for each origin.
- Because it is all static files, GitHub Pages can host it as is.

## Layout

| File | Contents |
| --- | --- |
| `index.html` | Page shell: fonts, stylesheet, the `#view` and `#modal` mount points, and the scripts in load order |
| `css/sotnia.css` | All styles, with the colour and type tokens on `:root` |
| `js/core.js` | The rules, with no DOM: troop classes, origins, traits, soldiers, economy, contracts, the battle simulation, scouting odds, aftermath, camp events and the day cycle |
| `js/art.js` | Palette, pixel sprites, the woodcut backdrop, and drawing the battlefield and its particles |
| `js/audio.js` | Sound effects and music, synthesised with Web Audio (there are no recordings) |
| `js/screens.js` | Shared state (`G` is the campaign, `ui` is the interface), saving, and the HTML for every screen |
| `js/main.js` | Click and key handling, the frame loop and boot |

The scripts are plain `<script>` tags, not ES modules. They share one global scope and must load in the order `index.html` lists them, which keeps the game runnable straight from `file://` with no tooling. Top-level code in a file can only use what earlier files declare; functions can call anything, since they run after every file has loaded.

Keep `js/core.js` free of DOM access. The scouts' odds come from running the battle simulation headless, dozens of times per estimate, and the same separation lets the rules run outside a browser.

### Where things live

- **Balance:** unit stats in `CLS`, contract templates in `TEMPLATES` with difficulty in `makeContract`, prices and upkeep in the economy section, and campaign length in `DAYS` (all in `js/core.js`).
- **Battle behaviour:** `stepBattle`, `strike`, `fire` and `moraleTick` in `js/core.js`.
- **Camp events:** add entries to `EVENTS` in `js/core.js`.
- **Music:** `CUES` in `js/audio.js`.
- **Saves:** the state built by `newGame()` carries `v: 1`, and `loadSave()` ignores any other version. Bump it when the shape of the state changes, so old saves are dropped instead of loading broken.

## History

The first commit holds the artifact's HTML exactly as exported, so the original is always one command away:

```bash
git show $(git rev-list --max-parents=0 HEAD):index.html > sotnia-original.html
```

The next commit split that file into the layout above. The code is unchanged and in its original order, with two exceptions. Each new script starts with a `"use strict";` line and a header comment. The shared state and screen helpers (`G`, `ui`, `$`, `esc`, `pct`, `ORDER`, `STANCE`) moved from the top of the interface code to the top of `js/screens.js`.

`js/main.js` still checks for `window.claude.hot`. That only exists inside the Claude artifact runtime, where it keeps the campaign across hot reloads. Everywhere else it is absent and the game boots normally.
