-- ============================================================
-- Fix: mutable search_path su tutte le funzioni
-- Eseguire nel SQL Editor di Supabase
-- ============================================================

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

create or replace function public.update_updated_at()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
