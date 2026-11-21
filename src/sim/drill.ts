import * as C from './constants';
import { Rng } from './rng';
import type { DrillState, Player, SimEvent } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function laneX(lane: number): number {
  return C.CENTRE_X + (lane - (C.LANES - 1) / 2) * C.LANE_SPACING;
}

function makePlayers(rng: Rng): Player[] {
  const players: Player[] = [];
  for (let lane = 0; lane < C.LANES; lane++) {
    players.push({
      id: lane, team: 'att', lane, x: laneX(lane), y: C.ATT_START_Y - C.DEPTH_STEP * Math.abs(lane - 2),
      vx: 0, vy: 0, state: 'run', timer: 0, seenBallX: C.CENTRE_X,
    });
  }
  for (let lane = 0; lane < C.LANES; lane++) {
    // Defenders start roughly in line with their attacker, a little off.
    const x = laneX(lane) + rng.range(-1.2, 1.2);
    players.push({
      id: C.LANES + lane, team: 'def', lane, x, y: C.DEF_START_Y + rng.range(-0.5, 0.5),
      vx: 0, vy: 0, state: 'line', timer: 0, seenBallX: C.CENTRE_X,
    });
  }
  return players;
}

/** Create a fresh drill. The ball starts with the middle attacker. */
export function createDrill(seed: number): DrillState {
  const rng = new Rng(seed);
  const state: DrillState = {
    time: 0, seed, resets: 0, phase: 'live', resetIn: 0, playTime: 0,
    players: makePlayers(rng),
    ball: { x: laneX(2), y: C.ATT_START_Y, carrierId: 2, flight: null },
    stats: { tries: 0, tackled: 0, forwardPasses: 0, streak: 0 },
    events: [],
    lineY: C.DEF_START_Y,
    rng,
  };
  return state;
}

export function attackers(s: DrillState): Player[] {
  return s.players.filter((p) => p.team === 'att');
}
export function defenders(s: DrillState): Player[] {
  return s.players.filter((p) => p.team === 'def');
}
export function carrier(s: DrillState): Player | null {
  return s.ball.carrierId === null ? null : s.players[s.ball.carrierId]!;
}

function emit(s: DrillState, e: SimEvent) {
  s.events.push(e);
}

/** Take events produced since the last call. */
export function drainEvents(s: DrillState): SimEvent[] {
  const e = s.events;
  s.events = [];
  return e;
}

/** Reset positions for the next play. Stats and the RNG carry on. */
function resetPlay(s: DrillState) {
  s.players = makePlayers(s.rng);
  s.ball = { x: laneX(2), y: C.ATT_START_Y, carrierId: 2, flight: null };
  s.phase = 'live';
  s.resetIn = 0;
  s.playTime = 0;
  s.lineY = C.DEF_START_Y;
  s.resets++;
  emit(s, { type: 'reset' });
}

/**
 * The ball carrier passes to the next attacker left (-1) or right (+1).
 * Returns true if a pass was thrown.
 */
export function requestPass(s: DrillState, dir: -1 | 1): boolean {
  const c = carrier(s);
  if (!c) return false;
  return requestPassTo(s, c.lane + dir);
}

/** Pass to any other attacker by lane. Passing over a team-mate is a skip pass. */
export function requestPassTo(s: DrillState, toLane: number): boolean {
  if (s.phase !== 'live' || s.ball.flight || s.ball.carrierId === null) return false;
  const from = s.players[s.ball.carrierId]!;
  if (toLane < 0 || toLane >= C.LANES || toLane === from.lane) return false;
  const to = s.players[toLane]!;
  const sample = ballDur(from, to);
  // Forward is judged in the passer's frame: where the receiver catches it compared
  // with where the passer's hands will be by then (both are running up the pitch).
  const catchY = to.y + to.vy * sample;
  const handsY = from.y + from.vy * sample;
  const forward = catchY > handsY + C.FORWARD_TOLERANCE;
  s.ball.flight = {
    passerId: from.id, receiverId: to.id, fromX: from.x, fromY: from.y,
    t: 0, dur: sample, forward,
  };
  s.ball.carrierId = null;
  emit(s, { type: 'pass', from: from.id, to: to.id, forward });
  return true;
}

