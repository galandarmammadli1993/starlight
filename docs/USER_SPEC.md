# ELEVEN SOCCER — COMPLETE REAL FOOTBALL GAMEPLAY & IFAB RULES OVERHAUL

Act as a senior AAA football gameplay engineer, football physics programmer, match simulation architect, and professional football rules specialist.

Your task is to substantially upgrade the EXISTING Eleven Soccer football game.

The current game suffers from serious limitations:

1. Goals are mostly scored by running straight through the middle.
2. Passing and combination play are poorly implemented.
3. Wide attacking and wing play are ineffective.
4. The ball gets stuck at the pitch boundaries instead of going out of play.
5. Throw-ins, corners, and goal kicks do not function properly.
6. Offside is missing or not functioning correctly.
7. Match time moves far too quickly.
8. The gameplay feels like a basic arcade prototype rather than real football.

**OBJECTIVE: Transform the existing match engine into a realistic, fully playable 11v11 football simulation with genuine tactical freedom and correct IFAB Laws of the Game.**

Do not rebuild the application from scratch.

Preserve the existing Eleven Soccer interface, Main Menu, Player Career, Manager Career, teams, player customization, save system, and other working features.

## 1. OFFICIAL FOOTBALL RULES — 2026/27

Implement the official IFAB Laws of the Game 2026/27.

Official source:
https://www.theifab.com/laws/latest/

Study and apply all 17 laws, including:

1. Field of Play
2. The Ball
3. The Players
4. Players' Equipment
5. The Referee
6. Other Match Officials
7. Duration of the Match
8. Start and Restart of Play
9. Ball In and Out of Play
10. Outcome of a Match
11. Offside
12. Fouls and Misconduct
13. Free Kicks
14. Penalty Kicks
15. Throw-ins
16. Goal Kicks
17. Corner Kicks

Create a centralized football rules engine rather than implementing scattered, inconsistent rules in unrelated components.

Respect official rules while providing playable mobile controls.

## 2. CRITICAL FIX — BALL OUT OF PLAY

This is the highest-priority existing bug.

Currently the ball becomes stuck or stops unnaturally when reaching the pitch boundary.

REMOVE THIS BEHAVIOR.

The football field must not behave like a closed box.

Implement:

- No invisible walls preventing the ball from leaving the pitch.
- No artificial clamping of ball coordinates to the playing field.
- The ball must move naturally over sidelines and goal lines.
- The ball must be able to leave the pitch on the ground or in the air.
- Track the complete three-dimensional position of the ball.
- Use the actual ball radius for boundary detection.
- Detect when the ENTIRE ball has crossed the applicable boundary plane.
- Do not stop play merely because the ball's center touches a line.
- Use continuous trajectory checks to prevent fast-moving balls from skipping boundary detection.
- Detect which player last touched the ball.
- Identify the exact crossing location.
- Trigger the correct restart.
- Prevent repeated restart events from a single boundary crossing.

When the ball leaves the field:

1. Allow it to visibly cross the line.
2. Stop active gameplay when the out-of-play condition is confirmed.
3. Trigger the referee's decision.
4. Display the corresponding restart.
5. Position the ball correctly.
6. Arrange players around the restart.
7. Resume only after the restart is performed.

Do not teleport the ball back to the center.

The center of the pitch is exclusively for kick-off situations and other legally appropriate events.

## 3. THROW-IN SYSTEM

Implement fully functional throw-ins.

When the ball completely crosses either touchline:

- Determine the team that last touched the ball.
- Award the throw-in to the opposing team.
- Place the thrower at the correct touchline position.
- Animate a realistic two-handed throw from behind and over the head.
- Keep the thrower's feet in a legal position.
- Maintain the appropriate two-meter opposition distance.

Provide player controls for:

- Short throw
- Long throw
- Select receiving teammate
- Choose throw direction
- Adjust throw power

Teammates must actively move into space to receive the throw.

The throw must travel through physical space, not instantly teleport to a teammate.

There is no offside offence directly from a throw-in.

A direct goal from a throw-in must not count; apply the correct restart instead.

