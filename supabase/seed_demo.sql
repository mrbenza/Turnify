-- ============================================================
-- seed_demo.sql — Dati dimostrativi Turnify
--
-- Cosa inserisce:
--   • 8 dipendenti fittizi (senza account auth — solo dati)
--   • 1 utente "Sistema" usato come created_by nei turni storici
--   • Festività italiane 2024, 2025, 2026 (tutte mandatory=true)
--   • Turni per tutti i weekend e festivi di 2024 e 2025
--     (2 reperibili/giorno, modalità weekend_full)
--   • Tutti i mesi 2024-2025 impostati come "confirmed"
--   • Disponibilità Gen-Mar 2026: tutti disponibili per ogni giorno
--
-- NOTA: i dipendenti fittizi non possono fare login (no auth.users).
-- Admin e manager vanno creati normalmente tramite Supabase Auth.
--
-- Eseguire nel SQL Editor di Supabase (service_role).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Utente "Sistema" (created_by per turni storici)
-- ------------------------------------------------------------

INSERT INTO public.users (id, nome, email, ruolo, attivo)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Sistema',
  'sistema@turnify.internal',
  'admin',
  false
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Dipendenti fittizi (8 persone)
-- ------------------------------------------------------------

INSERT INTO public.users (id, nome, email, ruolo, attivo) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Mario Rossi',      'mario.rossi@demo.it',      'dipendente', true),
  ('d1000000-0000-0000-0000-000000000002', 'Laura Bianchi',    'laura.bianchi@demo.it',    'dipendente', true),
  ('d1000000-0000-0000-0000-000000000003', 'Giovanni Verdi',   'giovanni.verdi@demo.it',   'dipendente', true),
  ('d1000000-0000-0000-0000-000000000004', 'Alessia Neri',     'alessia.neri@demo.it',     'dipendente', true),
  ('d1000000-0000-0000-0000-000000000005', 'Marco Russo',      'marco.russo@demo.it',      'dipendente', true),
  ('d1000000-0000-0000-0000-000000000006', 'Francesca Romano', 'francesca.romano@demo.it', 'dipendente', true),
  ('d1000000-0000-0000-0000-000000000007', 'Davide Esposito',  'davide.esposito@demo.it',  'dipendente', true),
  ('d1000000-0000-0000-0000-000000000008', 'Sara Marino',      'sara.marino@demo.it',      'dipendente', true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Festività italiane 2024 / 2025 / 2026
-- ------------------------------------------------------------

INSERT INTO public.holidays (date, name, mandatory) VALUES
  -- 2024
  ('2024-01-01', 'Capodanno',               true),
  ('2024-01-06', 'Epifania',                true),
  ('2024-03-31', 'Pasqua',                  true),
  ('2024-04-01', 'Lunedì dell''Angelo',     true),
  ('2024-04-25', 'Festa della Liberazione', true),
  ('2024-05-01', 'Festa dei Lavoratori',    true),
  ('2024-06-02', 'Festa della Repubblica',  true),
  ('2024-08-15', 'Ferragosto',              true),
  ('2024-11-01', 'Ognissanti',              true),
  ('2024-12-08', 'Immacolata Concezione',   true),
  ('2024-12-25', 'Natale',                  true),
  ('2024-12-26', 'Santo Stefano',           true),
  -- 2025
  ('2025-01-01', 'Capodanno',               true),
  ('2025-01-06', 'Epifania',                true),
  ('2025-04-20', 'Pasqua',                  true),
  ('2025-04-21', 'Lunedì dell''Angelo',     true),
  ('2025-04-25', 'Festa della Liberazione', true),
  ('2025-05-01', 'Festa dei Lavoratori',    true),
  ('2025-06-02', 'Festa della Repubblica',  true),
  ('2025-08-15', 'Ferragosto',              true),
  ('2025-11-01', 'Ognissanti',              true),
  ('2025-12-08', 'Immacolata Concezione',   true),
  ('2025-12-25', 'Natale',                  true),
  ('2025-12-26', 'Santo Stefano',           true),
  -- 2026
  ('2026-01-01', 'Capodanno',               true),
  ('2026-01-06', 'Epifania',                true),
  ('2026-04-05', 'Pasqua',                  true),
  ('2026-04-06', 'Lunedì dell''Angelo',     true),
  ('2026-04-25', 'Festa della Liberazione', true),
  ('2026-05-01', 'Festa dei Lavoratori',    true),
  ('2026-06-02', 'Festa della Repubblica',  true),
  ('2026-08-15', 'Ferragosto',              true),
  ('2026-11-01', 'Ognissanti',              true),
  ('2026-12-08', 'Immacolata Concezione',   true),
  ('2026-12-25', 'Natale',                  true),
  ('2026-12-26', 'Santo Stefano',           true)
ON CONFLICT (date) DO NOTHING;

-- ------------------------------------------------------------
-- 4. Turni 2024-2025 (round-robin, weekend_full, 2 per giorno)
-- ------------------------------------------------------------

DO $$
DECLARE
  d        date;
  dow      int;
  is_hol   boolean;
  emp_ids  uuid[] := ARRAY[
    'd1000000-0000-0000-0000-000000000001'::uuid,
    'd1000000-0000-0000-0000-000000000002'::uuid,
    'd1000000-0000-0000-0000-000000000003'::uuid,
    'd1000000-0000-0000-0000-000000000004'::uuid,
    'd1000000-0000-0000-0000-000000000005'::uuid,
    'd1000000-0000-0000-0000-000000000006'::uuid,
    'd1000000-0000-0000-0000-000000000007'::uuid,
    'd1000000-0000-0000-0000-000000000008'::uuid
  ];
  emp_names text[] := ARRAY[
    'Mario Rossi', 'Laura Bianchi', 'Giovanni Verdi', 'Alessia Neri',
    'Marco Russo', 'Francesca Romano', 'Davide Esposito', 'Sara Marino'
  ];
  n        CONSTANT int  := 8;
  sys_user CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
  we_idx   int  := 0;   -- round-robin weekend (avanza di 2 ogni sabato)
  hol_idx  int  := 0;   -- round-robin festivi feriali
  w1       uuid; w1n text;
  w2       uuid; w2n text;
  st       text;
BEGIN
  FOR d IN
    SELECT gs::date
    FROM generate_series('2024-01-01'::date, '2025-12-31'::date, '1 day') gs
  LOOP
    dow   := EXTRACT(DOW FROM d)::int;   -- 0=Dom 6=Sab
    SELECT EXISTS(
      SELECT 1 FROM public.holidays WHERE date = d AND mandatory = true
    ) INTO is_hol;

    IF dow = 6 THEN
      -- Sabato: sceglie i 2 worker e li salva per la domenica
      w1  := emp_ids [(we_idx       % n) + 1];
      w1n := emp_names[(we_idx       % n) + 1];
      w2  := emp_ids [((we_idx+1)   % n) + 1];
      w2n := emp_names[((we_idx+1)  % n) + 1];
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
      -- Festivo feriale (lun-ven): 2 worker indipendenti
      w1  := emp_ids [(hol_idx      % n) + 1];
      w1n := emp_names[(hol_idx     % n) + 1];
      w2  := emp_ids [((hol_idx+1)  % n) + 1];
      w2n := emp_names[((hol_idx+1) % n) + 1];
      hol_idx := hol_idx + 2;

      INSERT INTO public.shifts (date, user_id, user_nome, shift_type, created_by) VALUES
        (d, w1, w1n, 'festivo', sys_user),
        (d, w2, w2n, 'festivo', sys_user)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 5. month_status confirmed per 2024-2025
-- ------------------------------------------------------------

INSERT INTO public.month_status (month, year, status, locked_by, locked_at)
SELECT
  EXTRACT(MONTH FROM gs)::int,
  EXTRACT(YEAR  FROM gs)::int,
  'confirmed',
  '00000000-0000-0000-0000-000000000000',
  (EXTRACT(YEAR FROM gs)::text
   || '-' || lpad(EXTRACT(MONTH FROM gs)::text, 2, '0')
   || '-28 10:00:00+00')::timestamptz
FROM generate_series('2024-01-01'::date, '2025-12-01'::date, '1 month') gs
ON CONFLICT (month, year) DO UPDATE
  SET status    = 'confirmed',
      locked_by = EXCLUDED.locked_by,
      locked_at = EXCLUDED.locked_at;

-- ------------------------------------------------------------
-- 6. Disponibilità Gen-Mar 2026
--    Tutti i dipendenti disponibili per ogni giorno del trimestre
-- ------------------------------------------------------------

INSERT INTO public.availability (user_id, date, available, status)
SELECT
  u.id,
  d.date,
  true,
  'pending'
FROM public.users u
CROSS JOIN (
  SELECT gs::date AS date
  FROM generate_series('2026-01-01'::date, '2026-03-31'::date, '1 day') gs
) d
WHERE u.ruolo = 'dipendente' AND u.attivo = true
ON CONFLICT (user_id, date) DO NOTHING;

COMMIT;
