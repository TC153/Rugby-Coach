import * as C from './constants';
import { Rng } from './rng';
import type { DrillOptions, DrillState, PlayCall, Player, Ruck, SimEvent } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------------------
// Setup

function newPlayer(id: number, team: Player['team'], x: number, y: number): Player {
  return {
    id, team, job: 'line', lane: -1, x, y, vx: 0, vy: 0,
    state: team === 'att' ? 'run' : 'line', timer: 0, seenBallX: x, markId: -1,
    rejoinIn: 0, slotX: x, slotY: y, set: false, arrivedAt: null,
  };
}

/**
 * A fresh attack: a tackle has just been made at a point near our 22.
 * Attackers are scattered behind it, defenders in front, as after a carry.
 */
function scenario(s: DrillState) {
  const rng = s.rng;
  const rx = rng.range(22, 48);
  const ry = C.START_RUCK_Y;
  const players: Player[] = [];
  players.push(newPlayer(0, 'att', rx, ry));
  for (let i = 1; i < C.PER_SIDE; i++) {
    // The first few are close support, the rest spread out behind.
    const near = i <= 3;
    const x = clamp(rx + rng.range(near ? -5 : -17, near ? 5 : 17), 4, C.PITCH_W - 4);
    players.push(newPlayer(i, 'att', x, ry - rng.range(near ? 1.5 : 3, near ? 5 : 10)));
  }
  players.push(newPlayer(C.PER_SIDE, 'def', rx + rng.range(-0.4, 0.4), ry + 0.7));
  for (let i = 1; i < C.PER_SIDE; i++) {
    const x = clamp(rx + rng.range(-18, 18), 4, C.PITCH_W - 4);
    players.push(newPlayer(C.PER_SIDE + i, 'def', x, ry + rng.range(1.5, 9)));
  }
  s.players = players;
  s.ball = { x: rx, y: ry, carrierId: 0, flight: null };
  s.stats.phase = 0;
  startRuck(s, 0, C.PER_SIDE);
}