Implement the 2026/27 five-second countdown only when the referee judges that a throw-in is being unfairly delayed, rather than automatically imposing a five-second limit on every throw.

## 4. CORNER KICK SYSTEM

When the defending team last touches the ball before it completely crosses its own goal line, and no goal has been scored, award a corner kick.

Implement both left and right corners.

Features:

- Correct corner placement
- Realistic kicking animation
- Short corner
- High cross
- Driven cross
- Near-post delivery
- Far-post delivery
- Pass to an approaching teammate
- Cross targeting
- Adjustable direction and power

Inside the penalty area, teammates must:

- Make attacking runs
- Jump for headers
- Challenge defenders
- Move toward near and far posts
- Attempt volleys
- Attempt rebounds

Defending players must:

- Mark opponents
- Contest headers
- Clear crosses
- Defend the six-yard area

Allow direct goals from corner kicks when physically and legally valid.

Do not automatically turn every corner into a goal or immediate possession change.

## 5. GOAL KICK SYSTEM

When the attacking team last touches the ball before it completely crosses the defending team's goal line without a goal, award a goal kick.

Implement:

- Goal kick from a valid position within the goal area
- Short goalkeeper distribution
- Long goal kick
- Passing to center-backs
- Passing toward full-backs
- Long passes toward midfield
- Direction and power controls

The ball becomes active once it is kicked and clearly moves.

Do not incorrectly require the ball to leave the penalty area before it becomes active.

Opposing players must respect the applicable penalty-area positioning rules.

There is no offside offence directly from a goal kick.

Implement the 2026/27 procedure for unfairly delaying a goal kick, including the appropriate five-second referee countdown and corner-kick sanction.

## 6. COMPLETE OFFSIDE SYSTEM

Implement a working and accurate offside detection engine.

Offside must be calculated at the relevant moment when a teammate plays or touches the ball, not simply when the receiver catches it.

The system must consider:

- Attacking direction
- Position of the ball
- Position of the second-last opponent
- Attacking player's position
- The opposition half
- Legal body parts used in offside decisions
- The exact timing of the teammate's pass or touch

An offside position alone is NOT an offence.

Penalize only when the player becomes actively involved according to IFAB Law 11.

Include:

- Interfering with play
- Interfering with an opponent
- Gaining an advantage from rebounds or saves
- Blocking the goalkeeper's view
- Challenging an opponent for the ball
- Deliberate play by an opponent versus deflections and saves

No offside offence when receiving the ball directly from:

- A throw-in
- A corner kick
- A goal kick

No offside position in the player's own half.

Players level with the relevant offside line must not be incorrectly penalized.

Backward passes must be evaluated using actual ball and player positions, not simplistic directional assumptions.

When offside occurs:

1. Stop play.
2. Display the OFFSIDE notification.
3. Trigger a referee whistle.
4. Disallow any invalid goal.
5. Award an indirect free kick to the defending team at the proper location.
6. Resume with the correct restart.

Build automated offside tests for borderline positions, different attacking directions, rebounds, and direct restarts.

## 7. REAL PASSING & COMBINATION FOOTBALL

The player must no longer be forced to run through the middle to create scoring opportunities.

Implement a complete passing engine:

- Short passes
- Long passes
- Ground passes
- Through balls
- Lofted through balls
- Cross-field passes
- One-touch passes
- Back passes
- Wall passes / one-two combinations
- Diagonal passes
- First-time crosses
- Crosses from the wings
- Cut-back passes
- Passes into the penalty area

Passing must depend on:

- Ball position
- Player orientation
- Selected target
- Player attributes
- Passing power
- Defending pressure
- Distance
- Available passing lanes

A pass should be able to fail, be intercepted, or be controlled imperfectly.

Do not automatically give every pass to the nearest teammate.

Use independent ball trajectories and realistic ball physics.

## 8. FULL WIDTH ATTACKING SYSTEM

The entire football pitch must become playable.

Currently most useful movement is restricted to the central corridor.

Fix this completely.

Allow players to:

- Attack down the left wing
- Attack down the right wing
- Switch play across the pitch
- Cut inside
- Overlap with full-backs
- Underlap into central attacking areas
- Deliver crosses
- Dribble along the touchline
- Pass backward to retain possession
- Attack through central combinations
- Create counterattacks

