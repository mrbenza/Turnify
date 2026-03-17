-- ============================================================
-- Cancella tutte le disponibilità
-- NON tocca turni, utenti o mesi
-- ============================================================

DELETE FROM public.availability;

-- Verifica
SELECT count(*) AS righe_rimaste FROM public.availability;
