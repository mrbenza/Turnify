-- ============================================================
-- Reset completo storico: disponibilità, turni, mesi confermati
-- NON tocca: utenti, festivi
-- ============================================================

DELETE FROM public.shifts;
DELETE FROM public.availability;
DELETE FROM public.month_status;

-- Verifica
SELECT 'shifts'       AS tabella, count(*) AS righe FROM public.shifts
UNION ALL
SELECT 'availability' AS tabella, count(*) AS righe FROM public.availability
UNION ALL
SELECT 'month_status' AS tabella, count(*) AS righe FROM public.month_status;
