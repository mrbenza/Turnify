import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260604132549_pwa_notification_storage.sql'),
  'utf8',
).toLowerCase()

const indexesMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260604141356_pwa_notification_fk_indexes.sql'),
  'utf8',
).toLowerCase()

const testEventsMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260604213002_pwa_notification_test_events.sql'),
  'utf8',
).toLowerCase()

describe('PWA notification storage migration', () => {
  it('creates the three notification tables with anti-duplicate constraints', () => {
    expect(migration).toContain('create table public.push_subscriptions')
    expect(migration).toContain('create table public.notification_events')
    expect(migration).toContain('create table public.notification_deliveries')
    expect(migration).toContain('unique (area_id, month, year, publication_number)')
    expect(migration).toContain('unique (event_id, subscription_id)')
  })

  it('keeps notification data inaccessible to browser roles', () => {
    for (const table of [
      'push_subscriptions',
      'notification_events',
      'notification_deliveries',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`revoke all on table public.${table} from anon, authenticated`)
    }
  })

  it('restricts the atomic confirmation function to service_role', () => {
    expect(migration).toContain('create or replace function public.confirm_month_and_create_notification_event')
    expect(migration).toContain('security invoker')
    expect(migration).toContain('for update')
    expect(migration).toContain("if v_status <> 'locked'")
    expect(migration).toContain("set status = 'confirmed'")
    expect(migration).toContain('insert into public.notification_events')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to service_role')
  })

  it('indexes notification foreign keys used by cleanup and diagnostics', () => {
    expect(indexesMigration).toContain('idx_notification_events_created_by')
    expect(indexesMigration).toContain('idx_notification_deliveries_user_id')
  })

  it('supports diagnostic test events without faking a month publication', () => {
    expect(testEventsMigration).toContain("'month_republished', 'test'")
    expect(testEventsMigration).toContain('event_type = \'test\'')
    expect(testEventsMigration).toContain('add column title text')
    expect(testEventsMigration).toContain('add column body text')
  })
})
