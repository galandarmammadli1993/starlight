# Implementation scope

The supplied specification describes an overhaul of an existing Eleven Soccer game. The selected repository contained only the Astro/Starlight starter. The user explicitly authorized creating the game from scratch instead. There were no pre-existing game menus, career databases, teams or save files to migrate.

## Architecture

| File | Responsibility |
| --- | --- |
| src/game/rules.mjs | Central boundary/restart, offside, clock and referee decisions |
| src/game/engine.mjs | Match state machine, fixed-step physics, movement, passes/shots, AI, goalkeepers, restart transitions |
| src/game/renderer.mjs | Three.js sideline stadium and upright player models, one ball mesh, raycast receiver picking and 2D side-view fallback |
| src/game/storage.mjs | Validated versioned saves, resumable matches, once-only career records |
| src/game/app.mjs | One animation loop, keyboard/multi-touch input, menus, settings and match UI |
| src/pages/index.astro | Accessible application shell |

## Side-view and career revision

- Replaced the overhead renderer with actual Three.js geometry and a near-sideline perspective camera, upright animated humanoids, crowd terraces, 3D goal frames/netting, lighting and ball-follow tracking. This is a browser 3D implementation, not a Unity project or licensed clone of a commercial title.
- Removed the old ball trail and its residual graphics. A single named match-ball mesh is updated from one stable engine ball object. Restart and goal transitions do not create additional ball meshes.
- Split player life (daily training, energy, recovery, wallet/salary, reputation, own goals) and manager club decisions (budget, board trust, team fitness/morale, coaching, scouting, youth). Attributes affect actual engine movement, passing, shooting and defending.
- Manager input cannot directly control any footballer. Player career cannot switch identity or change team tactics/substitutions; AI teammates make their own decisions and respond to delayed, lane-checked pass calls.
- Separate suspended games, histories and manager tactical plans persist without erasing another mode. Older version-one local saves migrate without dropping shared result history.
- Fixed stale restart/penalty flags, invalid-input NaNs, dismissed-goalkeeper restart freezing, dead player defensive switch controls and sky-click receiver targeting.

## Clear requests and human-model revision

- Added a separate R / TOP İSTƏ action, a persistent Azerbaijani off-ball help panel, request countdown, distinct blocked/offside/passing/received feedback and a visible raised-hand gesture.
- AI reacts after a brief delay, checks the pass lane and offside, and delivers a physical, interceptable pass. Requesting during any restart is rejected; repeated calls do not spam or extend the timer.
- Replaced the old simple head/cylinder bodies with original authored 1.8m athletic models, shaped shoulders/waist, jaw/nose/ears, multi-joint legs and arms, and improved action poses. Shared geometry bounds memory. Clothing surface clearance is tested to avoid skin patches through socks.
- Added a close sideline camera option. Models are procedural 3D figures; no external character assets were purchased or downloaded, and photorealistic people are not claimed.

## Persistent manager career

The manager dashboard now connects a persistent eight-club league and named player roster to real transfers, bench substitutions, individual match reports, wages and seasons. Character-sensitive dilemmas, groups, mentors, promises, fictional media, pre/half/post-match talks and substitution explanations affect actual engine mentality. Saved coach style is the default when continuing a speech without choosing a one-off style. Psychological clocks and outstanding commitments continue correctly when a new season starts. See [manager career scope](MANAGER_CAREER.md) for all playable systems and limits.

## Implemented and exercised

- 22 players, formations 4-3-3 / 4-4-2 / 4-2-3-1 / 3-5-2, goalkeeper and position-based roles, wing width and defensive recovery.
- Independent ball x/y/z, gravity, ground friction, bounce, goal-frame rebounds, and continuous whole-ball exits. Live ball coordinates are never clamped to the pitch.
- Throw-ins, corners, goal kicks, kick-offs, direct/indirect free kicks and penalties with staged setup and physical restart delivery.
- Pass-time offside snapshots and active receipt, direct-restart exceptions, saves retaining offside and deliberate control resetting it. Rules helpers accept legal-body-point data; the current player model uses point positions.
- Short/through/long passes, both-wing crosses, one-two support, wide-angle shots, headers, defender blocks, goalkeeper catches/distribution and the eight-second holding sanction.
- Contact-based clean/careless/reckless/excessive tackles, free kicks/penalties, yellows and second-yellow/red dismissals, minimum-player abandonment.
- A single authoritative match clock, two halves and changes of ends, added time, pausing, selectable real-world half lengths with a 12-minute default.
- Keyboard and touch input, receiver selection, held-action power, context-sensitive defensive controls, formation/tactic changes and five stoppage-only substitutions.
- Local player customization; position-locked player career; AI-driven manager career; finished-match records and resumable unfinished games. These are local careers, not a licensed league or transfer-market simulation.
- Development-only state/ball/restart/offside diagnostics. No fake VAR or replay claims.

Node tests exercise the actual rules and engine. Browser tests additionally exercise real DOM buttons, keyboard/touch actions, pause/resume, settings, manager tactics and save/restore. Unit tests of a rule helper alone do not establish all possible real-match interpretations.

## Limits of this browser edition

The original AAA-level specification is broader than this implementation. This release does not implement a skeletal animation/contact model; all possible handball, holding, obstruction or goalkeeper-view interpretations; competition-specific injury/treatment/substitution-return procedures; advantage recall; knockout extra time or penalty shootouts; replay/VAR; season scheduling, a transfer market or cloud/multi-device saves. Goalkeepers use positional catches/blocks rather than motion-captured dive animations. Outfield contact and body-part offside are simplified to the player model geometry. Restart-delay judgement uses an observable idle-duration heuristic rather than a full delay-intent model.

This is an Android-compatible browser game, not a signed Android application. A native APK needs a separate packaging workflow.

The official reference requested by the user is https://www.theifab.com/laws/latest/. Direct access to that hostname was denied by this environment network policy during development. Implemented mechanics follow the supplied rules brief and are tested as documented here; the project makes no claim of independent verification against every provision of the 2026/27 publication.

## Validation

```sh
npm test
npm run build
python tests/browser_smoke.py
```

The browser suite needs the development server running, Python Playwright, and Chromium (/usr/bin/chromium in this environment). Production output has no public debug hook; functional browser test fixtures deliberately use development-only inspection.
