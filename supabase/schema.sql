-- ============================================================
-- schema.sql — Schema completo Turnify (migrations 001-010)
-- Idempotente: DROP POLICY IF EXISTS prima di ogni CREATE.
--
-- Per un DB completamente vuoto: eseguire questo file.
-- Per un DB con schema esistente: eseguire reset.sql poi seed_demo.sql.
-- Eseguire nel SQL Editor di Supabase (service_role).
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELLA: users
-- ============================================================
create table if not exists public.users (
  id              uuid        primary key references auth.users(id) on delete cascade,
  nome            text        not null,
  email           text        not null unique,
  ruolo           text        not null default 'dipendente'
                              check (ruolo in ('admin', 'manager', 'dipendente')),
  attivo          boolean     not null default true,
  data_creazione  timestamptz not null default now(),
  disattivato_at  timestamptz
);

-- ============================================================
-- TABELLA: holidays
-- ============================================================
create table if not exists public.holidays (
  id        uuid    primary key default uuid_generate_v4(),
  date      date    not null unique,
  name      text    not null,
  mandatory boolean not null default false,
  year      integer not null generated always as (extract(year from date)::integer) stored
);

-- ============================================================
-- TABELLA: month_status
-- ============================================================
create table if not exists public.month_status (
  id               uuid        primary key default uuid_generate_v4(),
  month            integer     not null check (month between 1 and 12),
  year             integer     not null check (year >= 2024),
  status           text        not null default 'open'
                               check (status in ('open', 'locked', 'confirmed')),
  locked_by        uuid        references public.users(id),
  locked_at        timestamptz,
  email_inviata    boolean     not null default false,
  email_inviata_at timestamptz,
  unique (month, year)
);

