-- Riduce i pesi dello score equità per evitare troppa disparità
-- Vecchi pesi: normale ×1, festivo ×3, comandata ×6
-- Nuovi pesi:  normale ×1, festivo ×2, comandata ×3

drop function if exists get_equity_scores(integer, integer);

create or replace function get_equity_scores(p_month integer, p_year integer)
returns table (
  user_id        uuid,
  nome           text,
  turni_totali   bigint,
  festivi        bigint,
  fest_comandate bigint,
  score          bigint
)
language sql security definer as $$
  select
    u.id,
    u.nome,
    count(s.id)                                                        as turni_totali,
    count(s.id) filter (where h.date is not null)                      as festivi,
    count(s.id) filter (where h.mandatory = true)                      as fest_comandate,
    count(s.id)
      + count(s.id) filter (where h.date is not null) * 1
      + count(s.id) filter (where h.mandatory = true) * 1             as score
  from public.users u
  left join public.shifts s
    on u.id = s.user_id
    and (
      p_month = 0  -- tutti i tempi
      or (
        extract(month from s.date)::integer = p_month
        and extract(year  from s.date)::integer = p_year
      )
    )
  left join public.holidays h on s.date = h.date
  where u.ruolo = 'user' and u.attivo = true
  group by u.id, u.nome
  order by score asc;
$$;

comment on function get_equity_scores is
  'Score equità turni: score basso = priorità alta. Pesi: normale ×1, festivo ×2, comandata ×3. p_month=0 → tutti i tempi.';
