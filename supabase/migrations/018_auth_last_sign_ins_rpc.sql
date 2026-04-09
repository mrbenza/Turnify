-- Migration 018: RPC controllata per leggere last_sign_in_at da auth.users

create or replace function public.get_auth_last_sign_ins(p_user_ids uuid[])
returns table (
  user_id uuid,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin_or_manager() then
    raise exception 'not authorized';
  end if;

  return query
  select
    au.id as user_id,
    au.last_sign_in_at
  from auth.users au
  where au.id = any(coalesce(p_user_ids, array[]::uuid[]));
end;
$$;

revoke all on function public.get_auth_last_sign_ins(uuid[]) from public;
grant execute on function public.get_auth_last_sign_ins(uuid[]) to authenticated;
