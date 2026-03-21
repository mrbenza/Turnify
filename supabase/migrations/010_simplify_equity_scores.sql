-- Semplifica lo score equità:
-- mandatory = true  → festivo attivo → vale 3 punti (1 base + 2 extra)
-- mandatory = false → giorno ignorato → vale 0 (trattato come normale)
-- Rimuove la colonna fest_comandate (ora coincide con festivi)

drop function if exists get_equity_scores(integer, integer);

create or replace function get_equity_scores(p_month integer, p_year integer)
returns table (
  user_id        uuid,
  nome           text,
  turni_totali   bigint,
  festivi        bigint,
  score          bigint
)
language sql security definer as $$
  select
    u.id,
    u.nome,
    count(s.id)                                                as turni_totali,
    count(s.id) filter (where h.mandatory = true)              as festivi,
    count(s.id)
      + count(s.id) filter (where h.mandatory = true) * 2     as score
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
  'Score equità: normale=1pt, festivo attivo (mandatory)=3pt. p_month=0 → tutti i tempi.';
