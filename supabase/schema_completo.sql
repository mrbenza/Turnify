-- ============================================================
-- Turnify — Schema completo (stato finale)
-- Generato da migration 001 → 012
-- Eseguire su un database vuoto o usare le singole migration
-- per aggiornare un DB esistente.
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELLA: users
-- ============================================================
create table public.users (
  id              uuid        primary key references auth.users(id) on delete cascade,
  nome            text        not null,
  email           text        not null unique,
  ruolo           text        not null default 'dipendente'
                              check (ruolo in ('admin', 'manager', 'dipendente')),
  attivo          boolean     not null default true,
  data_creazione  timestamptz not null default now(),
  disattivato_at  timestamptz
);

comment on table  public.users is 'Anagrafica utenti Turnify';
comment on column public.users.disattivato_at is
  'Valorizzato quando attivo viene impostato a false; azzerato alla riattivazione.';

-- ============================================================
-- TABELLA: holidays
-- ============================================================
create table public.holidays (
  id        uuid    primary key default uuid_generate_v4(),
  date      date    not null unique,
  name      text    not null,
  mandatory boolean not null default false,
  year      integer not null generated always as (extract(year from date)::integer) stored
);

comment on table  public.holidays is
  'Festività. mandatory=true → attiva: visibile sul calendario, assegnabile come turno festivo (3 pt).';

