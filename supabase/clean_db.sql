-- ============================================================
-- clean_db.sql — Pulizia completa dati Turnify
-- ATTENZIONE: elimina TUTTI i dati. La struttura (tabelle,
-- funzioni, policy RLS) rimane intatta.
--
-- Eseguire nel SQL Editor di Supabase (service_role).
-- ============================================================

-- 1. Dati dipendenti da users (FK con ON DELETE CASCADE)
DELETE FROM public.shifts;
DELETE FROM public.availability;
DELETE FROM public.month_status;
DELETE FROM public.email_settings;
DELETE FROM public.holidays;

-- 2. Scollega manager dalle aree prima di eliminare gli utenti
UPDATE public.areas SET manager_id = NULL;

-- 3. Elimina tutti gli utenti da auth (cascade su public.users)
DELETE FROM auth.users;

-- 4. Reset aree: rimuovi tutte tranne Default e ripulisci Default
DELETE FROM public.areas WHERE nome != 'Default';
UPDATE public.areas
SET template_path = NULL,
    scheduling_mode = 'weekend_full',
    workers_per_day = 2
WHERE nome = 'Default';
