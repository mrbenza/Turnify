-- ============================================================
-- Turnify — Seed demo realistico
-- Password per tutti: test
--
-- Utenti:
--   1 admin  · 1 manager  · 12 dipendenti attivi · 2 inattivi
--
-- Profili disponibilità (influenzano aprile 2026 e il comportamento storico):
--   Marco Ferretti     → standard (sab+dom+festivi, ~80%)
--   Giulia Esposito    → solo festivi comandati (mai weekend)
--   Luca Bianchi       → affidabile (sab+dom+festivi, 100%)
--   Andrea Ricci       → sempre disponibile (100% tutto)
--   Elena Russo        → solo sabato (mai domenica né festivi domenicali)
--   Davide Marino      → standard con qualche buco
--   Chiara Lombardi    → preferisce festivi; weekend solo se comandati
--   Matteo De Luca     → standard affidabile
--   Roberto Gallo      → sempre disponibile (100% tutto)
--   Francesca Bruno    → selettiva (~60%, spesso non inserisce in tempo)
--   Sara Conti         → selettiva (come Francesca)
--   Valentina Costa    → solo festivi comandati (mai weekend)
--
-- Inattivi:
--   Pietro Santoro     → disattivato 2026-01-10
--   Marta Ferri        → disattivata 2025-04-20
--
-- Storico:
--   Gen 2024 – Nov 2025 → confirmed (turni assegnati, mesi chiusi)
--   Dic 2025            → locked (ultimo mese chiuso)
--   Gen–Mar 2026        → BUCO INTENZIONALE (nessun turno, nessun month_status)
--                          → importare tramite docs/turni_gen_feb_mar_2026.xlsx
--   Apr 2026            → open (disponibilità parziali: 9/12 hanno inserito)
--                          Mancano: Francesca Bruno, Sara Conti, Valentina Costa
-- ============================================================

-- ============================================================
-- 0. Festività 2024 (2025-2026 già in schema_completo.sql)
-- ============================================================
INSERT INTO public.holidays (date, name, mandatory) VALUES
  ('2024-01-01', 'Capodanno',               true),
  ('2024-01-06', 'Epifania',                true),
  ('2024-03-31', 'Pasqua',                  true),
  ('2024-04-01', 'Lunedì dell''Angelo',      false),
  ('2024-04-25', 'Festa della Liberazione', true),
  ('2024-05-01', 'Festa dei Lavoratori',    true),
  ('2024-06-02', 'Festa della Repubblica',  true),
  ('2024-08-15', 'Ferragosto',              true),
  ('2024-11-01', 'Ognissanti',              false),
  ('2024-12-08', 'Immacolata Concezione',   false),
  ('2024-12-25', 'Natale',                  true),
  ('2024-12-26', 'Santo Stefano',           false)
ON CONFLICT (date) DO NOTHING;

