import { DEAD_BALL_Y, PITCH_W } from '../sim/constants';

export const Y_MIN = -14;
export const Y_MAX = DEAD_BALL_Y;
/** Far end of the pitch is drawn this much smaller (0 = no tilt). */
export const TILT = 0.34;
export { PITCH_W };

export interface View {
  w: number;
  h: number;
  /** Pixels per metre at the near edge. */
  scale: number;
  /** Extra stretch up the screen. */
  vStretch: number;
  /** Screen y of the near edge (Y_MIN). */
  baseY: number;
  camX: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Size multiplier for things standing at this depth. */
  k: number;
}

const SPAN = Y_MAX - Y_MIN;

/** Perspective factor: 1 at the near edge, 1 - TILT at the far edge. */
export function depthScale(y: number): number {
  return 1 - (TILT * (y - Y_MIN)) / SPAN;
}

/** Integral of depthScale: how far up the screen a world y sits (in metres at near scale). */
function ground(y: number): number {
  const d = y - Y_MIN;
  return d - (TILT * d * d) / (2 * SPAN);
}

/**
 * Lay out the camera for a screen size. Portrait is the main case: about 34 m of width
 * is visible and the camera follows the ball sideways. Landscape fits the whole depth.
 * `top` and `bottom` leave room for the HUD.
 */
export function makeView(w: number, h: number, top: number, bottom: number): View {
  const availH = Math.max(100, h - top - bottom);
  const gMax = ground(Y_MAX);
  const portrait = h >= w;
  const visibleWidth = portrait ? 42 : 60;
  let scale = w / visibleWidth;
  let vStretch = availH / (gMax * scale);
  // Keep the tilt slight: never stretch beyond a gentle three-quarter look.
  if (vStretch > 1.3) vStretch = 1.3;
  if (vStretch < 0.6) {
    vStretch = 0.6;
  }
  // If the stretch had to be capped, shrink scale so the whole depth still fits.
  if (gMax * scale * vStretch > availH) scale = availH / (gMax * vStretch);
  const baseY = h - bottom - (availH - gMax * scale * vStretch);
  return { w, h, scale, vStretch, baseY, camX: PITCH_W / 2 };
}

export function project(v: View, x: number, y: number): Projected {
  const k = depthScale(y);
  return {
    x: v.w / 2 + (x - v.camX) * v.scale * k,
    y: v.baseY - ground(y) * v.scale * v.vStretch,
    k,
  };
}
