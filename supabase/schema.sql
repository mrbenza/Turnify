-- ============================================================
-- schema.sql — Schema completo Turnify (migrations 001-011)
-- Idempotente: può essere eseguito anche su un DB con schema
-- già presente (DROP POLICY IF EXISTS prima di ogni CREATE).
--
-- Per un DB completamente vuoto: eseguire questo file.
-- Per un DB con schema esistente: eseguire solo reset.sql
-- e poi seed_demo.sql (saltare schema.sql).
--
-- Eseguire nel SQL Editor di Supabase (service_role).
-- ============================================================

-- ------------------------------------------------------------
-- Funzioni helper per RLS
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND ruolo = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND ruolo IN ('admin', 'manager')
  );
$$;

-- ------------------------------------------------------------
-- Tabella: users
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id             uuid        PRIMARY KEY,           -- corrisponde a auth.users.id
  nome           text        NOT NULL,
  email          text        NOT NULL UNIQUE,
  ruolo          text        NOT NULL DEFAULT 'dipendente'
                             CHECK (ruolo IN ('admin', 'manager', 'dipendente')),
  attivo         boolean     NOT NULL DEFAULT true,
  data_creazione timestamptz NOT NULL DEFAULT now(),
  disattivato_at timestamptz
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_self"      ON public.users;
DROP POLICY IF EXISTS "users_select_admin"     ON public.users;
DROP POLICY IF EXISTS "users_select_manager"   ON public.users;
DROP POLICY IF EXISTS "users_insert_admin"     ON public.users;
DROP POLICY IF EXISTS "users_update_admin"     ON public.users;
DROP POLICY IF EXISTS "users_update_self"      ON public.users;
DROP POLICY IF EXISTS "users_delete_admin"     ON public.users;

CREATE POLICY "users_select_self"
  ON public.users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_select_admin"
  ON public.users FOR SELECT
  USING (public.is_admin() AND ruolo != 'admin');

CREATE POLICY "users_select_manager"
  ON public.users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.ruolo = 'manager')
    AND (ruolo = 'dipendente' OR id = auth.uid())
  );

CREATE POLICY "users_insert_admin"
  ON public.users FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "users_update_admin"
  ON public.users FOR UPDATE
  USING  (public.is_admin() AND id != auth.uid())
  WITH CHECK (public.is_admin());

CREATE POLICY "users_update_self"
  ON public.users FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "users_delete_admin"
  ON public.users FOR DELETE USING (public.is_admin() AND id != auth.uid());

-- ------------------------------------------------------------
-- Tabella: areas
-- (predisposta per multi-area; per ora 1 riga "Default")
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.areas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text        NOT NULL UNIQUE,
  scheduling_mode text        NOT NULL DEFAULT 'weekend_full'
                              CHECK (scheduling_mode IN ('single_day', 'weekend_full', 'sun_next_sat')),
  workers_per_day integer     NOT NULL DEFAULT 2
                              CHECK (workers_per_day IN (1, 2)),
  template_path   text,
  manager_id      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "areas_select_authenticated" ON public.areas;

CREATE POLICY "areas_select_authenticated"
  ON public.areas FOR SELECT USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- Tabella: holidays
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.holidays (
  id        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  date      date    NOT NULL UNIQUE,
  name      text    NOT NULL,
  mandatory boolean NOT NULL DEFAULT false,
  year      integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)::integer) STORED
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holidays_select_authenticated" ON public.holidays;
DROP POLICY IF EXISTS "holidays_write_admin"           ON public.holidays;

CREATE POLICY "holidays_select_authenticated"
  ON public.holidays FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "holidays_write_admin"
  ON public.holidays FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- Tabella: month_status
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.month_status (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  month            integer     NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             integer     NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  status           text        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'locked', 'confirmed')),
  locked_by        uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  locked_at        timestamptz,
  email_inviata    boolean     NOT NULL DEFAULT false,
  email_inviata_at timestamptz,
  UNIQUE (month, year)
);

ALTER TABLE public.month_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "month_status_select_all"             ON public.month_status;
DROP POLICY IF EXISTS "month_status_insert_admin_manager"   ON public.month_status;
DROP POLICY IF EXISTS "month_status_update_admin_manager"   ON public.month_status;

