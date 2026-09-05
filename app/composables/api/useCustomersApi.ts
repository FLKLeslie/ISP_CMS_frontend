import type { Paginated } from '~/types/api/common'
import type { Customer, CustomerStatus } from '~/types/api/subscriptions'

export interface CustomerCreatePayload {
  email: string; first_name: string; last_name: string; password: string
  phone_number?: string; address?: string; city?: string; country?: string
  router_ip?: string | null; status?: CustomerStatus
}
// address/city/country/router_ip/status are editable by the customer
// themself or an admin. first_name/last_name/email/phone_number are
// admin-only - the backend rejects them from a non-admin with a 400 (see
// customers.serializers.CustomerSerializer.update on the backend).
export interface CustomerUpdatePayload extends Partial<
  Pick<Customer, 'address' | 'city' | 'country' | 'router_ip' | 'status'>
> {
  first_name?: string; last_name?: string; email?: string; phone_number?: string
}

export function useCustomersApi() {
  function listCustomers(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Customer>>('/api/customers/', { params })
  }
  function fetchCustomer(id: string) { return apiFetch<Customer>(`/api/customers/${id}/`) }
  function createCustomer(payload: CustomerCreatePayload) {
    return apiFetch<Customer>('/api/customers/', { method: 'POST', body: payload })
  }
  function updateCustomer(id: string, payload: CustomerUpdatePayload) {
    return apiFetch<Customer>(`/api/customers/${id}/`, { method: 'PATCH', body: payload })
  }
  function setCustomerStatus(id: string, status: CustomerStatus) {
    return apiFetch<Customer>(`/api/customers/${id}/`, { method: 'PATCH', body: { status } })
  }
  // POST /api/customers/{id}/block-internet/ (Administrator only) - cuts
  // this customer's internet by deactivating their current active
  // subscription. Distinct from suspending the account (setCustomerStatus)
  // - a customer can still log in after this, they just have no service.
  function blockInternet(id: string) {
    return apiFetch<Customer>(`/api/customers/${id}/block-internet/`, { method: 'POST' })
  }
  return {
    listCustomers, fetchCustomer, createCustomer, updateCustomer,
    setCustomerStatus, blockInternet,
  }
}