-- ============================================================
-- schema.sql — Schema completo Turnify (migrations 001-016)
-- Idempotente: DROP POLICY IF EXISTS prima di ogni CREATE.
--
-- Per un DB completamente vuoto: eseguire questo file.
-- Per pulire i dati senza toccare la struttura: eseguire clean_db.sql.
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
  disattivato_at  timestamptz,
  area_id         uuid        -- FK aggiunta dopo creazione areas (migration 013)
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
  area_id          uuid,       -- FK aggiunta dopo creazione areas (migration 013)
  unique (month, year, area_id)
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
  area_id    uuid,       -- FK aggiunta dopo creazione areas (migration 013)
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
  area_id          uuid,       -- FK aggiunta dopo creazione areas (migration 013)
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
  template_path       text,
  manager_id          uuid        references public.users(id),
  storico_abilitato   boolean     not null default true,
  created_at          timestamptz not null default now()
);

-- Riga default
insert into public.areas (nome) values ('Default') on conflict (nome) do nothing;

-- ============================================================
-- TABELLA: email_settings (migration 015: area_id aggiunto)
-- ============================================================
create table if not exists public.email_settings (
  id          uuid        primary key default uuid_generate_v4(),
  email       text        not null,
  descrizione text,
  attivo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  area_id     uuid        not null references public.areas(id) on delete cascade,
  unique (email, area_id)
);

-- ============================================================
-- FK area_id (migration 013 — dopo creazione areas)
-- ============================================================
alter table public.users        add constraint users_area_id_fkey
  foreign key (area_id) references public.areas(id) on delete restrict;
alter table public.shifts       add constraint shifts_area_id_fkey
  foreign key (area_id) references public.areas(id) on delete restrict;
alter table public.availability add constraint availability_area_id_fkey
  foreign key (area_id) references public.areas(id) on delete restrict;
alter table public.month_status add constraint month_status_area_id_fkey
  foreign key (area_id) references public.areas(id) on delete restrict;

create index if not exists idx_users_area_id          on public.users(area_id);
create index if not exists idx_shifts_area_id         on public.shifts(area_id);
create index if not exists idx_availability_area_id   on public.availability(area_id);
create index if not exists idx_month_status_area_id   on public.month_status(area_id);
create index if not exists idx_email_settings_area_id on public.email_settings(area_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users          enable row level security;
alter table public.holidays       enable row level security;
alter table public.month_status   enable row level security;
alter table public.availability   enable row level security;
alter table public.shifts         enable row level security;
alter table public.email_settings enable row level security;
alter table public.areas          enable row level security;

drop policy if exists "areas_select_authenticated" on public.areas;
create policy "areas_select_authenticated" on public.areas
  for select using (auth.role() = 'authenticated');

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

-- Helper: area_id dell'utente corrente (migration 016)
create or replace function public.current_user_area_id()
returns uuid language sql security definer
set search_path = ''
as $$
  select area_id from public.users where id = auth.uid()
$$;

create or replace function public.is_manager()
returns boolean language sql security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and ruolo = 'manager' and attivo = true
  )
$$;

-- ---- USERS ----
drop policy if exists "users: legge se stesso"             on public.users;
drop policy if exists "users: admin o manager legge tutti" on public.users;
drop policy if exists "users: admin o manager gestisce"    on public.users;
drop policy if exists "users: admin tutto"                 on public.users;
drop policy if exists "users: manager propria area"        on public.users;

create policy "users: legge se stesso" on public.users
  for select using (id = auth.uid());

create policy "users: admin tutto" on public.users
  for all using (public.is_admin());

create policy "users: manager propria area" on public.users
  for all using (
    public.is_manager()
    and area_id = public.current_user_area_id()
  );

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
drop policy if exists "month_status: admin tutto"               on public.month_status;
drop policy if exists "month_status: autenticati leggono"       on public.month_status;
drop policy if exists "month_status: manager propria area"      on public.month_status;

create policy "month_status: autenticati leggono" on public.month_status
  for select using (auth.role() = 'authenticated');

create policy "month_status: admin tutto" on public.month_status
  for all using (public.is_admin());

create policy "month_status: manager propria area" on public.month_status
  for all using (
    public.is_manager()
    and area_id = public.current_user_area_id()
  );

-- ---- AVAILABILITY ----
drop policy if exists "availability: utente vede le sue"             on public.availability;
drop policy if exists "availability: utente inserisce pending"       on public.availability;
drop policy if exists "availability: utente aggiorna se pending"     on public.availability;
drop policy if exists "availability: admin o manager vede tutto"     on public.availability;
drop policy if exists "availability: admin o manager gestisce tutto" on public.availability;
drop policy if exists "availability: admin tutto"                    on public.availability;
drop policy if exists "availability: dipendente gestisce le sue"     on public.availability;
drop policy if exists "availability: manager propria area"           on public.availability;

create policy "availability: dipendente gestisce le sue" on public.availability
  for all using (user_id = auth.uid());

create policy "availability: admin tutto" on public.availability
  for all using (public.is_admin());

create policy "availability: manager propria area" on public.availability
  for all using (
    public.is_manager()
    and area_id = public.current_user_area_id()
  );

-- ---- SHIFTS ----
drop policy if exists "shifts: utente vede i suoi"             on public.shifts;
drop policy if exists "shifts: admin o manager gestisce tutto" on public.shifts;
drop policy if exists "shifts: admin tutto"                    on public.shifts;
drop policy if exists "shifts: dipendente vede i suoi"         on public.shifts;
drop policy if exists "shifts: manager propria area"           on public.shifts;

create policy "shifts: dipendente vede i suoi" on public.shifts
  for select using (user_id = auth.uid());

create policy "shifts: admin tutto" on public.shifts
  for all using (public.is_admin());

create policy "shifts: manager propria area" on public.shifts
  for all using (
    public.is_manager()
    and area_id = public.current_user_area_id()
  );

-- ---- EMAIL_SETTINGS ----
drop policy if exists "email_settings: admin o manager legge"     on public.email_settings;
drop policy if exists "email_settings: admin o manager inserisce" on public.email_settings;
drop policy if exists "email_settings: admin o manager aggiorna"  on public.email_settings;
drop policy if exists "email_settings: admin o manager elimina"   on public.email_settings;
drop policy if exists "email_settings: admin tutto"               on public.email_settings;
drop policy if exists "email_settings: manager propria area"      on public.email_settings;

create policy "email_settings: admin tutto" on public.email_settings
  for all using (public.is_admin());

create policy "email_settings: manager propria area" on public.email_settings
  for all using (
    public.is_manager()
    and area_id = public.current_user_area_id()
  );

-- ============================================================
-- FUNZIONE: get_equity_scores
-- normale=1pt, festivo attivo (mandatory=true)=3pt
-- p_month=0 → tutti i tempi
-- ============================================================
create or replace function public.get_equity_scores(
  p_month   integer,
  p_year    integer,
  p_area_id uuid default null
)
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
    and (p_area_id is null or s.area_id = p_area_id)
  left join public.holidays h on s.date = h.date
  where u.ruolo = 'dipendente'
    and u.attivo = true
    and (p_area_id is null or u.area_id = p_area_id)
  group by u.id, u.nome
  order by score asc;
$$;