CREATE POLICY "month_status_select_all"
  ON public.month_status FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "month_status_insert_admin_manager"
  ON public.month_status FOR INSERT WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "month_status_update_admin_manager"
  ON public.month_status FOR UPDATE
  USING  (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- ------------------------------------------------------------
-- Tabella: availability
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.availability (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date       date        NOT NULL,
  available  boolean     NOT NULL DEFAULT true,
  status     text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'locked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availability_select_own"           ON public.availability;
DROP POLICY IF EXISTS "availability_select_admin_manager" ON public.availability;
DROP POLICY IF EXISTS "availability_insert_own"           ON public.availability;
DROP POLICY IF EXISTS "availability_insert_admin_manager" ON public.availability;
DROP POLICY IF EXISTS "availability_update_own"           ON public.availability;
DROP POLICY IF EXISTS "availability_update_admin_manager" ON public.availability;
DROP POLICY IF EXISTS "availability_delete_own"           ON public.availability;
DROP POLICY IF EXISTS "availability_delete_admin_manager" ON public.availability;

CREATE POLICY "availability_select_own"
  ON public.availability FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "availability_select_admin_manager"
  ON public.availability FOR SELECT USING (public.is_admin_or_manager());

CREATE POLICY "availability_insert_own"
  ON public.availability FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "availability_insert_admin_manager"
  ON public.availability FOR INSERT WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "availability_update_own"
  ON public.availability FOR UPDATE
  USING  (auth.uid() = user_id AND status != 'locked')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "availability_update_admin_manager"
  ON public.availability FOR UPDATE
  USING  (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "availability_delete_own"
  ON public.availability FOR DELETE
  USING (auth.uid() = user_id AND status != 'locked');

CREATE POLICY "availability_delete_admin_manager"
  ON public.availability FOR DELETE USING (public.is_admin_or_manager());

-- ------------------------------------------------------------
-- Tabella: shifts
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shifts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date       date        NOT NULL,
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_nome  text,
  shift_type text        NOT NULL DEFAULT 'reperibilita'
                         CHECK (shift_type IN ('weekend', 'festivo', 'reperibilita')),
  created_by uuid        NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, user_id)
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_select_own"          ON public.shifts;
DROP POLICY IF EXISTS "shifts_select_admin_manager" ON public.shifts;
DROP POLICY IF EXISTS "shifts_write_admin_manager"  ON public.shifts;

CREATE POLICY "shifts_select_own"
  ON public.shifts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "shifts_select_admin_manager"
  ON public.shifts FOR SELECT USING (public.is_admin_or_manager());

CREATE POLICY "shifts_write_admin_manager"
  ON public.shifts FOR ALL
  USING  (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- ------------------------------------------------------------
-- Tabella: email_settings
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_settings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL UNIQUE,
  descrizione text,
  attivo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_settings_admin_manager" ON public.email_settings;

CREATE POLICY "email_settings_admin_manager"
  ON public.email_settings FOR ALL
  USING  (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- ------------------------------------------------------------
-- Funzione RPC: get_equity_scores
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_equity_scores(p_month integer, p_year integer)
RETURNS TABLE (
  user_id        uuid,
  nome           text,
  turni_totali   bigint,
  festivi_attivi bigint,
  score          bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    u.id,
    u.nome,
    COUNT(s.id)                                                         AS turni_totali,
    COUNT(CASE WHEN h.mandatory = true THEN 1 END)                      AS festivi_attivi,
    COUNT(s.id) + (COUNT(CASE WHEN h.mandatory = true THEN 1 END) * 2) AS score
  FROM public.users u
  LEFT JOIN public.shifts s ON u.id = s.user_id
    AND (p_month = 0 OR (
      EXTRACT(MONTH FROM s.date)::integer = p_month
      AND EXTRACT(YEAR  FROM s.date)::integer = p_year
    ))
  LEFT JOIN public.holidays h ON s.date = h.date AND h.mandatory = true
  WHERE u.ruolo = 'dipendente' AND u.attivo = true
  GROUP BY u.id, u.nome
  ORDER BY score ASC;
$$;

-- ------------------------------------------------------------
-- Riga default per areas
-- ------------------------------------------------------------

INSERT INTO public.areas (nome)
VALUES ('Default')
ON CONFLICT (nome) DO NOTHING;
