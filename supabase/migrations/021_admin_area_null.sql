-- Migration 021: gli admin operano globalmente e non devono avere area assegnata

alter table public.users
alter column area_id drop not null;

update public.users
set area_id = null
where ruolo = 'admin'
  and area_id is not null;

alter table public.users
drop constraint if exists users_admin_area_null;

alter table public.users
add constraint users_admin_area_null
check (ruolo <> 'admin' or area_id is null);