-- ============================================================
-- 1. auth.users
-- ============================================================
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at, last_sign_in_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('a0000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'admin@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('b0000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'manager@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  -- Dipendenti attivi
  ('c0000001-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'marco.ferretti@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000002-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'giulia.esposito@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000003-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'luca.bianchi@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000004-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'andrea.ricci@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000005-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'elena.russo@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000006-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'davide.marino@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000007-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'chiara.lombardi@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000008-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'matteo.deluca@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000009-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'roberto.gallo@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000010-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'francesca.bruno@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000011-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'sara.conti@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000012-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'valentina.costa@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  -- Dipendenti inattivi
  ('c0000013-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'pietro.santoro@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','',''),
  ('c0000014-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated',
   'marta.ferri@turnify.test', crypt('test',gen_salt('bf')),
   now(),now(),now(),now(),
   '{"provider":"email","providers":["email"]}','{}',
   '','','','')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. public.users
-- ============================================================
INSERT INTO public.users (id, nome, email, ruolo, attivo, data_creazione, disattivato_at) VALUES
  ('a0000000-0000-0000-0000-000000000000', 'Admin',             'admin@turnify.test',       'admin',      true,  '2021-01-01', null),
  ('b0000000-0000-0000-0000-000000000000', 'Giuseppe Verdi',    'manager@turnify.test',     'manager',    true,  '2021-06-01', null),
  -- Dipendenti attivi — assunti in anni diversi per realismo equity
  ('c0000001-0000-0000-0000-000000000000', 'Marco Ferretti',    'marco.ferretti@turnify.test',   'dipendente', true, '2021-06-01', null),
  ('c0000002-0000-0000-0000-000000000000', 'Giulia Esposito',   'giulia.esposito@turnify.test',  'dipendente', true, '2021-09-01', null),
  ('c0000003-0000-0000-0000-000000000000', 'Luca Bianchi',      'luca.bianchi@turnify.test',     'dipendente', true, '2022-01-10', null),
  ('c0000004-0000-0000-0000-000000000000', 'Andrea Ricci',      'andrea.ricci@turnify.test',     'dipendente', true, '2022-03-01', null),
  ('c0000005-0000-0000-0000-000000000000', 'Elena Russo',       'elena.russo@turnify.test',      'dipendente', true, '2022-06-15', null),
  ('c0000006-0000-0000-0000-000000000000', 'Davide Marino',     'davide.marino@turnify.test',    'dipendente', true, '2022-09-05', null),
  ('c0000007-0000-0000-0000-000000000000', 'Chiara Lombardi',   'chiara.lombardi@turnify.test',  'dipendente', true, '2023-01-16', null),
  ('c0000008-0000-0000-0000-000000000000', 'Matteo De Luca',    'matteo.deluca@turnify.test',    'dipendente', true, '2023-04-03', null),
  ('c0000009-0000-0000-0000-000000000000', 'Roberto Gallo',     'roberto.gallo@turnify.test',    'dipendente', true, '2023-09-11', null),
  ('c0000010-0000-0000-0000-000000000000', 'Francesca Bruno',   'francesca.bruno@turnify.test',  'dipendente', true, '2024-01-08', null),
  ('c0000011-0000-0000-0000-000000000000', 'Sara Conti',        'sara.conti@turnify.test',       'dipendente', true, '2024-06-03', null),
  ('c0000012-0000-0000-0000-000000000000', 'Valentina Costa',   'valentina.costa@turnify.test',  'dipendente', true, '2025-02-17', null),
  -- Dipendenti inattivi
  ('c0000013-0000-0000-0000-000000000000', 'Pietro Santoro',    'pietro.santoro@turnify.test',   'dipendente', false, '2021-06-01', '2026-01-10'),
  ('c0000014-0000-0000-0000-000000000000', 'Marta Ferri',       'marta.ferri@turnify.test',      'dipendente', false, '2022-03-01', '2025-04-20')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3-4. Storico turni (Gen 2024 – Mar 2026), disponibilità
--      Mar 2026 locked, stati mese
-- ============================================================
DO $$
DECLARE
  v_manager  uuid := 'b0000000-0000-0000-0000-000000000000';

  -- UUIDs dipendenti (1-14)
  uid  uuid[];
  nome text[];

  d          date;
  dow        int;
  is_mand    boolean;
  stype      text;
  counter    int := 0;
  pool_size  int;
  w1 int; w2 int;
  i  int;
  ly int; lm int;
  locked_ts  timestamptz;

BEGIN
  uid := ARRAY[
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
    'c0000012-0000-0000-0000-000000000000'::uuid,
    'c0000013-0000-0000-0000-000000000000'::uuid,  -- Pietro (inattivo dal 2026-01-10)
    'c0000014-0000-0000-0000-000000000000'::uuid   -- Marta  (inattiva dal 2025-04-20)
  ];
  nome := ARRAY[
    'Marco Ferretti','Giulia Esposito','Luca Bianchi','Andrea Ricci',
    'Elena Russo','Davide Marino','Chiara Lombardi','Matteo De Luca',
    'Roberto Gallo','Francesca Bruno','Sara Conti','Valentina Costa',
    'Pietro Santoro','Marta Ferri'
  ];

  -- --------------------------------------------------------
  -- A. Turni storici: Gen 2024 → Dic 2025
  --    2 reperibili per ogni giorno festivo (mandatory) o weekend
  --
  --    Gen–Mar 2026 lasciati vuoti intenzionalmente:
  --      i dati verranno importati tramite XLSX (turni_gen_feb_mar_2026.xlsx)
  --
  --    Pool attivi in base alla data:
  --      < 2025-04-20  → 14 (tutti)
  --      < 2026-01-10  → 13 (senza Marta, pos 14)
  --      else          → 12 (senza Pietro e Marta)
  --
  --    Giulia (2) e Valentina (12) non fanno weekend:
  --      per i giorni weekend vengono saltate se capitano in w1/w2
  --      (il round-robin le include nei festivi)
  -- --------------------------------------------------------
  FOR d IN
    SELECT dd::date
    FROM generate_series('2024-01-01'::date,'2025-12-31'::date,'1 day'::interval) dd
  LOOP
    dow := EXTRACT(DOW FROM d)::int;

    SELECT EXISTS(
      SELECT 1 FROM public.holidays WHERE date = d AND mandatory = true
    ) INTO is_mand;

    IF is_mand THEN
      stype := 'festivo';
    ELSIF dow IN (0,6) THEN
      stype := 'weekend';
    ELSE
      CONTINUE;
    END IF;

    counter := counter + 1;

    -- Pool size (il loop termina a dic 2025, Pietro inattivo dal 2026-01-10)
    IF    d < '2025-04-20' THEN pool_size := 14;
    ELSE                        pool_size := 13;  -- Marta inattiva dal 2025-04-20
    END IF;

    -- Selezione 2 worker con rotazione ciclica
    w1 := ((counter - 1) * 2)     % pool_size + 1;
    w2 := ((counter - 1) * 2 + 1) % pool_size + 1;
    IF w1 = w2 THEN w2 := w2 % pool_size + 1; END IF;

    -- Se è weekend e il worker è Giulia (2) o Valentina (12), salta al successivo
    IF stype = 'weekend' AND (w1 = 2 OR w1 = 12) THEN
      w1 := w1 % pool_size + 1;
    END IF;
    IF stype = 'weekend' AND (w2 = 2 OR w2 = 12) THEN
      w2 := w2 % pool_size + 1;
    END IF;
    IF w1 = w2 THEN w2 := w2 % pool_size + 1; END IF;

    INSERT INTO public.shifts (user_id, user_nome, date, shift_type, created_by)
    VALUES (uid[w1], nome[w1], d, stype, v_manager)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.shifts (user_id, user_nome, date, shift_type, created_by)
    VALUES (uid[w2], nome[w2], d, stype, v_manager)
    ON CONFLICT DO NOTHING;

  END LOOP;

  -- --------------------------------------------------------
  -- C. Stati mese
  --    Gen 2024 – Nov 2025 → confirmed
  --    Dic 2025            → locked   (ultimo mese chiuso)
  --    Gen–Mar 2026        → assenti  (open per default, buco da importare via XLSX)
  --    Apr 2026            → open     (mese prossimo, disponibilità parziali)
  -- --------------------------------------------------------
  FOR ly IN 2024..2025 LOOP
    FOR lm IN 1..12 LOOP
      CONTINUE WHEN ly = 2025 AND lm >= 12;  -- dic 2025 gestito separatamente

      locked_ts := (make_date(ly, lm, 1) + '1 month 3 days'::interval)::timestamptz;

      INSERT INTO public.month_status (month, year, status, locked_by, locked_at)
      VALUES (lm, ly, 'confirmed', v_manager, locked_ts)
      ON CONFLICT (month, year) DO NOTHING;
    END LOOP;
  END LOOP;

  -- Dicembre 2025: locked (ultimo mese chiuso prima del buco)
  INSERT INTO public.month_status (month, year, status, locked_by, locked_at)
  VALUES (12, 2025, 'locked', v_manager, '2026-01-05 09:45:00+00')
  ON CONFLICT (month, year) DO NOTHING;

END $$;

-- ============================================================
-- 5. Disponibilità 2026 — tutti i mesi (Gen–Dic)
--
--    Profili:
--      Marco Ferretti    (1) → standard ~80% (salta ogni 5°)
--      Giulia Esposito   (2) → solo festivi mandatory, mai weekend
--      Luca Bianchi      (3) → 100% sempre disponibile
--      Andrea Ricci      (4) → 100% sempre disponibile
--      Elena Russo       (5) → solo sabato (mai domenica, nemmeno se festivo)
--      Davide Marino     (6) → standard ~85% (salta ogni 7°)
--      Chiara Lombardi   (7) → festivi sì; weekend solo ogni 3° sabato
--      Matteo De Luca    (8) → standard affidabile ~90% (salta ogni 10°)
--      Roberto Gallo     (9) → 100% sempre disponibile
--      Francesca Bruno  (10) → selettiva ~60%
--      Sara Conti       (11) → selettiva ~60% (pattern sfasato)
--      Valentina Costa  (12) → solo festivi mandatory, mai weekend
-- ============================================================
DO $$
DECLARE
  d        date;
  dow      int;
  is_mand  boolean;
  seq      int := 0;
  uid      uuid[] := ARRAY[
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
BEGIN
  FOR d IN
    SELECT dd::date
    FROM generate_series('2026-01-01'::date, '2026-12-31'::date, '1 day'::interval) dd
  LOOP
    dow := EXTRACT(DOW FROM d)::int;  -- 0=Dom, 6=Sab

    SELECT EXISTS(
      SELECT 1 FROM public.holidays WHERE date = d AND mandatory = true
    ) INTO is_mand;

    -- Solo date qualificanti: weekend (sab/dom) o festivo mandatory
    IF NOT (dow IN (0, 6) OR is_mand) THEN
      CONTINUE;
    END IF;

    seq := seq + 1;

    -- 1. Marco Ferretti — ~80% (salta ogni 5°)
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[1], d, (seq % 5 != 0), 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 2. Giulia Esposito — solo festivi mandatory
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[2], d, is_mand, 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 3. Luca Bianchi — 100%
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[3], d, true, 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 4. Andrea Ricci — 100%
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[4], d, true, 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 5. Elena Russo — solo sabato
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[5], d, (dow = 6), 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 6. Davide Marino — ~85% (salta ogni 7°)
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[6], d, (seq % 7 != 0), 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 7. Chiara Lombardi — festivi sì; sabati ogni 3°; domeniche mai
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[7], d,
      CASE
        WHEN is_mand        THEN true
        WHEN dow = 6        THEN (seq % 3 = 0)
        ELSE false
      END,
    'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 8. Matteo De Luca — ~90% (salta ogni 10°)
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[8], d, (seq % 10 != 0), 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 9. Roberto Gallo — 100%
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[9], d, true, 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 10. Francesca Bruno — ~60%
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[10], d, (seq % 5 < 3), 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 11. Sara Conti — ~60% (pattern sfasato)
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[11], d, ((seq + 2) % 5 < 3), 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

    -- 12. Valentina Costa — solo festivi mandatory
    INSERT INTO public.availability (user_id, date, available, status)
    VALUES (uid[12], d, is_mand, 'pending')
    ON CONFLICT (user_id, date) DO NOTHING;

  END LOOP;
END $$;

-- ============================================================
-- Verifica finale
-- ============================================================
SELECT
  to_char(date_trunc('month', date), 'Mon YYYY') AS mese,
  count(*)                                        AS turni,
  count(DISTINCT user_id)                         AS reperibili_distinti
FROM public.shifts
GROUP BY 1, date_trunc('month', date)
ORDER BY date_trunc('month', date);

SELECT
  ms.year, ms.month, ms.status,
  count(a.id) AS righe_availability
FROM public.month_status ms
LEFT JOIN public.availability a
  ON extract(month from a.date)::int = ms.month
  AND extract(year  from a.date)::int = ms.year
GROUP BY ms.year, ms.month, ms.status
ORDER BY ms.year, ms.month;