function ballDur(a: Player, b: Player): number {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.max(C.MIN_PASS_TIME, d / C.BALL_SPEED);
}

/** Move velocity towards a desired velocity with limited acceleration. */
function accelerate(p: Player, dvx: number, dvy: number, a: number, dt: number) {
  const ex = dvx - p.vx;
  const ey = dvy - p.vy;
  const len = Math.hypot(ex, ey);
  const maxStep = a * dt;
  if (len <= maxStep || len === 0) {
    p.vx = dvx;
    p.vy = dvy;
  } else {
    p.vx += (ex / len) * maxStep;
    p.vy += (ey / len) * maxStep;
  }
}

function stepAttackers(s: DrillState, dt: number) {
  const holder = s.ball.carrierId !== null ? s.players[s.ball.carrierId]! : null;
  // Reference lane/depth: the carrier, or the receiver while the ball is in the air.
  const refId = holder ? holder.id : s.ball.flight!.receiverId;
  const ref = s.players[refId]!;
  for (const p of attackers(s)) {
    let dvy: number;
    if (p.id === refId && holder) {
      dvy = C.CARRIER_SPEED;
    } else {
      const target = ref.y - C.DEPTH_STEP * Math.abs(p.lane - ref.lane);
      dvy = clamp(C.CARRIER_SPEED + (target - p.y) * 3.0, C.SUPPORT_MIN_SPEED, C.SUPPORT_MAX_SPEED);
    }
    // Fan out slightly towards the touchlines so wide players find width.
    const dvx = (p.lane - 2) * C.FAN_OUT;
    accelerate(p, dvx, dvy, 18, dt);
  }
}

function stepDefenders(s: DrillState, dt: number) {
  s.lineY = Math.max(s.lineY - C.LINE_SPEED * dt, C.ATT_START_Y + 4);
  const holder = s.ball.carrierId !== null ? s.players[s.ball.carrierId]! : null;
  const ballX = s.ball.x;
  const atts = attackers(s);

  for (const d of defenders(s)) {
    // Lagged read of where the ball is.
    d.seenBallX += (ballX - d.seenBallX) * clamp(dt / C.DEF_REACTION, 0, 1);
    const mark = atts[d.lane]!;

    if (d.state === 'beaten') {
      d.timer -= dt;
      accelerate(d, 0, 0, 10, dt);
      if (d.timer <= 0) d.state = 'line';
      continue;
    }

    if (d.state === 'overran') {
      // Committed to the old carrier: still moving, can barely change direction.
      d.timer -= dt;
      const targetX = mark.x + C.DEF_SLIDE * (d.seenBallX - mark.x);
      const lat = clamp(targetX - d.x, -1, 1) * C.OVERRAN_LATERAL_SPEED;
      accelerate(d, lat, Math.max(d.vy * 0.6, 0), 8, dt);
      if (d.timer <= 0) d.state = 'line';
      continue;
    }

    if (d.state === 'tackler') {
      if (!holder) {
        // Ball has gone: the tackler is out of the play for a moment.
        d.state = 'overran';
        d.timer = C.OVERRAN_TIME;
        continue;
      }
      // Head for where the carrier will be, a little ahead.
      const lead = clamp(Math.hypot(holder.x - d.x, holder.y - d.y) / C.TACKLER_SPEED, 0, 0.6);
      const tx = holder.x + holder.vx * lead;
      const ty = holder.y + holder.vy * lead;
      const dx = tx - d.x;
      const dy = ty - d.y;
      const len = Math.hypot(dx, dy) || 1;
      accelerate(d, (dx / len) * C.TACKLER_SPEED, (dy / len) * C.TACKLER_SPEED, C.DEF_ACCEL, dt);
      continue;
    }

    // Ball (or carrier) has got past this defender: turn and chase it down.
    const ballY = holder ? holder.y : s.ball.flight ? s.players[s.ball.flight.receiverId]!.y : s.ball.y;
    if (ballY > d.y + C.BEATEN_MARGIN) {
      const tgt = holder ?? s.players[s.ball.flight ? s.ball.flight.receiverId : 0]!;
      const lead = clamp(Math.hypot(tgt.x - d.x, tgt.y - d.y) / C.CHASE_SPEED, 0, 0.8);
      const dx = tgt.x + tgt.vx * lead - d.x;
      const dy = tgt.y + tgt.vy * lead - d.y;
      const len = Math.hypot(dx, dy) || 1;
      accelerate(d, (dx / len) * C.CHASE_SPEED, (dy / len) * C.CHASE_SPEED, C.DEF_ACCEL, dt);
      continue;
    }

    // Holding the line.
    if (holder) {
      const dist = Math.hypot(holder.x - d.x, holder.y - d.y);
      const isMark = d.lane === holder.lane;
      if (dist < C.TACKLE_TRIGGER && (isMark || dist < C.TACKLE_TRIGGER * 0.55)) {
        d.state = 'tackler';
        continue;
      }
    }
    const targetX = mark.x + C.DEF_SLIDE * (d.seenBallX - mark.x);
    const dvx = clamp((targetX - d.x) * 4, -C.DEF_LATERAL_SPEED, C.DEF_LATERAL_SPEED);
    const dvy = clamp((s.lineY - d.y) * 4, -C.DEF_FORWARD_SPEED, C.DEF_FORWARD_SPEED);
    accelerate(d, dvx, dvy, C.DEF_ACCEL, dt);
  }
}

