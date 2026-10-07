import { createHash, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
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
import { buildRegistrationsWorkbook } from './excel';
import { RateLimiter } from './rate-limit';

export const api = express.Router();
// Parsed here (not in server.ts) so malformed bodies reach this router's JSON error handler.
api.use(express.json({ limit: '10kb' }));

// Generous on purpose: mobile carriers put many people behind the same IP (CGNAT).
const publicLimiter = new RateLimiter(30, 10 * 60 * 1000);
const adminFailures = new RateLimiter(10, 15 * 60 * 1000);

const unavailable = (res: Response) =>
  res.status(503).json({ message: 'El registro no está disponible en este momento. Escríbenos por WhatsApp.' });

/* ───────────────────────── Public: pre-registration ───────────────────────── */

api.post('/registrations', publicLimiter.middleware(), async (req, res) => {
  const body = req.body ?? {};
  if (body.website) {
    res.status(400).json({ message: 'Solicitud inválida.' });
    return;
  }

  const validation = validateRegistration(body);
  if (!validation.ok) {
    res.status(422).json({ message: 'Revisa los datos del formulario.', errors: validation.errors });
    return;
  }

  const supabase = db();
  if (!supabase) return void unavailable(res);

  const { fullName, cedula, phone } = validation.data;
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ full_name: fullName, cedula, phone })
    .select(COLUMNS)
    .single<RegistrationRow>();

  if (!error) {
    res.status(201).json(toResult(data, false));
    return;
  }

  // Unique violation on cédula: let the same person recover their ticket, but don't leak it to others.
  if (error.code === '23505') {
    const { data: existing } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('cedula', cedula)
      .maybeSingle<RegistrationRow>();
    if (existing?.phone === phone) {
      res.status(200).json(toResult(existing, true));
      return;
    }
    res.status(409).json({
      message: 'Esta cédula ya está registrada con otro número. Si es tuya, escríbenos por WhatsApp.',
    });
    return;
  }

  throw error;
});

/* ───────────────────────── Admin (password protected) ─────────────────────── */

function sameSecret(a: string, b: string): boolean {
  const hash = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env['ADMIN_PASSWORD'];
  if (!expected) {
    res.status(503).json({ message: 'Configura ADMIN_PASSWORD en el servidor.' });
    return;
  }

  const ip = req.ip ?? 'unknown';
  if (adminFailures.isBlocked(ip)) {
    res.status(429).json({ message: 'Demasiados intentos fallidos. Espera 15 minutos.' });
    return;
  }

  const header = req.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!sameSecret(given, expected)) {
    adminFailures.hit(ip);
    res.status(401).json({ message: 'Contraseña incorrecta.' });
    return;
  }
  next();
}

api.use('/admin', requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

api.get('/admin/registrations', async (_req, res) => {
  const supabase = db();
  if (!supabase) return void unavailable(res);
  const rows = await fetchAllRegistrations(supabase);
  res.json(rows.map(toAdmin));
});

api.get('/admin/export', async (_req, res) => {
  const supabase = db();
  if (!supabase) return void unavailable(res);
  const rows = await fetchAllRegistrations(supabase);
  const file = await buildRegistrationsWorkbook(rows.map(toAdmin));
  const date = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  res
    .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .attachment(`${EVENT.name.toLowerCase()}-registros-${date}.xlsx`)
    .send(file);
});

api.patch('/admin/registrations/:id', async (req, res) => {
  const supabase = db();
  if (!supabase) return void unavailable(res);
  const id = String(req.params['id']);
  if (!UUID_PATTERN.test(id) || typeof req.body?.paid !== 'boolean') {
    res.status(400).json({ message: 'Solicitud inválida.' });
    return;
  }

  const paid: boolean = req.body.paid;
  const { data, error } = await supabase
    .from(TABLE)
    .update(
      paid
        ? { payment_status: 'paid', payment_method: 'transfer', paid_at: new Date().toISOString() }
        : { payment_status: 'pending', payment_method: null, payment_reference: null, paid_at: null },
    )
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle<RegistrationRow>();
  if (error) throw error;
  if (!data) {
    res.status(404).json({ message: 'Registro no encontrado.' });
    return;
  }
  res.json(toAdmin(data));
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

api.post('/payments/payphone/prepare', publicLimiter.middleware(), async (req, res) => {
  const credentials = payphoneCredentials();
  const supabase = db();
  if (!credentials || !supabase) {
    res.status(503).json({ message: 'El pago con tarjeta no está disponible. Paga por transferencia.' });
    return;
  }

  const registrationId = String(req.body?.registrationId ?? '');
  if (!UUID_PATTERN.test(registrationId)) {
    res.status(400).json({ message: 'Solicitud inválida.' });
    return;
  }

  const { data: row } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('id', registrationId)
    .maybeSingle<RegistrationRow>();
  if (!row) {
    res.status(404).json({ message: 'No encontramos tu pre-registro.' });
    return;
  }
  if (row.payment_status === 'paid') {
    res.status(409).json({ message: 'Esta entrada ya está pagada.' });
    return;
  }

  const siteUrl = process.env['SITE_URL'] ?? `${req.protocol}://${req.get('host')}`;
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
    responseUrl: `${siteUrl}/pago/confirmacion`,
    cancellationUrl: `${siteUrl}/pago/confirmacion`,
    lang: 'es',
  });

  res.json({ url: prepared.payWithCard });
});

interface PayphoneConfirmation {
  statusCode: number;
  transactionStatus: string;
  transactionId: number;
  clientTransactionId: string;
  amount: number;
}

api.post('/payments/payphone/confirm', publicLimiter.middleware(), async (req, res) => {
  const credentials = payphoneCredentials();
  const supabase = db();
  if (!credentials || !supabase) return void unavailable(res);

  const id = Number(req.body?.id);
  const clientTxId = String(req.body?.clientTxId ?? '');
  if (!Number.isSafeInteger(id) || id <= 0 || !CLIENT_TX_PATTERN.test(clientTxId)) {
    res.status(400).json({ message: 'Solicitud inválida.' });
    return;
  }

  // PayPhone reverses the charge if this call doesn't happen within 5 minutes of payment.
  const tx = await payphone<PayphoneConfirmation>('V2/Confirm', credentials.token, { id, clientTxId });
  const registrationId = CLIENT_TX_PATTERN.exec(tx.clientTransactionId ?? '')?.[1];

  if (tx.statusCode !== 3 || !registrationId) {
    res.json({ status: 'cancelled' });
    return;
  }
  if (tx.amount !== COVER_CENTS) {
    console.error('PayPhone amount mismatch', tx);
    res.status(409).json({ message: 'El monto pagado no coincide. Escríbenos por WhatsApp.' });
    return;
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
    res.status(404).json({ message: 'Pago recibido pero no encontramos tu registro. Escríbenos por WhatsApp.' });
    return;
  }

  res.json({ status: 'approved', registration: toResult(row, true) });
});

/* ───────────────────────── Errors ─────────────────────────────────────────── */

api.use((_req, res) => {
  res.status(404).json({ message: 'No encontrado.' });
});

api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ message: 'Solicitud inválida.' });
    return;
  }
  console.error('[api]', err);
  res.status(500).json({ message: 'Algo salió mal. Intenta de nuevo en un momento.' });
});
