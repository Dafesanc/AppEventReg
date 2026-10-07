import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { apiErrorMessage, RegistrationApi } from '../../core/registration-api';
import {
  clearSavedRegistration,
  loadSavedRegistration,
  saveRegistration,
} from '../../core/saved-registration';
import { EVENT, coverLabel, whatsappUrl } from '../../shared/event.config';
import {
  type FieldErrors,
  type RegistrationResult,
  validateRegistration,
} from '../../shared/registration';
import { Icon, type IconName } from '../icon/icon';

type Field = keyof FieldErrors;

interface FieldConfig {
  name: Field;
  label: string;
  placeholder: string;
  icon: IconName;
  type: 'text' | 'tel';
  inputmode: 'text' | 'numeric' | 'tel';
  autocomplete: string;
  maxlength: number;
}

/** Runs the same validation as the server so messages match exactly. */
function fieldValidator(field: Field) {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const result = validateRegistration({ [field]: control.value });
    const message = result.ok ? undefined : result.errors[field];
    return message ? { invalid: message } : null;
  };
}

const REQUIRED_MESSAGE: Record<Field, string> = {
  fullName: 'Escribe tus nombres completos.',
  cedula: 'Ingresa tu número de cédula.',
  phone: 'Ingresa tu número de celular.',
};

@Component({
  selector: 'app-registration-form',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './registration-form.html',
  // scroll-margin keeps the card's top in view when scrolling to the success state.
  host: { class: 'block scroll-mt-24' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationForm {
  private readonly api = inject(RegistrationApi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly event = EVENT;
  protected readonly coverLabel = coverLabel;

  protected readonly fields: readonly FieldConfig[] = [
    {
      name: 'fullName',
      label: 'Nombres completos',
      placeholder: 'Ej. María José Pérez',
      icon: 'user',
      type: 'text',
      inputmode: 'text',
      autocomplete: 'name',
      maxlength: 120,
    },
    {
      name: 'cedula',
      label: 'Cédula',
      placeholder: '10 dígitos',
      icon: 'ticket',
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      maxlength: 10,
    },
    {
      name: 'phone',
      label: 'Celular (WhatsApp)',
      placeholder: '09XXXXXXXX',
      icon: 'whatsapp',
      type: 'tel',
      inputmode: 'tel',
      autocomplete: 'tel-national',
      maxlength: 16,
    },
  ];

  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: ['', [Validators.required, fieldValidator('fullName')]],
    cedula: ['', [Validators.required, fieldValidator('cedula')]],
    phone: ['', [Validators.required, fieldValidator('phone')]],
    website: [''],
  });

  protected readonly submitting = signal(false);
  protected readonly paying = signal(false);
  protected readonly copied = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly registration = signal<RegistrationResult | null>(null);

  protected readonly firstName = computed(() => this.registration()?.fullName.split(' ')[0] ?? '');
  protected readonly whatsappLink = computed(() => {
    const r = this.registration();
    if (!r) return '';
    return whatsappUrl(
      `¡Hola! Me pre-registré para *${EVENT.name.toUpperCase()}* ✨\n\n` +
        `Nombre: ${r.fullName}\n` +
        `Código: ${r.ticket}\n\n` +
        `Quiero pagar mi entrada (cover ${coverLabel}) por transferencia. ¿Me pasas los datos? 🙌`,
    );
  });

  constructor() {
    afterNextRender(() => {
      const saved = loadSavedRegistration();
      if (saved) this.registration.set(saved);
    });
  }

  protected error(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.touched || control.valid) return null;
    if (control.hasError('required')) return REQUIRED_MESSAGE[field];
    return control.getError('invalid') ?? control.getError('server') ?? null;
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid')?.focus();
      return;
    }

    this.submitting.set(true);
    this.serverError.set(null);
    this.api.register(this.form.getRawValue()).subscribe({
      next: (registration) => {
        this.submitting.set(false);
        this.registration.set(registration);
        saveRegistration(registration);
        this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      error: (err) => {
        this.submitting.set(false);
        const errors: FieldErrors = err?.error?.errors ?? {};
        for (const [field, message] of Object.entries(errors)) {
          this.form.controls[field as Field].setErrors({ server: message });
        }
        this.form.markAllAsTouched();
        this.serverError.set(apiErrorMessage(err));
      },
    });
  }

  protected payWithCard(): void {
    const registration = this.registration();
    if (!registration || this.paying()) return;
    this.paying.set(true);
    this.serverError.set(null);
    this.api.preparePayment(registration.id).subscribe({
      next: ({ url }) => window.location.assign(url),
      error: (err) => {
        this.paying.set(false);
        this.serverError.set(apiErrorMessage(err));
      },
    });
  }

  protected async copyTicket(): Promise<void> {
    const ticket = this.registration()?.ticket;
    if (!ticket) return;
    try {
      await navigator.clipboard.writeText(ticket);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard blocked: the code is visible on screen anyway.
    }
  }

  protected registerAnother(): void {
    clearSavedRegistration();
    this.registration.set(null);
    this.serverError.set(null);
    this.form.reset();
  }
}
