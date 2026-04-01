// Tipi TypeScript che rispecchiano lo schema Supabase
// Aggiornare ogni volta che cambia SHEET_SCHEMA.md

export type UserRole = 'admin' | 'manager' | 'dipendente'
export type AvailabilityStatus = 'pending' | 'approved' | 'locked'
export type ShiftType = 'weekend' | 'festivo' | 'reperibilita'
export type MonthStatusValue = 'open' | 'locked' | 'confirmed'
export type SchedulingMode = 'weekend_full' | 'single_day' | 'sun_next_sat'

export type User = {
  id: string
  nome: string
  email: string
  ruolo: UserRole
  attivo: boolean
  data_creazione: string
  disattivato_at: string | null
  area_id: string
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

// Tipo Database completo per il client Supabase tipizzato
// Aggiornare ogni volta che cambia lo schema Supabase (tabelle, funzioni, enum).
// Formato compatibile con @supabase/supabase-js v2.
export type Database = {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'data_creazione' | 'disattivato_at'> & { disattivato_at?: string | null }
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
