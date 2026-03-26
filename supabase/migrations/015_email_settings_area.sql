-- Migration 015: aggiunge area_id a email_settings per isolamento per area

ALTER TABLE public.email_settings
ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE;

-- Backfill: assegna i record esistenti all'area Default
UPDATE public.email_settings
SET area_id = (SELECT id FROM public.areas WHERE nome = 'Default')
WHERE area_id IS NULL;

-- Rendi la colonna NOT NULL dopo il backfill
ALTER TABLE public.email_settings ALTER COLUMN area_id SET NOT NULL;

-- Indice per query rapide per area
CREATE INDEX IF NOT EXISTS idx_email_settings_area_id ON public.email_settings(area_id);
