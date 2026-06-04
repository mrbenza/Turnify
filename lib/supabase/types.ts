// Tipi TypeScript che rispecchiano lo schema Supabase
// Aggiornare ogni volta che cambia SHEET_SCHEMA.md

export type UserRole = 'admin' | 'manager' | 'dipendente'
export type AvailabilityStatus = 'pending' | 'approved' | 'locked'
export type ShiftType = 'weekend' | 'festivo' | 'reperibilita'
export type MonthStatusValue = 'open' | 'locked' | 'confirmed'
export type SchedulingMode = 'weekend_full' | 'single_day' | 'sun_next_sat'
export type NotificationEventType = 'month_published' | 'month_republished' | 'test'
export type NotificationEventStatus = 'pending' | 'sending' | 'sent' | 'partial' | 'failed'
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed' | 'revoked'

export type User = {
  id: string
  nome: string
  email: string
  ruolo: UserRole
  attivo: boolean
  data_creazione: string
  disattivato_at: string | null
  last_login_at: string | null
  area_id: string | null
}

export type Holiday = {
  id: string
  date: string
  name: string
  mandatory: boolean
  year: number
}

export type MonthStatus = {
  id: string
  month: number
  year: number
  status: MonthStatusValue
  locked_by: string | null
  locked_at: string | null
  email_inviata: boolean
  email_inviata_at: string | null
  area_id: string
}

export type Availability = {
  id: string
  user_id: string
  date: string
  available: boolean
  status: AvailabilityStatus
  created_at: string
  updated_at: string
  area_id: string
}

export type Shift = {
  id: string
  date: string
  user_id: string
  user_nome: string | null
  shift_type: ShiftType
  reperibile_order: number
  created_by: string
  created_at: string
  area_id: string
}

export type EquityScore = {
  user_id: string
  nome: string
  turni_totali: number
  festivi: number
  score: number
}

export type Area = {
  id: string
  nome: string
  scheduling_mode: SchedulingMode
  workers_per_day: 1 | 2
  template_path: string | null
  manager_id: string | null
  storico_abilitato: boolean
  created_at: string
}

export type EmailSetting = {
  id: string
  email: string
  descrizione: string | null
  attivo: boolean
  area_id: string
  created_at: string
}

export type PushSubscription = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  expiration_time: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
  last_seen_at: string
  last_success_at: string | null
  failure_count: number
  revoked_at: string | null
}

export type NotificationEvent = {
  id: string
  event_type: NotificationEventType
  area_id: string | null
  month: number | null
  year: number | null
  publication_number: number | null
  created_by: string
  created_at: string
  status: NotificationEventStatus
  completed_at: string | null
  title: string | null
  body: string | null
  target_url: string | null
}

export type NotificationDelivery = {
  id: string
  event_id: string
  subscription_id: string | null
  user_id: string | null
  status: NotificationDeliveryStatus
  attempts: number
  last_attempt_at: string | null
  sent_at: string | null
  http_status: number | null
  error: string | null
}

// Tipo Database completo per il client Supabase tipizzato
// Aggiornare ogni volta che cambia lo schema Supabase (tabelle, funzioni, enum).
// Formato compatibile con @supabase/supabase-js v2.
export type Database = {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'data_creazione' | 'disattivato_at' | 'last_login_at'> & {
          disattivato_at?: string | null
          last_login_at?: string | null
        }
        Update: Partial<Omit<User, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'users_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
        ]
      }
      holidays: {
        Row: Holiday
        Insert: Omit<Holiday, 'id' | 'year'>
        Update: Partial<Omit<Holiday, 'id' | 'year'>>
        Relationships: []
      }
      month_status: {
        Row: MonthStatus
        Insert: Omit<MonthStatus, 'id' | 'email_inviata' | 'email_inviata_at'> & {
          email_inviata?: boolean
          email_inviata_at?: string | null
        }
        Update: Partial<Omit<MonthStatus, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'month_status_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
        ]
      }
      availability: {
        Row: Availability
        Insert: Omit<Availability, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Availability, 'id' | 'user_id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'availability_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
        ]
      }
      shifts: {
        Row: Shift
        Insert: Omit<Shift, 'id' | 'created_at'>
        Update: Partial<Omit<Shift, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'shifts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
        ]
      }
      email_settings: {
        Row: EmailSetting
        Insert: Omit<EmailSetting, 'id' | 'created_at'>
        Update: Partial<Omit<EmailSetting, 'id' | 'created_at'>>
        Relationships: []
      }
      areas: {
        Row: Area
        Insert: Omit<Area, 'id' | 'created_at'>
        Update: Partial<Omit<Area, 'id' | 'created_at'>>
        Relationships: []
      }
      push_subscriptions: {
        Row: PushSubscription
        Insert: Omit<
          PushSubscription,
          | 'id'
          | 'expiration_time'
          | 'user_agent'
          | 'created_at'
          | 'updated_at'
          | 'last_seen_at'
          | 'last_success_at'
          | 'failure_count'
          | 'revoked_at'
        > & {
          expiration_time?: string | null
          user_agent?: string | null
          last_seen_at?: string
          last_success_at?: string | null
          failure_count?: number
          revoked_at?: string | null
        }
        Update: Partial<Omit<PushSubscription, 'id' | 'user_id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      notification_events: {
        Row: NotificationEvent
        Insert: Omit<NotificationEvent, 'id' | 'created_at' | 'status' | 'completed_at' | 'title' | 'body' | 'target_url'> & {
          status?: NotificationEventStatus
          completed_at?: string | null
          title?: string | null
          body?: string | null
          target_url?: string | null
        }
        Update: Partial<Omit<NotificationEvent, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'notification_events_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_events_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      notification_deliveries: {
        Row: NotificationDelivery
        Insert: Omit<NotificationDelivery, 'id' | 'status' | 'attempts' | 'last_attempt_at' | 'sent_at' | 'http_status' | 'error'> & {
          status?: NotificationDeliveryStatus
          attempts?: number
          last_attempt_at?: string | null
          sent_at?: string | null
          http_status?: number | null
          error?: string | null
        }
        Update: Partial<Omit<NotificationDelivery, 'id' | 'event_id'>>
        Relationships: [
          {
            foreignKeyName: 'notification_deliveries_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'notification_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_deliveries_subscription_id_fkey'
            columns: ['subscription_id']
            isOneToOne: false
            referencedRelation: 'push_subscriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_deliveries_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_equity_scores: {
        Args: { p_month: number; p_year: number; p_area_id?: string }
        Returns: EquityScore[]
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      confirm_month_and_create_notification_event: {
        Args: {
          p_area_id: string
          p_month: number
          p_year: number
          p_created_by: string
        }
        Returns: NotificationEvent
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
