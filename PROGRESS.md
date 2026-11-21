# Progress

## Milestone 1: 5-a-side attack drill — built
Plan: sim (pure TS) → circles renderer with tilted portrait camera → tap input → tests → Pages deploy.

### What works
- `src/sim/`: seeded RNG, 5 attackers vs 5 defenders, passing chain, defence (line, slide, tackler, over-run, beaten), 3d6 tackles, try / forward pass / touch, auto reset. Headless Vitest tests incl. balance check.
- `src/render/`: tilted camera (far players smaller/higher), pitch, pass line through attackers, timing ring, circles, ball arc.
- `src/ui/`: HUD (tries, tackled, forward, streak), banner with dice, input (tap left/right half, ← → / A D).
- Playwright screenshots in portrait and landscape.
- GitHub Pages workflow on push to `main`.

### Next
- Idea from Tom: a touch rugby mode (touch instead of tackle, six touches, rollball, defence back 5 m). Fits this engine well; not started, waiting for go-ahead.
- Milestone 2: rucks and recycling, fatigue, momentum.

### Decisions for Tom to review
- Tap an attacker to pass to him; tapping past a team-mate is a skip pass (longer flight, same forward-pass rule). Tap near the carrier = adjacent on that side. Keys: ← → adjacent, Q/E or Shift+arrow skip.
- Defenders the ball has got past by 1 m turn and chase at 5.9 m/s (carrier 5.6), so a clean break is not a certain try.
- Carrier runs straight; he cannot be steered. Wide attackers fan out slightly.
- Forward pass if the receiver is in front of the passer when it is thrown (>0.3 m), or the ball goes forward relative to the passer's running frame. Play resets.
- Defence: man-on-man by lane, cheats 18% towards the ball with 0.4s reading lag; marker charges inside 6.5 m, then is "over-run" and slow to turn if the ball is passed. That is the window to exploit.
- Tackle: 3d6 (+1 front on) must reach 7; otherwise carrier breaks and defender is beaten for 1.3s.
- Balance (bots): never passing ≈ 5% tries; passing once tackler commits ≈ 18%.
- Handling (all 3d6, shown on screen):
  - Pass roll at release, minus 1 per team-mate skipped, minus 2 if hurried (defender within 2.2 m): 4 or less = missed pass (ball on floor), 5-7 = poor pass (+2 catch difficulty).
  - Catch roll: need 5, +1 per skip, +2 poor pass, +1 hurried, +2 if a defender is within 2.5 m of the receiver. Fail = knock-on.
  - Intercept: each defender who gets within 1.1 m of the ball in flight rolls once; 14+ picks it off.
  - Bot balance over 400 plays: 15% tries, 70% tackled, 12% knock-on, 3% missed pass.
- Errors counter = forward passes + knock-ons + missed passes + intercepts.
- Resets after tackle, try, forward pass, touch. Stats persist.
- `CLAUDE (1).md` has a stray " (1)" in its name; Claude Code only auto-loads `CLAUDE.md`. Not renamed.
