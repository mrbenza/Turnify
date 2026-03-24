-- Migration 012: aggiunge reperibile_order a shifts
-- 1 = primo reperibile (colonna D nel foglio Excel)
-- 2 = secondo reperibile (colonna E nel foglio Excel)
ALTER TABLE public.shifts
  ADD COLUMN reperibile_order smallint NOT NULL DEFAULT 1
  CHECK (reperibile_order IN (1, 2));
