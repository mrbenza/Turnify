-- Fix security warning: function_search_path_mutable
-- Aggiunge SET search_path = '' alle funzioni SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND ruolo = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND ruolo IN ('admin', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_equity_scores(p_month integer, p_year integer)
RETURNS TABLE (
  user_id        uuid,
  nome           text,
  turni_totali   bigint,
  festivi_attivi bigint,
  score          bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
  SELECT
    u.id,
    u.nome,
    COUNT(s.id)                                                         AS turni_totali,
    COUNT(CASE WHEN h.mandatory = true THEN 1 END)                      AS festivi_attivi,
    COUNT(s.id) + (COUNT(CASE WHEN h.mandatory = true THEN 1 END) * 2) AS score
  FROM public.users u
  LEFT JOIN public.shifts s ON u.id = s.user_id
    AND (p_month = 0 OR (
      EXTRACT(MONTH FROM s.date)::integer = p_month
      AND EXTRACT(YEAR  FROM s.date)::integer = p_year
    ))
  LEFT JOIN public.holidays h ON s.date = h.date AND h.mandatory = true
  WHERE u.ruolo = 'dipendente' AND u.attivo = true
  GROUP BY u.id, u.nome
  ORDER BY score ASC;
$$;
