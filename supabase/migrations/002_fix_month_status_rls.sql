-- Fix RLS month_status: la policy FOR ALL non copre INSERT correttamente
-- Eseguire su Supabase SQL Editor

drop policy if exists "month_status: solo admin scrive" on public.month_status;

create policy "month_status: admin inserisce" on public.month_status
  for insert with check (is_admin());

create policy "month_status: admin aggiorna" on public.month_status
  for update using (is_admin());

create policy "month_status: admin elimina" on public.month_status
  for delete using (is_admin());
