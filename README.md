# Footba11 Heroes

A playable 11v11 football game with a genuine 3D sideline camera, built in the existing Astro project. Everything runs locally in the browser: a fixed-step match simulation, Three.js 3D sideline view, keyboard and multi-touch controls, tactical AI, player and manager modes, and resumable local saves.

## Run

Requires Node 22.12+ (verified on Node 24.19) and npm.

```sh
npm ci
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
| Explicitly ask a teammate for the ball | R or TOP İSTƏ |
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

Off the ball, move into space and press **R** or tap **TOP İSTƏ**. The Azerbaijani help panel explains whether the request is pending, a defender blocks the lane, you are offside, the pass is travelling, or the ball has arrived. Your player raises a hand and the teammate carrying the ball is highlighted. Requests never trigger a set piece and do not force illegal or blocked passes.

Hold a pass, cross or shot action to increase power. The mobile joystick and action buttons accept simultaneous touches. Manager matches instead show tactical touchline commands. The 3D camera follows play from the near sideline; player bodies, stadium, goal frames and nets are actual 3D geometry. A side-view compatibility renderer is available when WebGL is unavailable. During a restart, choose a teammate or aim with movement, then pass, cross or shoot. Opponent and manager-mode restarts are taken by AI.

Player career is a separate personal-life journey: train skills, manage energy and recovery, earn salary, pay living costs and build reputation. On matchday control only the selected DEF, MID or FWD; off-ball passes are requests to an AI teammate, not remote kicks. Manager career is a separate club simulation: manage budget, team preparation, scouting, youth development, formation, approach and substitutions. All footballers play autonomously; manager input cannot move, pass, shoot or switch a player. Manager plans and career records are independent of player-life progress. Substitutions require a stoppage and are limited to five. Career results are recorded at full time. Main Menu saves unfinished matches independently for quick, player and manager modes. Returning to a mode offers its own Resume Match, without overwriting another career. Browser storage must be available for persistence.

## Baş məşqçi karyerası

**Baş məşqçi** seçərək doqquz bölməli qərargahı aç. Daimi heyət, liqa, skautinq/transfer, akademiya və maliyyəni idarə et; ulduz eqosu, gənclər/veteranlar, mentorluq, qruplaşma, intizam və media hadisələrinə qərar ver. Matçdan əvvəl, fasilədə və sonra çıxış üslubunu seç. Top dayananda həqiqi ehtiyat oyunçusu, əvəzetmə səbəbi və danışıq tərzi seçilir. Qərarlar fərdi etimada və meydandakı davranışa təsir edir. [Oynamaq və sistemlərin tam izahı](docs/MANAGER_CAREER.md).

## Tests and scope

`npm test` discovers every `tests/*.test.mjs` suite and runs deterministic boundary, offside, clock, contact/foul, gameplay, formation, career-life, persistence and 3D camera/projection tests including persistent league, market, psychology and match-report integration. `python tests/browser_smoke.py` runs the browser checks when Python Playwright and Chromium are installed; set `GAME_URL` or `CHROMIUM_PATH` to override their defaults.

The **Yaxın baxış / Geniş baxış** button switches between closer player framing and the broad sideline view. The original authored human models use adult anatomical proportions and articulated knees, elbows and ankles. They are procedural game figures, not scanned or photorealistic characters.

`python tests/offball_browser.py` checks the explicit request UI, physical pass receipt, blocked/offside feedback and mobile tapping.

Development-only diagnostics are available with `?debug=1` and the `window.__football` inspection hook. Neither is enabled in a production build.

See [implementation scope](docs/IMPLEMENTATION.md) for verified functionality and limitations. The engine implements a tested core rules subset; it is **not** a certified, complete implementation of all 17 IFAB laws. No official club branding or player assets are used. All rendering is local and needs no external images or fonts.

The game remains a browser application, not a Unity 6 project or an exact reproduction of any commercial football title. Its visuals use a new low-poly 3D style with local assets and no external model downloads.