AI teammates must intelligently occupy the whole pitch.

Wingers should provide width.

Full-backs should support wide attacks when tactics allow.

Midfielders should offer passing options.

Strikers should attack the penalty area.

No invisible movement barriers or artificial central-lane restrictions.

## 9. PLAYER MOVEMENT & BALL CONTROL

Improve player mobility and responsiveness.

Implement:

- 360-degree player movement
- Smooth acceleration
- Deceleration
- Sprinting
- Turning
- Dribbling
- Close control
- First touch
- Ball shielding
- Changes of direction
- Player collisions
- Realistic ball loss under pressure

The ball should not be permanently attached to the player's feet.

The ball must behave as an independent physics object.

Player animations must correspond to real gameplay actions.

## 10. REALISTIC SHOOTING

Players must be able to score from different angles.

Implement:

- Central shots
- Angled shots
- Shots from the left side
- Shots from the right side
- Long-range shots
- First-time shots
- Volleys
- Headers
- Close-range finishes
- Rebound finishes
- Low and high shots

Shot success must depend on ball physics, position, accuracy, goalkeeper reaction, pressure, and player ability.

Do not guarantee goals.

A goal counts only when the entire ball legally crosses the goal line between the posts and beneath the crossbar.

Differentiate between:

- Goal
- Shot wide
- Shot over the crossbar
- Goalkeeper save
- Defender block
- Post or crossbar rebound
- Corner after defensive deflection
- Goal kick after attacking team's last touch

Support realistic own goals.

## 11. FOULS, FREE KICKS, PENALTIES & CARDS

Implement a functional referee system.

Detect applicable offences:

- Illegal tackles
- Tripping
- Pushing
- Holding
- Illegal handball
- Dangerous challenges
- Impeding an opponent
- Serious foul play
- Other relevant IFAB Law 12 offences

Distinguish careless, reckless, and excessive-force challenges.

Implement:

- Direct free kicks
- Indirect free kicks
- Yellow cards
- Red cards
- Second-yellow dismissals
- Penalty kicks
- Defensive walls
- Appropriate positioning distances
- Referee advantage
- Player dismissals
- Correct restarts

Free kicks should allow player-controlled direction, power, passing, and shooting where legally permitted.

During penalties, provide controls for the kicker and goalkeeper.

Apply correct consequences for illegal double touches and goalkeeper offences.

A red-carded player must not return to active play.

Do not use completely random foul decisions disconnected from actual contact events.

## 12. GOALKEEPER INTELLIGENCE

The goalkeeper must act like a real football goalkeeper.

Implement:

- Positioning
- Diving
- Catching
- Punching
- Shot blocking
- Leaving the goal to claim crosses
- One-on-one defending
- Short distribution
- Long distribution
- Throwing the ball
- Saving penalties

The goalkeeper must react to attacks from both wings and the center.

Respect handling restrictions, including deliberate kicks from teammates and the relevant throw-in restrictions.

Implement the official eight-second goalkeeper hand-control rule, with a corner kick for the opposing team when breached.

## 13. REBUILD THE MATCH CLOCK — CRITICAL

The match clock currently advances far too quickly.

Replace the existing clock implementation.

Use two 45-minute football halves, with an appropriate conversion to real-world playable match duration.

Set the DEFAULT match length to:

**12 real-world minutes per half (24 minutes total, excluding breaks and additional time).**

Provide selectable match settings:

- 5 real minutes per half
- 8 real minutes per half
- 12 real minutes per half (DEFAULT)
- 15 real minutes per half
- 20 real minutes per half
- 45 real minutes per half (real-time option)

Ensure the match-clock conversion is accurate and does not depend on frame rate.

Do not increment the timer independently in several different components.

Use a single authoritative game-clock system.

Correctly handle:

- First half
- Half-time
- Second half
- Added time
- Full-time whistle
- Paused game
- Goal celebrations
- Restart setup
- Penalty situations
- Extra time in qualifying knockout competitions

Provide appropriate timekeeping and stoppage-time logic.

