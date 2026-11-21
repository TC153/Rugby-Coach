export type PassDir = -1 | 1;

export interface InputHandlers {
  /** Tap or click at a screen x: pass to the attacker nearest that point. */
  onTap(screenX: number): void;
  /** Keyboard: pass left/right by `steps` attackers (2 = skip pass). */
  onKey(dir: PassDir, steps: 1 | 2): void;
}

/**
 * Tap an attacker to pass to him, over team-mates if need be (skip pass).
 * Keys: arrows or A/D pass to the next attacker, Q/E skip one.
 */
export function bindInput(target: HTMLElement, h: InputHandlers) {
  target.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    h.onTap(e.clientX - target.getBoundingClientRect().left);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') h.onKey(-1, e.shiftKey ? 2 : 1);
    else if (k === 'arrowright' || k === 'd') h.onKey(1, e.shiftKey ? 2 : 1);
    else if (k === 'q') h.onKey(-1, 2);
    else if (k === 'e') h.onKey(1, 2);
  });
}