-- ============================================================
-- TABELLA: availability
-- ============================================================
create table if not exists public.availability (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  date       date        not null,
  available  boolean     not null default true,
  status     text        not null default 'pending'
                         check (status in ('pending', 'approved', 'locked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Trigger: aggiorna updated_at automaticamente
create or replace function update_updated_at()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists availability_updated_at on public.availability;
create trigger availability_updated_at
  before update on public.availability
  for each row execute function update_updated_at();

-- ============================================================
-- TABELLA: shifts
-- ============================================================
create table if not exists public.shifts (
  id               uuid        primary key default uuid_generate_v4(),
  date             date        not null,
  user_id          uuid        not null references public.users(id) on delete cascade,
  user_nome        text,
  shift_type       text        not null
                               check (shift_type in ('weekend', 'festivo', 'reperibilita')),
  reperibile_order smallint    not null default 1
                               check (reperibile_order in (1, 2)),
  created_by       uuid        not null references public.users(id),
  created_at       timestamptz not null default now(),
  unique (date, user_id)
);

-- ============================================================
-- TABELLA: areas (migration 011)
-- ============================================================
create table if not exists public.areas (
  id               uuid        primary key default uuid_generate_v4(),
  nome             text        not null unique,
  scheduling_mode  text        not null default 'weekend_full'
                               check (scheduling_mode in ('weekend_full', 'single_day', 'sun_next_sat')),
  workers_per_day  integer     not null default 2
                               check (workers_per_day in (1, 2)),
  template_path    text,
  manager_id       uuid        references public.users(id),
  created_at       timestamptz not null default now()
);

-- ============================================================
-- TABELLA: email_settings
-- ============================================================
create table if not exists public.email_settings (
  id          uuid        primary key default uuid_generate_v4(),
  email       text        not null unique,
  descrizione text,
  attivo      boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users          enable row level security;
alter table public.holidays       enable row level security;
alter table public.month_status   enable row level security;
alter table public.availability   enable row level security;
alter table public.shifts         enable row level security;
alter table public.email_settings enable row level security;

-- Funzioni helper
create or replace function public.is_admin()
returns boolean language sql security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and ruolo = 'admin' and attivo = true
  );
$$;

create or replace function public.is_admin_or_manager()
returns boolean language sql security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and ruolo in ('admin', 'manager')
      and attivo = true
  );
$$;

-- ---- USERS ----
drop policy if exists "users: legge se stesso"            on public.users;
drop policy if exists "users: admin o manager legge tutti" on public.users;
drop policy if exists "users: admin o manager gestisce"   on public.users;

create policy "users: legge se stesso" on public.users
  for select using (id = auth.uid());

create policy "users: admin o manager legge tutti" on public.users
  for select using (public.is_admin_or_manager());

create policy "users: admin o manager gestisce" on public.users
  for all using (public.is_admin_or_manager());

-- ---- HOLIDAYS ----
drop policy if exists "holidays: tutti leggono"    on public.holidays;
drop policy if exists "holidays: solo admin scrive" on public.holidays;

create policy "holidays: tutti leggono" on public.holidays
  for select using (true);

create policy "holidays: solo admin scrive" on public.holidays
  for all using (public.is_admin());

-- ---- MONTH_STATUS ----
drop policy if exists "month_status: tutti leggono"             on public.month_status;
drop policy if exists "month_status: admin o manager inserisce" on public.month_status;
drop policy if exists "month_status: admin o manager aggiorna"  on public.month_status;
drop policy if exists "month_status: admin o manager elimina"   on public.month_status;

create policy "month_status: tutti leggono" on public.month_status
  for select using (true);

create policy "month_status: admin o manager inserisce" on public.month_status
  for insert with check (public.is_admin_or_manager());

create policy "month_status: admin o manager aggiorna" on public.month_status
  for update using (public.is_admin_or_manager());

create policy "month_status: admin o manager elimina" on public.month_status
  for delete using (public.is_admin_or_manager());

-- ---- AVAILABILITY ----
drop policy if exists "availability: utente vede le sue"          on public.availability;
drop policy if exists "availability: utente inserisce pending"    on public.availability;
drop policy if exists "availability: utente aggiorna se pending"  on public.availability;
drop policy if exists "availability: admin o manager vede tutto"  on public.availability;
drop policy if exists "availability: admin o manager gestisce tutto" on public.availability;

create policy "availability: utente vede le sue" on public.availability
  for select using (user_id = auth.uid());

create policy "availability: utente inserisce pending" on public.availability
  for insert with check (user_id = auth.uid());

create policy "availability: utente aggiorna se pending" on public.availability
  for update using (user_id = auth.uid() and status = 'pending');

create policy "availability: admin o manager vede tutto" on public.availability
  for select using (public.is_admin_or_manager());

create policy "availability: admin o manager gestisce tutto" on public.availability
  for all using (public.is_admin_or_manager());

-- ---- SHIFTS ----
drop policy if exists "shifts: utente vede i suoi"          on public.shifts;
drop policy if exists "shifts: admin o manager gestisce tutto" on public.shifts;

create policy "shifts: utente vede i suoi" on public.shifts
  for select using (user_id = auth.uid());

create policy "shifts: admin o manager gestisce tutto" on public.shifts
  for all using (public.is_admin_or_manager());

-- ---- EMAIL_SETTINGS ----
drop policy if exists "email_settings: admin o manager legge"     on public.email_settings;
drop policy if exists "email_settings: admin o manager inserisce" on public.email_settings;
drop policy if exists "email_settings: admin o manager aggiorna"  on public.email_settings;
drop policy if exists "email_settings: admin o manager elimina"   on public.email_settings;

create policy "email_settings: admin o manager legge" on public.email_settings
  for select using (public.is_admin_or_manager());

create policy "email_settings: admin o manager inserisce" on public.email_settings
  for insert with check (public.is_admin_or_manager());

create policy "email_settings: admin o manager aggiorna" on public.email_settings
  for update using (public.is_admin_or_manager());

create policy "email_settings: admin o manager elimina" on public.email_settings
  for delete using (public.is_admin_or_manager());

-- ============================================================
-- FUNZIONE: get_equity_scores
-- normale=1pt, festivo attivo (mandatory=true)=3pt
-- p_month=0 → tutti i tempi
-- ============================================================
create or replace function public.get_equity_scores(p_month integer, p_year integer)
returns table (
  user_id      uuid,
  nome         text,
  turni_totali bigint,
  festivi      bigint,
  score        bigint
)
language sql security definer
set search_path = ''
as $$
  select
    u.id,
    u.nome,
    count(s.id)                                                as turni_totali,
    count(s.id) filter (where h.mandatory = true)              as festivi,
    count(s.id) + count(s.id) filter (where h.mandatory = true) * 2 as score
  from public.users u
  left join public.shifts s
    on u.id = s.user_id
    and (
      p_month = 0
      or (
        extract(month from s.date)::integer = p_month
        and extract(year  from s.date)::integer = p_year
      )
    )
  left join public.holidays h on s.date = h.date
  where u.ruolo = 'dipendente' and u.attivo = true
  group by u.id, u.nome
  order by score asc;
$$;
