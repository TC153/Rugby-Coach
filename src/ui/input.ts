export type PassDir = -1 | 1;

/**
 * Touch, mouse and keyboard all produce the same thing: pass left or right.
 * Tap the left half of the screen to pass left, the right half to pass right.
 */
export function bindInput(target: HTMLElement, onPass: (dir: PassDir) => void) {
  target.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = target.getBoundingClientRect();
    onPass(e.clientX < rect.left + rect.width / 2 ? -1 : 1);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') onPass(-1);
    else if (k === 'arrowright' || k === 'd') onPass(1);
  });
}
