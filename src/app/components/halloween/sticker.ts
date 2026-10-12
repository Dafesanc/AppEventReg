import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BAT_PATH, BAT_VIEWBOX } from './shapes';

export type StickerKind = 'pumpkin' | 'ghost' | 'bat' | 'spider';

/**
 * Decorative Halloween sticker (multi-colour inline SVG). Size, rotation and position come from
 * the consumer's classes; add the `sticker` utility for the die-cut outline.
 */
@Component({
  selector: 'app-sticker',
  template: `
    @switch (kind()) {
      @case ('pumpkin') {
        <svg viewBox="0 0 100 100" class="block size-full" aria-hidden="true" focusable="false">
          <path d="M46 25 C45 16 48 9 55 6 L58.5 10 C53.5 13 52.5 18 53.5 25 Z" fill="#4f7a28" />
          <path d="M55 13 C62 8 70 11 67 18" stroke="#4f7a28" stroke-width="2.5" fill="none" stroke-linecap="round" />
          <ellipse cx="31" cy="61" rx="23" ry="28" fill="#d9520b" />
          <ellipse cx="69" cy="61" rx="23" ry="28" fill="#d9520b" />
          <ellipse cx="50" cy="60" rx="23" ry="32" fill="#ff7a18" />
          <path d="M44 30 C38 46 38 76 44 91 M56 30 C62 46 62 76 56 91" stroke="#c4470a" stroke-width="1.6" fill="none" opacity=".7" />
          <g fill="#ffd166">
            <path d="M31 53 L43 53 L37 42 Z" />
            <path d="M57 53 L69 53 L63 42 Z" />
            <path d="M46.5 62 L53.5 62 L50 56 Z" />
            <path d="M28 67 Q50 88 72 67 L67 68.5 L64 73 L59 69.5 L55 75 L50 70.5 L45 75 L41 69.5 L36 73 L33 68.5 Z" />
          </g>
        </svg>
      }
      @case ('ghost') {
        <svg viewBox="0 0 100 100" class="block size-full" aria-hidden="true" focusable="false">
          <path d="M29 56 C21 57 15 51 16 44 C21 48 25 50 29 49 Z M71 56 C79 57 85 51 84 44 C79 48 75 50 71 49 Z" fill="#f3ece4" />
          <path d="M29 90 V46 C29 25 40 12 50 12 C60 12 71 25 71 46 V90 L64 83 L57 90 L50 83 L43 90 L36 83 Z" fill="#f3ece4" />
          <ellipse cx="42" cy="43" rx="4" ry="6" fill="#140b0d" />
          <ellipse cx="58" cy="43" rx="4" ry="6" fill="#140b0d" />
          <ellipse cx="50" cy="59" rx="5" ry="6.5" fill="#140b0d" />
          <circle cx="36" cy="52" r="3.5" fill="#ff8fa3" opacity=".55" />
          <circle cx="64" cy="52" r="3.5" fill="#ff8fa3" opacity=".55" />
        </svg>
      }
      @case ('bat') {
        <svg [attr.viewBox]="batViewBox" class="block size-full" aria-hidden="true" focusable="false">
          <path [attr.d]="batPath" fill="#1a0d10" />
          <circle cx="48.3" cy="16" r="1.3" fill="#ff3b3b" />
          <circle cx="51.7" cy="16" r="1.3" fill="#ff3b3b" />
        </svg>
      }
      @case ('spider') {
        <svg viewBox="0 0 50 130" class="block size-full" aria-hidden="true" focusable="false">
          <path d="M25 0 V96" stroke="#d8cec6" stroke-width="1.2" opacity=".7" />
          <g fill="none" stroke="#2b1a1d" stroke-width="2.6" stroke-linecap="round">
            <path d="M19 104 Q9 94 4 100 M19 107 Q7 103 2 111 M19 110 Q9 113 6 122 M20 113 Q14 120 13 128" />
            <path d="M31 104 Q41 94 46 100 M31 107 Q43 103 48 111 M31 110 Q41 113 44 122 M30 113 Q36 120 37 128" />
          </g>
          <ellipse cx="25" cy="111" rx="8" ry="9.5" fill="#1a0d10" />
          <circle cx="25" cy="100" r="5.5" fill="#1a0d10" />
          <circle cx="23" cy="99.5" r="1.4" fill="#ff3b3b" />
          <circle cx="27" cy="99.5" r="1.4" fill="#ff3b3b" />
        </svg>
      }
    }
  `,
  host: { class: 'inline-block shrink-0 pointer-events-none select-none', 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sticker {
  readonly kind = input.required<StickerKind>();

  protected readonly batPath = BAT_PATH;
  protected readonly batViewBox = BAT_VIEWBOX;
}
