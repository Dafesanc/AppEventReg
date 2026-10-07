import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { RegistrationInput, RegistrationResult } from '../shared/registration';

export type PaymentConfirmation =
  | { status: 'approved'; registration: RegistrationResult }
  | { status: 'cancelled' };

@Injectable({ providedIn: 'root' })
export class RegistrationApi {
  private readonly http = inject(HttpClient);

  register(input: RegistrationInput) {
    return this.http.post<RegistrationResult>('/api/registrations', input);
  }

  preparePayment(registrationId: string) {
    return this.http.post<{ url: string }>('/api/payments/payphone/prepare', { registrationId });
  }

  confirmPayment(id: number, clientTxId: string) {
    return this.http.post<PaymentConfirmation>('/api/payments/payphone/confirm', { id, clientTxId });
  }
}

/** Extracts the user-facing message the API sends with every error. */
export function apiErrorMessage(error: unknown): string {
  const body = (error as { error?: { message?: unknown } })?.error;
  return typeof body?.message === 'string'
    ? body.message
    : 'No pudimos conectar. Revisa tu internet e intenta de nuevo.';
}
