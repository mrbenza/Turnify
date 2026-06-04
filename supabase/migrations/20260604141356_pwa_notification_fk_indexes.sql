create index idx_notification_events_created_by
  on public.notification_events(created_by);

create index idx_notification_deliveries_user_id
  on public.notification_deliveries(user_id);
