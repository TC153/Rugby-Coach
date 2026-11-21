import type { DrillState, SimEvent } from '../sim/types';

const $ = (id: string) => document.getElementById(id)!;

export class Hud {
  private banner = $('banner');
  private title = this.banner.querySelector('.title') as HTMLElement;
  private sub = this.banner.querySelector('.sub') as HTMLElement;
  private hideAt = 0;

  update(s: DrillState, now: number) {
    $('s-tries').textContent = String(s.stats.tries);
    $('s-tackled').textContent = String(s.stats.tackled);
    $('s-forward').textContent = String(s.stats.forwardPasses);
    $('s-streak').textContent = String(s.stats.streak);
    if (this.hideAt && now > this.hideAt) {
      this.banner.classList.remove('show');
      this.hideAt = 0;
    }
  }

  /** Show a message for an event. Tackle dice are always shown. */
  show(e: SimEvent, now: number) {
    switch (e.type) {
      case 'tackle':
        this.set(e.made ? 'TACKLED' : 'BROKE THE TACKLE', `3d6: ${e.dice.join(' + ')} = ${e.total}`, e.made ? 'bad' : 'good', now, e.made ? 1.6 : 1.2);
        break;
      case 'try':
        this.set('TRY!', 'Over the line', 'good', now, 1.6);
        break;
      case 'forward-pass':
        this.set('FORWARD PASS', 'Scrum to the defence', 'warn', now, 1.6);
        break;
      case 'touch':
        this.set('IN TOUCH', 'Ran out of play', 'warn', now, 1.6);
        break;
      default:
        break;
    }
  }

  private set(title: string, sub: string, cls: string, now: number, secs: number) {
    this.title.textContent = title;
    this.sub.textContent = sub;
    this.banner.className = `banner show ${cls}`;
    this.hideAt = now + secs * 1000;
  }
}
