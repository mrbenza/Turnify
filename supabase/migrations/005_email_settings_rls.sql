-- ============================================================
-- Tabella email_settings con RLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  descrizione text,
  attivo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- Solo admin può leggere e scrivere
CREATE POLICY "email_settings: solo admin legge" ON public.email_settings
  FOR SELECT USING (is_admin());

CREATE POLICY "email_settings: solo admin inserisce" ON public.email_settings
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "email_settings: solo admin aggiorna" ON public.email_settings
  FOR UPDATE USING (is_admin());

CREATE POLICY "email_settings: solo admin elimina" ON public.email_settings
  FOR DELETE USING (is_admin());
