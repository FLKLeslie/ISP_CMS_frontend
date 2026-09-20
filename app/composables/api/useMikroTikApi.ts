// Wraps /api/microtik/ (microtik/urls.py). Administrator-only for every
// method — a customer session gets a 403 on all of these, same as
// useAccessPointsApi. See microtik/internal_urls.py separately for the
// Node-facing endpoints this frontend never calls directly.
import type { Paginated } from '~/types/api/common'
import type {
  AllocatableCustomer, MikroTikCommand, MikroTikLease, MikroTikLeaseSummary, MikroTikRouter,
} from '~/types/api/microtik'

export function useMikroTikApi() {
  // GET /api/microtik/routers/ — filterable by status/access_point;
  // searchable by signature/identity/model.
  function listRouters(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<MikroTikRouter>>('/api/microtik/routers/', { params })
  }

  function getRouter(id: string) {
    return apiFetch<MikroTikRouter>(`/api/microtik/routers/${id}/`)
  }

  // The only field an admin can edit directly on a router — everything
  // else (identity/model/firmware/status) is populated by Node's verify
  // calls or the approve/reject actions below.
  function linkRouterToAccessPoint(id: string, accessPointId: string | null) {
    return apiFetch<MikroTikRouter>(`/api/microtik/routers/${id}/`, {
      method: 'PATCH', body: { access_point: accessPointId },
    })
  }

  function approveRouter(id: string) {
    return apiFetch<MikroTikRouter>(`/api/microtik/routers/${id}/approve/`, { method: 'POST' })
  }

  function rejectRouter(id: string) {
    return apiFetch<MikroTikRouter>(`/api/microtik/routers/${id}/reject/`, { method: 'POST' })
  }

  // GET /api/microtik/leases/ — every device each MikroTik knows about,
  // online AND offline. Filterable by router/mac_address/customer/
  // access_state, plus allocated=true|false and online=true|false.
  // Searchable by MAC/IP/hostname and customer name/email.
  function listLeases(params: Record<string, string | number | boolean> = {}) {
    return apiFetch<Paginated<MikroTikLease>>('/api/microtik/leases/', { params })
  }

  // GET /api/microtik/leases/summary/ — counts for the tab badges.
  function getLeaseSummary() {
    return apiFetch<MikroTikLeaseSummary>('/api/microtik/leases/summary/')
  }

  // GET /api/microtik/leases/allocatable-customers/ — customers with NO
  // router allocated yet: the only ones worth offering when allocating.
  // `search` matches name/email/phone; every word must match.
  function listAllocatableCustomers(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<AllocatableCustomer>>(
      '/api/microtik/leases/allocatable-customers/', { params },
    )
  }

  // Allocates an unallocated device to a customer, OR reallocates an
  // allocated one to a different customer (the previous customer's router
  // details are cleared server-side). Either way the customer's router
  // MAC/IP/hostname is backfilled so future reports match automatically.
  function allocateLease(id: string, customerId: string) {
    return apiFetch<MikroTikLease>(`/api/microtik/leases/${id}/allocate/`, {
      method: 'POST', body: { customer: customerId },
    })
  }

  // Removes the device's customer; it returns to the "needs allocation" queue.
  function unallocateLease(id: string) {
    return apiFetch<MikroTikLease>(`/api/microtik/leases/${id}/unallocate/`, { method: 'POST' })
  }

  // Block/reconnect ONE specific device, routed automatically to whichever
  // MikroTik it sits behind. Returns the updated lease (now PENDING) plus
  // the command audit record. The lease only settles to BLOCKED/ALLOWED
  // when a later router report confirms it. 409 if the previous command
  // for this device is still awaiting confirmation.
  function blockLease(id: string) {
    return apiFetch<{ lease: MikroTikLease; command: MikroTikCommand }>(
      `/api/microtik/leases/${id}/block/`, { method: 'POST' },
    )
  }

  function reconnectLease(id: string) {
    return apiFetch<{ lease: MikroTikLease; command: MikroTikCommand }>(
      `/api/microtik/leases/${id}/reconnect/`, { method: 'POST' },
    )
  }

  // GET /api/microtik/commands/ — filterable by status/command_type/router/customer.
  function listCommands(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<MikroTikCommand>>('/api/microtik/commands/', { params })
  }

  return {
    listRouters,
    getRouter,
    linkRouterToAccessPoint,
    approveRouter,
    rejectRouter,
    listLeases,
    getLeaseSummary,
    listAllocatableCustomers,
    allocateLease,
    unallocateLease,
    blockLease,
    reconnectLease,
    listCommands,
  }
}
