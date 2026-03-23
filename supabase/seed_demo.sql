-- ============================================================
-- seed_demo.sql — Dati dimostrativi Turnify
--
-- Utenti: 1 admin, 1 manager, 14 dipendenti (12 attivi, 2 disattivi)
-- Password per tutti: test
--
-- Festività: 2024 / 2025 / 2026 con mandatory corretto
-- Turni: 2024 e 2025 (round-robin, weekend_full, 2 reperibili/giorno)
-- Mesi confermati: gennaio 2024 – dicembre 2025
-- Disponibilità: gen-mar 2026, tutti disponibili (per test)
--
-- Eseguire nel SQL Editor di Supabase (service_role).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Auth users (password: test)
-- ------------------------------------------------------------

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@turnify.test',           crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000000','authenticated','authenticated','manager@turnify.test',         crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000001-0000-0000-0000-000000000000','authenticated','authenticated','marco.ferretti@turnify.test',  crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000002-0000-0000-0000-000000000000','authenticated','authenticated','giulia.esposito@turnify.test', crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000003-0000-0000-0000-000000000000','authenticated','authenticated','luca.bianchi@turnify.test',    crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000004-0000-0000-0000-000000000000','authenticated','authenticated','andrea.ricci@turnify.test',    crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000005-0000-0000-0000-000000000000','authenticated','authenticated','elena.russo@turnify.test',     crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000006-0000-0000-0000-000000000000','authenticated','authenticated','davide.marino@turnify.test',   crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000007-0000-0000-0000-000000000000','authenticated','authenticated','chiara.lombardi@turnify.test', crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000008-0000-0000-0000-000000000000','authenticated','authenticated','matteo.deluca@turnify.test',   crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000009-0000-0000-0000-000000000000','authenticated','authenticated','roberto.gallo@turnify.test',   crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000010-0000-0000-0000-000000000000','authenticated','authenticated','francesca.bruno@turnify.test', crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000011-0000-0000-0000-000000000000','authenticated','authenticated','sara.conti@turnify.test',      crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000012-0000-0000-0000-000000000000','authenticated','authenticated','valentina.costa@turnify.test', crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000013-0000-0000-0000-000000000000','authenticated','authenticated','pietro.santoro@turnify.test',  crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','c0000014-0000-0000-0000-000000000000','authenticated','authenticated','marta.ferri@turnify.test',     crypt('test',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','')
ON CONFLICT (id) DO NOTHING;

-- Identities (necessario per il login email+password)
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000000','admin@turnify.test',           'a0000000-0000-0000-0000-000000000000','{"sub":"a0000000-0000-0000-0000-000000000000","email":"admin@turnify.test"}',           'email',now(),now(),now()),
  ('b0000000-0000-0000-0000-000000000000','manager@turnify.test',         'b0000000-0000-0000-0000-000000000000','{"sub":"b0000000-0000-0000-0000-000000000000","email":"manager@turnify.test"}',         'email',now(),now(),now()),
  ('c0000001-0000-0000-0000-000000000000','marco.ferretti@turnify.test',  'c0000001-0000-0000-0000-000000000000','{"sub":"c0000001-0000-0000-0000-000000000000","email":"marco.ferretti@turnify.test"}',  'email',now(),now(),now()),
  ('c0000002-0000-0000-0000-000000000000','giulia.esposito@turnify.test', 'c0000002-0000-0000-0000-000000000000','{"sub":"c0000002-0000-0000-0000-000000000000","email":"giulia.esposito@turnify.test"}', 'email',now(),now(),now()),
  ('c0000003-0000-0000-0000-000000000000','luca.bianchi@turnify.test',    'c0000003-0000-0000-0000-000000000000','{"sub":"c0000003-0000-0000-0000-000000000000","email":"luca.bianchi@turnify.test"}',    'email',now(),now(),now()),
  ('c0000004-0000-0000-0000-000000000000','andrea.ricci@turnify.test',    'c0000004-0000-0000-0000-000000000000','{"sub":"c0000004-0000-0000-0000-000000000000","email":"andrea.ricci@turnify.test"}',    'email',now(),now(),now()),
  ('c0000005-0000-0000-0000-000000000000','elena.russo@turnify.test',     'c0000005-0000-0000-0000-000000000000','{"sub":"c0000005-0000-0000-0000-000000000000","email":"elena.russo@turnify.test"}',     'email',now(),now(),now()),
  ('c0000006-0000-0000-0000-000000000000','davide.marino@turnify.test',   'c0000006-0000-0000-0000-000000000000','{"sub":"c0000006-0000-0000-0000-000000000000","email":"davide.marino@turnify.test"}',   'email',now(),now(),now()),
  ('c0000007-0000-0000-0000-000000000000','chiara.lombardi@turnify.test', 'c0000007-0000-0000-0000-000000000000','{"sub":"c0000007-0000-0000-0000-000000000000","email":"chiara.lombardi@turnify.test"}', 'email',now(),now(),now()),
  ('c0000008-0000-0000-0000-000000000000','matteo.deluca@turnify.test',   'c0000008-0000-0000-0000-000000000000','{"sub":"c0000008-0000-0000-0000-000000000000","email":"matteo.deluca@turnify.test"}',   'email',now(),now(),now()),
  ('c0000009-0000-0000-0000-000000000000','roberto.gallo@turnify.test',   'c0000009-0000-0000-0000-000000000000','{"sub":"c0000009-0000-0000-0000-000000000000","email":"roberto.gallo@turnify.test"}',   'email',now(),now(),now()),
  ('c0000010-0000-0000-0000-000000000000','francesca.bruno@turnify.test', 'c0000010-0000-0000-0000-000000000000','{"sub":"c0000010-0000-0000-0000-000000000000","email":"francesca.bruno@turnify.test"}', 'email',now(),now(),now()),
  ('c0000011-0000-0000-0000-000000000000','sara.conti@turnify.test',      'c0000011-0000-0000-0000-000000000000','{"sub":"c0000011-0000-0000-0000-000000000000","email":"sara.conti@turnify.test"}',      'email',now(),now(),now()),
  ('c0000012-0000-0000-0000-000000000000','valentina.costa@turnify.test', 'c0000012-0000-0000-0000-000000000000','{"sub":"c0000012-0000-0000-0000-000000000000","email":"valentina.costa@turnify.test"}', 'email',now(),now(),now()),
  ('c0000013-0000-0000-0000-000000000000','pietro.santoro@turnify.test',  'c0000013-0000-0000-0000-000000000000','{"sub":"c0000013-0000-0000-0000-000000000000","email":"pietro.santoro@turnify.test"}',  'email',now(),now(),now()),
  ('c0000014-0000-0000-0000-000000000000','marta.ferri@turnify.test',     'c0000014-0000-0000-0000-000000000000','{"sub":"c0000014-0000-0000-0000-000000000000","email":"marta.ferri@turnify.test"}',     'email',now(),now(),now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Utenti applicativi (public.users)
-- ------------------------------------------------------------

INSERT INTO public.users (id, nome, email, ruolo, attivo) VALUES
  ('a0000000-0000-0000-0000-000000000000', 'Admin',              'admin@turnify.test',           'admin',      true),
  ('b0000000-0000-0000-0000-000000000000', 'Giuseppe Verdi',     'manager@turnify.test',         'manager',    true),
  ('c0000001-0000-0000-0000-000000000000', 'Marco Ferretti',     'marco.ferretti@turnify.test',  'dipendente', true),
  ('c0000002-0000-0000-0000-000000000000', 'Giulia Esposito',    'giulia.esposito@turnify.test', 'dipendente', true),
  ('c0000003-0000-0000-0000-000000000000', 'Luca Bianchi',       'luca.bianchi@turnify.test',    'dipendente', true),
  ('c0000004-0000-0000-0000-000000000000', 'Andrea Ricci',       'andrea.ricci@turnify.test',    'dipendente', true),
  ('c0000005-0000-0000-0000-000000000000', 'Elena Russo',        'elena.russo@turnify.test',     'dipendente', true),
  ('c0000006-0000-0000-0000-000000000000', 'Davide Marino',      'davide.marino@turnify.test',   'dipendente', true),
  ('c0000007-0000-0000-0000-000000000000', 'Chiara Lombardi',    'chiara.lombardi@turnify.test', 'dipendente', true),
  ('c0000008-0000-0000-0000-000000000000', 'Matteo De Luca',     'matteo.deluca@turnify.test',   'dipendente', true),
  ('c0000009-0000-0000-0000-000000000000', 'Roberto Gallo',      'roberto.gallo@turnify.test',   'dipendente', true),
  ('c0000010-0000-0000-0000-000000000000', 'Francesca Bruno',    'francesca.bruno@turnify.test', 'dipendente', true),
  ('c0000011-0000-0000-0000-000000000000', 'Sara Conti',         'sara.conti@turnify.test',      'dipendente', true),
  ('c0000012-0000-0000-0000-000000000000', 'Valentina Costa',    'valentina.costa@turnify.test', 'dipendente', true),
  ('c0000013-0000-0000-0000-000000000000', 'Pietro Santoro',     'pietro.santoro@turnify.test',  'dipendente', false),
  ('c0000014-0000-0000-0000-000000000000', 'Marta Ferri',        'marta.ferri@turnify.test',     'dipendente', false)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Festività italiane 2024 / 2025 / 2026
--    mandatory: solo le festività che richiedono reperibilità
--    (Lunedì Angelo, Ognissanti, Immacolata, Santo Stefano = false)
-- ------------------------------------------------------------

INSERT INTO public.holidays (date, name, mandatory) VALUES
  -- 2024
  ('2024-01-01', 'Capodanno',               true),
  ('2024-01-06', 'Epifania',                true),
  ('2024-03-31', 'Pasqua',                  true),
  ('2024-04-01', 'Lunedì dell''Angelo',     false),
  ('2024-04-25', 'Festa della Liberazione', true),
  ('2024-05-01', 'Festa dei Lavoratori',    true),
  ('2024-06-02', 'Festa della Repubblica',  true),
  ('2024-08-15', 'Ferragosto',              true),
  ('2024-11-01', 'Ognissanti',              false),
  ('2024-12-08', 'Immacolata Concezione',   false),
  ('2024-12-25', 'Natale',                  true),
  ('2024-12-26', 'Santo Stefano',           false),
  -- 2025
  ('2025-01-01', 'Capodanno',               true),
  ('2025-01-06', 'Epifania',                true),
  ('2025-04-20', 'Pasqua',                  true),
  ('2025-04-21', 'Lunedì dell''Angelo',     false),
  ('2025-04-25', 'Festa della Liberazione', true),
  ('2025-05-01', 'Festa dei Lavoratori',    true),
  ('2025-06-02', 'Festa della Repubblica',  true),
  ('2025-08-15', 'Ferragosto',              true),
  ('2025-11-01', 'Ognissanti',              false),
  ('2025-12-08', 'Immacolata Concezione',   false),
  ('2025-12-25', 'Natale',                  true),
  ('2025-12-26', 'Santo Stefano',           false),
  -- 2026
  ('2026-01-01', 'Capodanno',               true),
  ('2026-01-06', 'Epifania',                true),
  ('2026-04-05', 'Pasqua',                  true),
  ('2026-04-06', 'Lunedì dell''Angelo',     false),
  ('2026-04-25', 'Festa della Liberazione', true),
  ('2026-05-01', 'Festa dei Lavoratori',    true),
  ('2026-06-02', 'Festa della Repubblica',  true),
  ('2026-08-15', 'Ferragosto',              true),
  ('2026-11-01', 'Ognissanti',              false),
  ('2026-12-08', 'Immacolata Concezione',   false),
  ('2026-12-25', 'Natale',                  true),
  ('2026-12-26', 'Santo Stefano',           false)
ON CONFLICT (date) DO NOTHING;

-- ------------------------------------------------------------
-- 4. Turni 2024-2025
--    12 dipendenti attivi, round-robin, weekend_full, 2/giorno
-- ------------------------------------------------------------

DO $$
DECLARE
  d        date;
  dow      int;
  is_hol   boolean;
  emp_ids  uuid[] := ARRAY[
    'c0000001-0000-0000-0000-000000000000'::uuid,
    'c0000002-0000-0000-0000-000000000000'::uuid,
    'c0000003-0000-0000-0000-000000000000'::uuid,
    'c0000004-0000-0000-0000-000000000000'::uuid,
    'c0000005-0000-0000-0000-000000000000'::uuid,
    'c0000006-0000-0000-0000-000000000000'::uuid,
    'c0000007-0000-0000-0000-000000000000'::uuid,
    'c0000008-0000-0000-0000-000000000000'::uuid,
    'c0000009-0000-0000-0000-000000000000'::uuid,
    'c0000010-0000-0000-0000-000000000000'::uuid,
    'c0000011-0000-0000-0000-000000000000'::uuid,
    'c0000012-0000-0000-0000-000000000000'::uuid
  ];
  emp_names text[] := ARRAY[
    'Marco Ferretti','Giulia Esposito','Luca Bianchi','Andrea Ricci',
    'Elena Russo','Davide Marino','Chiara Lombardi','Matteo De Luca',
    'Roberto Gallo','Francesca Bruno','Sara Conti','Valentina Costa'
  ];
  n        CONSTANT int  := 12;
  sys_user CONSTANT uuid := 'a0000000-0000-0000-0000-000000000000';
  we_idx   int := 0;
  hol_idx  int := 0;
  w1 uuid; w1n text;
  w2 uuid; w2n text;
  st text;
BEGIN
  FOR d IN
    SELECT gs::date
    FROM generate_series('2024-01-01'::date, '2025-12-31'::date, '1 day') gs
  LOOP
    dow   := EXTRACT(DOW FROM d)::int;
    SELECT EXISTS(
      SELECT 1 FROM public.holidays WHERE date = d AND mandatory = true
    ) INTO is_hol;

    IF dow = 6 THEN
      -- Sabato: sceglie i 2 worker e li salva per la domenica
      w1  := emp_ids [(we_idx     % n) + 1];
      w1n := emp_names[(we_idx    % n) + 1];
      w2  := emp_ids [((we_idx+1) % n) + 1];
      w2n := emp_names[((we_idx+1)% n) + 1];
      we_idx := we_idx + 2;
      st := CASE WHEN is_hol THEN 'festivo' ELSE 'weekend' END;
      INSERT INTO public.shifts (date, user_id, user_nome, shift_type, created_by) VALUES
        (d, w1, w1n, st, sys_user),
        (d, w2, w2n, st, sys_user)
      ON CONFLICT DO NOTHING;

    ELSIF dow = 0 THEN
      -- Domenica: stessi 2 worker del sabato (weekend_full)
      st := CASE WHEN is_hol THEN 'festivo' ELSE 'weekend' END;
      INSERT INTO public.shifts (date, user_id, user_nome, shift_type, created_by) VALUES
        (d, w1, w1n, st, sys_user),
        (d, w2, w2n, st, sys_user)
      ON CONFLICT DO NOTHING;

    ELSIF is_hol THEN
      -- Festivo feriale: 2 worker indipendenti
      w1  := emp_ids [(hol_idx     % n) + 1];
      w1n := emp_names[(hol_idx    % n) + 1];
      w2  := emp_ids [((hol_idx+1) % n) + 1];
      w2n := emp_names[((hol_idx+1)% n) + 1];
      hol_idx := hol_idx + 2;
      INSERT INTO public.shifts (date, user_id, user_nome, shift_type, created_by) VALUES
        (d, w1, w1n, 'festivo', sys_user),
        (d, w2, w2n, 'festivo', sys_user)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 5. month_status confirmed: gennaio 2024 – dicembre 2025
-- ------------------------------------------------------------

INSERT INTO public.month_status (month, year, status, locked_by, locked_at)
SELECT
  EXTRACT(MONTH FROM gs)::int,
  EXTRACT(YEAR  FROM gs)::int,
  'confirmed',
  'a0000000-0000-0000-0000-000000000000',
  (EXTRACT(YEAR FROM gs)::text
   || '-' || lpad(EXTRACT(MONTH FROM gs)::text,2,'0')
   || '-28 10:00:00+00')::timestamptz
FROM generate_series('2024-01-01'::date, '2025-12-01'::date, '1 month') gs
ON CONFLICT (month, year) DO UPDATE
  SET status    = 'confirmed',
      locked_by = EXCLUDED.locked_by,
      locked_at = EXCLUDED.locked_at;

-- ------------------------------------------------------------
-- 6. Disponibilità gen-mar 2026
--    Tutti i dipendenti attivi disponibili ogni giorno
-- ------------------------------------------------------------

INSERT INTO public.availability (user_id, date, available, status)
SELECT u.id, d.date, true, 'pending'
FROM public.users u
CROSS JOIN (
  SELECT gs::date AS date
  FROM generate_series('2026-01-01'::date, '2026-03-31'::date, '1 day') gs
) d
WHERE u.ruolo = 'dipendente' AND u.attivo = true
ON CONFLICT (user_id, date) DO NOTHING;

-- ------------------------------------------------------------
COMMIT;
