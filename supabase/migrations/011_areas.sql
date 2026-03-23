-- Migration 011: tabella areas
-- Struttura predisposta per il futuro multi-area.
-- Per ora viene inserita una sola riga "Default" che raccoglie
-- la configurazione globale (scheduling_mode, workers_per_day).

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

-- Riga di default (upsert sicuro su nome)
INSERT INTO public.areas (nome)
VALUES ('Default')
ON CONFLICT (nome) DO NOTHING;

-- RLS: visibile a tutti gli utenti autenticati in lettura;
-- scrittura riservata ad admin e manager via service role nelle API.
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas_select_authenticated"
  ON public.areas FOR SELECT
  USING (auth.role() = 'authenticated');
