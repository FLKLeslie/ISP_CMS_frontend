import type { User } from './auth'

export interface Plan {
  id: string; name: string; description: string; duration_days: number
  price: string; is_active: boolean; created_at: string; updated_at: string
}

export type CustomerStatus = 'ACTIVE' | 'SUSPENDED'
export interface Customer {
  id: string; user: User; address: string; city: string; country: string
  registration_date: string; status: CustomerStatus; created_at: string; updated_at: string
}

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
export interface Subscription {
  id: string; customer: Customer; plan: Plan; start_date: string; end_date: string
  amount_paid: string; status: SubscriptionStatus; remaining_days: number
  is_active: boolean; created_at: string; updated_at: string
}

export type PaymentMethod = 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY' | 'BANK'
export type PaymentStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED'
export interface Payment {
  id: string; subscription: Subscription; customer: Customer; amount: string
  payment_method: PaymentMethod; payment_reference: string; payment_date: string
  recorded_by: string | null; recorded_by_name: string | null; status: PaymentStatus
  created_at: string; updated_at: string
}
