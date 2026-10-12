/**
 * Single source of truth for the event. Used by the landing page, SEO tags,
 * WhatsApp messages, the Excel export and the payment gateway.
 */
export const EVENT = {
  name: 'Spooky Night',
  /** Used in the page title and description ("Spooky Night, la fiesta de Halloween en…"). */
  kind: 'fiesta de Halloween',
  slogan: 'Nada es lo que parece…',
  tagline: 'Una noche de miedo. Cero excusas.',

  /** ISO 8601 with Ecuador offset (UTC-5, no DST). Drives the countdown and SEO. */
  startDate: '2026-10-17T21:00:00-05:00',
  /** Written out by hand so every label reads the same on server and browser. Keep in sync with startDate. */
  date: { weekday: 'Sábado', day: 17, month: 'octubre' },
  doorsLabel: '9:00 PM',

  venue: {
    name: 'Urdesa Spot',
    area: 'Urdesa',
    city: 'Guayaquil',
    region: 'Guayas',
    country: 'EC',
  },

  cover: {
    amount: 5,
    currency: 'USD',
    perk: 'Botella personal de Switch gratis',
  },

  dj: 'DJ Sebas',
  organizer: {
    name: 'Astrid Adrián',
    instagram: 'astrid_.ab',
  },

  /** WhatsApp number in international format, digits only (+593 98 312 0430). */
  whatsapp: '593983120430',

  /** Public URL where the site is deployed (no trailing slash). Used for canonical/OG/sitemap. */
  siteUrl: 'https://euphoria.dafesanc12.workers.dev',

  /** Shows the "pay with card" button. Also requires PAYPHONE_* env vars on the server. */
  cardPaymentsEnabled: false,

  /** Prefix for the human-readable ticket code (SPK-0042). The number comes from the database. */
  ticketPrefix: 'SPK',
} as const;

export const coverLabel = `$${EVENT.cover.amount}`;

const { weekday, day, month } = EVENT.date;
export const dateLabels = {
  /** Sábado 17 de octubre */
  long: `${weekday} ${day} de ${month}`,
  /** 17 de octubre */
  dayMonth: `${day} de ${month}`,
  /** Sáb 17 Oct */
  short: `${weekday.slice(0, 3)} ${day} ${month[0].toUpperCase()}${month.slice(1, 3)}`,
  /** 17.10 */
  numeric: `${String(day).padStart(2, '0')}.${EVENT.startDate.slice(5, 7)}`,
};

export const eventDescription =
  `${EVENT.name}, la ${EVENT.kind} en ${EVENT.venue.name} (${EVENT.venue.city}) con ${EVENT.dj}. ` +
  `${dateLabels.long}, puertas ${EVENT.doorsLabel}. Cover ${coverLabel} con ` +
  `${EVENT.cover.perk.toLowerCase()}. Pre-regístrate aquí.`;

export const instagramUrl = (user: string) => `https://www.instagram.com/${user}/`;

export function whatsappUrl(text: string): string {
  return `https://wa.me/${EVENT.whatsapp}?text=${encodeURIComponent(text)}`;
}

/** "Spooky Night" → "spooky-night" (file names). */
export const eventSlug = EVENT.name
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

export function formatTicket(ticketNumber: number): string {
  return `${EVENT.ticketPrefix}-${String(ticketNumber).padStart(4, '0')}`;
}
