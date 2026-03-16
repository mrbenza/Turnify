-- ============================================================
-- SEED COMPLETO — Turnify
-- Crea 15 dipendenti + disponibilità + turni Marzo→Agosto 2026
-- Password per tutti: test
-- ============================================================

-- ----------------------------------------
-- 1. auth.users
-- ----------------------------------------
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('cccccc01-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user1@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc02-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user2@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc03-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user3@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc04-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user4@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc05-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user5@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc06-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user6@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc07-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user7@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc08-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user8@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc09-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user9@test.com', crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc10-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user10@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc11-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user11@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc12-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user12@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc13-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user13@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc14-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user14@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc15-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user15@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------
-- 2. public.users
-- ----------------------------------------
INSERT INTO public.users (id, nome, email, ruolo, attivo) VALUES
  ('cccccc01-cccc-cccc-cccc-cccccccccccc','User 1', 'user1@test.com', 'user', true),
  ('cccccc02-cccc-cccc-cccc-cccccccccccc','User 2', 'user2@test.com', 'user', true),
  ('cccccc03-cccc-cccc-cccc-cccccccccccc','User 3', 'user3@test.com', 'user', true),
  ('cccccc04-cccc-cccc-cccc-cccccccccccc','User 4', 'user4@test.com', 'user', true),
  ('cccccc05-cccc-cccc-cccc-cccccccccccc','User 5', 'user5@test.com', 'user', true),
  ('cccccc06-cccc-cccc-cccc-cccccccccccc','User 6', 'user6@test.com', 'user', true),
  ('cccccc07-cccc-cccc-cccc-cccccccccccc','User 7', 'user7@test.com', 'user', true),
  ('cccccc08-cccc-cccc-cccc-cccccccccccc','User 8', 'user8@test.com', 'user', true),
  ('cccccc09-cccc-cccc-cccc-cccccccccccc','User 9', 'user9@test.com', 'user', true),
  ('cccccc10-cccc-cccc-cccc-cccccccccccc','User 10','user10@test.com','user', true),
  ('cccccc11-cccc-cccc-cccc-cccccccccccc','User 11','user11@test.com','user', true),
  ('cccccc12-cccc-cccc-cccc-cccccccccccc','User 12','user12@test.com','user', true),
  ('cccccc13-cccc-cccc-cccc-cccccccccccc','User 13','user13@test.com','user', true),
  ('cccccc14-cccc-cccc-cccc-cccccccccccc','User 14','user14@test.com','user', true),
  ('cccccc15-cccc-cccc-cccc-cccccccccccc','User 15','user15@test.com','user', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------
-- 3. Disponibilità + turni + stato mesi
-- ----------------------------------------
DO $$
DECLARE
  v_admin_id uuid;

  giorni_date date[] := ARRAY[
    -- Marzo
    '2026-03-01','2026-03-07','2026-03-08',
    '2026-03-14','2026-03-15',
    '2026-03-21','2026-03-22',
    '2026-03-28','2026-03-29',
    -- Aprile
    '2026-04-04','2026-04-05','2026-04-06',
    '2026-04-11','2026-04-12',
    '2026-04-18','2026-04-19',
    '2026-04-25','2026-04-26',
    -- Maggio
    '2026-05-01',
    '2026-05-02','2026-05-03',
    '2026-05-09','2026-05-10',
    '2026-05-16','2026-05-17',
    '2026-05-23','2026-05-24',
    '2026-05-30','2026-05-31',
    -- Giugno
    '2026-06-02',
    '2026-06-06','2026-06-07',
    '2026-06-13','2026-06-14',
    '2026-06-20','2026-06-21',
    '2026-06-27','2026-06-28',
    -- Luglio
    '2026-07-04','2026-07-05',
    '2026-07-11','2026-07-12',
    '2026-07-18','2026-07-19',
    '2026-07-25','2026-07-26',
    -- Agosto
    '2026-08-01','2026-08-02',
    '2026-08-08','2026-08-09',
    '2026-08-15','2026-08-16',
    '2026-08-22','2026-08-23',
    '2026-08-29','2026-08-30'
  ];

  giorni_tipo text[] := ARRAY[
    -- Marzo
    'weekend','weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    -- Aprile
    'weekend','festivo','festivo',   -- Sab, Pasqua, Pasquetta
    'weekend','weekend',
    'weekend','weekend',
    'festivo','weekend',             -- 25 Aprile, Dom
    -- Maggio
    'festivo',                       -- 1 Maggio
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    -- Giugno
    'festivo',                       -- 2 Giugno
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    -- Luglio
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    -- Agosto
    'weekend','weekend',
    'weekend','weekend',
    'festivo','weekend',             -- Ferragosto, Dom
    'weekend','weekend',
    'weekend','weekend'
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
  mese int;

BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE ruolo = 'admin' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Nessun admin trovato. Crea prima un utente admin.';
  END IF;

  -- Disponibilità: ogni dipendente salta ~1/3 dei giorni
  FOR i IN 1..15 LOOP
    FOR j IN 1..array_length(giorni_date, 1) LOOP
      IF (i + j) % 3 != 0 THEN
        INSERT INTO public.availability (user_id, date, status)
        VALUES (uids[i], giorni_date[j], 'pending')
        ON CONFLICT (user_id, date) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Turni: 2 reperibili per giorno, rotazione sui 15
  FOR j IN 1..array_length(giorni_date, 1) LOOP
    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[((j*2 - 2) % 15) + 1], giorni_date[j], giorni_tipo[j], v_admin_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[((j*2 - 1) % 15) + 1], giorni_date[j], giorni_tipo[j], v_admin_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Stato mesi: tutti open
  FOR mese IN 3..8 LOOP
    INSERT INTO public.month_status (month, year, status, locked_by)
    VALUES (mese, 2026, 'open', v_admin_id)
    ON CONFLICT (month, year) DO NOTHING;
  END LOOP;

END $$;

-- Verifica finale
SELECT
  to_char(date_trunc('month', date), 'Mon YYYY') AS mese,
  count(*) AS turni
FROM public.shifts
WHERE date BETWEEN '2026-03-01' AND '2026-08-31'
GROUP BY 1, date_trunc('month', date)
ORDER BY date_trunc('month', date);
