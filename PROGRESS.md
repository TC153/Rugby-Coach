# Progress

## Milestone 1: 5-a-side attack drill — done
Passing drill with tilted portrait camera, tap to pass, defence and 3d6 tackles. Deployed to GitHub Pages.

## Milestone 2 (with a first slice of 3): rucks and calling plays off them — built
Tom's brief: rugby is creating space by pulling defenders in. After a tackle, call the clear-out
count and the play while the ruck forms in slow motion; more defenders in the ruck means slower
ball but more space; quick ball means neither side is set.

### Plan (done)
1. 8 v 8 drill that opens on a ruck near our 22. Phases continue until try, turnover or error.
2. Ruck model: defence commits 0-2, attack sends 1-3 cleaners, jackal if a defender gets there first, 3d6 contest.
3. Ruck clock (real seconds; world runs at half speed). Ball out at max(ready time, your call); no call = 6 s.
4. Both sides reposition during the ruck: runners to slots on the called side, defence to guards + marks.
5. Ball out: half passes to 1st / 2nd runner or picks and goes. Runners not set = harder catch (and can be forward).
6. Call panel UI, offside lines, slot markers, camera follows the ball.

### What works
- `src/sim/`: phases, ruck state machine, contest dice, ready/fire timing, repositioning, marks after the ball
  comes out (fewer defenders in the line = unmarked runners), plus everything from milestone 1
  (pass/catch/intercept/tackle dice, forward pass, chasing defenders).
- `src/ui/ruckPanel.ts`: clear-out 1/2/3, play Pick & go / 1 out / 2 out, side, CALL IT, clock bar with
  ready (green) and fire (yellow) markers.
- HUD: tries, phase, turnovers, errors. Dice line shows every roll.
- 27 Vitest tests incl. timing rules, jackal/turnover, quick vs slow ball effects, balance; Playwright screenshots.

### Decisions for Tom to review
- 8 v 8 (5 v 5 had no room to manipulate). Defence commits 0-2 to a ruck: the nearest defender within 5 m
  goes in 85% of the time, a second 50%.
- Scrum-half is the nearest support player when the tackle is made; cleaners are the next nearest.
- Clear-out can be changed until the contest settles (everyone committed arrived, or 5 s on the clock).
- Contest: keep the ball if 3d6 + 2 x (cleaners - defenders) - 3 (jackal) reaches 7. No defender in = no roll.
- Ready time = when contest settled + 0.9 s + 1.1 s per defender + 1.0 s jackal - 0.35 s per spare cleaner,
  kept between 2.5 s and 6 s.
- Ruck clock is real seconds; players move at half speed during the ruck (the slow-mo).
- Runners not within 1.6 m of their slot when the ball comes out catch at +2 difficulty.
- Default side is the open (wider) side. Defaults reset every ruck: 2 clear-out, 1 out.
- Bot balance (calls instantly, passes when a defender commits): clear-out 1 ≈ 25% tries / 28% turnovers /
  1.6 phases; clear-out 3 ≈ 7% tries / 13% turnovers / 4.5 phases.

### Open questions
- Should your last call become the default for the next ruck?
- Defence ruck policy (how often they compete) could become a setting for the opposition.
- More plays: crash ball, wrap-around, pods of forwards. That is milestone 3 proper.

### Ideas
- Touch rugby mode (touch instead of tackle, six touches, rollball, defence back 5 m). Not started.