Match time must never jump unexpectedly or accelerate when graphics quality or frame rate changes.

The user must have enough real playing time to build attacks, pass, defend, and participate in realistic football sequences.

## 14. REALISTIC 11v11 TEAM AI

Both teams must use genuine football tactics.

Implement roles for:

- Goalkeeper
- Center-backs
- Full-backs
- Defensive midfielders
- Central midfielders
- Attacking midfielders
- Wingers
- Strikers

Support formations such as:

- 4-3-3
- 4-4-2
- 4-2-3-1
- 3-5-2

AI behavior should include:

- Positional discipline
- Defensive recovery
- Pressing
- Marking
- Interceptions
- Supporting runs
- Passing combinations
- Counterattacking
- Switching play
- Tracking attackers
- Coordinated defending

Players must not all chase the ball simultaneously.

Players must return to realistic tactical positions after goals and during restarts.

## 15. PLAYER CAREER COMPATIBILITY

Preserve the existing Player Career mode.

If the user selects DEF, MID, or FWD, the controlled player must operate in their chosen position.

The remaining ten teammates must function through AI.

The controlled player should still have realistic positional freedom.

Allow meaningful involvement in attacking and defending situations without forcing the player into scripted running paths.

## 16. MANAGER CAREER COMPATIBILITY

Preserve the existing Manager Career mode.

The match simulation must recognize managerial decisions including:

- Formation
- Team tactics
- Substitutions
- Pressing intensity
- Attacking approach
- Defensive approach
- Player roles

Tactical decisions must affect actual match behavior.

The manager mode and player mode must use the same underlying football rules engine.

## 17. REST OF MATCH RULES

Implement the remaining applicable match regulations:

- Proper kick-off positioning
- Kick-off after each valid goal
- Half-time changes of ends
- Legal restarts after match interruptions
- Substitutions according to competition rules
- Injury interruptions
- Minimum player requirements
- Advantage decisions
- Dropped-ball situations
- Extra time when required
- Penalty shootouts when required
- Correct treatment of draws in league matches
- Appropriate match-end conditions

VAR-style decision review may be implemented if an actual deterministic event log and replay system supports it.

Do not display fake VAR decisions without corresponding rule validation.

Implement 2026/27 rule changes where applicable, including the time-limited substitution and restart-delay provisions.

## 18. MOBILE CONTROLS

The game is primarily for Android.

Provide a complete and practical touch-control system.

Attacking:

- MOVE
- SPRINT
- SHORT PASS
- THROUGH PASS
- LONG PASS / CROSS
- SHOOT
- SKILL / DRIBBLE

Defending:

- MOVE
- SPRINT
- TACKLE
- PRESS
- SWITCH PLAYER
- CLEAR BALL

Set pieces:

- AIM
- POWER
- PASS
- CROSS
- SHOOT

Allow contextual changes to controls.

Buttons must actually trigger the associated gameplay actions.

Avoid overlapping touch controls.

Support smooth performance on mobile devices.

## 19. CAMERA & FIELD VISIBILITY

Implement a camera that follows the real gameplay.

The camera must:

- Follow the ball intelligently.
- Allow visibility of both wings.
- Adapt to attacks entering the final third.
- Clearly show set pieces.
- Handle both attacking directions.
- Provide adequate view of passing options.

The camera must not visually or mechanically restrict gameplay to the center of the pitch.

## 20. TECHNICAL GAME ENGINE ARCHITECTURE

Inspect and improve the existing match engine.

Implement or refactor the following logical systems:

- MatchStateManager
- FootballRulesEngine
- BallPhysicsEngine
- BoundaryDetectionSystem
- RestartManager
- OffsideDetectionSystem
- RefereeDecisionEngine
- PassingSystem
- ShootingSystem
- PlayerMovementController
- TacticalAIManager
- GoalkeeperController
- MatchClockManager
- MatchEventLogger

Use the existing project's programming language and framework.

The match engine must have explicit states:

PRE_MATCH
KICK_OFF_SETUP
IN_PLAY
OUT_OF_PLAY
THROW_IN_SETUP
GOAL_KICK_SETUP
CORNER_KICK_SETUP
FREE_KICK_SETUP
PENALTY_SETUP
OFFSIDE_RESTART
GOAL_CELEBRATION
HALF_TIME
FULL_TIME
PAUSED

