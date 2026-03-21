// Tipi TypeScript che rispecchiano lo schema Supabase
// Aggiornare ogni volta che cambia SHEET_SCHEMA.md

export type UserRole = 'admin' | 'manager' | 'dipendente'
export type AvailabilityStatus = 'pending' | 'approved' | 'locked'
export type ShiftType = 'weekend' | 'festivo' | 'reperibilita'
export type MonthStatusValue = 'open' | 'approved' | 'locked' | 'confirmed'

export interface User {
  id: string
  nome: string
  email: string
  ruolo: UserRole
  attivo: boolean
  data_creazione: string
}

export interface Holiday {
  id: string
  date: string
  name: string
  mandatory: boolean
  year: number
}

export interface MonthStatus {
  id: string
  month: number
  year: number
  status: MonthStatusValue
  locked_by: string | null
  locked_at: string | null
  email_inviata: boolean
  email_inviata_at: string | null
}

export interface Availability {
  id: string
  user_id: string
  date: string
  available: boolean
  status: AvailabilityStatus
  created_at: string
  updated_at: string
}

export interface Shift {
  id: string
  date: string
  user_id: string
  shift_type: ShiftType
  created_by: string
  created_at: string
}

export interface EquityScore {
  user_id: string
  nome: string
  turni_totali: number
  festivi: number
  score: number
}

export interface EmailSetting {
  id: string
  email: string
  descrizione: string | null
  attivo: boolean
  created_at: string
}

// Tipo Database completo per il client Supabase tipizzato
export type Database = {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'data_creazione'>
        Update: Partial<Omit<User, 'id'>>
      }
      holidays: {
        Row: Holiday
        Insert: Omit<Holiday, 'id' | 'year'>
        Update: Partial<Omit<Holiday, 'id' | 'year'>>
      }
      month_status: {
        Row: MonthStatus
        Insert: Omit<MonthStatus, 'id'>
        Update: Partial<Omit<MonthStatus, 'id'>>
      }
      availability: {
        Row: Availability
        Insert: Omit<Availability, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Availability, 'id' | 'user_id' | 'created_at'>>
      }
      shifts: {
        Row: Shift
        Insert: Omit<Shift, 'id' | 'created_at'>
        Update: Partial<Omit<Shift, 'id' | 'created_at'>>
      }
      email_settings: {
        Row: EmailSetting
        Insert: Omit<EmailSetting, 'id' | 'created_at'>
        Update: Partial<Omit<EmailSetting, 'id' | 'created_at'>>
      }
    }
    Functions: {
      get_equity_scores: {
        Args: { p_month: number; p_year: number }
        Returns: EquityScore[]
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
  }
}
