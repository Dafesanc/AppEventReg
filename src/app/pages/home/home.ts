import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Countdown } from '../../components/countdown/countdown';
import { BatSwarm } from '../../components/halloween/bat-swarm';
import { Sticker } from '../../components/halloween/sticker';
import { Icon, type IconName } from '../../components/icon/icon';
import { RegistrationForm } from '../../components/registration-form/registration-form';
import { Seo } from '../../core/seo';
import {
  EVENT,
  coverLabel,
  dateLabels,
  eventDescription,
  eventSlug,
  instagramUrl,
  whatsappUrl,
} from '../../shared/event.config';

interface Feature {
  icon: IconName;
  title: string;
  text: string;
}

const FLYER = 'img/spooky-flyer.jpg';

@Component({
  selector: 'app-home',
  imports: [BatSwarm, Countdown, Icon, RegistrationForm, Sticker],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly event = EVENT;
  protected readonly coverLabel = coverLabel;
  protected readonly dateLabels = dateLabels;
  protected readonly organizerUrl = instagramUrl(EVENT.organizer.instagram);
  protected readonly questionsUrl = whatsappUrl(`¡Hola! Tengo una pregunta sobre ${EVENT.name} 🎃`);
  protected readonly year = new Date(EVENT.startDate).getFullYear();
  protected readonly flyerFileName = `${eventSlug}-flyer.jpg`;
  protected readonly flyerAlt =
    `Flyer de ${EVENT.name}: ${EVENT.venue.name}, ${dateLabels.dayMonth}, cover ${coverLabel}. ${EVENT.slogan}`;

  protected readonly marquee = [
    EVENT.name,
    EVENT.slogan.replace('…', ''),
    EVENT.dj,
    dateLabels.numeric,
    EVENT.venue.name,
    `Open doors ${EVENT.doorsLabel}`,
  ];

  protected readonly details: (Feature & { label: string })[] = [
    { icon: 'calendar', label: 'Fecha', title: dateLabels.dayMonth, text: EVENT.date.weekday },
    { icon: 'pin', label: 'Lugar', title: EVENT.venue.name, text: `${EVENT.venue.area}, ${EVENT.venue.city}` },
    { icon: 'clock', label: 'Open doors', title: EVENT.doorsLabel, text: 'Apertura de puertas' },
    { icon: 'ticket', label: 'Cover', title: coverLabel, text: 'Incluye botella personal de Switch' },
  ];

  protected readonly inside: Feature[] = [
    { icon: 'wine', title: 'Bebidas', text: 'A la venta dentro del recinto.' },
    { icon: 'martini', title: 'Cócteles', text: 'Pociones para brindar toda la noche.' },
    { icon: 'cookie', title: 'Snacks', text: 'Para recargar energía entre sustos.' },
    { icon: 'camera', title: 'Photocall', text: 'Tu spot para las selfies más terroríficas.' },
  ];

  protected readonly rules: Feature[] = [
    { icon: 'noSmoking', title: 'Sin cigarrillos', text: 'No se permite ingresar con cigarrillos.' },
    { icon: 'noPills', title: 'Cero sustancias', text: 'Prohibido ingresar sustancias psicotrópicas.' },
    { icon: 'noAlcohol', title: 'Sin bebidas de afuera', text: 'No se permite ingresar bebidas alcohólicas.' },
  ];

  protected readonly steps = [
    { title: 'Pre-regístrate', text: 'Nombre, cédula y celular. Toma 30 segundos.' },
    { title: 'Paga tu entrada', text: `Cover de ${coverLabel} por transferencia vía WhatsApp${EVENT.cardPaymentsEnabled ? ' o con tarjeta' : ''}.` },
    { title: `Vive ${EVENT.name}`, text: `Te esperamos el ${dateLabels.long.toLowerCase()} desde las ${EVENT.doorsLabel}.` },
  ];

  constructor() {
    const seo = inject(Seo);
    const image = {
      url: 'img/spooky-og.jpg',
      width: 1200,
      height: 630,
      alt: `${EVENT.name} — ${EVENT.tagline}`,
    };

    seo.setPage({
      title: `${EVENT.name} — Fiesta de Halloween ${dateLabels.dayMonth} · ${EVENT.venue.name}, ${EVENT.venue.city}`,
      description: eventDescription,
      image,
    });

    seo.setJsonLd('event-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: `${EVENT.name} — ${EVENT.slogan.replace('…', '')}`,
      description: eventDescription,
      startDate: EVENT.startDate,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      image: [seo.absolute(image.url), seo.absolute(FLYER)],
      location: {
        '@type': 'Place',
        name: EVENT.venue.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: EVENT.venue.area,
          addressLocality: EVENT.venue.city,
          addressRegion: EVENT.venue.region,
          addressCountry: EVENT.venue.country,
        },
      },
      performer: { '@type': 'Person', name: EVENT.dj },
      organizer: { '@type': 'Person', name: EVENT.organizer.name, url: this.organizerUrl },
      offers: {
        '@type': 'Offer',
        price: EVENT.cover.amount.toFixed(2),
        priceCurrency: EVENT.cover.currency,
        availability: 'https://schema.org/InStock',
        url: `${EVENT.siteUrl}/#registro`,
      },
    });
  }
}
