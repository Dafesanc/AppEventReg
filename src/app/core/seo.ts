import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { EVENT } from '../shared/event.config';

export interface PageSeo {
  title: string;
  description: string;
  path?: string;
  image?: { url: string; width: number; height: number; alt: string };
  noindex?: boolean;
}

/** Sets title, description, canonical, Open Graph/Twitter and JSON-LD. Runs during prerender. */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  setPage(page: PageSeo): void {
    const url = `${EVENT.siteUrl}${page.path ?? '/'}`;
    this.title.setTitle(page.title);

    const tags: Record<string, string> = {
      description: page.description,
      robots: page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
      'og:type': 'website',
      'og:site_name': EVENT.name,
      'og:locale': 'es_EC',
      'og:title': page.title,
      'og:description': page.description,
      'og:url': url,
      'twitter:card': page.image ? 'summary_large_image' : 'summary',
      'twitter:title': page.title,
      'twitter:description': page.description,
    };
    if (page.image) {
      const imageUrl = this.absolute(page.image.url);
      Object.assign(tags, {
        'og:image': imageUrl,
        'og:image:width': String(page.image.width),
        'og:image:height': String(page.image.height),
        'og:image:alt': page.image.alt,
        'twitter:image': imageUrl,
      });
    }

    for (const [key, content] of Object.entries(tags)) {
      const attr = key.startsWith('og:') ? 'property' : 'name';
      this.meta.updateTag({ [attr]: key, content }, `${attr}="${key}"`);
    }

    if (!page.noindex) this.setCanonical(url);
  }

  setJsonLd(id: string, data: object): void {
    let script = this.document.getElementById(id);
    if (!script) {
      script = this.document.createElement('script');
      script.id = id;
      script.setAttribute('type', 'application/ld+json');
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  absolute(path: string): string {
    return path.startsWith('http') ? path : `${EVENT.siteUrl}/${path.replace(/^\//, '')}`;
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
