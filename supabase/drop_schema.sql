-- ============================================================
-- drop_schema.sql — Elimina schema E dati completamente
-- ⚠ DISTRUTTIVO: cancella tabelle, policy, funzioni e utenti.
-- Dopo questo script il DB è completamente vuoto.
-- Per ripartire: eseguire schema.sql + seed_demo.sql
-- ============================================================

-- Dati auth (deve venire prima per le FK)
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- Tabelle dati (ordine FK: figli prima dei padri)
DROP TABLE IF EXISTS public.availability   CASCADE;
DROP TABLE IF EXISTS public.shifts         CASCADE;
DROP TABLE IF EXISTS public.month_status   CASCADE;
DROP TABLE IF EXISTS public.email_settings CASCADE;
DROP TABLE IF EXISTS public.areas          CASCADE;
DROP TABLE IF EXISTS public.holidays       CASCADE;
DROP TABLE IF EXISTS public.users          CASCADE;

-- Funzioni
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_admin_or_manager();
DROP FUNCTION IF EXISTS public.get_equity_scores(integer, integer);
