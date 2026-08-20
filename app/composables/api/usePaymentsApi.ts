import type { Paginated } from '~/types/api/common'
import type { Payment, PaymentMethod, PaymentStatus } from '~/types/api/subscriptions'
export function usePaymentsApi() {
  function listPayments(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Payment>>('/api/payments/', { params })
  }
  function recordPayment(payload: { subscription: string; customer: string; amount: string; payment_method: PaymentMethod; status?: PaymentStatus; renew_subscription?: boolean }) {
    return apiFetch<Payment>('/api/payments/', { method: 'POST', body: payload })
  }
  return { listPayments, recordPayment }
}
