import { makeView, PITCH_W, type View } from './render/camera';
import { drawDrill } from './render/draw';
import { createDrill, drainEvents, requestPass, stepDrill } from './sim/drill';
import { Hud } from './ui/hud';
import { bindInput } from './ui/input';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = new Hud();

// ?seed=N gives a repeatable drill (used by the screenshot tests).
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || (Date.now() & 0xffffff);
const state = createDrill(seed);

let view: View;
let camX = PITCH_W / 2;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view = makeView(w, h, 44, 36);
  view.camX = camX;
}
window.addEventListener('resize', resize);
resize();

bindInput(canvas.parentElement!, (dir) => {
  requestPass(state, dir);
});

const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
const paused = params.has('freeze');

function frame(nowMs: number) {
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
};
