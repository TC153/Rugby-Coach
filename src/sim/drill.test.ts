import { describe, expect, it } from 'vitest';
import * as C from './constants';
import {
  callPlay, carrier, createDrill, drainEvents, fireTime, lineAttackers, requestPass, requestPassTo,
  setClearOut, setPlay, setSide, stepDrill,
} from './drill';
import { Rng } from './rng';
import type { DrillState, SimEvent } from './types';

const DT = 1 / 60;

function stepUntil(s: DrillState, done: (s: DrillState) => boolean, maxSeconds = 30) {
  for (let i = 0; i < maxSeconds / DT && !done(s); i++) stepDrill(s, DT);
}
/** Step until the ball is out of the first ruck, collecting events. */
function playOut(s: DrillState): SimEvent[] {
  const ev: SimEvent[] = [];
  for (let i = 0; i < 12 / DT && s.phase === 'ruck'; i++) {
    stepDrill(s, DT);
    ev.push(...drainEvents(s));
  }
  return ev;
}
/** A drill where the ball is already out and the half has passed it on (no dice). */
function inOpenPlay(seed: number): DrillState {
  const s = createDrill(seed, { handlingDice: false });
  callPlay(s);
  playOut(s);
  stepUntil(s, (x) => !!carrier(x) && !x.ball.flight, 3);
  return s;
}

describe('rng', () => {
  it('is reproducible from a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it('rolls three dice between 1 and 6', () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) for (const d of r.roll3d6()) expect(d >= 1 && d <= 6).toBe(true);
  });
});

describe('drill setup', () => {
  it('opens with a ruck: 8 v 8, carrier and tackler down, defaults 2 clear-out and 1 out', () => {
    const s = createDrill(1);
    expect(s.players.filter((p) => p.team === 'att')).toHaveLength(C.PER_SIDE);
    expect(s.players.filter((p) => p.team === 'def')).toHaveLength(C.PER_SIDE);
    expect(s.phase).toBe('ruck');
    const r = s.ruck!;
    expect(s.players[r.carrierId]!.state).toBe('down');
    expect(s.players[r.tacklerId]!.state).toBe('down');
    expect(r.clearOut).toBe(2);
    expect(r.cleaners).toHaveLength(2);
    expect(r.play).toBe('one');
    expect(s.stats.phase).toBe(1);
  });
  it('defaults to the open (wider) side', () => {
    for (let seed = 1; seed < 30; seed++) {
      const r = createDrill(seed).ruck!;
      expect(r.side).toBe(r.x < C.CENTRE_X ? 1 : -1);
    }
  });
  it('is deterministic for a seed', () => {
    const a = createDrill(5);
    const b = createDrill(5);
    for (let i = 0; i < 900; i++) {
      stepDrill(a, DT);
      stepDrill(b, DT);
    }
    expect(a.players.map((p) => [p.x, p.y])).toEqual(b.players.map((p) => [p.x, p.y]));
  });
});

describe('ruck timing', () => {
  it('with no call the ball comes out at 6 seconds (or later if not ready)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createDrill(seed);
      const play = playOut(s).find((e) => e.type === 'play');
      if (!play || play.type !== 'play') continue; // turnover
      expect(play.clock).toBeGreaterThanOrEqual(C.DECISION_MAX - 0.02);
    }
  });

  it('calling early fires when the ball is ready, not before', () => {
    let fired = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = createDrill(seed);
      callPlay(s);
      let readyAt = 0;
      const ev = playOut(s);
      for (const e of ev) if (e.type === 'ruck-contest') readyAt = e.readyAt;
      const play = ev.find((e) => e.type === 'play');
      if (!play || play.type !== 'play') continue;
      fired++;
      expect(play.clock).toBeGreaterThanOrEqual(readyAt - 0.02);
      expect(play.clock).toBeLessThan(C.DECISION_MAX);
    }
    expect(fired).toBeGreaterThan(10);
  });

  it('calling late fires when you call', () => {
    const s = createDrill(2);
    stepUntil(s, (x) => (x.ruck?.readyAt ?? 99) + 0.5 < x.ruck!.clock || x.phase !== 'ruck', 10);
    if (s.phase !== 'ruck') return;
    const at = s.ruck!.clock;
    callPlay(s);
    expect(fireTime(s.ruck!)).toBeCloseTo(at, 5);
  });

  it('more defenders committed means slower ball', () => {
    const byDefs: Record<number, number[]> = {};
    for (let seed = 1; seed <= 150; seed++) {
      const s = createDrill(seed);
      for (const e of playOut(s)) {
        if (e.type === 'ruck-contest') (byDefs[e.result.defenders] ??= []).push(e.readyAt);
      }
    }
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(byDefs[0]!.length).toBeGreaterThan(5);
    expect(byDefs[1]!.length).toBeGreaterThan(5);
    expect(avg(byDefs[1]!)).toBeGreaterThan(avg(byDefs[0]!));
    for (const t of Object.values(byDefs).flat()) {
      expect(t).toBeGreaterThanOrEqual(C.RUCK_READY_MIN);
      expect(t).toBeLessThanOrEqual(C.RUCK_READY_MAX);
    }
  });
});