/** Create a drill. It opens with a tackle made: the first ruck. */
export function createDrill(seed: number, options: Partial<DrillOptions> = {}): DrillState {
  const s: DrillState = {
    time: 0, seed, resets: 0, phase: 'ruck', resetIn: 0,
    players: [],
    ball: { x: 0, y: 0, carrierId: null, flight: null },
    ruck: null,
    stats: { tries: 0, phase: 0, bestPhase: 0, tackled: 0, turnovers: 0, forwardPasses: 0, handlingErrors: 0 },
    events: [],
    lineY: 0,
    rng: new Rng(seed),
    options: { handlingDice: true, ...options },
  };
  scenario(s);
  return s;
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
/** Attackers in the pass line, left to right. */
export function lineAttackers(s: DrillState): Player[] {
  return s.players.filter((p) => p.team === 'att' && p.lane >= 0).sort((a, b) => a.lane - b.lane);
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

function stopPlay(s: DrillState, phase: DrillState['phase']) {
  s.phase = phase;
  s.resetIn = C.RESET_DELAY;
  s.ruck = null;
  for (const p of s.players) {
    p.vx = 0;
    p.vy = 0;
  }
}

function resetPlay(s: DrillState) {
  s.resets++;
  scenario(s);
  emit(s, { type: 'reset' });
}

/** Rank attackers in the line by x, so the pass line runs left to right. */
function computeLanes(s: DrillState) {
  const line = s.players.filter((p) => p.team === 'att' && p.job === 'line' && p.state !== 'down');
  line.sort((a, b) => a.x - b.x);
  for (const p of s.players) if (p.team === 'att') p.lane = -1;
  line.forEach((p, i) => (p.lane = i));
}

function nearestDefender(s: DrillState, x: number, y: number): number {
  let best = Infinity;
  for (const d of s.players) {
    if (d.team !== 'def' || d.job === 'ruck' || d.state === 'beaten' || d.state === 'down') continue;
    best = Math.min(best, Math.hypot(d.x - x, d.y - y));
  }
  return best;
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

/** Run towards a point, slowing as you arrive. */
function runTo(p: Player, tx: number, ty: number, speed: number, dt: number) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const v = Math.min(speed, d * 3);
  accelerate(p, d > 0.01 ? (dx / d) * v : 0, d > 0.01 ? (dy / d) * v : 0, 20, dt);
}

// ---------------------------------------------------------------------------
// Ruck

function startRuck(s: DrillState, carrierId: number, tacklerId: number) {
  const c = s.players[carrierId]!;
  const t = s.players[tacklerId]!;
  const rx = clamp(c.x, 5, C.PITCH_W - 5);
  const ry = c.y;
  s.stats.phase++;
  s.stats.bestPhase = Math.max(s.stats.bestPhase, s.stats.phase);
  s.phase = 'ruck';
  s.ball.flight = null;
  s.ball.carrierId = null;
  s.ball.x = rx;
  s.ball.y = ry - 0.6;

  for (const p of s.players) {
    p.job = 'line';
    p.markId = -1;
    p.arrivedAt = null;
    p.rejoinIn = 0;
    p.set = false;
    // Everyone from the last breakdown is back on his feet.
    p.state = p.team === 'att' ? 'run' : 'line';
  }
  for (const p of [c, t]) {
    p.state = 'down';
    p.job = 'ruck';
    p.vx = 0;
    p.vy = 0;
    p.arrivedAt = 0;
  }

  // Defence decides who competes: the closest one or two, if they are near.
  const committed: number[] = [];
  const near = defenders(s)
    .filter((d) => d.id !== tacklerId && d.state !== 'down')
    .sort((a, b) => dist(a, c) - dist(b, c));
  for (const d of near) {
    if (committed.length >= C.DEF_COMMIT_CHANCE.length) break;
    if (dist(d, c) > C.DEF_COMMIT_DIST) break;
    if (s.rng.next() < C.DEF_COMMIT_CHANCE[committed.length]!) {
      committed.push(d.id);
      d.job = 'ruck';
    }
  }

  // Scrum-half: the nearest support player gets to the base.
  const support = attackers(s)
    .filter((a) => a.id !== carrierId && a.state !== 'down')
    .sort((a, b) => dist(a, c) - dist(b, c));
  const half = support[0]!;
  half.job = 'half';

  s.ruck = {
    x: rx, y: ry, clock: 0, carrierId, tacklerId, halfId: half.id,
    cleaners: [], committed, clearOut: 2, play: 'one',
    side: rx < C.CENTRE_X ? 1 : -1,
    decidedAt: null, formedAt: null, readyAt: null, result: null,
  };
  setClearOut(s, 2);
  s.lineY = ry + C.DEF_OFFSIDE;
  emit(s, { type: 'ruck', committed: committed.length });
}

/** How many attackers go in to clean out. Can be changed until the contest is settled. */
export function setClearOut(s: DrillState, n: number): boolean {
  const r = s.ruck;
  if (!r || s.phase !== 'ruck' || r.formedAt !== null) return false;
  n = clamp(Math.round(n), 1, 3);
  r.clearOut = n;
  const pool = attackers(s)
    .filter((a) => a.id !== r.carrierId && a.id !== r.halfId && a.state !== 'down')
    .sort((a, b) => dist(a, r) - dist(b, r));
  r.cleaners = pool.slice(0, n).map((p) => p.id);
  for (const p of pool) {
    const isCleaner = r.cleaners.includes(p.id);
    p.job = isCleaner ? 'ruck' : 'line';
    if (!isCleaner) p.arrivedAt = null;
  }
  return true;
}

export function setPlay(s: DrillState, play: PlayCall): boolean {
  if (!s.ruck || s.phase !== 'ruck') return false;
  s.ruck.play = play;
  return true;
}

export function setSide(s: DrillState, side: -1 | 1): boolean {
  if (!s.ruck || s.phase !== 'ruck') return false;
  s.ruck.side = side;
  return true;
}

/** The coach calls it: the ball comes out as soon as it is ready (or now, if it already is). */
export function callPlay(s: DrillState): boolean {
  if (!s.ruck || s.phase !== 'ruck' || s.ruck.decidedAt !== null) return false;
  s.ruck.decidedAt = s.ruck.clock;
  return true;
}

/** When the ball will come out, as far as is known now. */
export function fireTime(r: Ruck): number | null {
  if (r.readyAt === null) return null;
  return Math.max(r.readyAt, r.decidedAt ?? C.DECISION_MAX);
}

/** Where the attack runners should stand, on the called side of the ruck. */
function attackSlots(r: Ruck, runners: Player[]) {
  const n = runners.length;
  if (!n) return;
  const room = r.side > 0 ? C.PITCH_W - 2 - r.x : r.x - 2;
  const spacing = clamp((room - C.SLOT_FIRST) / Math.max(1, n - 1), 2.5, C.SLOT_SPACING);
  const slots = runners.map((_, i) => ({
    x: clamp(r.x + r.side * (C.SLOT_FIRST + spacing * i), 2, C.PITCH_W - 2),
    y: r.y - C.SLOT_DEPTH - C.SLOT_DEPTH_STEP * i,
  }));
  // Pair by x order so nobody crosses over.
  const byX = [...runners].sort((a, b) => a.x - b.x);
  const slotsByX = [...slots].sort((a, b) => a.x - b.x);
  byX.forEach((p, i) => {
    p.slotX = slotsByX[i]!.x;
    p.slotY = slotsByX[i]!.y;
  });
}

/** Where the defenders in the line want to be while the ruck forms. */
function defenceTargets(s: DrillState, r: Ruck, line: Player[]) {
  const offY = r.y + C.DEF_OFFSIDE;
  const targets: { x: number; y: number }[] = [
    { x: r.x - 2.2, y: offY },
    { x: r.x + 2.2, y: offY },
  ];
  const runners = attackers(s)
    .filter((a) => a.job === 'line' && a.state !== 'down')
    .sort((a, b) => Math.abs(a.x - r.x) - Math.abs(b.x - r.x));
  for (const a of runners) targets.push({ x: a.x, y: offY + 0.6 });
  // Spares sweep behind on the open side.
  for (let i = 0; targets.length < line.length; i++) {
    targets.push({ x: clamp(r.x + r.side * (8 + 6 * i), 3, C.PITCH_W - 3), y: offY + 10 });
  }
  const chosen = targets.slice(0, line.length).sort((a, b) => a.x - b.x);
  const byX = [...line].sort((a, b) => a.x - b.x);
  return byX.map((d, i) => ({ d, t: chosen[i]! }));
}

function settleRuck(s: DrillState, r: Ruck) {
  const cleaners = r.cleaners.map((id) => s.players[id]!).filter((p) => p.arrivedAt !== null);
  const defs = r.committed.map((id) => s.players[id]!).filter((p) => p.arrivedAt !== null);
  const firstCleaner = Math.min(...cleaners.map((p) => p.arrivedAt!), Infinity);
  const jackal = defs.some((d) => d.arrivedAt! < firstCleaner);
  const mod = 2 * (cleaners.length - defs.length) - (jackal ? C.RUCK_JACKAL_PENALTY : 0);
  const dice = s.rng.roll3d6();
  const total = dice[0] + dice[1] + dice[2];
  // Nobody from the defence in there: nothing to contest.
  const need = defs.length ? C.RUCK_KEEP - mod : 0;
  const turnover = total < need;
  r.formedAt = r.clock;
  r.result = { dice, total, need, turnover, cleaners: cleaners.length, defenders: defs.length, jackal };
  const spare = Math.max(0, cleaners.length - defs.length - 1);
  r.readyAt = clamp(
    r.clock + C.RUCK_BASE + C.RUCK_PER_DEFENDER * defs.length + (jackal ? C.RUCK_JACKAL : 0)
      - C.RUCK_PER_SPARE_CLEANER * spare,
    C.RUCK_READY_MIN, C.RUCK_READY_MAX,
  );
  emit(s, { type: 'ruck-contest', result: r.result, readyAt: r.readyAt });
  if (turnover) {
    s.stats.turnovers++;
    stopPlay(s, 'turnover');
  }
}

function stepRuck(s: DrillState, realDt: number) {
  const r = s.ruck!;
  r.clock += realDt;
  const dt = realDt * C.RUCK_TIMESCALE;

  // Ruck players head for the ruck and bind on.
  const spots = (ids: number[], dy: number) =>
    ids.forEach((id, i) => {
      const p = s.players[id]!;
      const tx = r.x + [0, -0.9, 0.9][i % 3]!;
      const ty = r.y + dy;
      runTo(p, tx, ty, p.team === 'att' ? C.CLEANER_SPEED : C.DEF_RUCK_SPEED, dt);
      if (p.arrivedAt === null && Math.hypot(tx - p.x, ty - p.y) < 1.0) p.arrivedAt = r.clock;
    });
  spots(r.cleaners, -0.8);
  spots(r.committed, 0.9);
  // Released cleaners (clear-out lowered) and everyone else take up their positions.
  const half = s.players[r.halfId]!;
  runTo(half, r.x, r.y - 1.4, C.REALIGN_SPEED_ATT, dt);

  const runners = attackers(s).filter((a) => a.job === 'line' && a.state !== 'down');
  attackSlots(r, runners);
  for (const a of runners) runTo(a, a.slotX, a.slotY, C.REALIGN_SPEED_ATT, dt);

  const line = defenders(s).filter((d) => d.job === 'line' && d.state !== 'down');
  for (const { d, t } of defenceTargets(s, r, line)) runTo(d, t.x, t.y, C.REALIGN_SPEED_DEF, dt);

  for (const p of s.players) {
    if (p.state === 'down') continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  if (r.formedAt === null) {
    const all = [...r.cleaners, ...r.committed].map((id) => s.players[id]!);
    if (all.every((p) => p.arrivedAt !== null) || r.clock >= C.RUCK_FORM_MAX) settleRuck(s, r);
    if (s.phase !== 'ruck') return;
  }

  const fireAt = fireTime(r);
  const halfReady = Math.hypot(half.x - r.x, half.y - (r.y - 1.4)) < 1.0;
  if (fireAt !== null && r.clock >= fireAt && halfReady) fire(s, r);
}

/** Ball out of the ruck: run the called play. */
function fire(s: DrillState, r: Ruck) {
  const half = s.players[r.halfId]!;
  half.job = 'line';
  let unset = 0;
  for (const a of attackers(s)) {
    if (a.job === 'line' && a.id !== half.id) {
      a.set = Math.hypot(a.slotX - a.x, a.slotY - a.y) < C.SET_DIST;
      if (!a.set) unset++;
    } else a.set = true;
  }
  for (const id of [...r.cleaners, ...r.committed, r.carrierId, r.tacklerId]) {
    s.players[id]!.rejoinIn = C.RUCK_REJOIN;
  }
  s.ball.carrierId = half.id;
  s.ball.x = half.x;
  s.ball.y = half.y;
  computeLanes(s);
  assignMarks(s);
  s.lineY = r.y + C.DEF_OFFSIDE;
  for (const d of defenders(s)) d.seenBallX = r.x;
  emit(s, { type: 'play', call: r.play, side: r.side, clock: r.clock, clearOut: r.cleaners.length, unset });
  const play = r.play;
  const side = r.side;
  // Slots belong to this ruck only; from here on runners are in open play.
  s.ruck = null;
  s.phase = 'live';

  if (play === 'pick') return;
  const target = calledReceiver(s, half.id, play, side, r.x);
  if (target) requestPassTo(s, target.lane);
}

/** Who the half passes to for a call: first (1 out) or second (2 out) runner on that side. */
export function calledReceiver(s: DrillState, halfId: number, play: PlayCall, side: -1 | 1, rx: number): Player | null {
  if (play === 'pick') return null;
  const runners = s.players
    .filter((p) => p.team === 'att' && p.job === 'line' && p.id !== halfId && p.state !== 'down')
    .filter((p) => Math.sign(p.slotX - rx) === side)
    .sort((a, b) => Math.abs(a.slotX - rx) - Math.abs(b.slotX - rx));
  return runners[play === 'one' ? 0 : 1] ?? runners[0] ?? null;
}

/** Line defenders pick up attackers, inside first; spares stay as guards and cover. */
function assignMarks(s: DrillState) {
  const line = defenders(s).filter((d) => d.job === 'line' && d.state !== 'down');
  for (const d of defenders(s)) d.markId = -1;
  const ballX = s.ball.x;
  const atts = lineAttackers(s).sort((a, b) => Math.abs(a.x - ballX) - Math.abs(b.x - ballX));
  const free = new Set(line);
  for (const a of atts) {
    let best: Player | null = null;
    for (const d of free) if (!best || Math.abs(d.x - a.x) < Math.abs(best.x - a.x)) best = d;
    if (!best) break;
    best.markId = a.id;
    free.delete(best);
  }
}

// ---------------------------------------------------------------------------
// Passing

/** Pass one along the line left (-1) or right (+1). */
export function requestPass(s: DrillState, dir: -1 | 1): boolean {
  const c = carrier(s);
  if (!c) return false;
  return requestPassTo(s, c.lane + dir);
}

/** Pass to the attacker at this position in the line. Over a team-mate is a skip pass. */
export function requestPassTo(s: DrillState, toLane: number): boolean {
  if (s.phase !== 'live' || s.ball.flight || s.ball.carrierId === null) return false;
  const from = s.players[s.ball.carrierId]!;
  const to = lineAttackers(s).find((p) => p.lane === toLane);
  if (!to || to.id === from.id) return false;
  const sample = ballDur(from, to);
  // Forward if the receiver is in front of the passer as it is thrown, or if the
  // ball goes forward out of the passer's hands (judged in his running frame).
  const catchY = to.y + to.vy * sample;
  const handsY = from.y + from.vy * sample;
  const forward = to.y > from.y + C.AHEAD_TOLERANCE || catchY > handsY + C.FORWARD_TOLERANCE;

  // Quality of the pass: 3d6, worse when hurried or skipping team-mates.
  const skipped = Math.abs(toLane - from.lane) - 1;
  const hurried = nearestDefender(s, from.x, from.y) < C.HURRIED_DIST;
  const dice = s.rng.roll3d6();
  const total = dice[0] + dice[1] + dice[2];
  const score = total - skipped - (hurried ? 1 : 0);
  const quality = !s.options.handlingDice ? 'good' : score <= C.PASS_MISSED_MAX ? 'missed' : score <= C.PASS_POOR_MAX ? 'poor' : 'good';

  let landX: number | null = null;
  let landY: number | null = null;
  if (quality === 'missed') {
    // Behind and short of the receiver, onto the floor.
    landX = from.x + (to.x + to.vx * sample - from.x) * 0.75;
    landY = to.y + to.vy * sample - 2.5;
  }

  s.ball.flight = {
    passerId: from.id, receiverId: to.id, fromX: from.x, fromY: from.y,
    t: 0, dur: sample, forward, quality,
    catchPenalty: skipped + (quality === 'poor' ? 1 : 0) + (hurried ? 1 : 0) + (to.set ? 0 : C.UNSET_PENALTY),
    landX, landY, interceptTried: [],
  };
  s.ball.carrierId = null;
  emit(s, { type: 'pass', from: from.id, to: to.id, forward, dice, total, quality });
  return true;
}

function ballDur(a: Player, b: Player): number {
  return Math.max(C.MIN_PASS_TIME, dist(a, b) / C.BALL_SPEED);
}

// ---------------------------------------------------------------------------
// Open play

function stepRuckLeavers(s: DrillState, dt: number) {
  for (const p of s.players) {
    if (p.job !== 'ruck') continue;
    p.rejoinIn -= dt;
    accelerate(p, 0, 0, 12, dt);
    if (p.rejoinIn <= 0) {
      p.job = 'line';
      p.markId = -1;
      p.state = p.team === 'att' ? 'run' : 'line';
      // A fresh body: keep him behind the ball, so he is a support runner.
      if (p.team === 'att') p.set = true;
    }
  }
}

function stepAttackers(s: DrillState, dt: number) {
  computeLanes(s);
  const holder = carrier(s);
  const refId = holder ? holder.id : s.ball.flight ? s.ball.flight.receiverId : null;
  if (refId === null) return;
  const ref = s.players[refId]!;
  for (const p of attackers(s)) {
    if (p.job !== 'line' || p.state === 'down') continue;
    let dvy: number;
    if (p.id === refId && holder) {
      dvy = C.CARRIER_SPEED;
    } else {
      const gap = Math.abs(p.lane - ref.lane);
      const target = ref.y - C.DEPTH_STEP * Math.max(1, gap);
      dvy = clamp(C.CARRIER_SPEED + (target - p.y) * 3.0, C.SUPPORT_MIN_SPEED, C.SUPPORT_MAX_SPEED);
    }
    const side = Math.sign(p.lane - ref.lane);
    let dvx = side * Math.min(Math.abs(p.lane - ref.lane), 2) * C.FAN_OUT;
    if (p.x < 3 || p.x > C.PITCH_W - 3) dvx = 0;
    accelerate(p, dvx, dvy, 18, dt);
  }
}

function stepDefenders(s: DrillState, dt: number) {
  s.lineY -= C.LINE_SPEED * dt;
  const holder = carrier(s);
  const ballX = s.ball.x;

  for (const d of defenders(s)) {
    if (d.job !== 'line' || d.state === 'down') continue;
    d.seenBallX += (ballX - d.seenBallX) * clamp(dt / C.DEF_REACTION, 0, 1);
    const mark = d.markId >= 0 ? s.players[d.markId]! : null;
    const targetX = mark ? mark.x + C.DEF_SLIDE * (d.seenBallX - mark.x) : d.x + (d.seenBallX - d.x) * 0.35;

    if (d.state === 'beaten') {
      d.timer -= dt;
      accelerate(d, 0, 0, 10, dt);
      if (d.timer <= 0) d.state = 'line';
      continue;
    }

    if (d.state === 'overran') {
      // Committed to the old carrier: still moving, can barely change direction.
      d.timer -= dt;
      const lat = clamp(targetX - d.x, -1, 1) * C.OVERRAN_LATERAL_SPEED;
      accelerate(d, lat, Math.min(d.vy * 0.6, 0), 8, dt);
      if (d.timer <= 0) d.state = 'line';
      continue;
    }

    if (d.state === 'tackler') {
      if (!holder) {
        d.state = 'overran';
        d.timer = C.OVERRAN_TIME;
        continue;
      }
      const lead = clamp(dist(holder, d) / C.TACKLER_SPEED, 0, 0.6);
      const dx = holder.x + holder.vx * lead - d.x;
      const dy = holder.y + holder.vy * lead - d.y;
      const len = Math.hypot(dx, dy) || 1;
      accelerate(d, (dx / len) * C.TACKLER_SPEED, (dy / len) * C.TACKLER_SPEED, C.DEF_ACCEL, dt);
      continue;
    }

    // Ball has got past this defender: turn and chase it down.
    const tgt = holder ?? (s.ball.flight ? s.players[s.ball.flight.receiverId]! : null);
    if (tgt && tgt.y > d.y + C.BEATEN_MARGIN) {
      const lead = clamp(dist(tgt, d) / C.CHASE_SPEED, 0, 0.8);
      const dx = tgt.x + tgt.vx * lead - d.x;
      const dy = tgt.y + tgt.vy * lead - d.y;
      const len = Math.hypot(dx, dy) || 1;
      accelerate(d, (dx / len) * C.CHASE_SPEED, (dy / len) * C.CHASE_SPEED, C.DEF_ACCEL, dt);
      continue;
    }

    // Holding the line: mark's defender goes in, anyone very close does too.
    if (holder) {
      const dd = dist(holder, d);
      if (dd < C.TACKLE_TRIGGER && (d.markId === holder.id || dd < C.TACKLE_TRIGGER * 0.55)) {
        d.state = 'tackler';
        continue;
      }
    }
    // Spares sit a little behind the line as cover.
    const wantY = mark ? s.lineY : s.lineY + 2.5;
    const dvx = clamp((targetX - d.x) * 4, -C.DEF_LATERAL_SPEED, C.DEF_LATERAL_SPEED);
    const dvy = clamp((Math.min(wantY, d.y + 50) - d.y) * 4, -C.DEF_FORWARD_SPEED, C.DEF_FORWARD_SPEED);
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
    const tx = f.landX ?? recv.x;
    const ty = f.landY ?? recv.y;
    b.x = f.fromX + (tx - f.fromX) * k;
    b.y = f.fromY + (ty - f.fromY) * k;

    // Defenders near the ball get one go each at picking it off.
    for (const d of s.options.handlingDice ? s.players : []) {
      if (d.team !== 'def' || d.job === 'ruck' || d.state === 'beaten' || d.state === 'down') continue;
      if (f.interceptTried.includes(d.id)) continue;
      if (Math.hypot(d.x - b.x, d.y - b.y) > C.INTERCEPT_R) continue;
      f.interceptTried.push(d.id);
      const dice = s.rng.roll3d6();
      const total = dice[0] + dice[1] + dice[2];
      const made = total >= C.INTERCEPT_NEED;
      emit(s, { type: 'intercept', dice, total, need: C.INTERCEPT_NEED, made, defenderId: d.id });
      if (made) {
        b.flight = null;
        b.x = d.x;
        b.y = d.y;
        s.stats.handlingErrors++;
        stopPlay(s, 'intercept');
        return;
      }
    }

    if (f.t >= f.dur) {
      b.flight = null;
      if (f.forward) {
        s.stats.forwardPasses++;
        stopPlay(s, 'forward');
        emit(s, { type: 'forward-pass' });
        return;
      }
      if (f.quality === 'missed') {
        s.stats.handlingErrors++;
        stopPlay(s, 'loose');
        emit(s, { type: 'loose' });
        return;
      }
      // Catch: 3d6, harder under pressure, off a poor pass, a skip, or not set.
      const pressure = nearestDefender(s, recv.x, recv.y) < C.PRESSURE_DIST ? 1 : 0;
      const need = C.CATCH_FAIL_BASE + f.catchPenalty + pressure + 1;
      const dice = s.rng.roll3d6();
      const total = dice[0] + dice[1] + dice[2];
      const made = !s.options.handlingDice || total >= need;
      emit(s, { type: 'catch', dice, total, need, made });
      if (made) {
        b.carrierId = recv.id;
      } else {
        b.y = recv.y + 1.5;
        b.x = recv.x;
        s.stats.handlingErrors++;
        stopPlay(s, 'knock-on');
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
    if (d.job !== 'line' || d.state === 'beaten' || d.state === 'down') continue;
    if (dist(holder, d) > C.TACKLE_CONTACT) continue;
    const dice = s.rng.roll3d6();
    const total = dice[0] + dice[1] + dice[2];
    // Hitting the carrier front on helps the defender.
    const frontOn = d.y >= holder.y ? 1 : -1;
    const made = total + frontOn >= C.TACKLE_TARGET;
    emit(s, { type: 'tackle', dice, total, made, tacklerId: d.id });
    if (made) {
      s.stats.tackled++;
      startRuck(s, holder.id, d.id);
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
    s.stats.tries++;
    stopPlay(s, 'try');
    emit(s, { type: 'try' });
  } else if (holder.x < 0 || holder.x > C.PITCH_W) {
    stopPlay(s, 'touch');
    emit(s, { type: 'touch' });
  }
}

/** Advance the drill by dt real seconds. Rucks run in slow motion. */
export function stepDrill(s: DrillState, dt: number) {
  s.time += dt;
  if (s.phase === 'ruck') {
    stepRuck(s, dt);
    return;
  }
  if (s.phase !== 'live') {
    s.resetIn -= dt;
    if (s.resetIn <= 0) resetPlay(s);
    return;
  }
  stepRuckLeavers(s, dt);
  stepAttackers(s, dt);
  stepDefenders(s, dt);
  for (const p of s.players) {
    if (p.state === 'down' && p.job === 'ruck') continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  stepBall(s, dt);
  checkTackles(s);
  checkScoring(s);
}
