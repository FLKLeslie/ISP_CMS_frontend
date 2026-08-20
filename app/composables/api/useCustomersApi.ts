import type { Paginated } from '~/types/api/common'
import type { Customer, CustomerStatus } from '~/types/api/subscriptions'
export function useCustomersApi() {
  function listCustomers(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Customer>>('/api/customers/', { params })
  }
  function fetchCustomer(id: string) { return apiFetch<Customer>(`/api/customers/${id}/`) }
  function setCustomerStatus(id: string, status: CustomerStatus) {
    return apiFetch<Customer>(`/api/customers/${id}/`, { method: 'PATCH', body: { status } })
  }
  return { listCustomers, fetchCustomer, setCustomerStatus }
}
