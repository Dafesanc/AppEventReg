# Euphoria · Landing y pre-registro

Landing page de la fiesta **Euphoria** con formulario de pre-registro, panel para organizadores
con exportación a Excel, pago por transferencia vía WhatsApp y pago con tarjeta opcional (PayPhone).

**Stack:** Angular 21 (SSR + prerender) · Tailwind CSS 4 · Express · Supabase (Postgres).

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
   Dominio: tu `SITE_URL`. URL de respuesta: `https://TU-DOMINIO/pago/confirmacion`.
2. Copia el *Token* y el *StoreId* en `PAYPHONE_TOKEN` y `PAYPHONE_STORE_ID`.
3. Pon `cardPaymentsEnabled: true` en `event.config.ts` y vuelve a hacer build.

Al confirmarse el pago, el registro se marca solo como pagado (método “Tarjeta”).

## Producción

```bash
npm run build
npm run serve:ssr:AppEventReg   # node dist/AppEventReg/server/server.mjs (puerto PORT o 4000)
```

Necesita un hosting con Node.js (Railway, Render, Fly.io, un VPS…) con las variables de `.env.example`.
`SITE_URL` debe ser el dominio público: se usa para canonical/Open Graph, `robots.txt`, `sitemap.xml`,
el retorno de PayPhone y como host permitido del SSR (otros dominios: `NG_ALLOWED_HOSTS`).
Actualiza también `siteUrl` en `event.config.ts`, que es lo que queda en el HTML prerenderizado.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm start` | Servidor de desarrollo con API (lee `.env`) |
| `npm run build` | Build de producción + prerender |
| `npm test` | Tests unitarios (validación de cédula, celular y nombre) |

## Estructura

```
src/
  app/
    shared/        config del evento + validación compartida cliente/servidor
    pages/         home (landing), admin, payment-result
    components/    formulario, countdown, íconos SVG
    core/          SEO (meta + JSON-LD), cliente de la API
  server/          API Express: registro, admin + Excel, PayPhone
  server.ts        servidor SSR, robots.txt, sitemap.xml
supabase/schema.sql
```