describe('ruck contest', () => {
  it('no defender in the ruck: no turnover', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = createDrill(seed);
      for (const e of playOut(s)) {
        if (e.type === 'ruck-contest' && e.result.defenders === 0) expect(e.result.turnover).toBe(false);
      }
    }
  });

  it('one cleaner gives up more turnovers than three', () => {
    const turnovers = (n: number) => {
      let t = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const s = createDrill(seed);
        setClearOut(s, n);
        playOut(s);
        if (s.phase === 'turnover') t++;
      }
      return t;
    };
    expect(turnovers(1)).toBeGreaterThan(turnovers(3));
  });

  it('a jackal on the ball before the clean-out makes it harder', () => {
    let jackalT = 0, jackalN = 0, cleanT = 0, cleanN = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const s = createDrill(seed);
      for (const e of playOut(s)) {
        if (e.type !== 'ruck-contest' || e.result.defenders === 0) continue;
        if (e.result.jackal) { jackalN++; if (e.result.turnover) jackalT++; }
        else { cleanN++; if (e.result.turnover) cleanT++; }
      }
    }
    expect(jackalN).toBeGreaterThan(10);
    if (cleanN > 10) expect(jackalT / jackalN).toBeGreaterThan(cleanT / cleanN);
  });

  it('clear-out can be changed until the contest is settled, then locks', () => {
    const s = createDrill(1);
    expect(setClearOut(s, 3)).toBe(true);
    expect(s.ruck!.cleaners).toHaveLength(3);
    stepUntil(s, (x) => x.ruck?.formedAt !== null || x.phase !== 'ruck', 10);
    if (s.phase === 'ruck') expect(setClearOut(s, 1)).toBe(false);
  });
});

describe('positions off the ruck', () => {
  it('quick ball: runners are less likely to be set than on slow ball', () => {
    let quick = 0, slow = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const a = createDrill(seed);
      callPlay(a);
      for (const e of playOut(a)) if (e.type === 'play') quick += e.unset;
      const b = createDrill(seed);
      for (const e of playOut(b)) if (e.type === 'play') slow += e.unset;
    }
    expect(quick).toBeGreaterThan(slow);
  });

  it('quick ball: defence is still bunched near the ruck; slow ball lets it spread', () => {
    const spread = (call: boolean) => {
      let total = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const s = createDrill(seed);
        if (call) callPlay(s);
        const rx = s.ruck!.x;
        playOut(s);
        if (s.phase !== 'live') continue;
        for (const d of s.players) if (d.team === 'def' && d.job === 'line') total += Math.abs(d.x - rx);
      }
      return total;
    };
    expect(spread(false)).toBeGreaterThan(spread(true));
  });

  it('runners line up on the called side', () => {
    const s = createDrill(4);
    setSide(s, 1);
    stepUntil(s, (x) => x.ruck!.clock > 4 || x.phase !== 'ruck', 6);
    if (s.phase !== 'ruck') return;
    const r = s.ruck!;
    for (const p of s.players) {
      if (p.team === 'att' && p.job === 'line') expect(p.slotX).toBeGreaterThan(r.x);
    }
  });
});