function stepBall(s: DrillState, dt: number) {
  const b = s.ball;
  if (b.flight) {
    const f = b.flight;
    f.t += dt;
    const recv = s.players[f.receiverId]!;
    const k = clamp(f.t / f.dur, 0, 1);
    b.x = f.fromX + (recv.x - f.fromX) * k;
    b.y = f.fromY + (recv.y - f.fromY) * k;
    if (f.t >= f.dur) {
      b.flight = null;
      if (f.forward) {
        s.phase = 'forward';
        s.resetIn = C.RESET_DELAY;
        s.stats.forwardPasses++;
        s.stats.streak = 0;
        emit(s, { type: 'forward-pass' });
      } else {
        b.carrierId = recv.id;
      }
    }
  } else if (b.carrierId !== null) {
    const c = s.players[b.carrierId]!;
    b.x = c.x;
    b.y = c.y;
  }
}

function checkTackles(s: DrillState) {
  const holder = carrier(s);
  if (!holder || s.phase !== 'live') return;
  for (const d of defenders(s)) {
    if (d.state === 'beaten') continue;
    const dist = Math.hypot(holder.x - d.x, holder.y - d.y);
    if (dist > C.TACKLE_CONTACT) continue;
    const dice = s.rng.roll3d6();
    const total = dice[0] + dice[1] + dice[2];
    // Hitting the carrier front on helps the defender.
    const frontOn = d.y >= holder.y ? 1 : -1;
    const made = total + frontOn >= C.TACKLE_TARGET;
    emit(s, { type: 'tackle', dice, total, made, tacklerId: d.id });
    if (made) {
      s.phase = 'tackled';
      s.resetIn = C.RESET_DELAY;
      s.stats.tackled++;
      s.stats.streak = 0;
      holder.state = 'down';
      d.state = 'down';
      for (const p of s.players) {
        p.vx = 0;
        p.vy = 0;
      }
    } else {
      d.state = 'beaten';
      d.timer = C.BEATEN_TIME;
    }
    return;
  }
}

function checkScoring(s: DrillState) {
  const holder = carrier(s);
  if (!holder || s.phase !== 'live') return;
  if (holder.y >= C.TRY_LINE_Y) {
    s.phase = 'try';
    s.resetIn = C.RESET_DELAY;
    s.stats.tries++;
    s.stats.streak++;
    emit(s, { type: 'try' });
    for (const p of s.players) {
      p.vx = 0;
      p.vy = 0;
    }
  } else if (holder.x < 0 || holder.x > C.PITCH_W) {
    s.phase = 'touch';
    s.resetIn = C.RESET_DELAY;
    s.stats.streak = 0;
    emit(s, { type: 'touch' });
  }
}

/** Advance the drill by dt seconds. */
export function stepDrill(s: DrillState, dt: number) {
  s.time += dt;
  if (s.phase !== 'live') {
    s.resetIn -= dt;
    if (s.resetIn <= 0) resetPlay(s);
    return;
  }
  s.playTime += dt;
  stepAttackers(s, dt);
  stepDefenders(s, dt);
  for (const p of s.players) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  stepBall(s, dt);
  checkTackles(s);
  checkScoring(s);
}
