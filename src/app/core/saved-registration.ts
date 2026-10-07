import type { RegistrationResult } from '../shared/registration';

/**
 * Remembers the visitor's own registration in this browser so returning to the page
 * shows their code and payment options again. Storage can be unavailable (private mode),
 * so every access is best-effort.
 */
const KEY = 'euphoria:registration';

export function loadSavedRegistration(): RegistrationResult | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as RegistrationResult) : null;
    return parsed?.id && parsed.ticket ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRegistration(registration: RegistrationResult): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(registration));
  } catch {
    // Ignore: the visitor just won't see their code after a reload.
  }
}

export function clearSavedRegistration(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
