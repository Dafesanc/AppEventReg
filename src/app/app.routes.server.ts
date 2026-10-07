import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Landing: static HTML generated at build time — fastest load and fully crawlable.
  { path: '', renderMode: RenderMode.Prerender },
  // Private / per-visitor pages don't need SSR.
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'pago/confirmacion', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
