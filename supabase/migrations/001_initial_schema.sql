-- ============================================================
-- Turnify — Schema iniziale
-- Eseguire su Supabase SQL Editor in questo ordine
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELLA: users
-- ============================================================
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  email         text not null unique,
  ruolo         text not null default 'user' check (ruolo in ('admin', 'user')),
  attivo        boolean not null default true,
  data_creazione timestamptz not null default now()
);

comment on table public.users is 'Anagrafica utenti Turnify';

-- ============================================================
-- TABELLA: holidays
-- ============================================================
create table public.holidays (
  id        uuid primary key default uuid_generate_v4(),
  date      date not null unique,
  name      text not null,
  mandatory boolean not null default false,
  year      integer not null generated always as (extract(year from date)::integer) stored
);

comment on table public.holidays is 'Festività — mandatory = deve essere distribuita equamente';

-- ============================================================
-- TABELLA: month_status
-- ============================================================
create table public.month_status (
  id        uuid primary key default uuid_generate_v4(),
  month     integer not null check (month between 1 and 12),
  year      integer not null check (year >= 2024),
  status    text not null default 'open' check (status in ('open', 'approved', 'locked')),
  locked_by uuid references public.users(id),
  locked_at timestamptz,
  unique (month, year)
);

comment on table public.month_status is 'Stato di ogni mese — locked = immutabile';

-- ============================================================
-- TABELLA: availability
-- ============================================================
create table public.availability (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  date       date not null,
  available  boolean not null default true,
  status     text not null default 'pending' check (status in ('pending', 'approved', 'locked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

comment on table public.availability is 'Disponibilità inserite dai dipendenti (Sab/Dom/Festivi)';

-- Trigger: aggiorna updated_at automaticamente
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger availability_updated_at
  before update on public.availability
  for each row execute function update_updated_at();

-- ============================================================
-- TABELLA: shifts
-- ============================================================
create table public.shifts (
  id         uuid primary key default uuid_generate_v4(),
  date       date not null,
  user_id    uuid not null references public.users(id) on delete cascade,
  shift_type text not null check (shift_type in ('weekend', 'festivo', 'reperibilita')),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (date, user_id)
);

comment on table public.shifts is 'Turni assegnati dall''admin — separati da availability per design';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.users       enable row level security;
alter table public.holidays    enable row level security;
alter table public.month_status enable row level security;
alter table public.availability enable row level security;
alter table public.shifts      enable row level security;

-- Helper: controlla se l'utente corrente è admin
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and ruolo = 'admin' and attivo = true
  );
$$;

-- USERS
create policy "users: legge se stesso" on public.users
  for select using (id = auth.uid());

create policy "users: admin legge tutti" on public.users
  for select using (is_admin());

create policy "users: admin gestisce" on public.users
  for all using (is_admin());

-- HOLIDAYS
create policy "holidays: tutti leggono" on public.holidays
  for select using (true);

create policy "holidays: solo admin scrive" on public.holidays
  for all using (is_admin());

-- MONTH_STATUS
create policy "month_status: tutti leggono" on public.month_status
  for select using (true);

create policy "month_status: solo admin scrive" on public.month_status
  for all using (is_admin());

-- AVAILABILITY
create policy "availability: utente vede le sue" on public.availability
  for select using (user_id = auth.uid());

create policy "availability: utente modifica pending" on public.availability
  for insert with check (user_id = auth.uid());

create policy "availability: utente aggiorna se pending" on public.availability
  for update using (user_id = auth.uid() and status = 'pending');

create policy "availability: admin vede tutto" on public.availability
  for select using (is_admin());

create policy "availability: admin gestisce tutto" on public.availability
  for all using (is_admin());

-- SHIFTS
create policy "shifts: utente vede i suoi" on public.shifts
  for select using (user_id = auth.uid());

create policy "shifts: admin gestisce tutto" on public.shifts
  for all using (is_admin());

-- ============================================================
-- FESTIVITÀ ITALIANE 2026 (pre-popolate)
-- ============================================================
insert into public.holidays (date, name, mandatory) values
  ('2026-01-01', 'Capodanno',                   true),
  ('2026-01-06', 'Epifania',                    true),
  ('2026-04-05', 'Pasqua',                      true),
  ('2026-04-06', 'Lunedì dell''Angelo',          false),
  ('2026-04-25', 'Festa della Liberazione',     true),
  ('2026-05-01', 'Festa dei Lavoratori',        true),
  ('2026-06-02', 'Festa della Repubblica',      true),
  ('2026-08-15', 'Ferragosto',                  true),
  ('2026-11-01', 'Ognissanti',                  false),
  ('2026-12-08', 'Immacolata Concezione',       false),
  ('2026-12-25', 'Natale',                      true),
  ('2026-12-26', 'Santo Stefano',               false);

-- ============================================================
-- FUNZIONE: score equità (usata dall'API per suggerimento)
-- ============================================================
create or replace function get_equity_scores(p_month integer, p_year integer)
returns table (
  user_id       uuid,
  nome          text,
  turni_totali  bigint,
  festivi       bigint,
  fest_comandate bigint,
  score         bigint
)
language sql security definer as $$
  select
    u.id,
    u.nome,
    count(s.id)                                                          as turni_totali,
    count(s.id) filter (where h.date is not null)                        as festivi,
    count(s.id) filter (where h.mandatory = true)                        as fest_comandate,
    count(s.id)
      + count(s.id) filter (where h.date is not null) * 2
      + count(s.id) filter (where h.mandatory = true) * 3               as score
  from public.users u
  left join public.shifts s on u.id = s.user_id
  left join public.holidays h on s.date = h.date
  where u.ruolo = 'user' and u.attivo = true
  group by u.id, u.nome
  order by score asc;
$$;

comment on function get_equity_scores is 'Score equità turni: score basso = priorità alta nell''assegnazione';
