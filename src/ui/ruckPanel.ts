import { DECISION_MAX } from '../sim/constants';
import { callPlay, fireTime, setClearOut, setPlay, setSide } from '../sim/drill';
import type { DrillState, PlayCall } from '../sim/types';

const $ = (id: string) => document.getElementById(id)!;

/** The call panel shown while a ruck forms: clear-out count, play, side, and the clock. */
export class RuckPanel {
  private el = $('ruck-panel');
  private hint = $('hint');

  constructor(private s: DrillState) {
    const stop = (e: Event) => e.stopPropagation();
    this.el.addEventListener('pointerdown', stop);
    this.el.querySelectorAll<HTMLButtonElement>('[data-co]').forEach((b) =>
      b.addEventListener('click', () => setClearOut(this.s, Number(b.dataset.co))),
    );
    this.el.querySelectorAll<HTMLButtonElement>('[data-play]').forEach((b) =>
      b.addEventListener('click', () => setPlay(this.s, b.dataset.play as PlayCall)),
    );
    this.el.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) =>
      b.addEventListener('click', () => setSide(this.s, Number(b.dataset.side) as -1 | 1)),
    );
    $('rk-go').addEventListener('click', () => callPlay(this.s));
  }

  update() {
    const r = this.s.ruck;
    const show = this.s.phase === 'ruck' && !!r;
    this.el.hidden = !show;
    this.hint.style.visibility = show ? 'hidden' : 'visible';
    if (!r) return;

    const pct = (t: number) => `${Math.min(100, (t / DECISION_MAX) * 100)}%`;
    $('rk-clock').textContent = `${r.clock.toFixed(1)}s`;
    $('rk-fill').style.width = pct(r.clock);
    const ready = $('rk-ready');
    const fire = $('rk-fire');
    ready.style.display = r.readyAt === null ? 'none' : 'block';
    if (r.readyAt !== null) ready.style.left = pct(r.readyAt);
    const ft = fireTime(r);
    fire.style.display = ft === null ? 'none' : 'block';
    if (ft !== null) fire.style.left = `calc(${pct(ft)} - 3px)`;

    let status: string;
    if (!r.result) status = 'Ruck forming…';
    else if (r.readyAt !== null && r.clock < r.readyAt) status = `Ball ready at ${r.readyAt.toFixed(1)}s`;
    else status = r.decidedAt === null ? `Ball's there · out at ${DECISION_MAX}s` : 'Ball out!';
    $('rk-status').textContent = status;

    const locked = r.formedAt !== null;
    this.el.querySelectorAll<HTMLButtonElement>('[data-co]').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset.co) === r.clearOut);
      b.disabled = locked;
      b.style.opacity = locked && Number(b.dataset.co) !== r.clearOut ? '0.35' : '1';
    });
    this.el.querySelectorAll<HTMLButtonElement>('[data-play]').forEach((b) =>
      b.classList.toggle('on', b.dataset.play === r.play),
    );
    this.el.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) =>
      b.classList.toggle('on', Number(b.dataset.side) === r.side),
    );
    const go = $('rk-go');
    go.classList.toggle('called', r.decidedAt !== null);
    go.textContent = r.decidedAt === null ? 'CALL IT' : `CALLED · out at ${(ft ?? r.decidedAt).toFixed(1)}s`;
  }
}
