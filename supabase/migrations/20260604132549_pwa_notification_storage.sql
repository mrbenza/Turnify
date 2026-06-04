-- PWA-02: persistenza notifiche Web Push.
-- Le tabelle sono accessibili esclusivamente dal service role tramite API
-- Next.js autenticate. Nessuna chiave o endpoint viene esposto al client.

-- ============================================================
-- SUBSCRIPTION WEB PUSH
-- ============================================================
create table public.push_subscriptions (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references public.users(id) on delete cascade,
  endpoint        text        not null unique,
  p256dh          text        not null,
  auth            text        not null,
  expiration_time timestamptz,
  user_agent      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count   integer     not null default 0 check (failure_count >= 0),
  revoked_at      timestamptz
);

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function update_updated_at();

-- ============================================================
-- EVENTI LOGICI DI PUBBLICAZIONE
-- ============================================================
create table public.notification_events (
  id                 uuid        primary key default uuid_generate_v4(),
  event_type         text        not null
                                 check (event_type in ('month_published', 'month_republished')),
  area_id            uuid        not null references public.areas(id) on delete restrict,
  month              integer     not null check (month between 1 and 12),
  year               integer     not null check (year >= 2024),
  publication_number integer     not null check (publication_number >= 1),
  created_by         uuid        not null references public.users(id) on delete restrict,
  created_at         timestamptz not null default now(),
  status             text        not null default 'pending'
                                 check (status in ('pending', 'sending', 'sent', 'partial', 'failed')),
  completed_at       timestamptz,
  unique (area_id, month, year, publication_number)
);

-- ============================================================
-- CONSEGNE PER SINGOLA SUBSCRIPTION
-- ============================================================
create table public.notification_deliveries (
  id              uuid        primary key default uuid_generate_v4(),
  event_id        uuid        not null references public.notification_events(id) on delete cascade,
  subscription_id uuid        references public.push_subscriptions(id) on delete set null,
  user_id         uuid        references public.users(id) on delete set null,
  status          text        not null default 'pending'
                              check (status in ('pending', 'sent', 'failed', 'revoked')),
  attempts        integer     not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  sent_at         timestamptz,
  http_status     integer     check (http_status between 100 and 599),
  error           text,
  unique (event_id, subscription_id)
);

-- ============================================================
-- INDICI
-- ============================================================
create index idx_push_subscriptions_user_active
  on public.push_subscriptions(user_id)
  where revoked_at is null;

create index idx_notification_events_area_period
  on public.notification_events(area_id, year, month);

create index idx_notification_deliveries_event_status
  on public.notification_deliveries(event_id, status);

create index idx_notification_deliveries_subscription
  on public.notification_deliveries(subscription_id);

-- ============================================================
-- RLS: nessun accesso diretto dai client
-- ============================================================
alter table public.push_subscriptions enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.notification_events from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;

grant all on table public.push_subscriptions to service_role;
grant all on table public.notification_events to service_role;
grant all on table public.notification_deliveries to service_role;

-- ============================================================
-- CONFERMA ATOMICA + CREAZIONE EVENTO
-- Chiamabile esclusivamente dal service role dopo i controlli API.
-- Import storico, export ed email non usano questa funzione.
-- ============================================================
create or replace function public.confirm_month_and_create_notification_event(
  p_area_id uuid,
  p_month integer,
  p_year integer,
  p_created_by uuid
)
returns public.notification_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_publication_number integer;
  v_event public.notification_events;
  v_from date;
  v_to date;
begin
  if p_month < 1 or p_month > 12 then
    raise exception 'Mese non valido'
      using errcode = '22023';
  end if;

  select ms.status
    into v_status
    from public.month_status ms
    where ms.area_id = p_area_id
      and ms.month = p_month
      and ms.year = p_year
    for update;

  if not found then
    raise exception 'Stato mese non trovato'
      using errcode = 'P0002';
  end if;

  if v_status <> 'locked' then
    raise exception 'Il mese deve essere salvato prima della conferma'
      using errcode = 'P0001';
  end if;

  select coalesce(max(ne.publication_number), 0) + 1
    into v_publication_number
    from public.notification_events ne
    where ne.area_id = p_area_id
      and ne.month = p_month
      and ne.year = p_year;

  v_from := make_date(p_year, p_month, 1);
  v_to := (v_from + interval '1 month - 1 day')::date;

  update public.availability
    set status = 'approved'
    where status = 'pending'
      and area_id = p_area_id
      and date between v_from and v_to;

  update public.month_status
    set status = 'confirmed'
    where area_id = p_area_id
      and month = p_month
      and year = p_year;

  insert into public.notification_events (
    event_type,
    area_id,
    month,
    year,
    publication_number,
    created_by
  )
  values (
    case
      when v_publication_number = 1 then 'month_published'
      else 'month_republished'
    end,
    p_area_id,
    p_month,
    p_year,
    v_publication_number,
    p_created_by
  )
  returning * into v_event;

  return v_event;
end;
$$;

revoke execute on function public.confirm_month_and_create_notification_event(uuid, integer, integer, uuid)
  from public, anon, authenticated;

grant execute on function public.confirm_month_and_create_notification_event(uuid, integer, integer, uuid)
  to service_role;
