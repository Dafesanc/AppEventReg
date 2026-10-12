import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BAT_PATH, BAT_VIEWBOX } from '../halloween/shapes';

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const rect = (x: number, y: number, w: number, h: number, rx: number) =>
  `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${rx} 0 0 1 ${rx} ${rx}v${h - 2 * rx}a${rx} ${rx} 0 0 1 ${-rx} ${rx}` +
  `h${-(w - 2 * rx)}a${rx} ${rx} 0 0 1 ${-rx} ${-rx}v${-(h - 2 * rx)}a${rx} ${rx} 0 0 1 ${rx} ${-rx}z`;

/** Stroke icons on a 24×24 grid (Lucide-style). */
const STROKE = {
  calendar: [rect(3, 4, 18, 18, 2), 'M16 2v4M8 2v4M3 10h18'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', circle(12, 10, 3)],
  clock: [circle(12, 12, 10), 'M12 6v6l4 2'],
  ticket: [
    'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z',
    'M13 5v2M13 17v2M13 11v2',
  ],
  music: ['M9 18V5l12-2v13', circle(6, 18, 3), circle(18, 16, 3)],
  instagram: [rect(2, 2, 20, 20, 5), 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z', 'M17.5 6.5h.01'],
  camera: ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z', circle(12, 13, 3)],
  martini: ['M8 22h8M12 11v11M19 3l-7 8-7-8Z'],
  wine: ['M8 22h8M7 10h10M12 15v7', 'M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z'],
  cookie: ['M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5', 'M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01'],
  noSmoking: [
    'M12 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h13M18 8c0-2.5-2-2.5-2-5M2 2l20 20',
    'M21 12a1 1 0 0 1 1 1v2a1 1 0 0 1-.5.87M22 8c0-2.5-2-2.5-2-5M7 12v4',
  ],
  noPills: ['m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z', 'm8.5 8.5 7 7', 'M2 2l20 20'],
  noAlcohol: [
    'M8 22h8M7 10h3m7 0h-1.34M12 15v7',
    'M7.3 7.3A12.3 12.3 0 0 0 7 10a5 5 0 0 0 7.39 4.39M8.64 2.98C8.75 2.67 8.87 2.34 9 2h6c1.5 4 2 6 2 8 0 .41-.05.81-.15 1.2M2 2l20 20',
  ],
  crown: [
    'M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3z',
    'M5 21h14',
  ],
  check: ['M20 6 9 17l-5-5'],
  card: [rect(2, 5, 20, 14, 2), 'M2 10h20'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'],
  arrowRight: ['M5 12h14M12 5l7 7-7 7'],
  arrowDown: ['M12 5v14M19 12l-7 7-7-7'],
  copy: [rect(8, 8, 14, 14, 2), 'M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2'],
  lock: [rect(3, 11, 18, 11, 2), 'M7 11V7a5 5 0 0 1 10 0v4'],
  search: [circle(11, 11, 8), 'm21 21-4.3-4.3'],
  alert: [circle(12, 12, 10), 'M12 8v4M12 16h.01'],
  refresh: ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5'],
  user: [circle(12, 7, 4), 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'],
} as const;

/** Filled glyphs. */
const FILL = {
  bat: BAT_PATH,
  whatsapp:
    'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41Z',
} as const;

export type IconName = keyof typeof STROKE | keyof typeof FILL;

/** Icons not drawn on the 24×24 grid. */
const VIEWBOX: Partial<Record<IconName, string>> = { bat: BAT_VIEWBOX };

@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.viewBox]="viewBox()"
      class="size-full"
      [attr.fill]="filled() ? 'currentColor' : 'none'"
      [attr.stroke]="filled() ? null : 'currentColor'"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  // Size comes from the consumer's class (e.g. class="size-5").
  host: { class: 'inline-block shrink-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();

  protected readonly filled = computed(() => this.name() in FILL);
  protected readonly viewBox = computed(() => VIEWBOX[this.name()] ?? '0 0 24 24');
  protected readonly paths = computed<readonly string[]>(() => {
    const name = this.name();
    return name in FILL ? [FILL[name as keyof typeof FILL]] : STROKE[name as keyof typeof STROKE];
  });
}
