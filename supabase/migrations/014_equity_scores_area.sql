-- Migration 014: aggiunge p_area_id a get_equity_scores
-- Il parametro è opzionale (default null) per retrocompatibilità.
-- Con p_area_id valorizzato filtra utenti e turni per quell'area.

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
