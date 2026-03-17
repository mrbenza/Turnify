-- Aggiorna get_equity_scores: p_month=0 + p_year>0 = tutti i mesi di quell'anno
-- Comportamento precedente (p_month=0, p_year=0) rimane invariato = tutti i tempi

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
      + count(s.id) filter (where h.date is not null) * 2
      + count(s.id) filter (where h.mandatory = true) * 3             as score
  from public.users u
  left join public.shifts s
    on u.id = s.user_id
    and (
      (p_month = 0 and p_year = 0)                                              -- tutti i tempi
      or (p_month = 0 and p_year > 0
          and extract(year from s.date)::integer = p_year)                      -- tutto l'anno
      or (p_month > 0
          and extract(month from s.date)::integer = p_month
          and extract(year  from s.date)::integer = p_year)                     -- mese specifico
    )
  left join public.holidays h on s.date = h.date
  where u.ruolo = 'user' and u.attivo = true
  group by u.id, u.nome
  order by score asc;
$$;

comment on function get_equity_scores is
  'Score equità turni: score basso = priorità alta.
   p_month=0, p_year=0 → tutti i tempi.
   p_month=0, p_year>0 → tutti i mesi dell''anno.
   p_month>0, p_year>0 → mese specifico.';
