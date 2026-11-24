import * as C from '../sim/constants';
import { calledReceiver, carrier, defenders, lineAttackers } from '../sim/drill';
import type { DrillState, Player } from '../sim/types';
import { depthScale, project, Y_MAX, Y_MIN, type View } from './camera';

const COL = {
  outside: '#102016',
  grassA: '#2f7a3a',
  grassB: '#2a6f35',
  inGoal: '#235f2e',
  line: 'rgba(255,255,255,0.8)',
  att: '#2f6bff',
  attRim: '#cfe0ff',
  def: '#e23b3b',
  defRim: '#ffd3d3',
  ball: '#f4e9d0',
  shadow: 'rgba(0,0,0,0.28)',
};

function quad(ctx: CanvasRenderingContext2D, v: View, x0: number, y0: number, x1: number, y1: number, fill: string) {
  const a = project(v, x0, y0);
  const b = project(v, x1, y0);
  const c = project(v, x1, y1);
  const d = project(v, x0, y1);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

function hline(ctx: CanvasRenderingContext2D, v: View, y: number, dashed = false) {
  const a = project(v, 0, y);
  const b = project(v, C.PITCH_W, y);
  ctx.strokeStyle = COL.line;
  ctx.lineWidth = Math.max(1.5, 0.22 * v.scale * a.k);
  ctx.setLineDash(dashed ? [8, 8] : []);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPitch(ctx: CanvasRenderingContext2D, v: View) {
  ctx.fillStyle = COL.outside;
  ctx.fillRect(0, 0, v.w, v.h);
  // Mown stripes every 5 m.
  for (let y = Y_MIN - 30; y < C.TRY_LINE_Y; y += 5) {
    const y0 = y;
    const y1 = Math.min(y + 5, C.TRY_LINE_Y);
    quad(ctx, v, 0, y0, C.PITCH_W, y1, Math.abs(Math.floor((y - Y_MIN) / 5)) % 2 ? COL.grassA : COL.grassB);
  }
  quad(ctx, v, 0, C.TRY_LINE_Y, C.PITCH_W, C.DEAD_BALL_Y, COL.inGoal);
  // Touchlines.
  for (const x of [0, C.PITCH_W]) {
    const a = project(v, x, Y_MIN - 30);
    const b = project(v, x, Y_MAX);
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  hline(ctx, v, C.HALFWAY_Y);
  hline(ctx, v, 10, true);
  hline(ctx, v, 28);
  hline(ctx, v, C.TRY_LINE_Y);
  hline(ctx, v, C.DEAD_BALL_Y);
}

function arrow(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, back: number, col: string, w: number, dash: number[]) {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  const ang = Math.atan2(by - ay, bx - ax);
  const tip = { x: bx - Math.cos(ang) * back, y: by - Math.sin(ang) * back };
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - Math.cos(ang - 0.45) * 12, tip.y - Math.sin(ang - 0.45) * 12);
  ctx.lineTo(tip.x - Math.cos(ang + 0.45) * 12, tip.y - Math.sin(ang + 0.45) * 12);
  ctx.closePath();
  ctx.fill();
}

function drawPassLine(ctx: CanvasRenderingContext2D, v: View, s: DrillState) {
  const line = lineAttackers(s);
  if (line.length < 2) return;
  const pts = line.map((p) => project(v, p.x, p.y));
  // The whole line through the attackers.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrows to everyone the carrier can pass to. Red: in front of him, it would be forward.
  const holder = carrier(s);
  if (!holder || s.ball.flight || s.phase !== 'live' || holder.lane < 0) return;
  const a = pts[holder.lane]!;
  for (const r of line) {
    if (r.id === holder.id) continue;
    const skip = Math.abs(r.lane - holder.lane) > 1;
    const ahead = r.y > holder.y + C.AHEAD_TOLERANCE;
    const b = pts[r.lane]!;
    const col = ahead ? 'rgba(255,107,94,0.7)' : skip ? 'rgba(255,227,107,0.55)' : '#ffe36b';
    const back = C.PLAYER_R * 1.2 * v.scale * depthScale(r.y) + 6;
    arrow(ctx, a.x, a.y, b.x, b.y, back, col, skip ? 2.5 : 3.5, skip || ahead ? [3, 6] : []);
  }
}

/** Ruck: the pile, offside lines, where runners should stand and the called pass. */
function drawRuck(ctx: CanvasRenderingContext2D, v: View, s: DrillState) {
  const r = s.ruck;
  if (!r || s.phase !== 'ruck') return;
  // Offside lines: hindmost feet each side.
  for (const [y, col] of [[r.y - 1.2, 'rgba(125,184,255,0.7)'], [r.y + C.DEF_OFFSIDE, 'rgba(255,138,125,0.7)']] as const) {
    const a = project(v, r.x - 30, y);
    const b = project(v, r.x + 30, y);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // The pile.
  const c = project(v, r.x, r.y);
  const rad = 2.4 * v.scale * c.k;
  ctx.fillStyle = 'rgba(90,60,30,0.45)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Slot markers: green when the runner is set.
  for (const p of s.players) {
    if (p.team !== 'att' || p.job !== 'line') continue;
    const sp = project(v, p.slotX, p.slotY);
    const set = Math.hypot(p.slotX - p.x, p.slotY - p.y) < C.SET_DIST;
    ctx.strokeStyle = set ? '#7dff9b' : 'rgba(255,211,107,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, 0.9 * v.scale * sp.k, 0.45 * v.scale * sp.k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Called pass from the half.
  const half = s.players[r.halfId]!;
  const target = calledReceiver(s, r.halfId, r.play, r.side, r.x);
  if (!target) return;
  const h = project(v, half.x, half.y);
  const t = project(v, target.slotX, target.slotY);
  arrow(ctx, h.x, h.y, t.x, t.y, 8, 'rgba(255,227,107,0.85)', 3, [8, 6]);
}

function drawPlayer(ctx: CanvasRenderingContext2D, v: View, p: Player, isCarrier: boolean, s: DrillState) {
  const pr = project(v, p.x, p.y);
  const r = C.PLAYER_R * 1.2 * v.scale * pr.k;
  const att = p.team === 'att';
  const down = p.state === 'down';
  const inRuck = p.job === 'ruck' && !down;
  const beaten = p.state === 'beaten';

  // Shadow.
  ctx.fillStyle = COL.shadow;
  ctx.beginPath();
  ctx.ellipse(pr.x, pr.y + r * 0.55, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = down || beaten ? 0.55 : inRuck ? 0.8 : 1;
  if (down) {
    // Lying on the ground: a squashed circle.
    ctx.fillStyle = att ? COL.att : COL.def;
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y + r * 0.2, r * 1.25, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Body stands on its shadow: circle centre raised a little.
    const cy = pr.y - r * 0.4;
    ctx.fillStyle = att ? COL.att : COL.def;
    ctx.strokeStyle = att ? COL.attRim : COL.defRim;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.arc(pr.x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isCarrier) {
      ctx.strokeStyle = '#ffe36b';
      ctx.lineWidth = Math.max(2, r * 0.2);
      ctx.beginPath();
      ctx.arc(pr.x, cy, r + 4 + Math.sin(s.time * 8) * 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawBall(ctx: CanvasRenderingContext2D, v: View, s: DrillState) {
  const b = s.ball;
  const pr = project(v, b.x, b.y);
  let lift = 0;
  if (b.flight) {
    const k = Math.min(1, b.flight.t / b.flight.dur);
    lift = Math.sin(Math.PI * k) * 1.6 * v.scale * pr.k;
  }
  const holder = carrier(s);
  const r = 0.42 * v.scale * pr.k;
  // Held ball sits at the carrier's front hip.
  const baseLift = holder ? C.PLAYER_R * v.scale * pr.k * 0.5 : 0;
  const cx = pr.x + (holder ? C.PLAYER_R * v.scale * pr.k * 0.55 : 0);
  const cy = pr.y - baseLift - lift;
  ctx.fillStyle = COL.shadow;
  ctx.beginPath();
  ctx.ellipse(pr.x, pr.y + r * 0.3, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.ball;
  ctx.strokeStyle = '#6a4a22';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 1.15, r * 0.8, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** How threatening the nearest defender is to the carrier, for the timing ring. */
function drawTimingRing(ctx: CanvasRenderingContext2D, v: View, s: DrillState) {
  const holder = carrier(s);
  if (!holder || s.phase !== 'live') return;
  let nearest = Infinity;
  for (const d of defenders(s)) nearest = Math.min(nearest, Math.hypot(d.x - holder.x, d.y - holder.y));
  const pr = project(v, holder.x, holder.y);
  const colour = nearest > 10 ? '#7dff9b' : nearest > C.TACKLE_TRIGGER ? '#ffd36b' : '#ff6b5e';
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 5]);
  const r = C.PLAYER_R * v.scale * pr.k * 1.9;
  ctx.beginPath();
  ctx.ellipse(pr.x, pr.y, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

export function drawDrill(ctx: CanvasRenderingContext2D, v: View, s: DrillState) {
  drawPitch(ctx, v);
  drawRuck(ctx, v, s);
  drawPassLine(ctx, v, s);
  drawTimingRing(ctx, v, s);
  const holder = carrier(s);
  // Far players first so nearer ones overlap them.
  const order = [...s.players].sort((a, b) => b.y - a.y);
  for (const p of order) drawPlayer(ctx, v, p, holder?.id === p.id, s);
  drawBall(ctx, v, s);
}
