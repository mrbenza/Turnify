-- ============================================================
-- Accoppia le disponibilità per weekend intero (Sab+Dom)
-- Non tocca i festivi
-- ============================================================

-- Aggiungi Domenica per ogni Sabato disponibile (se la Dom non è festiva)
INSERT INTO public.availability (user_id, date, available, status)
SELECT a.user_id, a.date + 1, a.available, a.status
FROM public.availability a
WHERE EXTRACT(DOW FROM a.date) = 6  -- Sabato
  AND NOT EXISTS (
    SELECT 1 FROM public.holidays h WHERE h.date = a.date + 1
  )
ON CONFLICT (user_id, date) DO NOTHING;

-- Aggiungi Sabato per ogni Domenica disponibile (se il Sab non è festivo)
INSERT INTO public.availability (user_id, date, available, status)
SELECT a.user_id, a.date - 1, a.available, a.status
FROM public.availability a
WHERE EXTRACT(DOW FROM a.date) = 0  -- Domenica
  AND NOT EXISTS (
    SELECT 1 FROM public.holidays h WHERE h.date = a.date - 1
  )
ON CONFLICT (user_id, date) DO NOTHING;

-- Verifica
SELECT
  EXTRACT(DOW FROM date) AS dow,
  CASE EXTRACT(DOW FROM date) WHEN 0 THEN 'Dom' WHEN 6 THEN 'Sab' END AS giorno,
  count(*) AS n
FROM public.availability
WHERE EXTRACT(DOW FROM date) IN (0, 6)
GROUP BY 1, 2
ORDER BY 1;
