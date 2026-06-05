alter table public.push_subscriptions
  add column if not exists client_mode text not null default 'browser',
  add column if not exists revoked_reason text,
  add column if not exists revoked_by uuid references public.users(id) on delete set null;

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_client_mode_check,
  add constraint push_subscriptions_client_mode_check
    check (client_mode in ('standalone', 'browser'));

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_revoked_reason_check,
  add constraint push_subscriptions_revoked_reason_check
    check (
      revoked_reason is null
      or revoked_reason in ('manual_user', 'manual_admin', 'push_service_gone')
    );

create index if not exists idx_push_subscriptions_standalone_active
  on public.push_subscriptions(user_id, last_seen_at)
  where revoked_at is null and client_mode = 'standalone';
