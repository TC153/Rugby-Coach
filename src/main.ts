import { makeView, PITCH_W, type View } from './render/camera';
import { drawDrill } from './render/draw';
import { carrier, createDrill, drainEvents, requestPass, requestPassTo, stepDrill } from './sim/drill';
import { project } from './render/camera';
import { pickTarget } from './ui/pick';
import { Hud } from './ui/hud';
import { bindInput } from './ui/input';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = new Hud();

// ?seed=N gives a repeatable drill (used by the screenshot tests).
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || (Date.now() & 0xffffff);
const state = createDrill(seed);

let view: View | undefined;
let camX = PITCH_W / 2;

let sizeKey = '';

/** Re-measure the canvas. Called every frame because some phone browsers report
 *  a zero or stale window size at load and never fire a resize event. */
function resize() {
  const host = canvas.parentElement!;
  const w = host.clientWidth || window.innerWidth;
  const h = host.clientHeight || window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const key = `${w}x${h}@${dpr}`;
  if (!w || !h || key === sizeKey) return;
  sizeKey = key;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view = makeView(w, h, 44, 36);
  view.camX = camX;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

function showError(msg: string) {
  const hint = document.getElementById('hint');
  if (hint) hint.textContent = `Error: ${msg}`;
}
window.addEventListener('error', (e) => showError(e.message));
window.addEventListener('unhandledrejection', (e) => showError(String(e.reason)));

// Version label and a reload button that skips the browser cache.
declare const __BUILD__: string;
document.getElementById('version')!.textContent = __BUILD__;
const reloadBtn = document.getElementById('reload')!;
reloadBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
reloadBtn.addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.set('v', String(Date.now()));
  location.replace(url.toString());
});

bindInput(canvas, {
  onTap(x) {
    const c = carrier(state);
    if (!c || !view) return;
    const xs = state.players.filter((p) => p.team === 'att').map((p) => project(view!, p.x, p.y).x);
    requestPassTo(state, pickTarget(xs, c.lane, x));
  },
  onKey(dir, steps) {
    const c = carrier(state);
    if (c) requestPassTo(state, c.lane + dir * steps);
  },
});

const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
const paused = params.has('freeze');

function frame(nowMs: number) {
  resize();
  if (!view) {
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(0.1, (nowMs - last) / 1000);
  last = nowMs;
  if (!paused) {
    acc += dt;
    while (acc >= STEP) {
      stepDrill(state, STEP);
      acc -= STEP;
    }
  }
  for (const e of drainEvents(state)) hud.show(e, nowMs);
  hud.update(state, nowMs);

  // Camera follows the ball sideways, staying inside the pitch.
  const half = (view.w / (view.scale * 2)) * 0.98;
  const target = Math.min(Math.max(state.ball.x, half), PITCH_W - half);
  camX += (target - camX) * Math.min(1, dt * 4);
  view.camX = camX;
  drawDrill(ctx, view, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test hook for Playwright: drive the sim deterministically.
(window as unknown as { __game: unknown }).__game = {
  state,
  advance(seconds: number) {
    for (let i = 0; i < seconds / STEP; i++) stepDrill(state, STEP);
  },
  pass: (dir: -1 | 1) => requestPass(state, dir),
  passTo: (lane: number) => requestPassTo(state, lane),
};
