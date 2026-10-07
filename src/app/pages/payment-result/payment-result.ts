import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '../../components/icon/icon';
import { apiErrorMessage, RegistrationApi } from '../../core/registration-api';
import { loadSavedRegistration, saveRegistration } from '../../core/saved-registration';
import { Seo } from '../../core/seo';
import { EVENT, whatsappUrl } from '../../shared/event.config';
import type { RegistrationResult } from '../../shared/registration';

/** PayPhone redirects here with ?id=…&clientTransactionId=… after the card form. */
@Component({
  selector: 'app-payment-result',
  imports: [Icon, RouterLink],
  templateUrl: './payment-result.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentResult {
  protected readonly event = EVENT;
  protected readonly status = signal<'checking' | 'approved' | 'cancelled' | 'error'>('checking');
  protected readonly registration = signal<RegistrationResult | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly helpUrl = whatsappUrl(
    `¡Hola! Intenté pagar mi entrada a ${EVENT.name} con tarjeta y tuve un problema. ¿Me ayudas?`,
  );

  constructor() {
    inject(Seo).setPage({
      title: `Pago · ${EVENT.name}`,
      description: 'Confirmación de pago',
      path: '/pago/confirmacion',
      noindex: true,
    });

    const api = inject(RegistrationApi);
    const params = inject(ActivatedRoute).snapshot.queryParamMap;

    afterNextRender(() => {
      const id = Number(params.get('id'));
      const clientTxId = params.get('clientTransactionId') ?? params.get('clientTxId');
      if (!id || !clientTxId) {
        this.status.set('cancelled');
        return;
      }

      api.confirmPayment(id, clientTxId).subscribe({
        next: (result) => {
          if (result.status !== 'approved') {
            this.status.set('cancelled');
            return;
          }
          this.registration.set(result.registration);
          // Keep the code the visitor already had on the landing page, now marked as paid.
          const saved = loadSavedRegistration();
          saveRegistration({ ...(saved ?? result.registration), paid: true });
          this.status.set('approved');
        },
        error: (err) => {
          this.message.set(apiErrorMessage(err));
          this.status.set('error');
        },
      });
    });
  }
}
