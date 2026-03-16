-- ============================================================
-- SEED DATI FITTIZI — Turnify
-- Esegui sul Supabase SQL Editor
-- Password per tutti: test
-- ============================================================

-- ----------------------------------------
-- 1. Crea dipendenti in auth.users
-- ----------------------------------------
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) VALUES
  ('cccccc01-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user1@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc02-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user2@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc03-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user3@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc04-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user4@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc05-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user5@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc06-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user6@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc07-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user7@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc08-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user8@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc09-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user9@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc10-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user10@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc11-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user11@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc12-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user12@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc13-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user13@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc14-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user14@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated'),
  ('cccccc15-cccc-cccc-cccc-cccccccccccc','00000000-0000-0000-0000-000000000000','user15@test.com',crypt('test',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------
-- 2. Profili in public.users
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
-- 3. Disponibilità + turni marzo 2026
--    Weekend: 1(dom),7(sab),8(dom),14(sab),15(dom),21(sab),22(dom),28(sab),29(dom)
-- ----------------------------------------
DO $$
DECLARE
  v_admin_id uuid;
  -- weekend e festivi marzo 2026
  giorni date[] := ARRAY[
    '2026-03-01','2026-03-07','2026-03-08',
    '2026-03-14','2026-03-15',
    '2026-03-21','2026-03-22',
    '2026-03-28','2026-03-29'
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
  g date;
  u uuid;
  i int;
  j int;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE ruolo = 'admin' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Nessun admin trovato. Crea prima un utente admin.';
  END IF;

  -- Disponibilità: ogni dipendente è disponibile su ~6 degli 9 weekend
  -- (distribuzione variabile per rendere le statistiche interessanti)
  FOR i IN 1..15 LOOP
    u := uids[i];
    FOR j IN 1..array_length(giorni,1) LOOP
      -- ogni dipendente salta 3 weekend (quelli con indice (i+j) mod 3 = 0)
      IF (i + j) % 3 != 0 THEN
        INSERT INTO public.availability (user_id, date, status)
        VALUES (u, giorni[j], 'pending')
        ON CONFLICT (user_id, date) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Turni: 2 persone per ogni weekend, ruotando tra i 15 dipendenti
  FOR j IN 1..array_length(giorni,1) LOOP
    g := giorni[j];
    -- 1° reperibile
    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[((j*2 - 2) % 15) + 1], g, 'weekend', v_admin_id)
    ON CONFLICT DO NOTHING;
    -- 2° reperibile
    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[((j*2 - 1) % 15) + 1], g, 'weekend', v_admin_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Stato mese marzo 2026 = open
  INSERT INTO public.month_status (month, year, status, locked_by)
  VALUES (3, 2026, 'open', v_admin_id)
  ON CONFLICT (month, year) DO NOTHING;

END $$;

-- ----------------------------------------
-- Verifica
-- ----------------------------------------
SELECT 'Dipendenti'       AS check, count(*)::text AS n FROM public.users WHERE ruolo = 'user'
UNION ALL
SELECT 'Disponibilità',   count(*)::text FROM public.availability
UNION ALL
SELECT 'Turni marzo',     count(*)::text FROM public.shifts WHERE date BETWEEN '2026-03-01' AND '2026-03-31';
