import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { EVENT, formatTicket } from '../app/shared/event.config';
import { validateRegistration } from '../app/shared/registration';
import {
  COLUMNS,
  TABLE,
  UUID_PATTERN,
  db,
  fetchAllRegistrations,
  toAdmin,
  toResult,
  type RegistrationRow,
} from './db';
import { RateLimiter, clientIp } from './rate-limit';

/** JSON API mounted at /api. Runs on Cloudflare Workers and on the Angular dev server. */
export const api = new Hono();

api.use(
  bodyLimit({
    maxSize: 10 * 1024,
    onError: (c) => c.json({ message: 'Solicitud inválida.' }, 413),
  }),
);

// Generous on purpose: mobile carriers put many people behind the same IP (CGNAT).
const publicLimiter = new RateLimiter(30, 10 * 60 * 1000);
const adminFailures = new RateLimiter(10, 15 * 60 * 1000);

const invalid = (c: Context) => c.json({ message: 'Solicitud inválida.' }, 400);
const unavailable = (c: Context) =>
  c.json({ message: 'El registro no está disponible en este momento. Escríbenos por WhatsApp.' }, 503);

/** Parsed JSON object body, or null when it's missing or malformed. */
async function jsonBody(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await c.req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ───────────────────────── Public: pre-registration ───────────────────────── */

api.post('/registrations', publicLimiter.middleware(), async (c) => {
  const body = await jsonBody(c);
  if (!body || body['website']) return invalid(c);

  const validation = validateRegistration(body);
  if (!validation.ok) {
    return c.json({ message: 'Revisa los datos del formulario.', errors: validation.errors }, 422);
  }

  const supabase = db();
  if (!supabase) return unavailable(c);

  const { fullName, cedula, phone } = validation.data;
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ full_name: fullName, cedula, phone })
    .select(COLUMNS)
    .single<RegistrationRow>();

  if (!error) return c.json(toResult(data, false), 201);

  // Unique violation on cédula: let the same person recover their ticket, but don't leak it to others.
  if (error.code === '23505') {
    const { data: existing } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('cedula', cedula)
      .maybeSingle<RegistrationRow>();
    if (existing?.phone === phone) return c.json(toResult(existing, true), 200);
    return c.json(
      { message: 'Esta cédula ya está registrada con otro número. Si es tuya, escríbenos por WhatsApp.' },
      409,
    );
  }

  throw error;
});

/* ───────────────────────── Admin (password protected) ─────────────────────── */

/** Constant-time comparison of SHA-256 digests (Web Crypto, available on Workers and Node). */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [x, y] = await Promise.all(
    [a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)))),
  );
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const requireAdmin: MiddlewareHandler = async (c, next) => {
  const expected = process.env['ADMIN_PASSWORD'];
  if (!expected) return c.json({ message: 'Configura ADMIN_PASSWORD en el servidor.' }, 503);

  const ip = clientIp(c);
  if (adminFailures.isBlocked(ip)) {
    return c.json({ message: 'Demasiados intentos fallidos. Espera 15 minutos.' }, 429);
  }

  const header = c.req.header('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!(await sameSecret(given, expected))) {
    adminFailures.hit(ip);
    return c.json({ message: 'Contraseña incorrecta.' }, 401);
  }

  c.header('Cache-Control', 'no-store');
  return next();
};

api.use('/admin/*', requireAdmin);

api.get('/admin/registrations', async (c) => {
  const supabase = db();
  if (!supabase) return unavailable(c);
  const rows = await fetchAllRegistrations(supabase);
  return c.json(rows.map(toAdmin));
});

api.patch('/admin/registrations/:id', async (c) => {
  const supabase = db();
  if (!supabase) return unavailable(c);
  const id = c.req.param('id');
  const body = await jsonBody(c);
  if (!UUID_PATTERN.test(id) || typeof body?.['paid'] !== 'boolean') return invalid(c);

  const { data, error } = await supabase
    .from(TABLE)
    .update(
      body['paid']
        ? { payment_status: 'paid', payment_method: 'transfer', paid_at: new Date().toISOString() }
        : { payment_status: 'pending', payment_method: null, payment_reference: null, paid_at: null },
    )
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle<RegistrationRow>();
  if (error) throw error;
  if (!data) return c.json({ message: 'Registro no encontrado.' }, 404);
  return c.json(toAdmin(data));
});

/* ───────────────────────── Card payments (PayPhone) ───────────────────────── */

