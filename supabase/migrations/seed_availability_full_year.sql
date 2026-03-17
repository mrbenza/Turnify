-- ============================================================
-- Disponibilità per tutto l'anno 2026
-- Copre: tutti i sabati, domeniche e festivi dell'anno
-- Utenti: tutti quelli attivi con ruolo 'user'
-- ============================================================

INSERT INTO public.availability (user_id, date, available, status)
SELECT
  u.id,
  d.giorno,
  true,
  'pending'
FROM public.users u
CROSS JOIN (
  -- Tutti i sabati e domeniche del 2026
  SELECT gs::date AS giorno
  FROM generate_series('2026-01-01'::date, '2026-12-31'::date, '1 day'::interval) gs
  WHERE EXTRACT(DOW FROM gs) IN (0, 6)

  UNION

  -- Tutti i festivi del 2026 già presenti in tabella
  SELECT date AS giorno
  FROM public.holidays
  WHERE EXTRACT(YEAR FROM date) = 2026
) d
WHERE u.ruolo = 'user'
  AND u.attivo = true
ON CONFLICT (user_id, date) DO NOTHING;

-- Verifica
SELECT
  EXTRACT(DOW FROM date) AS dow,
  CASE EXTRACT(DOW FROM date)
    WHEN 0 THEN 'Dom'
    WHEN 6 THEN 'Sab'
    ELSE 'Festivo feriale'
  END AS tipo,
  count(*) AS righe
FROM public.availability
WHERE EXTRACT(YEAR FROM date) = 2026
GROUP BY 1, 2
ORDER BY 1;