Ensure exactly one appropriate game state is active.

Every stoppage must transition reliably to a valid restart and then back to active gameplay.

Prevent infinite restart loops, duplicate goals, invalid ball placement, and frozen matches.

## 21. MANDATORY AUTOMATED TESTS

Do not consider the task complete until these cases work.

**Boundary tests**

1. Ball rolls completely over left touchline → throw-in.
2. Ball rolls completely over right touchline → throw-in.
3. Ball goes over goal line after attacker's touch → goal kick.
4. Ball goes over goal line after defender's touch → corner.
5. Ball partly overlaps a boundary line → remains in play.
6. Ball fully crosses a boundary in the air → correct restart.
7. Ball reaches the boundary → never becomes stuck against an invisible wall.
8. High-speed ball crosses a boundary → crossing is detected once.

**Offside tests**

9. Attacker is beyond the second-last opponent when teammate passes, then becomes actively involved → offside.
10. Attacker is level with second-last opponent → legal.
11. Attacker receives the ball directly from a throw-in → no offside.
12. Attacker receives directly from a corner → no offside.
13. Attacker receives directly from a goal kick → no offside.
14. Attacker remains in an offside position but does not interfere → no offence.
15. Attacker benefits from an opponent's deliberate save → apply offside correctly.

**Gameplay tests**

16. Player attacks down the left wing and crosses.
17. Player attacks down the right wing and crosses.
18. Two players complete a one-two passing combination.
19. Player shoots from a wide angle.
20. Defender blocks a shot for a corner.
21. Goalkeeper catches and distributes the ball.
22. AI teammates maintain positional structure.

**Match tests**

23. A goal is scored and players return to legal kick-off positions before restarting.
24. First half ends correctly.
25. Teams switch ends after half-time.
26. Selected match length controls clock speed correctly.
27. Game clock does not accelerate at lower or higher frame rates.
28. Pausing and resuming does not create multiple simulation loops.
29. No invalid match restart leaves the game permanently frozen.
30. Returning to the Main Menu preserves valid career progress.

## 22. DEBUGGING & QUALITY ASSURANCE

Provide a development-only debug mode.

Display:

- Current match state
- Ball position and velocity
- Last touch player/team
- Last boundary crossed
- Pending restart type
- Restart location
- Current game clock
- Offside line
- Last referee decision
- Relevant error logs

Use these diagnostics to find and correct actual gameplay issues.

Do not leave debug overlays enabled in the normal player experience.

## 23. DEVELOPMENT PRIORITY

Implement the changes in this strict order:

**PRIORITY 1 — FIX CORE GAMEPLAY**

- Ball freely leaving the pitch
- Correct boundary detection
- Working throw-ins, corners, and goal kicks
- Fixed match clock
- Working passing
- Attacking from both wings

**PRIORITY 2 — FOOTBALL RULES**

- Offside
- Fouls
- Free kicks
- Penalties
- Yellow/red cards
- Goalkeeper rules

**PRIORITY 3 — REALISM**

- Improved teammate AI
- Tactical formations
- Shooting variety
- Goalkeeper intelligence
- Player movement
- Camera responsiveness

**PRIORITY 4 — FINAL POLISH**

- Referee animations
- Restart animations
- Interface notifications
- Performance optimization
- Automated tests

## FINAL INSTRUCTIONS

Modify the actual existing project source code.

Do not create an unrelated football demo.

Do not substitute visual animations for functional football mechanics.

Do not claim that rules work unless the implementation has been tested.

If a specific rule requires functionality absent from the current engine, implement that dependency before marking the rule complete.

Preserve all working career and menu functionality.

The final result must feel like a genuine football game in which the user can pass, build attacks, defend, cross from the wings, win corners, take throw-ins, encounter offside decisions, and play a match at a comfortable speed.

**MOST IMPORTANT: The ball must NEVER become permanently stuck at the pitch boundaries, and football attacks must NEVER be restricted to the central corridor.**