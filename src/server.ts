import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { EVENT } from './app/shared/event.config';
import { api } from './server/api';

// Local development: read secrets from .env (in production the host provides them).
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on real environment variables.
}

const browserDistFolder = join(import.meta.dirname, '../browser');
const siteUrl = process.env['SITE_URL'] ?? EVENT.siteUrl;

const app = express();
// SSRF protection: Angular only server-renders for these hostnames (extra ones via NG_ALLOWED_HOSTS).
const extraHosts = (process.env['NG_ALLOWED_HOSTS'] ?? '').split(',').map((h) => h.trim());
const angularApp = new AngularNodeAppEngine({
  allowedHosts: [
    ...new Set(['localhost', new URL(siteUrl).hostname, new URL(EVENT.siteUrl).hostname, ...extraHosts]),
  ].filter(Boolean),
});

// Behind a proxy/CDN (Render, Railway, Fly…) so req.ip is the real client for rate limiting.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  next();
});

app.use('/api', api);

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /pago/\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  );
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      `<url><loc>${siteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>` +
      `</urlset>\n`,
  );
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
