-- Migration 016: RLS area-aware per manager
-- Un manager può accedere SOLO ai dati della propria area,
-- anche se bypassa le API e chiama Supabase direttamente.

-- ============================================================
-- Helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_area_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT area_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND ruolo = 'manager' AND attivo = true
  )
$$;

-- ============================================================
-- SHIFTS
-- ============================================================
DROP POLICY IF EXISTS "shifts: utente vede i suoi"             ON public.shifts;
DROP POLICY IF EXISTS "shifts: admin o manager gestisce tutto" ON public.shifts;

-- Dipendente: vede solo i propri turni
CREATE POLICY "shifts: dipendente vede i suoi" ON public.shifts
  FOR SELECT USING (user_id = auth.uid());

-- Admin: accesso completo
CREATE POLICY "shifts: admin tutto" ON public.shifts
  FOR ALL USING (public.is_admin());

-- Manager: solo la propria area
CREATE POLICY "shifts: manager propria area" ON public.shifts
  FOR ALL USING (
    public.is_manager()
    AND area_id = public.current_user_area_id()
  );

-- ============================================================
-- AVAILABILITY
-- ============================================================
DROP POLICY IF EXISTS "availability: utente vede le sue"              ON public.availability;
DROP POLICY IF EXISTS "availability: utente inserisce pending"        ON public.availability;
DROP POLICY IF EXISTS "availability: utente aggiorna se pending"      ON public.availability;
DROP POLICY IF EXISTS "availability: admin o manager vede tutto"      ON public.availability;
DROP POLICY IF EXISTS "availability: admin o manager gestisce tutto"  ON public.availability;

-- Dipendente: gestisce solo le proprie
CREATE POLICY "availability: dipendente gestisce le sue" ON public.availability
  FOR ALL USING (user_id = auth.uid());

-- Admin: accesso completo
CREATE POLICY "availability: admin tutto" ON public.availability
  FOR ALL USING (public.is_admin());

-- Manager: solo la propria area
CREATE POLICY "availability: manager propria area" ON public.availability
  FOR ALL USING (
    public.is_manager()
    AND area_id = public.current_user_area_id()
  );

-- ============================================================
-- MONTH_STATUS
-- ============================================================
DROP POLICY IF EXISTS "month_status: tutti leggono"             ON public.month_status;
DROP POLICY IF EXISTS "month_status: admin o manager inserisce" ON public.month_status;
DROP POLICY IF EXISTS "month_status: admin o manager aggiorna"  ON public.month_status;
DROP POLICY IF EXISTS "month_status: admin o manager elimina"   ON public.month_status;

-- Autenticati leggono (serve per CalendarioGlobale dipendente)
CREATE POLICY "month_status: autenticati leggono" ON public.month_status
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin: accesso completo
CREATE POLICY "month_status: admin tutto" ON public.month_status
  FOR ALL USING (public.is_admin());

-- Manager: solo la propria area
CREATE POLICY "month_status: manager propria area" ON public.month_status
  FOR ALL USING (
    public.is_manager()
    AND area_id = public.current_user_area_id()
  );

-- ============================================================
-- USERS
-- Fix privilege escalation: manager ha solo SELECT sulla propria area.
-- Le scritture (INSERT/UPDATE/DELETE) passano tutte per serviceClient
-- lato API, che bypassa RLS con service_role key.
-- ============================================================
DROP POLICY IF EXISTS "users: legge se stesso"            ON public.users;
DROP POLICY IF EXISTS "users: admin o manager legge tutti" ON public.users;
DROP POLICY IF EXISTS "users: admin o manager gestisce"   ON public.users;
DROP POLICY IF EXISTS "users: admin tutto"                ON public.users;
DROP POLICY IF EXISTS "users: manager propria area"       ON public.users;

-- Ogni utente vede se stesso
CREATE POLICY "users: legge se stesso" ON public.users
  FOR SELECT USING (id = auth.uid());

-- Admin: accesso completo
CREATE POLICY "users: admin tutto" ON public.users
  FOR ALL USING (public.is_admin());

-- Manager: solo lettura sulla propria area (scritture via serviceClient in API)
CREATE POLICY "users: manager legge propria area" ON public.users
  FOR SELECT USING (
    public.is_manager()
    AND area_id = public.current_user_area_id()
  );

-- ============================================================
-- EMAIL_SETTINGS
-- ============================================================
DROP POLICY IF EXISTS "email_settings: admin o manager legge"     ON public.email_settings;
DROP POLICY IF EXISTS "email_settings: admin o manager inserisce" ON public.email_settings;
DROP POLICY IF EXISTS "email_settings: admin o manager aggiorna"  ON public.email_settings;
DROP POLICY IF EXISTS "email_settings: admin o manager elimina"   ON public.email_settings;

-- Admin: accesso completo
CREATE POLICY "email_settings: admin tutto" ON public.email_settings
  FOR ALL USING (public.is_admin());

-- Manager: solo la propria area
CREATE POLICY "email_settings: manager propria area" ON public.email_settings
  FOR ALL USING (
    public.is_manager()
    AND area_id = public.current_user_area_id()
  );
