import { describe, expect, it } from 'vitest';
import * as C from './constants';
import { carrier, createDrill, drainEvents, requestPass, requestPassTo, stepDrill } from './drill';
import { Rng } from './rng';
import type { DrillState } from './types';

const DT = 1 / 60;

function runUntilStopped(s: DrillState, policy?: (s: DrillState) => void, maxSeconds = 20) {
  for (let i = 0; i < maxSeconds / DT && s.phase === 'live'; i++) {
    policy?.(s);
    stepDrill(s, DT);
  }
}

describe('rng', () => {
  it('is reproducible from a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it('rolls three dice between 1 and 6', () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) {
      for (const d of r.roll3d6()) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('drill setup', () => {
  it('has five attackers and five defenders, ball with the middle attacker', () => {
    const s = createDrill(1);
    expect(s.players.filter((p) => p.team === 'att')).toHaveLength(5);
    expect(s.players.filter((p) => p.team === 'def')).toHaveLength(5);
    expect(carrier(s)?.lane).toBe(2);
    expect(s.players.filter((p) => p.team === 'att').every((p) => p.y < C.DEF_START_Y)).toBe(true);
  });
  it('is deterministic for a seed', () => {
    const a = createDrill(5);
    const b = createDrill(5);
    for (let i = 0; i < 300; i++) {
      stepDrill(a, DT);
      stepDrill(b, DT);
    }
    expect(a.players.map((p) => [p.x, p.y])).toEqual(b.players.map((p) => [p.x, p.y]));
  });
});

describe('passing', () => {
  it('moves the ball to the neighbouring attacker', () => {
    const s = createDrill(1);
    for (let i = 0; i < 30; i++) stepDrill(s, DT);
    expect(requestPass(s, 1)).toBe(true);
    expect(s.ball.carrierId).toBeNull();
    for (let i = 0; i < 40; i++) stepDrill(s, DT);
    expect(carrier(s)?.lane).toBe(3);
  });
  it('cannot pass past the end of the line', () => {
    const s = createDrill(1);
    for (let i = 0; i < 20; i++) stepDrill(s, DT);
    requestPass(s, 1);
    for (let i = 0; i < 30; i++) stepDrill(s, DT);
    requestPass(s, 1);
    for (let i = 0; i < 30; i++) stepDrill(s, DT);
    expect(carrier(s)?.lane).toBe(4);
    expect(requestPass(s, 1)).toBe(false);
  });
  it('cannot pass while the ball is in the air', () => {
    const s = createDrill(1);
    expect(requestPass(s, 1)).toBe(true);
    expect(requestPass(s, -1)).toBe(false);
  });
  it('a pass to a receiver who is ahead of the passer is forward and stops play', () => {
    const s = createDrill(3);
    for (let i = 0; i < 30; i++) stepDrill(s, DT);
    s.players[3]!.y = s.players[2]!.y + 3;
    expect(requestPass(s, 1)).toBe(true);
    for (let i = 0; i < 60 && s.phase === 'live'; i++) stepDrill(s, DT);
    expect(s.phase).toBe('forward');
    expect(s.stats.forwardPasses).toBe(1);
  });
  it('a normal pass behind the passer is not forward', () => {
    const s = createDrill(3);
    for (let i = 0; i < 30; i++) stepDrill(s, DT);
    requestPass(s, -1);
    for (let i = 0; i < 40; i++) stepDrill(s, DT);
    expect(s.stats.forwardPasses).toBe(0);
    expect(carrier(s)?.lane).toBe(1);
  });
});

describe('skip pass', () => {
  it('goes over a team-mate to the attacker two lanes away', () => {
    const s = createDrill(1);
    for (let i = 0; i < 30; i++) stepDrill(s, DT);
    expect(requestPassTo(s, 4)).toBe(true);
    for (let i = 0; i < 60; i++) stepDrill(s, DT);
    expect(carrier(s)?.lane).toBe(4);
    expect(s.stats.forwardPasses).toBe(0);
  });
  it('takes longer in the air than a short pass', () => {
    const a = createDrill(1);
    const b = createDrill(1);
    requestPassTo(a, 3);
    requestPassTo(b, 4);
    expect(b.ball.flight!.dur).toBeGreaterThan(a.ball.flight!.dur);
  });
  it('rejects passing to yourself or off the end', () => {
    const s = createDrill(1);
    expect(requestPassTo(s, 2)).toBe(false);
    expect(requestPassTo(s, 5)).toBe(false);
  });
});

describe('defence', () => {
  it('defenders turn and chase once the carrier is through the line', () => {
    const s = createDrill(4);
    for (let i = 0; i < 10; i++) stepDrill(s, DT);
    // Put the carrier clean through, behind every defender.
    const c = carrier(s)!;
    c.y = 40;
    c.x = 35;
    for (let i = 0; i < 30; i++) stepDrill(s, DT);
    const defs = s.players.filter((p) => p.team === 'def');
    expect(defs.every((d) => d.vy > 1)).toBe(true);
  });

  it('tackles a carrier who never passes, and shows the dice', () => {
    let tackled = 0;
    let tries = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = createDrill(seed);
      runUntilStopped(s);
      if (s.phase === 'tackled') {
        tackled++;
        const tk = drainEvents(s).filter((e) => e.type === 'tackle');
        expect(tk.length).toBeGreaterThan(0);
      }
      if (s.phase === 'try') tries++;
    }
    expect(tackled).toBeGreaterThanOrEqual(30);
    expect(tries).toBeLessThanOrEqual(8);
  });

  it('resets after a tackle, keeping the stats', () => {
    const s = createDrill(2);
    runUntilStopped(s);
    expect(s.phase).not.toBe('live');
    const resets = s.resets;
    for (let i = 0; i < 4 / DT && s.resets === resets; i++) stepDrill(s, DT);
    expect(s.phase).toBe('live');
    expect(s.resets).toBe(resets + 1);
    expect(carrier(s)?.lane).toBe(2);
    expect(s.stats.tackled + s.stats.tries + s.stats.forwardPasses).toBeGreaterThan(0);
  });
});

describe('balance', () => {
  /** Pass one way along the line as soon as a defender commits to the carrier. */
  function wideBot(dirPref: 1 | -1) {
    return (s: DrillState) => {
      const c = carrier(s);
      if (!c || s.ball.flight || c.lane === 0 || c.lane === 4) return;
      const tackler = s.players.find((p) => p.team === 'def' && p.state === 'tackler');
      if (tackler && Math.hypot(tackler.x - c.x, tackler.y - c.y) < 5.5) requestPass(s, dirPref);
    };
  }

  it('a well-timed passing bot scores more than a bot that never passes', () => {
    let passTries = 0;
    let runTries = 0;
    const N = 80;
    for (let seed = 1; seed <= N; seed++) {
      const a = createDrill(seed);
      runUntilStopped(a, wideBot(seed % 2 ? 1 : -1));
      if (a.phase === 'try') passTries++;
      const b = createDrill(seed);
      runUntilStopped(b);
      if (b.phase === 'try') runTries++;
    }
    console.log(`balance: passing bot ${passTries}/${N} tries, never-pass bot ${runTries}/${N}`);
    expect(passTries).toBeGreaterThan(runTries * 2);
    expect(passTries).toBeLessThan(N * 0.6);
  });
});
