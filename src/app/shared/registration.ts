/**
 * Registration model and validation shared by the browser form and the Express API.
 * Keep this file free of Angular imports so the server can use it too.
 */

export interface RegistrationInput {
  fullName: string;
  cedula: string;
  phone: string;
  /** Honeypot: real users never fill it. */
  website?: string;
}

export interface RegistrationResult {
  id: string;
  ticket: string;
  fullName: string;
  paid: boolean;
  alreadyRegistered: boolean;
}

export type PaymentStatus = 'pending' | 'paid';
export type PaymentMethod = 'transfer' | 'payphone';

export interface AdminRegistration {
  id: string;
  ticket: string;
  fullName: string;
  cedula: string;
  phone: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  paidAt: string | null;
  createdAt: string;
}

export type FieldErrors = Partial<Record<'fullName' | 'cedula' | 'phone', string>>;

export type ValidationResult =
  | { ok: true; data: Required<Omit<RegistrationInput, 'website'>> }
  | { ok: false; errors: FieldErrors };

const NAME_PATTERN = /^[\p{L}][\p{L}'’.-]*(?: [\p{L}][\p{L}'’.-]*)+$/u;

/** Ecuadorian cédula: 10 digits, valid province, third digit < 6, modulo-10 check digit. */
export function isValidCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;

  const province = Number(value.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  if (Number(value[2]) >= 6) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(value[i]) * (i % 2 === 0 ? 2 : 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(value[9]);
}

/**
 * Accepts Ecuadorian mobile numbers in any common format
 * (0991234567, 099 123 4567, +593 99 123 4567, 593991234567) and returns E.164.
 */
export function normalizeEcPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const match = /^(?:593|0)?(9\d{8})$/.exec(digits);
  return match ? `+593${match[1]}` : null;
}

/** +593991234567 → "099 123 4567" */
export function formatLocalPhone(e164: string): string {
  const local = '0' + e164.replace(/^\+593/, '');
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** Collapses whitespace and capitalizes each word: "  maría  JOSÉ " → "María José". */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es'));
}

export function validateRegistration(input: Partial<RegistrationInput>): ValidationResult {
  const errors: FieldErrors = {};

  const fullName = normalizeName(String(input.fullName ?? ''));
  if (fullName.length < 5 || fullName.length > 120 || !NAME_PATTERN.test(fullName)) {
    errors.fullName = 'Escribe tu nombre y apellido.';
  }

  const cedula = String(input.cedula ?? '').replace(/\D/g, '');
  if (!isValidCedula(cedula)) {
    errors.cedula = 'Cédula inválida. Debe tener 10 dígitos.';
  }

  const phone = normalizeEcPhone(String(input.phone ?? ''));
  if (!phone) {
    errors.phone = 'Ingresa un celular válido, ej. 0991234567.';
  }

  return Object.keys(errors).length > 0 || !phone
    ? { ok: false, errors }
    : { ok: true, data: { fullName, cedula, phone } };
}
