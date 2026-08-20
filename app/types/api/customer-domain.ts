import type { Payment, Plan } from './subscriptions'

export type NotificationType = 'SUBSCRIPTION' | 'PAYMENT' | 'ANNOUNCEMENT' | 'GENERAL'
export interface AppNotification {
  id: string; customer: string; customer_name: string; title: string; message: string
  type: NotificationType; is_read: boolean; created_at: string; updated_at: string
}

export type SuggestionCategory = 'SUGGESTION' | 'COMPLAINT' | 'COMPLIMENT' | 'SUPPORT'
export type SuggestionStatus = 'PENDING' | 'REVIEWED' | 'RESPONDED' | 'CLOSED'
export interface Suggestion {
  id: string; customer: string; customer_name: string; subject: string; category: SuggestionCategory
  message: string; status: SuggestionStatus; admin_response: string
  responded_by: string | null; responded_by_name: string | null; responded_at: string | null
  created_at: string; updated_at: string
}

export interface Announcement {
  id: string; title: string; message: string; is_active: boolean
  created_by: string | null; created_by_name: string | null; created_at: string; updated_at: string
}

export interface CustomerDashboard {
  active_plan: Plan | null; remaining_days: number; expiry_date: string | null
  recent_payments: Payment[]; unread_notifications: number; latest_announcements: Announcement[]
}