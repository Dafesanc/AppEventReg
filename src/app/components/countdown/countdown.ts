import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

const UNITS = [
  { label: 'Días', ms: 86_400_000 },
  { label: 'Horas', ms: 3_600_000 },
  { label: 'Min', ms: 60_000 },
  { label: 'Seg', ms: 1_000 },
] as const;

/**
 * Live countdown to the event. The prerendered HTML shows "--" placeholders (the build
 * time would be stale); the browser fills in real values. Hidden once the event starts.
 */
@Component({
  selector: 'app-countdown',
  template: `
    @if (!started()) {
      <p class="eyebrow mb-4 text-center">Faltan</p>
      <ol class="grid grid-cols-4 gap-2 sm:gap-3" aria-live="off">
        @for (unit of units(); track unit.label) {
          <li class="card flex w-[4.5rem] flex-col items-center py-3 sm:w-24 sm:py-4">
            <span class="font-display text-3xl text-white tabular-nums sm:text-5xl">{{ unit.value }}</span>
            <span class="mt-1 font-mono text-[0.65rem] tracking-[0.2em] text-mist uppercase">{{ unit.label }}</span>
          </li>
        }
      </ol>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Countdown {
  readonly target = input.required<string>();

  private readonly now = signal<number | null>(null);
  private readonly remaining = computed(() => Date.parse(this.target()) - (this.now() ?? Date.now()));

  protected readonly started = computed(() => this.remaining() <= 0);
  protected readonly units = computed(() => {
    const known = this.now() !== null;
    let rest = this.remaining();
    return UNITS.map(({ label, ms }) => {
      const amount = Math.floor(rest / ms);
      rest -= amount * ms;
      return { label, value: known ? String(amount).padStart(2, '0') : '--' };
    });
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.now.set(Date.now());
      const timer = setInterval(() => this.now.set(Date.now()), 1000);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }
}