describe('plays', () => {
  it('1 out: the half passes to the first runner', () => {
    const s = createDrill(1, { handlingDice: false });
    setPlay(s, 'one');
    const halfId = s.ruck!.halfId;
    const ev = playOut(s);
    const pass = ev.find((e) => e.type === 'pass');
    expect(pass?.type).toBe('pass');
    if (pass?.type === 'pass') expect(pass.from).toBe(halfId);
  });
  it('pick and go: the half keeps it', () => {
    const s = createDrill(1, { handlingDice: false });
    setPlay(s, 'pick');
    const ev = playOut(s);
    expect(ev.some((e) => e.type === 'pass')).toBe(false);
    expect(carrier(s)).not.toBeNull();
  });
  it('a tackle in open play starts the next ruck and the phase count goes up', () => {
    const s = createDrill(3, { handlingDice: false });
    callPlay(s);
    playOut(s);
    stepUntil(s, (x) => x.phase !== 'live', 30);
    if (s.phase === 'ruck') expect(s.stats.phase).toBe(2);
  });
});

describe('passing in open play', () => {
  it('a pass to a receiver in front of the passer is forward', () => {
    const s = inOpenPlay(3);
    const c = carrier(s)!;
    const r = lineAttackers(s).find((p) => p.id !== c.id)!;
    r.y = c.y + 2;
    requestPassTo(s, r.lane);
    stepUntil(s, (x) => x.phase !== 'live', 2);
    expect(s.phase).toBe('forward');
  });
  it('a pass to a receiver behind is fine and the ball arrives', () => {
    const s = inOpenPlay(3);
    const c = carrier(s)!;
    const r = lineAttackers(s).find((p) => p.lane === c.lane + 1) ?? lineAttackers(s).find((p) => p.lane === c.lane - 1)!;
    r.y = c.y - 3;
    expect(requestPassTo(s, r.lane)).toBe(true);
    stepUntil(s, (x) => !!carrier(x), 2);
    expect(carrier(s)?.id).toBe(r.id);
  });
  it('cannot pass while the ball is in the air, or to yourself', () => {
    const s = inOpenPlay(3);
    const c = carrier(s)!;
    expect(requestPassTo(s, c.lane)).toBe(false);
    expect(requestPass(s, 1) || requestPass(s, -1)).toBe(true);
    expect(requestPass(s, 1)).toBe(false);
  });
  it('defenders turn and chase once the carrier is through the line', () => {
    const s = inOpenPlay(4);
    const c = carrier(s)!;
    c.y = 45;
    for (let i = 0; i < 30; i++) stepDrill(s, DT);
    const chasing = s.players.filter((d) => d.team === 'def' && d.job === 'line' && d.state !== 'down');
    expect(chasing.every((d) => d.vy > 1)).toBe(true);
  });
});

describe('balance', () => {
  /** Calls it straight away, passes along the line when a defender commits, never forward. */
  function bot(s: DrillState, seed: number) {
    if (s.phase === 'ruck') callPlay(s);
    const c = carrier(s);
    if (s.phase !== 'live' || !c || s.ball.flight) return;
    const t = s.players.find((p) => p.team === 'def' && p.state === 'tackler');
    if (!t || Math.hypot(t.x - c.x, t.y - c.y) > 5) return;
    for (const d of seed % 2 ? [1, -1] : [-1, 1]) {
      const r = lineAttackers(s).find((p) => p.lane === c.lane + d);
      if (r && r.y < c.y - 0.5) {
        requestPass(s, d as 1 | -1);
        return;
      }
    }
  }

  it('attacks end in a mix of tries, turnovers and errors', () => {
    const out: Record<string, number> = {};
    let phases = 0;
    const N = 80;
    for (let seed = 1; seed <= N; seed++) {
      const s = createDrill(seed);
      for (let i = 0; i < 90 / DT && (s.phase === 'live' || s.phase === 'ruck'); i++) {
        bot(s, seed);
        stepDrill(s, DT);
      }
      out[s.phase] = (out[s.phase] ?? 0) + 1;
      phases += s.stats.phase;
    }
    console.log('balance', JSON.stringify(out), 'avg phases', (phases / N).toFixed(2));
    expect(out.try ?? 0).toBeGreaterThan(3);
    expect(out.turnover ?? 0).toBeGreaterThan(3);
    expect(phases / N).toBeGreaterThan(1.3);
  }, 30000);
});