const PAYPHONE_API = 'https://pay.payphonetodoesposible.com/api/button';
const COVER_CENTS = Math.round(EVENT.cover.amount * 100);
const CLIENT_TX_PATTERN = /^([0-9a-f-]{36})-[0-9a-z]+$/i;

function payphoneCredentials() {
  const token = process.env['PAYPHONE_TOKEN'];
  const storeId = process.env['PAYPHONE_STORE_ID'];
  return EVENT.cardPaymentsEnabled && token && storeId ? { token, storeId } : null;
}

async function payphone<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${PAYPHONE_API}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`PayPhone ${path} ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

api.post('/payments/payphone/prepare', publicLimiter.middleware(), async (c) => {
  const credentials = payphoneCredentials();
  const supabase = db();
  if (!credentials || !supabase) {
    return c.json({ message: 'El pago con tarjeta no está disponible. Paga por transferencia.' }, 503);
  }

  const registrationId = String((await jsonBody(c))?.['registrationId'] ?? '');
  if (!UUID_PATTERN.test(registrationId)) return invalid(c);

  const { data: row } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('id', registrationId)
    .maybeSingle<RegistrationRow>();
  if (!row) return c.json({ message: 'No encontramos tu pre-registro.' }, 404);
  if (row.payment_status === 'paid') return c.json({ message: 'Esta entrada ya está pagada.' }, 409);

  // The visitor's own origin (workers.dev or custom domain) — must be the domain registered in PayPhone.
  const origin = new URL(c.req.url).origin;
  const prepared = await payphone<{ payWithCard: string }>('Prepare', credentials.token, {
    amount: COVER_CENTS,
    amountWithoutTax: COVER_CENTS,
    currency: 'USD',
    // Must be unique per attempt; the registration id prefix lets confirm find the row.
    clientTransactionId: `${row.id}-${Date.now().toString(36)}`,
    storeId: credentials.storeId,
    reference: `Entrada ${EVENT.name} ${formatTicket(row.ticket_number)}`,
    phoneNumber: row.phone,
    documentId: row.cedula,
    responseUrl: `${origin}/pago/confirmacion`,
    cancellationUrl: `${origin}/pago/confirmacion`,
    lang: 'es',
  });

  return c.json({ url: prepared.payWithCard });
});

interface PayphoneConfirmation {
  statusCode: number;
  transactionStatus: string;
  transactionId: number;
  clientTransactionId: string;
  amount: number;
}

api.post('/payments/payphone/confirm', publicLimiter.middleware(), async (c) => {
  const credentials = payphoneCredentials();
  const supabase = db();
  if (!credentials || !supabase) return unavailable(c);

  const body = await jsonBody(c);
  const id = Number(body?.['id']);
  const clientTxId = String(body?.['clientTxId'] ?? '');
  if (!Number.isSafeInteger(id) || id <= 0 || !CLIENT_TX_PATTERN.test(clientTxId)) return invalid(c);

  // PayPhone reverses the charge if this call doesn't happen within 5 minutes of payment.
  const tx = await payphone<PayphoneConfirmation>('V2/Confirm', credentials.token, { id, clientTxId });
  const registrationId = CLIENT_TX_PATTERN.exec(tx.clientTransactionId ?? '')?.[1];

  if (tx.statusCode !== 3 || !registrationId) return c.json({ status: 'cancelled' });
  if (tx.amount !== COVER_CENTS) {
    console.error('PayPhone amount mismatch', tx);
    return c.json({ message: 'El monto pagado no coincide. Escríbenos por WhatsApp.' }, 409);
  }

  const { data: row, error } = await supabase
    .from(TABLE)
    .update({
      payment_status: 'paid',
      payment_method: 'payphone',
      payment_reference: String(tx.transactionId),
      paid_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .select(COLUMNS)
    .maybeSingle<RegistrationRow>();
  if (error) throw error;
  if (!row) {
    console.error('PayPhone payment for unknown registration', tx);
    return c.json({ message: 'Pago recibido pero no encontramos tu registro. Escríbenos por WhatsApp.' }, 404);
  }

  return c.json({ status: 'approved', registration: toResult(row, true) });
});

/* ───────────────────────── Errors ─────────────────────────────────────────── */

// Registered last so unknown /api/* paths get JSON instead of falling through to Angular.
api.all('*', (c) => c.json({ message: 'No encontrado.' }, 404));

api.onError((err, c) => {
  console.error('[api]', err);
  return c.json({ message: 'Algo salió mal. Intenta de nuevo en un momento.' }, 500);
});
