# Footba11 Heroes

A playable, full-pitch 11v11 football game built in the existing Astro project. Everything runs locally in the browser: a fixed-step match simulation, Canvas2D broadcast view, keyboard and multi-touch controls, tactical AI, player and manager modes, and resumable local saves.

## Run

Requires Node 22.12+ (verified on Node 24.19) and npm.

```sh
npm install --package-lock=false
npm run dev -- --host 0.0.0.0
```

```sh
npm test
npm run build
npm run preview -- --host 0.0.0.0
```

The default match has **12 real minutes per half**. Choose 5, 8, 12, 15, 20 or 45 minutes in Match settings. This is a browser game with Android-compatible touch controls, not a native APK.

## Controls

| Action | Keyboard |
| --- | --- |
| Move / aim at a restart | WASD or arrow keys |
| Sprint | Shift |
| Pass / defensive press | J or Space |
| Through ball / defensive switch | U |
| Cross / clearance | L |
| Shoot / defensive tackle | K |
| Switch player | Q |
| Tackle | F |
| One-two | X |
| Close-control feint | Z |
| Clear | C |
| Next receiver | Tab while pitch is focused, or click a teammate |
| Pause | P or Escape |

Hold a pass, cross or shot action to increase power. The mobile joystick and action buttons accept simultaneous touches. During a restart, choose a teammate or aim with movement, then pass, cross or shoot. Opponent and manager-mode restarts are taken by AI.

Player career locks control to the selected DEF, MID or FWD. Manager career simulates both sides while your formation, approach and substitutions affect the home team. Substitutions require a stoppage and are limited to five. Career results are recorded at full time. Main Menu saves an unfinished match; returning to the same mode or reloading offers Resume Match. Browser storage must be available for persistence.

## Tests and scope

`npm test` runs deterministic boundary, offside, clock, contact/foul, gameplay, formation and persistence tests with individual test counts. `python tests/browser_smoke.py` runs the browser checks when Python Playwright and Chromium are installed; set `GAME_URL` or `CHROMIUM_PATH` to override their defaults.

Development-only diagnostics are available with `?debug=1` and the `window.__football` inspection hook. Neither is enabled in a production build.

See [implementation scope](docs/IMPLEMENTATION.md) for verified functionality and limitations. The engine implements a tested core rules subset; it is **not** a certified, complete implementation of all 17 IFAB laws. No official club branding or player assets are used. All rendering is local and needs no external images or fonts.
