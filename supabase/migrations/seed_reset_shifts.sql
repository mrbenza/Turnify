-- ============================================================
-- Reset turni marzo-agosto 2026
-- Mantiene: utenti, disponibilità, turni gen-feb (storico)
-- ============================================================

DELETE FROM public.shifts
WHERE date BETWEEN '2026-03-01' AND '2026-08-31';

DELETE FROM public.month_status
WHERE month BETWEEN 3 AND 8 AND year = 2026;

-- Ricrea i mesi come "open" così il calendario li vede
INSERT INTO public.month_status (month, year, status, locked_by)
SELECT gs.m, 2026, 'open', u.id
FROM generate_series(3, 8) AS gs(m)
CROSS JOIN (SELECT id FROM public.users WHERE ruolo = 'admin' LIMIT 1) u
ON CONFLICT (month, year) DO NOTHING;

-- Verifica
SELECT month, year, status FROM public.month_status WHERE year = 2026 ORDER BY month;
