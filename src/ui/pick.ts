/**
 * Which attacker does a tap mean? The one whose screen x is nearest the tap,
 * not counting the ball carrier. A tap nearest the carrier himself passes to
 * the neighbour on the side tapped.
 * `xs` are the attackers' screen x positions in lane order.
 */
export function pickTarget(xs: number[], carrierLane: number, tapX: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < xs.length; i++) {
    if (i === carrierLane) continue;
    const d = Math.abs(xs[i]! - tapX);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  // Tap closer to the carrier than to the chosen target: use the side tapped, adjacent.
  const carrierD = Math.abs(xs[carrierLane]! - tapX);
  if (carrierD < bestD) {
    const side = tapX < xs[carrierLane]! ? -1 : 1;
    const lane = carrierLane + side;
    if (lane >= 0 && lane < xs.length) return lane;
  }
  return best;
}
