-- Euphoria · pre-registros
-- Ejecuta este script una sola vez en Supabase → SQL Editor → New query → Run.

create table if not exists public.registrations (
  id                uuid primary key default gen_random_uuid(),
  ticket_number     integer generated always as identity unique,
  full_name         text not null check (char_length(full_name) between 5 and 120),
  cedula            text not null unique check (cedula ~ '^[0-9]{10}$'),
  phone             text not null check (phone ~ '^\+5939[0-9]{8}$'),
  payment_status    text not null default 'pending' check (payment_status in ('pending', 'paid')),
  payment_method    text check (payment_method in ('transfer', 'payphone')),
  payment_reference text,
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists registrations_created_at_idx on public.registrations (created_at);

-- RLS activado SIN políticas: nadie con la clave pública (anon/publishable) puede leer ni escribir.
-- Solo el servidor de la app, que usa la clave secreta (service_role), accede a los datos.
alter table public.registrations enable row level security;
