alter table public.notification_events
  drop constraint notification_events_event_type_check,
  drop constraint notification_events_month_check,
  drop constraint notification_events_year_check,
  drop constraint notification_events_publication_number_check;

alter table public.notification_events
  alter column area_id drop not null,
  alter column month drop not null,
  alter column year drop not null,
  alter column publication_number drop not null,
  add column title text,
  add column body text,
  add column target_url text,
  add constraint notification_events_event_type_check
    check (event_type in ('month_published', 'month_republished', 'test')),
  add constraint notification_events_month_check
    check (month is null or month between 1 and 12),
  add constraint notification_events_year_check
    check (year is null or year >= 2024),
  add constraint notification_events_publication_number_check
    check (publication_number is null or publication_number >= 1),
  add constraint notification_events_payload_check
    check (
      (
        event_type = 'test'
        and area_id is null
        and month is null
        and year is null
        and publication_number is null
        and title is not null
        and body is not null
      )
      or
      (
        event_type in ('month_published', 'month_republished')
        and area_id is not null
        and month is not null
        and year is not null
        and publication_number is not null
      )
    );
