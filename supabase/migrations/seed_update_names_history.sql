-- ============================================================
-- 1. Aggiorna nomi utenti con nomi italiani fittizi
--    (email e password invariate)
-- ============================================================
UPDATE public.users SET nome = 'Marco Ferretti'     WHERE email = 'user1@test.com';
UPDATE public.users SET nome = 'Giulia Esposito'    WHERE email = 'user2@test.com';
UPDATE public.users SET nome = 'Luca Bianchi'       WHERE email = 'user3@test.com';
UPDATE public.users SET nome = 'Sara Conti'         WHERE email = 'user4@test.com';
UPDATE public.users SET nome = 'Andrea Ricci'       WHERE email = 'user5@test.com';
UPDATE public.users SET nome = 'Elena Russo'        WHERE email = 'user6@test.com';
UPDATE public.users SET nome = 'Davide Marino'      WHERE email = 'user7@test.com';
UPDATE public.users SET nome = 'Chiara Lombardi'    WHERE email = 'user8@test.com';
UPDATE public.users SET nome = 'Matteo De Luca'     WHERE email = 'user9@test.com';
UPDATE public.users SET nome = 'Francesca Bruno'    WHERE email = 'user10@test.com';
UPDATE public.users SET nome = 'Roberto Gallo'      WHERE email = 'user11@test.com';
UPDATE public.users SET nome = 'Valentina Costa'    WHERE email = 'user12@test.com';
UPDATE public.users SET nome = 'Simone Mancini'     WHERE email = 'user13@test.com';
UPDATE public.users SET nome = 'Laura Fontana'      WHERE email = 'user14@test.com';
UPDATE public.users SET nome = 'Alessandro Moretti' WHERE email = 'user15@test.com';

-- ============================================================
-- 2. Storico turni: Gennaio e Febbraio 2026
--    (mesi precedenti al seed principale che parte da Marzo)
-- ============================================================
DO $$
DECLARE
  v_admin_id uuid;

  -- Gennaio 2026
  -- Festivi nel DB: 01/01 (Capodanno), 06/01 (Epifania)
  -- Weekend: 3-4, 10-11, 17-18, 24-25, 31
  gen_date date[] := ARRAY[
    '2026-01-01',                          -- Gio/Capodanno
    '2026-01-03','2026-01-04',             -- Sab, Dom
    '2026-01-06',                          -- Mar/Epifania
    '2026-01-10','2026-01-11',             -- Sab, Dom
    '2026-01-17','2026-01-18',             -- Sab, Dom
    '2026-01-24','2026-01-25',             -- Sab, Dom
    '2026-01-31'                           -- Sab
  ];
  gen_tipo text[] := ARRAY[
    'festivo',
    'weekend','weekend',
    'festivo',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend'
  ];

  -- Febbraio 2026
  -- Nessun festivo nazionale
  -- Weekend: 1, 7-8, 14-15, 21-22, 28
  feb_date date[] := ARRAY[
    '2026-02-01',                          -- Dom
    '2026-02-07','2026-02-08',             -- Sab, Dom
    '2026-02-14','2026-02-15',             -- Sab, Dom
    '2026-02-21','2026-02-22',             -- Sab, Dom
    '2026-02-28'                           -- Sab
  ];
  feb_tipo text[] := ARRAY[
    'weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend'
  ];

  uids uuid[] := ARRAY[
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
    'cccccc15-cccc-cccc-cccc-cccccccccccc'
  ];

  i int;
  j int;

BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE ruolo = 'admin' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Nessun admin trovato.';
  END IF;

  -- ----------------------------------------
  -- GENNAIO: disponibilità (skip ~1/3) + turni
  -- ----------------------------------------
  FOR i IN 1..15 LOOP
    FOR j IN 1..array_length(gen_date, 1) LOOP
      IF (i + j) % 3 != 0 THEN
        INSERT INTO public.availability (user_id, date, status)
        VALUES (uids[i], gen_date[j], 'pending')
        ON CONFLICT (user_id, date) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  FOR j IN 1..array_length(gen_date, 1) LOOP
    -- rotazione offset +3 rispetto al seed marzo per variare la distribuzione
    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[(((j+2)*2 - 2) % 15) + 1], gen_date[j], gen_tipo[j], v_admin_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[(((j+2)*2 - 1) % 15) + 1], gen_date[j], gen_tipo[j], v_admin_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.month_status (month, year, status, locked_by)
  VALUES (1, 2026, 'locked', v_admin_id)
  ON CONFLICT (month, year) DO NOTHING;

  -- ----------------------------------------
  -- FEBBRAIO: disponibilità + turni
  -- ----------------------------------------
  FOR i IN 1..15 LOOP
    FOR j IN 1..array_length(feb_date, 1) LOOP
      IF (i + j + 1) % 3 != 0 THEN
        INSERT INTO public.availability (user_id, date, status)
        VALUES (uids[i], feb_date[j], 'pending')
        ON CONFLICT (user_id, date) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  FOR j IN 1..array_length(feb_date, 1) LOOP
    -- rotazione offset +7 per ulteriore variazione
    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[(((j+6)*2 - 2) % 15) + 1], feb_date[j], feb_tipo[j], v_admin_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[(((j+6)*2 - 1) % 15) + 1], feb_date[j], feb_tipo[j], v_admin_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.month_status (month, year, status, locked_by)
  VALUES (2, 2026, 'locked', v_admin_id)
  ON CONFLICT (month, year) DO NOTHING;

END $$;

-- ============================================================
-- Verifica finale
-- ============================================================
SELECT 'Nomi aggiornati' AS check, count(*)::text AS n
  FROM public.users WHERE email LIKE '%@test.com' AND nome NOT LIKE 'User %'
UNION ALL
SELECT to_char(date_trunc('month', date), 'Mon YYYY'), count(*)::text
  FROM public.shifts
  WHERE date BETWEEN '2026-01-01' AND '2026-02-28'
  GROUP BY 1, date_trunc('month', date)
  ORDER BY 2 DESC;
