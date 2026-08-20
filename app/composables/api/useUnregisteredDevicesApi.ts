// Wraps /api/unregistered-devices/ (devices/urls.py ->
// UnregisteredDeviceSightingViewSet). Administrator-only, same as
// useAccessPointsApi — a customer session gets a 403 on every method here.
import type { Paginated } from '~/types/api/common'
import type { DeviceDetail, UnregisteredDeviceSighting } from '~/types/api/devices'

export function useUnregisteredDevicesApi() {
  // GET /api/unregistered-devices/ — defaults to no status filter server
  // side; pass { status: 'PENDING' } explicitly for the "needs review"
  // queue view, which is what the admin page uses by default.
  function listSightings(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<UnregisteredDeviceSighting>>('/api/unregistered-devices/', { params })
  }

  // POST /api/unregistered-devices/{id}/register/ — turns the sighting
  // into a real Device (mac_address is filled in server-side from the
  // sighting itself, never re-typed by the admin) and returns the full
  // DeviceDetail for the newly created device.
  function registerSighting(
    id: string,
    payload: {
      customer: string
      device_name: string
      access_point?: string | null
      notes?: string
    },
  ) {
    return apiFetch<DeviceDetail>(`/api/unregistered-devices/${id}/register/`, {
      method: 'POST',
      body: payload,
    })
  }

  // POST /api/unregistered-devices/{id}/discard/ — dismisses the sighting
  // with no Device created. Background heartbeats from this MAC keep
  // updating last_seen/sighting_count quietly, but the admin won't be
  // re-prompted about it (see the backend service function's docstring).
  function discardSighting(id: string) {
    return apiFetch<UnregisteredDeviceSighting>(`/api/unregistered-devices/${id}/discard/`, {
      method: 'POST',
    })
  }

  return { listSightings, registerSighting, discardSighting }
}