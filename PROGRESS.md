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
- Milestone 2: rucks and recycling, fatigue, momentum.

### Decisions for Tom to review
- Tap an attacker to pass to him; tapping past a team-mate is a skip pass (longer flight, same forward-pass rule). Tap near the carrier = adjacent on that side. Keys: ← → adjacent, Q/E or Shift+arrow skip.
- Defenders the ball has got past by 1 m turn and chase at 5.9 m/s (carrier 5.6), so a clean break is not a certain try.
- Carrier runs straight; he cannot be steered. Wide attackers fan out slightly.
- Forward pass judged in the passer's frame (catch point vs where his hands will be). Gives scrum to defence, play resets.
- Defence: man-on-man by lane, cheats 18% towards the ball with 0.4s reading lag; marker charges inside 6.5 m, then is "over-run" and slow to turn if the ball is passed. That is the window to exploit.
- Tackle: 3d6 (+1 front on) must reach 7; otherwise carrier breaks and defender is beaten for 1.3s.
- Balance (bots): never passing ≈ 5% tries; passing once tackler commits ≈ 18%.
- Resets after tackle, try, forward pass, touch. Stats persist.
- `CLAUDE (1).md` has a stray " (1)" in its name; Claude Code only auto-loads `CLAUDE.md`. Not renamed.
