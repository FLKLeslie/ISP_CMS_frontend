import type { Payment } from './subscriptions'
import type { Suggestion } from './customer-domain'
export interface AdminDashboard {
  total_customers: number; active_customers: number; suspended_customers: number
  // Customers with zero currently-ACTIVE subscriptions.
  customers_without_active_plan: number
  active_subscriptions: number; expired_subscriptions: number; expiring_soon: number
  // Device link-state counts. devices_online + devices_offline +
  // devices_never_reported always sums to the total device count.
  devices_online: number; devices_offline: number; devices_never_reported: number
  total_revenue: string; monthly_revenue: string
  recent_payments: Payment[]; latest_suggestions: Suggestion[]
  // Powers the "Unregistered Devices" sidebar badge.
  pending_unregistered_devices: number
}