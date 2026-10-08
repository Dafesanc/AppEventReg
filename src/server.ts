import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { EVENT } from './app/shared/event.config';
import { api } from './server/api';

// Angular dev server (Node): read secrets from .env. On Cloudflare they arrive through
// process.env (nodejs_compat), and `wrangler dev` reads .env by itself.
if (globalThis.navigator?.userAgent !== 'Cloudflare-Workers') {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file — rely on real environment variables.
  }
}

// SSRF protection: Angular only renders for these hosts. *.workers.dev covers Cloudflare's free subdomain.
const angularApp = new AngularAppEngine({
  allowedHosts: ['localhost', '127.0.0.1', '*.workers.dev', new URL(EVENT.siteUrl).hostname],
});

const app = new Hono();

app.use(
  secureHeaders({
    xFrameOptions: 'SAMEORIGIN',
    referrerPolicy: 'strict-origin-when-cross-origin',
  }),
);

app.route('/api', api);

app.get('/robots.txt', (c) =>
  c.text(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /pago/\n\nSitemap: ${EVENT.siteUrl}/sitemap.xml\n`,
  ),
);

app.get('/sitemap.xml', (c) =>
  c.body(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      `<url><loc>${EVENT.siteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>` +
      `</urlset>\n`,
    200,
    { 'Content-Type': 'application/xml' },
  ),
);

// Everything else is rendered by Angular. On Cloudflare, static files and the prerendered
// landing page are served by Workers Assets and never reach this handler.
app.all('*', async (c) => (await angularApp.handle(c.req.raw)) ?? c.text('Página no encontrada.', 404));

app.onError((err, c) => {
  console.error('[server]', err);
  return c.text('Algo salió mal.', 500);
});

/** Request handler used by the Angular CLI (dev server and build). */
export const reqHandler = createRequestHandler(app.fetch);

/** Cloudflare Workers entry point. */
export default { fetch: reqHandler };
