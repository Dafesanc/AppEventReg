import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BAT_PATH, BAT_VIEWBOX } from './shapes';

interface FlyingBat {
  top: string;
  size: number;
  /** Seconds to cross the screen; negative delay starts it mid-flight. */
  duration: number;
  delay: number;
  flap: number;
  bob: number;
  desktopOnly?: boolean;
}

const BATS: FlyingBat[] = [
  { top: '10%', size: 78, duration: 16, delay: -3, flap: 0.3, bob: 2.6 },
  { top: '26%', size: 48, duration: 23, delay: -12, flap: 0.24, bob: 3.2 },
  { top: '5%', size: 58, duration: 19, delay: -15, flap: 0.27, bob: 2.2, desktopOnly: true },
  { top: '38%', size: 38, duration: 27, delay: -6, flap: 0.21, bob: 3.6, desktopOnly: true },
  { top: '17%', size: 92, duration: 14, delay: -9, flap: 0.34, bob: 2.4 },
  { top: '48%', size: 32, duration: 31, delay: -21, flap: 0.2, bob: 4, desktopOnly: true },
];

/** Bats flying across the hero. Pure CSS animation (transform only); hidden for reduced motion. */
@Component({
  selector: 'app-bat-swarm',
  template: `
    @for (bat of bats; track $index) {
      <div
        class="absolute left-0 {{ bat.desktopOnly ? 'max-sm:hidden' : '' }}"
        [style.top]="bat.top"
        [style.animation]="'bat-fly ' + bat.duration + 's linear ' + bat.delay + 's infinite'"
      >
        <div class="animate-bob" [style.animation-duration.s]="bat.bob">
          <svg
            [attr.viewBox]="viewBox"
            [style.width.px]="bat.size"
            [style.animation]="'bat-flap ' + bat.flap + 's ease-in-out infinite'"
            class="block drop-shadow-[0_0_10px_rgb(227_18_27/0.85)]"
            focusable="false"
          >
            <path [attr.d]="path" fill="#1c0b0e" />
            <circle cx="48.3" cy="16" r="1.4" fill="#ff3b3b" />
            <circle cx="51.7" cy="16" r="1.4" fill="#ff3b3b" />
          </svg>
        </div>
      </div>
    }
  `,
  host: { class: 'pointer-events-none block overflow-hidden motion-reduce:hidden', 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BatSwarm {
  protected readonly bats = BATS;
  protected readonly path = BAT_PATH;
  protected readonly viewBox = BAT_VIEWBOX;
}
