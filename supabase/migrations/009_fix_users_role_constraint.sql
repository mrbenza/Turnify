-- Aggiorna il check constraint sul campo ruolo della tabella users
-- Il constraint originale ammetteva solo ('admin', 'user')
-- Ora i ruoli validi sono: 'admin', 'manager', 'dipendente'

alter table public.users
  drop constraint if exists users_ruolo_check;

alter table public.users
  add constraint users_ruolo_check
  check (ruolo in ('admin', 'manager', 'dipendente'));

-- Aggiorna anche il default (era 'user')
alter table public.users
  alter column ruolo set default 'dipendente';