-- ============================================================
-- TABELLA: month_status
-- ============================================================
create table public.month_status (
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

comment on table  public.month_status is
  'Stato di ogni mese. open → locked (immutabile) → confirmed (Excel generato).';

-- ============================================================
-- TABELLA: availability
-- ============================================================
create table public.availability (
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

comment on table public.availability is
  'Disponibilità inserite dai dipendenti (Sab/Dom/Festivi attivi).';

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

create trigger availability_updated_at
  before update on public.availability
  for each row execute function update_updated_at();

-- ============================================================
-- TABELLA: shifts
-- ============================================================
create table public.shifts (
  id         uuid        primary key default uuid_generate_v4(),
  date       date        not null,
  user_id    uuid        not null references public.users(id) on delete cascade,
  user_nome  text,
  shift_type text        not null
                         check (shift_type in ('weekend', 'festivo', 'reperibilita')),
  created_by uuid        not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (date, user_id)
);

comment on table  public.shifts is
  'Turni assegnati dal manager — separati da availability per design.';
comment on column public.shifts.user_nome is
  'Nome denormalizzato: preserva il nome anche se l''utente viene eliminato.';

-- ============================================================
-- TABELLA: email_settings
-- ============================================================
create table public.email_settings (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null unique,
  descrizione text,
  attivo      boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.email_settings is
  'Indirizzi email aggiuntivi che ricevono la notifica "mese confermato".';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.users         enable row level security;
alter table public.holidays      enable row level security;
alter table public.month_status  enable row level security;
alter table public.availability  enable row level security;
alter table public.shifts        enable row level security;
alter table public.email_settings enable row level security;

-- Helper: utente corrente è admin
create or replace function is_admin()
returns boolean language sql security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and ruolo = 'admin' and attivo = true
  );
$$;

-- Helper: utente corrente è admin o manager
create or replace function is_admin_or_manager()
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
create policy "users: legge se stesso" on public.users
  for select using (id = auth.uid());

create policy "users: admin o manager legge tutti" on public.users
  for select using (is_admin_or_manager());

create policy "users: admin o manager gestisce" on public.users
  for all using (is_admin_or_manager());

-- ---- HOLIDAYS ----
create policy "holidays: tutti leggono" on public.holidays
  for select using (true);

create policy "holidays: solo admin scrive" on public.holidays
  for all using (is_admin());

-- ---- MONTH_STATUS ----
create policy "month_status: tutti leggono" on public.month_status
  for select using (true);

create policy "month_status: admin o manager inserisce" on public.month_status
  for insert with check (is_admin_or_manager());

create policy "month_status: admin o manager aggiorna" on public.month_status
  for update using (is_admin_or_manager());

create policy "month_status: admin o manager elimina" on public.month_status
  for delete using (is_admin_or_manager());

-- ---- AVAILABILITY ----
create policy "availability: utente vede le sue" on public.availability
  for select using (user_id = auth.uid());

create policy "availability: utente inserisce pending" on public.availability
  for insert with check (user_id = auth.uid());

create policy "availability: utente aggiorna se pending" on public.availability
  for update using (user_id = auth.uid() and status = 'pending');

create policy "availability: admin o manager vede tutto" on public.availability
  for select using (is_admin_or_manager());

create policy "availability: admin o manager gestisce tutto" on public.availability
  for all using (is_admin_or_manager());

-- ---- SHIFTS ----
create policy "shifts: utente vede i suoi" on public.shifts
  for select using (user_id = auth.uid());

create policy "shifts: admin o manager gestisce tutto" on public.shifts
  for all using (is_admin_or_manager());

-- ---- EMAIL_SETTINGS ----
create policy "email_settings: admin o manager legge" on public.email_settings
  for select using (is_admin_or_manager());

create policy "email_settings: admin o manager inserisce" on public.email_settings
  for insert with check (is_admin_or_manager());

create policy "email_settings: admin o manager aggiorna" on public.email_settings
  for update using (is_admin_or_manager());

create policy "email_settings: admin o manager elimina" on public.email_settings
  for delete using (is_admin_or_manager());

-- ============================================================
-- FUNZIONE: get_equity_scores
-- Score equità turni (migration 010 — formula semplificata)
--   normale  = 1 pt
--   festivo attivo (mandatory=true) = 3 pt  (1 base + 2 extra)
-- p_month=0 → tutti i tempi
-- p_month>0 → mese/anno specificato
-- ============================================================
create or replace function get_equity_scores(p_month integer, p_year integer)
returns table (
  user_id        uuid,
  nome           text,
  turni_totali   bigint,
  festivi        bigint,
  score          bigint
)
language sql security definer
set search_path = ''
as $$
  select
    u.id,
    u.nome,
    count(s.id)                                               as turni_totali,
    count(s.id) filter (where h.mandatory = true)             as festivi,
    count(s.id)
      + count(s.id) filter (where h.mandatory = true) * 2    as score
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

comment on function get_equity_scores is
  'Score equità: normale=1pt, festivo attivo=3pt. p_month=0 → tutti i tempi.';

-- ============================================================
-- FESTIVITÀ ITALIANE 2025-2026 (pre-popolate)
-- ============================================================
insert into public.holidays (date, name, mandatory) values
  -- 2025
  ('2025-01-01', 'Capodanno',                  true),
  ('2025-01-06', 'Epifania',                   true),
  ('2025-04-20', 'Pasqua',                     true),
  ('2025-04-21', 'Lunedì dell''Angelo',         false),
  ('2025-04-25', 'Festa della Liberazione',    true),
  ('2025-05-01', 'Festa dei Lavoratori',       true),
  ('2025-06-02', 'Festa della Repubblica',     true),
  ('2025-08-15', 'Ferragosto',                 true),
  ('2025-11-01', 'Ognissanti',                 false),
  ('2025-12-08', 'Immacolata Concezione',      false),
  ('2025-12-25', 'Natale',                     true),
  ('2025-12-26', 'Santo Stefano',              false),
  -- 2026
  ('2026-01-01', 'Capodanno',                  true),
  ('2026-01-06', 'Epifania',                   true),
  ('2026-04-05', 'Pasqua',                     true),
  ('2026-04-06', 'Lunedì dell''Angelo',         false),
  ('2026-04-25', 'Festa della Liberazione',    true),
  ('2026-05-01', 'Festa dei Lavoratori',       true),
  ('2026-06-02', 'Festa della Repubblica',     true),
  ('2026-08-15', 'Ferragosto',                 true),
  ('2026-11-01', 'Ognissanti',                 false),
  ('2026-12-08', 'Immacolata Concezione',      false),
  ('2026-12-25', 'Natale',                     true),
  ('2026-12-26', 'Santo Stefano',              false)
on conflict (date) do nothing;
