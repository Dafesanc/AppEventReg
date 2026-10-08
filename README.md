# Euphoria · Landing y pre-registro

Landing page de la fiesta **Euphoria** con formulario de pre-registro, panel para organizadores
con exportación a Excel, pago por transferencia vía WhatsApp y pago con tarjeta opcional (PayPhone).

**Stack:** Angular 21 (SSR + prerender) · Tailwind CSS 4 · Hono · Supabase (Postgres) · Cloudflare Workers.

## Puesta en marcha

1. Instala dependencias: `npm install`
2. Crea un proyecto en [Supabase](https://supabase.com) → **SQL Editor** → pega y ejecuta [`supabase/schema.sql`](supabase/schema.sql).
3. Copia `.env.example` como `.env` y completa:
   - `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (Project Settings → API; usa la clave **secreta**, `sb_secret_…` o la `service_role` legacy).
   - `ADMIN_PASSWORD`: la contraseña del panel `/admin`.
   - Guarda el archivo como UTF-8 **sin BOM** (en Windows PowerShell 5.1, `Set-Content -Encoding utf8` agrega BOM y rompe la primera variable).
4. `npm start` y abre http://localhost:4200

## Editar el contenido

- Datos del evento (fecha, lugar, cover, DJ, organizadora, WhatsApp, dominio): [`src/app/shared/event.config.ts`](src/app/shared/event.config.ts).
- Textos de las secciones: [`src/app/pages/home/home.ts`](src/app/pages/home/home.ts) y [`home.html`](src/app/pages/home/home.html).
- Imágenes optimizadas en `public/img/` (logo con transparencia en WebP, flyer, imagen para compartir `og-euphoria.jpg` de 1200×630).

La página principal se **prerenderiza** en el build: después de cambiar contenido hay que volver a hacer build/deploy.

## Panel de organizadores (`/admin`)

Ingresa con `ADMIN_PASSWORD`. Desde ahí puedes:
- ver todos los pre-registros, buscar y filtrar;
- marcar como **pagado** a quien envió la transferencia por WhatsApp;
- **descargar el Excel** (código, nombre, cédula, teléfono, estado y método de pago, fechas).

Los datos personales nunca salen al navegador público: la tabla tiene RLS activado sin políticas y solo
el servidor (con la clave secreta) la lee o escribe.

## Pago con tarjeta (PayPhone, opcional)

1. Crea tu cuenta en **Payphone Business** y luego una aplicación tipo *Web* en **Payphone Developer**.
   Dominio: el de tu sitio. URL de respuesta: `https://TU-DOMINIO/pago/confirmacion`.
2. Guarda el *Token* y el *StoreId* como secrets: `npx wrangler secret put PAYPHONE_TOKEN` y `PAYPHONE_STORE_ID`
   (y en tu `.env` para probar en local).
3. Pon `cardPaymentsEnabled: true` en `event.config.ts` y vuelve a desplegar.

Al confirmarse el pago, el registro se marca solo como pagado (método “Tarjeta”).

## Despliegue en Cloudflare Workers

La landing prerenderizada y los archivos estáticos se sirven desde la CDN de Cloudflare; el Worker
(`src/server.ts`) solo atiende la API, `robots.txt`, `sitemap.xml` y las rutas `/admin` y `/pago`.
Entra en el plan gratuito (10 ms de CPU por request: la landing no consume CPU del Worker).

Primera vez:

```bash
npx wrangler login                              # abre el navegador para autorizar tu cuenta
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put ADMIN_PASSWORD
npm run deploy                                  # ng build + wrangler deploy
```

La app queda en `https://euphoria.<tu-subdominio>.workers.dev`. Después:
1. Pon esa URL (o tu dominio propio) en `siteUrl` de `event.config.ts` — es la que va en el canonical,
   Open Graph, `robots.txt` y `sitemap.xml` — y vuelve a ejecutar `npm run deploy`.
2. Con dominio propio: Cloudflare → Workers & Pages → `euphoria` → Settings → Domains & Routes → *Add Custom Domain*.

Archivos de Cloudflare: [`wrangler.jsonc`](wrangler.jsonc), [`public/_headers`](public/_headers) (caché y
headers de los estáticos) y [`public/.assetsignore`](public/.assetsignore) (lo que no se publica: `inspo/`, `logo/`).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm start` | Servidor de desarrollo con API (lee `.env`) |
| `npm run build` | Build de producción + prerender |
| `npm run preview` | Build + Worker local en el runtime real de Cloudflare (`wrangler dev`, lee `.env`) |
| `npm run deploy` | Build + publicación en Cloudflare |
| `npm test` | Tests unitarios (validación de cédula, celular y nombre) |

## Estructura

```
src/
  app/
    shared/        config del evento + validación compartida cliente/servidor
    pages/         home (landing), admin (+ Excel en el navegador), payment-result
    components/    formulario, countdown, íconos SVG
    core/          SEO (meta + JSON-LD), cliente de la API
  server/          API Hono: registro, admin, PayPhone
  server.ts        Worker / SSR, robots.txt, sitemap.xml
supabase/schema.sql
wrangler.jsonc     configuración de Cloudflare
```
