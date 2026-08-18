import type { Paginated } from '~/types/api/common'
import type { Payment } from '~/types/api/subscriptions'

export function usePaymentsApi() {
  function listPayments(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Payment>>('/api/payments/', { params })
  }

  return { listPayments }
}
