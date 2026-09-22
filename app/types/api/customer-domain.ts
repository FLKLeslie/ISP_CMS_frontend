import type { Payment, Plan } from './subscriptions'

export type NotificationType = 'SUBSCRIPTION' | 'PAYMENT' | 'ANNOUNCEMENT' | 'SUGGESTION' | 'CUSTOMER' | 'NETWORK' | 'GENERAL'
export interface AppNotification {
  id: string
  // null for an admin-broadcast entry (is_admin_broadcast=true) - e.g.
  // "new customer added", "new suggestion submitted" - which has no
  // single owning customer.
  customer: string | null; customer_name: string | null; is_admin_broadcast: boolean
  title: string; message: string
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
  active_plan: Plan | null; remaining_days: number
  // Exact seconds until the plan ends, and the exact moment (ISO). Use these,
  // not remaining_days, for anything shown - a short plan has 0 days left throughout.
  remaining_seconds: number; expiry_date: string | null
  // Precise end-of-day moment for expiry_date, in ISO 8601 - use this
  // (not expiry_date) for a live days/hours/minutes countdown.
  expires_at: string | null
  account_status: 'ACTIVE' | 'SUSPENDED'
  // True when there's no active subscription because an administrator
  // blocked the most recent one (see dashboard.views.CustomerDashboardView) -
  // distinct from simply never having subscribed.
  is_blocked: boolean; blocked_plan_name: string | null
  // False until an administrator links a router to the customer's account.
  // Without one they can't purchase a plan or be connected.
  router_allocated: boolean
  recent_payments: Payment[]; unread_notifications: number; latest_announcements: Announcement[]
}