// Wraps /api/microtik/ (microtik/urls.py). Administrator-only for every
// method — a customer session gets a 403 on all of these, same as
// useAccessPointsApi. See microtik/internal_urls.py separately for the
// Node-facing endpoints this frontend never calls directly.
import type { Paginated } from '~/types/api/common'
import type { MikroTikCommand, MikroTikLease, MikroTikRouter } from '~/types/api/microtik'

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

  // GET /api/microtik/leases/ — the client routers each MikroTik can
  // see. Filterable by router/mac_address/customer/access_state, plus
  // allocated=true|false for the "not yet matched to a customer" review
  // queue. Searchable by mac_address/hostname/ip_address.
  function listLeases(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<MikroTikLease>>('/api/microtik/leases/', { params })
  }

  // Assigns an unallocated client router to a customer. This also
  // backfills the customer's router MAC/IP/hostname, so every future
  // report for this router matches them automatically.
  function allocateLease(id: string, customerId: string) {
    return apiFetch<MikroTikLease>(`/api/microtik/leases/${id}/allocate/`, {
      method: 'POST', body: { customer: customerId },
    })
  }

  // Block/reconnect ONE specific client router, routed automatically to
  // whichever MikroTik it sits behind. Returns the updated lease plus the
  // command audit record — note the command's "SENT" status only means
  // the request was queued for the router's next check-in, never that the
  // router confirmed applying it.
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
    allocateLease,
    blockLease,
    reconnectLease,
    listCommands,
  }
}
