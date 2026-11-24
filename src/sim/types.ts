import type { Rng } from './rng';

export type Team = 'att' | 'def';

/** Open-play behaviour. Attackers: run. Defenders: line, tackler, overran, beaten. Both: down. */
export type PlayerState = 'run' | 'line' | 'tackler' | 'overran' | 'beaten' | 'down';

/** What a player is doing this phase. */
export type Job = 'line' | 'ruck' | 'half';

export interface Player {
  id: number;
  team: Team;
  job: Job;
  /** Attackers in the line: position along the pass line, left to right. -1 if not in it. */
  lane: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: PlayerState;
  timer: number;
  /** Defender: x position it believes the ball is at (lagged). */
  seenBallX: number;
  /** Defender: attacker it is marking this phase, or -1 for a spare (guard / cover). */
  markId: number;
  /** Seconds until a ruck player is back on his feet and rejoins play. */
  rejoinIn: number;
  /** Attacker: where he is meant to be standing off the ruck. */
  slotX: number;
  slotY: number;
  /** Attacker: was in position when the ball came out. */
  set: boolean;
  /** Ruck clock time this player arrived at the ruck, if he did. */
  arrivedAt: number | null;
}

export type PassQuality = 'good' | 'poor' | 'missed';

export interface Flight {
  passerId: number;
  receiverId: number;
  fromX: number;
  fromY: number;
  t: number;
  dur: number;
  forward: boolean;
  quality: PassQuality;
  /** Extra difficulty for the catch (skip, poor pass, hurried, receiver not set). */
  catchPenalty: number;
  /** Missed passes fly to a fixed spot on the floor instead of the receiver. */
  landX: number | null;
  landY: number | null;
  /** Defenders who have already had a go at intercepting this pass. */
  interceptTried: number[];
}

/** Play called off the ruck. */
export type PlayCall = 'pick' | 'one' | 'two';

export interface RuckResult {
  dice: Dice;
  total: number;
  /** Total needed to keep the ball. */
  need: number;
  turnover: boolean;
  cleaners: number;
  defenders: number;
  jackal: boolean;
}

export interface Ruck {
  x: number;
  y: number;
  /** Real seconds since the tackle (the decision clock). */
  clock: number;
  carrierId: number;
  tacklerId: number;
  halfId: number;
  cleaners: number[];
  committed: number[];
  clearOut: number;
  play: PlayCall;
  side: -1 | 1;
  /** Clock time the coach called it, or null. */
  decidedAt: number | null;
  /** Clock time the contest was settled. */
  formedAt: number | null;
  /** Clock time the ball is available to the half. */
  readyAt: number | null;
  result: RuckResult | null;
}

export type Phase =
  | 'live' | 'ruck' | 'try' | 'forward' | 'touch' | 'knock-on' | 'intercept' | 'loose' | 'turnover';

export type Dice = [number, number, number];

export type SimEvent =
  | { type: 'pass'; from: number; to: number; forward: boolean; dice: Dice; total: number; quality: PassQuality }
  | { type: 'catch'; dice: Dice; total: number; need: number; made: boolean }
  | { type: 'intercept'; dice: Dice; total: number; need: number; made: boolean; defenderId: number }
  | { type: 'loose' }
  | { type: 'tackle'; dice: Dice; total: number; made: boolean; tacklerId: number }
  | { type: 'ruck'; committed: number }
  | { type: 'ruck-contest'; result: RuckResult; readyAt: number }
  | { type: 'play'; call: PlayCall; side: -1 | 1; clock: number; clearOut: number; unset: number }
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
  /** Phase number of the current attack (1 = first ruck). */
  phase: number;
  /** Most phases in one attack. */
  bestPhase: number;
  tackled: number;
  turnovers: number;
  forwardPasses: number;
  /** Knock-ons, missed passes and intercepts. */
  handlingErrors: number;
}

export interface DrillOptions {
  /** Pass, catch and intercept dice. Off gives perfect hands (used by some tests). */
  handlingDice: boolean;
}

export interface DrillState {
  time: number;
  seed: number;
  resets: number;
  phase: Phase;
  /** Seconds until the drill resets after a stop. */
  resetIn: number;
  players: Player[];
  ball: Ball;
  ruck: Ruck | null;
  stats: Stats;
  events: SimEvent[];
  /** Defensive line y, advances over time. */
  lineY: number;
  rng: Rng;
  options: DrillOptions;
}
