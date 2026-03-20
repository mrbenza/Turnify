-- ============================================================
-- Fix RLS per ruolo 'manager'
-- Il manager deve avere le stesse capacità di lettura/scrittura
-- dell'admin (assegnare turni, vedere disponibilità, gestire utenti).
-- ============================================================

-- Helper: controlla se l'utente corrente è admin O manager
create or replace function is_admin_or_manager()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and ruolo in ('admin', 'manager')
      and attivo = true
  );
$$;

-- ============================================================
-- USERS: aggiungi lettura e gestione per manager
-- ============================================================
drop policy if exists "users: admin legge tutti" on public.users;
drop policy if exists "users: admin gestisce" on public.users;

create policy "users: admin o manager legge tutti" on public.users
  for select using (is_admin_or_manager());

create policy "users: admin o manager gestisce" on public.users
  for all using (is_admin_or_manager());

-- ============================================================
-- AVAILABILITY: aggiungi lettura completa per manager
-- ============================================================
drop policy if exists "availability: admin vede tutto" on public.availability;
drop policy if exists "availability: admin gestisce tutto" on public.availability;

create policy "availability: admin o manager vede tutto" on public.availability
  for select using (is_admin_or_manager());

create policy "availability: admin o manager gestisce tutto" on public.availability
  for all using (is_admin_or_manager());

-- ============================================================
-- SHIFTS: aggiungi gestione per manager
-- ============================================================
drop policy if exists "shifts: admin gestisce tutto" on public.shifts;

create policy "shifts: admin o manager gestisce tutto" on public.shifts
  for all using (is_admin_or_manager());

-- ============================================================
-- MONTH_STATUS: aggiungi scrittura per manager
-- ============================================================
drop policy if exists "month_status: admin inserisce" on public.month_status;
drop policy if exists "month_status: admin aggiorna" on public.month_status;
drop policy if exists "month_status: admin elimina" on public.month_status;

create policy "month_status: admin o manager inserisce" on public.month_status
  for insert with check (is_admin_or_manager());

create policy "month_status: admin o manager aggiorna" on public.month_status
  for update using (is_admin_or_manager());

create policy "month_status: admin o manager elimina" on public.month_status
  for delete using (is_admin_or_manager());
