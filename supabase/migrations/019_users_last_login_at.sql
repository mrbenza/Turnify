-- Migration 019: denormalizza l'ultimo login in public.users

alter table public.users
add column if not exists last_login_at timestamptz null;

update public.users as u
set last_login_at = au.last_sign_in_at
from auth.users as au
where au.id = u.id
  and u.last_login_at is distinct from au.last_sign_in_at;
