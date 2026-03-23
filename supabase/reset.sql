-- ============================================================
-- reset.sql — Svuota tutti i dati (mantiene lo schema)
-- ⚠ Cancella TUTTI i dati inclusi gli utenti auth.
-- Eseguire nel SQL Editor di Supabase (service_role).
--
-- Dopo il reset ri-eseguire seed_demo.sql.
-- Per ripartire da zero su un DB nuovo: eseguire prima schema.sql.
-- ============================================================

-- Tabelle dati (ordine FK: figli prima dei padri)
DELETE FROM public.availability;
DELETE FROM public.shifts;
DELETE FROM public.month_status;
DELETE FROM public.email_settings;
DELETE FROM public.areas;
DELETE FROM public.holidays;

-- Utenti applicativi (public.users viene svuotato in cascade)
DELETE FROM auth.users;
