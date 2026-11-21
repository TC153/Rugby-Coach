/** Seeded random number generator (mulberry32). All sim randomness goes through this. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  die(): number {
    return 1 + Math.floor(this.next() * 6);
  }
  /** Three six-sided dice, shown to the player. */
  roll3d6(): [number, number, number] {
    return [this.die(), this.die(), this.die()];
  }
  get state(): number {
    return this.s;
  }
}
