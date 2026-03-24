-- Migration 013: multi-area
-- Aggiunge area_id alle tabelle users, shifts, availability, month_status.
-- Tutti i record esistenti vengono assegnati all'area "Default".

DO $$
DECLARE
  default_area_id uuid;
BEGIN
  SELECT id INTO default_area_id FROM public.areas WHERE nome = 'Default';

  -- ----------------------------------------------------------------
  -- 1. users
  -- ----------------------------------------------------------------
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE RESTRICT;

  UPDATE public.users SET area_id = default_area_id WHERE area_id IS NULL;

  ALTER TABLE public.users ALTER COLUMN area_id SET NOT NULL;

  -- ----------------------------------------------------------------
  -- 2. shifts
  -- ----------------------------------------------------------------
  ALTER TABLE public.shifts
    ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE RESTRICT;

  UPDATE public.shifts SET area_id = default_area_id WHERE area_id IS NULL;

  ALTER TABLE public.shifts ALTER COLUMN area_id SET NOT NULL;

  -- ----------------------------------------------------------------
  -- 3. availability
  -- ----------------------------------------------------------------
  ALTER TABLE public.availability
    ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE RESTRICT;

  UPDATE public.availability SET area_id = default_area_id WHERE area_id IS NULL;

  ALTER TABLE public.availability ALTER COLUMN area_id SET NOT NULL;

  -- ----------------------------------------------------------------
  -- 4. month_status
  -- ----------------------------------------------------------------
  ALTER TABLE public.month_status
    ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE RESTRICT;

  UPDATE public.month_status SET area_id = default_area_id WHERE area_id IS NULL;

  ALTER TABLE public.month_status ALTER COLUMN area_id SET NOT NULL;

  -- Unique constraint: un solo record per (month, year, area)
  ALTER TABLE public.month_status DROP CONSTRAINT IF EXISTS month_status_month_year_key;
  ALTER TABLE public.month_status ADD CONSTRAINT month_status_month_year_area_key
    UNIQUE (month, year, area_id);

END $$;

-- ----------------------------------------------------------------
-- 5. Indici per le FK (performance query filtrate per area)
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_area_id        ON public.users(area_id);
CREATE INDEX IF NOT EXISTS idx_shifts_area_id       ON public.shifts(area_id);
CREATE INDEX IF NOT EXISTS idx_availability_area_id ON public.availability(area_id);
CREATE INDEX IF NOT EXISTS idx_month_status_area_id ON public.month_status(area_id);
