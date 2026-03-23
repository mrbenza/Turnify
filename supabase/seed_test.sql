-- ============================================================
-- Turnify — Seed dati di test (completo)
-- 1 manager + 15 dipendenti attivi + 3 dipendenti inattivi
-- Storico completo: Gennaio 2024 → Agosto 2026
-- Password per tutti: test
--
-- Lavoratori inattivi (per testare la visualizzazione storica):
--   Pietro Santoro  — disattivato 2026-03-15  (pochi giorni fa)
--   Marta Ferri     — disattivata 2025-06-10  (~9 mesi)
--   Tommaso Greco   — disattivato 2024-04-20  (~2 anni)
-- ============================================================

-- ============================================================
-- 0. Festività 2024 (2025 e 2026 già nel schema_completo.sql)
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
-- 1. auth.users  (1 manager + 15 attivi + 3 inattivi = 19)
-- ============================================================
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  -- Manager
  ('bbbbbb01-bbbb-bbbb-bbbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000000','manager1@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  -- Dipendenti attivi
  ('cccccc01-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user1@test.com',    crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc02-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user2@test.com',    crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc03-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user3@test.com',    crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc04-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user4@test.com',    crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc05-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user5@test.com',    crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc06-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user6@test.com',    crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc07-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user7@test.com',    crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc08-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user8@test.com',    crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc09-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user9@test.com',    crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc10-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user10@test.com',   crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc11-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user11@test.com',   crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc12-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user12@test.com',   crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc13-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user13@test.com',   crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc14-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user14@test.com',   crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc15-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user15@test.com',   crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  -- Dipendenti inattivi
  ('cccccc16-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user16@test.com',   crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc17-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user17@test.com',   crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc18-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user18@test.com',   crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. public.users
-- ============================================================
INSERT INTO public.users (id, nome, email, ruolo, attivo, data_creazione, disattivato_at) VALUES
  -- Manager
  ('bbbbbb01-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Giuseppe Verdi',      'manager1@test.com', 'manager',    true,  '2021-06-01', null),
  -- Dipendenti attivi (assunti in periodi diversi per realismo)
  ('cccccc01-cccc-cccc-cccc-cccccccccccc', 'Marco Ferretti',      'user1@test.com',    'dipendente', true,  '2021-06-01', null),
  ('cccccc02-cccc-cccc-cccc-cccccccccccc', 'Giulia Esposito',     'user2@test.com',    'dipendente', true,  '2021-06-01', null),
  ('cccccc03-cccc-cccc-cccc-cccccccccccc', 'Luca Bianchi',        'user3@test.com',    'dipendente', true,  '2021-09-15', null),
  ('cccccc04-cccc-cccc-cccc-cccccccccccc', 'Sara Conti',          'user4@test.com',    'dipendente', true,  '2021-09-15', null),
  ('cccccc05-cccc-cccc-cccc-cccccccccccc', 'Andrea Ricci',        'user5@test.com',    'dipendente', true,  '2022-01-10', null),
  ('cccccc06-cccc-cccc-cccc-cccccccccccc', 'Elena Russo',         'user6@test.com',    'dipendente', true,  '2022-01-10', null),
  ('cccccc07-cccc-cccc-cccc-cccccccccccc', 'Davide Marino',       'user7@test.com',    'dipendente', true,  '2022-05-20', null),
  ('cccccc08-cccc-cccc-cccc-cccccccccccc', 'Chiara Lombardi',     'user8@test.com',    'dipendente', true,  '2022-05-20', null),
  ('cccccc09-cccc-cccc-cccc-cccccccccccc', 'Matteo De Luca',      'user9@test.com',    'dipendente', true,  '2023-02-01', null),
  ('cccccc10-cccc-cccc-cccc-cccccccccccc', 'Francesca Bruno',     'user10@test.com',   'dipendente', true,  '2023-02-01', null),
  ('cccccc11-cccc-cccc-cccc-cccccccccccc', 'Roberto Gallo',       'user11@test.com',   'dipendente', true,  '2023-07-03', null),
  ('cccccc12-cccc-cccc-cccc-cccccccccccc', 'Valentina Costa',     'user12@test.com',   'dipendente', true,  '2023-07-03', null),
  ('cccccc13-cccc-cccc-cccc-cccccccccccc', 'Simone Mancini',      'user13@test.com',   'dipendente', true,  '2024-01-08', null),
  ('cccccc14-cccc-cccc-cccc-cccccccccccc', 'Laura Fontana',       'user14@test.com',   'dipendente', true,  '2024-09-02', null),
  ('cccccc15-cccc-cccc-cccc-cccccccccccc', 'Alessandro Moretti',  'user15@test.com',   'dipendente', true,  '2025-03-10', null),
  -- Dipendenti inattivi
  ('cccccc16-cccc-cccc-cccc-cccccccccccc', 'Pietro Santoro',      'user16@test.com',   'dipendente', false, '2021-06-01', '2026-03-15'),
  ('cccccc17-cccc-cccc-cccc-cccccccccccc', 'Marta Ferri',         'user17@test.com',   'dipendente', false, '2021-06-01', '2025-06-10'),
  ('cccccc18-cccc-cccc-cccc-cccccccccccc', 'Tommaso Greco',       'user18@test.com',   'dipendente', false, '2021-06-01', '2024-04-20')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Turni, disponibilità, stati mese
-- ============================================================
DO $$
DECLARE
  v_manager uuid := 'bbbbbb01-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  -- Posizioni 1-15: sempre attivi
  -- Posizione 16: Pietro Santoro  (disattivato 2026-03-15)
  -- Posizione 17: Marta Ferri     (disattivata 2025-06-10)
  -- Posizione 18: Tommaso Greco   (disattivato 2024-04-20)
  all_uids uuid[] := ARRAY[
    'cccccc01-cccc-cccc-cccc-cccccccccccc',
    'cccccc02-cccc-cccc-cccc-cccccccccccc',
    'cccccc03-cccc-cccc-cccc-cccccccccccc',
    'cccccc04-cccc-cccc-cccc-cccccccccccc',
    'cccccc05-cccc-cccc-cccc-cccccccccccc',
    'cccccc06-cccc-cccc-cccc-cccccccccccc',
    'cccccc07-cccc-cccc-cccc-cccccccccccc',
    'cccccc08-cccc-cccc-cccc-cccccccccccc',
    'cccccc09-cccc-cccc-cccc-cccccccccccc',
    'cccccc10-cccc-cccc-cccc-cccccccccccc',
    'cccccc11-cccc-cccc-cccc-cccccccccccc',
    'cccccc12-cccc-cccc-cccc-cccccccccccc',
    'cccccc13-cccc-cccc-cccc-cccccccccccc',
    'cccccc14-cccc-cccc-cccc-cccccccccccc',
    'cccccc15-cccc-cccc-cccc-cccccccccccc',
    'cccccc16-cccc-cccc-cccc-cccccccccccc',
    'cccccc17-cccc-cccc-cccc-cccccccccccc',
    'cccccc18-cccc-cccc-cccc-cccccccccccc'
  ];
  all_nomi text[] := ARRAY[
    'Marco Ferretti','Giulia Esposito','Luca Bianchi','Sara Conti',
    'Andrea Ricci','Elena Russo','Davide Marino','Chiara Lombardi',
    'Matteo De Luca','Francesca Bruno','Roberto Gallo','Valentina Costa',
    'Simone Mancini','Laura Fontana','Alessandro Moretti',
    'Pietro Santoro','Marta Ferri','Tommaso Greco'
  ];

  d            date;
  dow          int;
  is_holiday   boolean;
  stype        text;
  counter      int := 0;
  pool_size    int;
  w1           int;
  w2           int;
  i            int;
  loop_y       int;
  loop_m       int;
  locked_ts    timestamptz;

BEGIN

  -- ----------------------------------------------------------
  -- A. Turni: Gennaio 2024 → Agosto 2026
  --    Ogni giorno festivo (mandatory) o weekend → 2 reperibili
  --    Pool workers si riduce man mano che i 3 lasciano il team:
  --      prima di 2024-04-20 → pool 18 (tutti)
  --      2024-04-20 → 2025-06-09 → pool 17 (senza Tommaso)
  --      2025-06-10 → 2026-03-14 → pool 16 (senza Tommaso e Marta)
  --      dal 2026-03-15 → pool 15 (solo attivi)
  -- ----------------------------------------------------------
  FOR d IN
    SELECT dd::date
    FROM generate_series('2024-01-01'::date, '2026-08-31'::date, '1 day'::interval) dd
  LOOP
    dow := EXTRACT(DOW FROM d)::int;

    SELECT EXISTS(
      SELECT 1 FROM public.holidays WHERE date = d AND mandatory = true
    ) INTO is_holiday;

    IF is_holiday THEN
      stype := 'festivo';
    ELSIF dow = 0 OR dow = 6 THEN
      stype := 'weekend';
    ELSE
      CONTINUE;
    END IF;

    counter := counter + 1;

    -- Pool size in base alla data
    IF    d < '2024-04-20' THEN pool_size := 18;
    ELSIF d < '2025-06-10' THEN pool_size := 17;
    ELSIF d < '2026-03-15' THEN pool_size := 16;
    ELSE                        pool_size := 15;
    END IF;

    -- Seleziona 2 worker distinti con rotazione ciclica
    w1 := ((counter - 1) * 2)     % pool_size + 1;
    w2 := ((counter - 1) * 2 + 1) % pool_size + 1;
    IF w1 = w2 THEN w2 := w2 % pool_size + 1; END IF;

    -- Disponibilità per i mesi aperti (Aprile → Agosto 2026)
    -- Marzo 2026: disponibilità locked (mese confermato)
    IF d >= '2026-03-01' AND d < '2026-04-01' THEN
      FOR i IN 1..15 LOOP
        IF (i + counter) % 3 != 0 THEN
          INSERT INTO public.availability (user_id, date, status)
          VALUES (all_uids[i], d, 'locked')
          ON CONFLICT (user_id, date) DO NOTHING;
        END IF;
      END LOOP;
    ELSIF d >= '2026-04-01' THEN
      FOR i IN 1..15 LOOP
        IF (i + counter) % 3 != 0 THEN
          INSERT INTO public.availability (user_id, date, status)
          VALUES (all_uids[i], d, 'pending')
          ON CONFLICT (user_id, date) DO NOTHING;
        END IF;
      END LOOP;
    END IF;

    -- Turni
    INSERT INTO public.shifts (user_id, user_nome, date, shift_type, created_by)
    VALUES (all_uids[w1], all_nomi[w1], d, stype, v_manager)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.shifts (user_id, user_nome, date, shift_type, created_by)
    VALUES (all_uids[w2], all_nomi[w2], d, stype, v_manager)
    ON CONFLICT DO NOTHING;

  END LOOP;

  -- ----------------------------------------------------------
  -- B. Stati mese
  --    2024-01 → 2026-02: confirmed (locked_at = 3° giorno del mese successivo)
  --    2026-03: locked (locked_at = 2026-03-18)
  --    2026-04 → 2026-08: open
  -- ----------------------------------------------------------
  FOR loop_y IN 2024..2026 LOOP
    FOR loop_m IN 1..12 LOOP

      -- Salta mesi non ancora arrivati o fuori scope
      CONTINUE WHEN loop_y = 2026 AND loop_m > 8;
      CONTINUE WHEN loop_y = 2026 AND loop_m >= 3; -- gestiti separatamente

      locked_ts := (make_date(loop_y, loop_m, 1) + '1 month'::interval + '3 days'::interval)::timestamptz;

      INSERT INTO public.month_status (month, year, status, locked_by, locked_at)
      VALUES (loop_m, loop_y, 'confirmed', v_manager, locked_ts)
      ON CONFLICT (month, year) DO NOTHING;

    END LOOP;
  END LOOP;

  -- Marzo 2026: locked
  INSERT INTO public.month_status (month, year, status, locked_by, locked_at)
  VALUES (3, 2026, 'locked', v_manager, '2026-03-18 10:30:00+00')
  ON CONFLICT (month, year) DO NOTHING;

  -- Aprile → Agosto 2026: open
  FOR loop_m IN 4..8 LOOP
    INSERT INTO public.month_status (month, year, status, locked_by)
    VALUES (loop_m, 2026, 'open', v_manager)
    ON CONFLICT (month, year) DO NOTHING;
  END LOOP;

END $$;

-- ============================================================
-- Verifica
-- ============================================================
SELECT
  to_char(date_trunc('month', date), 'Mon YYYY') AS mese,
  count(*)                                        AS turni,
  count(DISTINCT user_id)                         AS reperibili_distinti
FROM public.shifts
GROUP BY 1, date_trunc('month', date)
ORDER BY date_trunc('month', date);
