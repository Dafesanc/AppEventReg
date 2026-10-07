import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { formatTicket } from '../app/shared/event.config';
import type {
  AdminRegistration,
  PaymentMethod,
  PaymentStatus,
  RegistrationResult,
} from '../app/shared/registration';

export const TABLE = 'registrations';
export const COLUMNS =
  'id, ticket_number, full_name, cedula, phone, payment_status, payment_method, payment_reference, paid_at, created_at';

export interface RegistrationRow {
  id: string;
  ticket_number: number;
  full_name: string;
  cedula: string;
  phone: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
}

let client: SupabaseClient | null | undefined;

/**
 * Server-only Supabase client using the secret (service role) key, which bypasses RLS.
 * Returns null when the env vars are missing so the API can answer 503 instead of crashing.
 */
export function db(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_SECRET_KEY'];
    client = url && key
      ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
  }
  return client;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toResult(row: RegistrationRow, alreadyRegistered: boolean): RegistrationResult {
  return {
    id: row.id,
    ticket: formatTicket(row.ticket_number),
    fullName: row.full_name,
    paid: row.payment_status === 'paid',
    alreadyRegistered,
  };
}

export function toAdmin(row: RegistrationRow): AdminRegistration {
  return {
    id: row.id,
    ticket: formatTicket(row.ticket_number),
    fullName: row.full_name,
    cedula: row.cedula,
    phone: row.phone,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

/** Reads every registration, paging past PostgREST's default 1000-row limit. */
export async function fetchAllRegistrations(supabase: SupabaseClient): Promise<RegistrationRow[]> {
  const pageSize = 1000;
  const rows: RegistrationRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .order('ticket_number', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data as RegistrationRow[]));
    if (data.length < pageSize) return rows;
  }
}
