# Rugby coach game

A 2D rugby union game where the player is the coach: they set the system and call plays, and the
players carry them out. Inspired by the feel of EA Rugby 08, but strategy first, modern laws, and
less arcade.

## Clean-room rule (do not break)
- Never copy, translate or look up code, art, audio, names or data from Rugby 08 or any EA game,
  including the rugby08-web repo. Work only from the design notes in this repo.
- No real players, teams or competitions. All names are invented.

## Tech
- TypeScript, Vite, HTML canvas (or Phaser if it clearly helps). Runs in the browser.
- Vitest for unit tests. Playwright for screenshots of the running game.
- Ask before adding any other dependency.
- Must play on a phone: touch controls first (tap to pass), mouse and keyboard as well. Portrait
  and landscape layouts.
- Deploy to GitHub Pages with a GitHub Actions workflow on every push to `main`, so the latest
  build can be played from a phone browser.

## Camera and art style
- Portrait phone first. The pitch runs up the screen.
- The player's team is always at the bottom: attacking up the screen with the ball, facing the
  opposition coming down the screen without it. The camera never flips on a turnover.
- Slight three-quarter tilt: players further up the screen are drawn a little smaller and higher,
  so the backline and the defensive line both read clearly. Not true 3D.
- Pixel art. Milestone 1 uses plain circles. Then placeholder sprites from a sprite sheet format,
  ready for Tom to swap in his own drawings.
- Sprites about 16 to 24 pixels tall, scaled up crisply (no smoothing). Views needed: back (own team),
  front (opposition), side (running across). Frames: run, pass, catch, tackle, on the ground.
- Kit colours swapped in code, so one set of drawings covers every team.
- Rucks, scrums and mauls drawn as a sprite pile with a simple effect, not detailed animation.

## Architecture
- `src/sim/`: the match simulation. Pure TypeScript, no drawing code. Must run headless in tests.
- `src/render/`: draws the sim state (players as circles, ball, pitch, pass lines).
- `src/ui/`: menus, play-call cards, HUD.
- Match brain: a state machine for the match phase (kick-off, open play, ruck, maul, scrum,
  lineout, penalty, goal kick, broken play).
- Player brains: each player has a role state (ball carrier, support runner, defender in line,
  guard at ruck, scrum-half, full-back, on the ground) and follows the team's set system.
- Separate modules for ball physics, referee, set plays and fatigue/momentum.
- All randomness through one seeded random number generator, so a match can be replayed exactly
  from its seed and the list of calls. Dice rolls (3d6) are shown to the player.

## Design pillars
- Coach, not player: no direct control of runners. You call plays; the team defaults to its set
  system when no call is made, and going off-system costs continuity.
- System choices (line speed, kicking vs running, defensive shape) are set before the match and
  at half time, not changed every phase.
- Plays are loaded as short sequences (e.g. three phases), with the defence responding each phase.
- Decisions depend on zone (own 22, middle, opposition 22), time left, and channel (width).
- Fatigue is split between forwards and backs. Momentum is a separate counter. Both affect
  handling errors, kick distance and gain-line success.
- Modern laws: 50:22, goal-line drop-out, ruck "use it" timing, tackle height.
- Built full for rugby fans: no hand-holding, strip back later after playtesting.

## Milestones (build in order, one at a time)
1. 5-a-side attack drill vs 5 defenders on half a pitch, in the camera view above: circles move, a pass line runs through
   the attackers, the player times each pass. Defence moves and tackles. Resets after a tackle.
2. Rucks and recycling: phases continue after a tackle; fatigue and momentum start to matter.
3. Play-call cards and three-phase sequences for attack and defence.
4. Full 15-a-side open play with zones, kicking and touch.
5. Set pieces: scrum, lineout, maul. Then penalties, referee tendencies, goal kicking.
6. Full 40-minute match (two halves of twenty) with a countdown and half-time talk.
7. Later: training week, squads via draft, seasons.

## How to work
- Plan first, then build the current milestone only. Keep each step small and runnable.
- Write tests for sim rules. Run tests and take a Playwright screenshot before calling a step done.
- Commit after each working step with a clear message.
- Keep `PROGRESS.md` updated: what works, what's next, open design questions.
- If a design question isn't answered here, ask instead of guessing.
