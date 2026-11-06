import type { Payment } from './subscriptions'
import type { Suggestion } from './customer-domain'
/** The dashboard sections an account may see (backend accounts/access.py: DASHBOARD_SECTIONS). */
export type DashboardSection =
  | 'customers' | 'subscriptions' | 'revenue' | 'payments' | 'devices' | 'access_points' | 'microtik'
  | 'unregistered' | 'suggestions'

export interface AdminDashboard {
  // Which sections below carry real data for THIS account; the rest are zeros / empty lists.
  // Show only these - a section the account may not see is not "0", it is not theirs.
  visible_sections: DashboardSection[]
  total_customers: number; active_customers: number; suspended_customers: number
  // Customers with zero currently-ACTIVE subscriptions.
  customers_without_active_plan: number
  active_subscriptions: number; expired_subscriptions: number; expiring_soon: number
  // Device link-state counts. devices_online + devices_offline +
  // devices_never_reported always sums to the total device count.
  devices_online: number; devices_offline: number; devices_never_reported: number
  // Counts behind the "x / y" tiles. devices_* are customer devices,
  // access_points_* are registered APs, mikrotik_* are APPROVED routers.
  // "Online" is recency-aware everywhere (a silent one doesn't count).
  devices_total: number
  access_points_online: number; access_points_total: number
  mikrotik_online: number; mikrotik_total: number
  total_revenue: string; monthly_revenue: string
  // Completed payments since 1 January of the current year.
  yearly_revenue: string
  recent_payments: Payment[]; latest_suggestions: Suggestion[]
  // Powers the "Unregistered Devices" sidebar badge.
  pending_unregistered_devices: number
}