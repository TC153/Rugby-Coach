import type { Rng } from './rng';

export type Team = 'att' | 'def';

/** attacker: run | defender: line, tackler, overran, beaten */
export type PlayerState = 'run' | 'line' | 'tackler' | 'overran' | 'beaten' | 'down';

export interface Player {
  id: number;
  team: Team;
  /** Lane index 0..4 left to right. Attackers pass along this chain. */
  lane: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: PlayerState;
  timer: number;
  /** Defender: x position it believes the ball is at (lagged). */
  seenBallX: number;
}

export interface Flight {
  passerId: number;
  receiverId: number;
  fromX: number;
  fromY: number;
  t: number;
  dur: number;
  forward: boolean;
  quality: PassQuality;
  /** Extra difficulty for the catch (skip, poor pass, hurried). */
  catchPenalty: number;
  /** Missed passes fly to a fixed spot on the floor instead of the receiver. */
  landX: number | null;
  landY: number | null;
  /** Defenders who have already had a go at intercepting this pass. */
  interceptTried: number[];
}

export type PassQuality = 'good' | 'poor' | 'missed';

export type Phase = 'live' | 'tackled' | 'try' | 'forward' | 'touch' | 'knock-on' | 'intercept' | 'loose';

export type Dice = [number, number, number];

export type SimEvent =
  | { type: 'pass'; from: number; to: number; forward: boolean; dice: Dice; total: number; quality: PassQuality }
  | { type: 'catch'; dice: Dice; total: number; need: number; made: boolean }
  | { type: 'intercept'; dice: Dice; total: number; need: number; made: boolean; defenderId: number }
  | { type: 'loose' }
  | { type: 'tackle'; dice: Dice; total: number; made: boolean; tacklerId: number }
  | { type: 'try' }
  | { type: 'forward-pass' }
  | { type: 'touch' }
  | { type: 'reset' };

export interface Ball {
  x: number;
  y: number;
  carrierId: number | null;
  flight: Flight | null;
}

export interface Stats {
  tries: number;
  tackled: number;
  forwardPasses: number;
  /** Knock-ons, missed passes and intercepts. */
  handlingErrors: number;
  /** Consecutive tries. */
  streak: number;
}

export interface DrillState {
  time: number;
  seed: number;
  resets: number;
  phase: Phase;
  /** Seconds until the drill resets after a stop. */
  resetIn: number;
  /** Time since the current play started. */
  playTime: number;
  players: Player[];
  ball: Ball;
  stats: Stats;
  events: SimEvent[];
  /** Defensive line y, advances over time. */
  lineY: number;
  rng: Rng;
  options: DrillOptions;
}

export interface DrillOptions {
  /** Pass, catch and intercept dice. Off gives perfect hands (used by some tests). */
  handlingDice: boolean;
}
