import { describe, expect, it } from 'vitest';
import { pickTarget } from './pick';

const xs = [50, 130, 210, 290, 370];

describe('pickTarget', () => {
  it('taps on an attacker pass to that attacker, skipping if needed', () => {
    expect(pickTarget(xs, 2, 372)).toBe(4);
    expect(pickTarget(xs, 2, 45)).toBe(0);
    expect(pickTarget(xs, 2, 288)).toBe(3);
  });
  it('a tap near the carrier passes to the neighbour on that side', () => {
    expect(pickTarget(xs, 2, 200)).toBe(1);
    expect(pickTarget(xs, 2, 225)).toBe(3);
  });
  it('end carriers can only pass inwards', () => {
    expect(pickTarget(xs, 4, 380)).toBe(3);
  });
});
