import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Icon } from '../../components/icon/icon';
import { apiErrorMessage } from '../../core/registration-api';
import { Seo } from '../../core/seo';
import { EVENT } from '../../shared/event.config';
import { type AdminRegistration, formatLocalPhone } from '../../shared/registration';

type Filter = 'all' | 'paid' | 'pending';

const TOKEN_KEY = 'euphoria:admin';
const dateFormat = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

@Component({
  selector: 'app-admin',
  imports: [Icon],
  templateUrl: './admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Admin {
  private readonly http = inject(HttpClient);

  protected readonly event = EVENT;
  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'paid', label: 'Pagados' },
    { value: 'pending', label: 'Pendientes' },
  ];

  protected readonly password = signal('');
  protected readonly token = signal<string | null>(null);
  protected readonly rows = signal<AdminRegistration[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly downloading = signal(false);
  protected readonly saving = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly filter = signal<Filter>('all');

  protected readonly stats = computed(() => {
    const rows = this.rows() ?? [];
    const paid = rows.filter((r) => r.paymentStatus === 'paid').length;
    return {
      total: rows.length,
      paid,
      pending: rows.length - paid,
      revenue: paid * EVENT.cover.amount,
    };
  });

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('es');
    const filter = this.filter();
    return (this.rows() ?? [])
      .filter((r) => filter === 'all' || r.paymentStatus === filter)
      .filter(
        (r) =>
          !q ||
          r.fullName.toLocaleLowerCase('es').includes(q) ||
          r.cedula.includes(q) ||
          r.ticket.toLowerCase().includes(q) ||
          r.phone.includes(q.replace(/^0/, '')),
      )
      .reverse();
  });

  constructor() {
    inject(Seo).setPage({
      title: `Admin · ${EVENT.name}`,
      description: 'Panel de pre-registros',
      path: '/admin',
      noindex: true,
    });

    afterNextRender(() => {
      const saved = readToken();
      if (saved) {
        this.token.set(saved);
        this.load();
      }
    });
  }

  protected login(event: Event): void {
    event.preventDefault();
    const password = this.password().trim();
    if (!password) return;
    this.token.set(password);
    this.load();
  }

  protected logout(): void {
    writeToken(null);
    this.token.set(null);
    this.rows.set(null);
    this.password.set('');
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<AdminRegistration[]>('/api/admin/registrations', { headers: this.headers() }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.rows.set(rows);
        writeToken(this.token());
      },
      error: (err) => this.fail(err),
    });
  }

  protected togglePaid(row: AdminRegistration): void {
    this.saving.set(row.id);
    this.http
      .patch<AdminRegistration>(
        `/api/admin/registrations/${row.id}`,
        { paid: row.paymentStatus !== 'paid' },
        { headers: this.headers() },
      )
      .subscribe({
        next: (updated) => {
          this.saving.set(null);
          this.rows.update((rows) => rows?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
        },
        error: (err) => {
          this.saving.set(null);
          this.fail(err);
        },
      });
  }

  protected download(): void {
    this.downloading.set(true);
    this.http
      .get('/api/admin/export', { headers: this.headers(), responseType: 'blob', observe: 'response' })
      .subscribe({
        next: (response) => {
          this.downloading.set(false);
          const name =
            /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '')?.[1] ??
            'registros.xlsx';
          const url = URL.createObjectURL(response.body!);
          const link = Object.assign(document.createElement('a'), { href: url, download: name });
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: () => {
          this.downloading.set(false);
          this.error.set('No se pudo generar el Excel. Intenta de nuevo.');
        },
      });
  }

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected setPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected phone(e164: string): string {
    return formatLocalPhone(e164);
  }

  protected chatUrl(e164: string): string {
    return `https://wa.me/${e164.replace('+', '')}`;
  }

  protected date(iso: string): string {
    return dateFormat.format(new Date(iso));
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token() ?? ''}` });
  }

  private fail(err: { status?: number }): void {
    this.loading.set(false);
    if (err.status === 401) this.logout();
    this.error.set(apiErrorMessage(err));
  }
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the admin will just have to log in again after a reload.
  }
}
