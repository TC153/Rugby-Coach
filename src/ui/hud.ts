import type { DrillState, SimEvent } from '../sim/types';

const $ = (id: string) => document.getElementById(id)!;

export class Hud {
  private banner = $('banner');
  private title = this.banner.querySelector('.title') as HTMLElement;
  private sub = this.banner.querySelector('.sub') as HTMLElement;
  private hideAt = 0;

  update(s: DrillState, now: number) {
    $('s-tries').textContent = String(s.stats.tries);
    $('s-phase').textContent = String(s.stats.phase);
    $('s-turnovers').textContent = String(s.stats.turnovers);
    $('s-errors').textContent = String(s.stats.forwardPasses + s.stats.handlingErrors);
    if (this.hideAt && now > this.hideAt) {
      this.banner.classList.remove('show');
      this.hideAt = 0;
    }
  }

  /** Show a message for an event. Tackle dice are always shown. */
  show(e: SimEvent, now: number) {
    const dice = (d: number[], total: number) => `${d.join(' + ')} = ${total}`;
    switch (e.type) {
      case 'pass':
        $('dice').textContent = `Pass 3d6: ${dice(e.dice, e.total)} · ${e.quality}`;
        break;
      case 'catch':
        $('dice').textContent = `Catch 3d6: ${dice(e.dice, e.total)} · need ${e.need} ${e.made ? '✓' : '✗'}`;
        if (!e.made) this.set('KNOCK-ON', `Catch 3d6: ${dice(e.dice, e.total)}, needed ${e.need}`, 'bad', now, 1.6);
        break;
      case 'intercept':
        $('dice').textContent = `Intercept 3d6: ${dice(e.dice, e.total)} · need ${e.need} ${e.made ? '✗' : '✓ missed it'}`;
        if (e.made) this.set('INTERCEPTED', `3d6: ${dice(e.dice, e.total)}, needed ${e.need}`, 'bad', now, 1.6);
        break;
      case 'ruck-contest': {
        const r = e.result;
        const who = `${r.cleaners} v ${r.defenders}${r.jackal ? ', jackal on' : ''}`;
        if (r.need > 0) {
          $('dice').textContent = `Ruck (${who}) 3d6: ${dice(r.dice, r.total)} · need ${r.need} ${r.turnover ? '✗' : '✓'}`;
        } else $('dice').textContent = `Ruck (${who}) · uncontested`;
        if (r.turnover) this.set('TURNOVER', `Jackal won it · 3d6: ${dice(r.dice, r.total)}, needed ${r.need}`, 'bad', now, 1.8);
        break;
      }
      case 'play': {
        const name = e.call === 'pick' ? 'Pick & go' : e.call === 'one' ? '1 out' : '2 out';
        $('dice').textContent = `${name} ${e.side > 0 ? '▶' : '◀'} at ${e.clock.toFixed(1)}s${e.unset ? ` · ${e.unset} not set` : ''}`;
        break;
      }
      case 'loose':
        this.set('MISSED PASS', 'Ball on the floor', 'bad', now, 1.6);
        break;
      case 'tackle':
        $('dice').textContent = `Tackle 3d6: ${dice(e.dice, e.total)} ${e.made ? '· ruck' : '· broken!'}`;
        if (!e.made) this.set('BROKE THE TACKLE', `3d6: ${dice(e.dice, e.total)}`, 'good', now, 1.0);
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
