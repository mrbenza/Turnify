-- ============================================================
-- SEED turni Aprile → Agosto 2026
-- Esegui DOPO seed_test_data.sql (i 15 dipendenti devono esistere)
-- ============================================================

DO $$
DECLARE
  v_admin_id uuid;

  -- Tutti i weekend + festivi da Aprile ad Agosto 2026
  -- Formato: (data, tipo_turno)
  -- Tipi: 'weekend' | 'festivo'
  giorni_date  date[]    := ARRAY[
    -- Aprile
    '2026-04-04','2026-04-05','2026-04-06',   -- Sab, Dom/Pasqua, Lun/Pasquetta
    '2026-04-11','2026-04-12',
    '2026-04-18','2026-04-19',
    '2026-04-25','2026-04-26',                -- Sab/Liberazione, Dom
    -- Maggio
    '2026-05-01',                             -- Ven/Festa del Lavoro
    '2026-05-02','2026-05-03',
    '2026-05-09','2026-05-10',
    '2026-05-16','2026-05-17',
    '2026-05-23','2026-05-24',
    '2026-05-30','2026-05-31',
    -- Giugno
    '2026-06-02',                             -- Mar/Festa della Repubblica
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
    '2026-08-15','2026-08-16',                -- Sab/Ferragosto, Dom
    '2026-08-22','2026-08-23',
    '2026-08-29','2026-08-30'
  ];

  giorni_tipo  text[] := ARRAY[
    -- Aprile
    'weekend','festivo','festivo',
    'weekend','weekend',
    'weekend','weekend',
    'festivo','weekend',
    -- Maggio
    'festivo',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    'weekend','weekend',
    -- Giugno
    'festivo',
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
    'festivo','weekend',
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

  g    date;
  u    uuid;
  i    int;
  j    int;
  mese int;
  anno int := 2026;

BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE ruolo = 'admin' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Nessun admin trovato.';
  END IF;

  -- ----------------------------------------
  -- Disponibilità: stessa logica del seed marzo
  -- ogni dipendente salta ~1/3 dei giorni
  -- ----------------------------------------
  FOR i IN 1..15 LOOP
    u := uids[i];
    FOR j IN 1..array_length(giorni_date, 1) LOOP
      IF (i + j) % 3 != 0 THEN
        INSERT INTO public.availability (user_id, date, status)
        VALUES (u, giorni_date[j], 'pending')
        ON CONFLICT (user_id, date) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- ----------------------------------------
  -- Turni: 2 reperibili per giorno, rotazione sui 15
  -- ----------------------------------------
  FOR j IN 1..array_length(giorni_date, 1) LOOP
    g := giorni_date[j];

    -- 1° reperibile
    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[((j*2 - 2) % 15) + 1], g, giorni_tipo[j], v_admin_id)
    ON CONFLICT DO NOTHING;

    -- 2° reperibile
    INSERT INTO public.shifts (user_id, date, shift_type, created_by)
    VALUES (uids[((j*2 - 1) % 15) + 1], g, giorni_tipo[j], v_admin_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ----------------------------------------
  -- Stato mesi: open per tutti
  -- ----------------------------------------
  FOR mese IN 4..8 LOOP
    INSERT INTO public.month_status (month, year, status, locked_by)
    VALUES (mese, anno, 'open', v_admin_id)
    ON CONFLICT (month, year) DO NOTHING;
  END LOOP;

END $$;

-- Verifica
SELECT
  to_char(date_trunc('month', date), 'Month YYYY') AS mese,
  count(*) AS turni
FROM public.shifts
WHERE date BETWEEN '2026-04-01' AND '2026-08-31'
GROUP BY 1
ORDER BY min(date);
