// Wraps /api/unregistered-devices/ (devices/urls.py ->
// UnregisteredDeviceSightingViewSet). Administrator-only, same as
// useAccessPointsApi — a customer session gets a 403 on every method here.
import type { Paginated } from '~/types/api/common'
import type { AccessPoint, DeviceDetail, UnregisteredDeviceSighting } from '~/types/api/devices'

// The 409 the backend returns when a Device already exists for this
// sighting's MAC address (see devices.views.UnregisteredDeviceSightingViewSet.
// register) - carries enough detail to show the admin a proper confirmation
// before resubmitting with confirm_replace: true.
export interface RegisterConflict {
  existing_device_id: string
  existing_device_name: string
  existing_customer_name: string | null
  existing_is_deleted: boolean
}

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
  //
  // If a Device already exists for this MAC (almost always a leftover
  // from an earlier attempt on this same sighting), the backend refuses
  // with a 409 and a `conflict` payload (RegisterConflict) UNLESS
  // `confirmReplace` is true, in which case it adopts/overwrites that
  // existing device with the details given here. Callers should catch
  // the 409, show the admin what's being overwritten, and only resubmit
  // with confirmReplace: true once they've explicitly agreed.
  function registerSighting(
    id: string,
    payload: {
      customer: string
      device_name: string
      access_point?: string | null
      notes?: string
    },
    confirmReplace = false,
  ) {
    return apiFetch<DeviceDetail>(`/api/unregistered-devices/${id}/register/`, {
      method: 'POST',
      body: { ...payload, confirm_replace: confirmReplace },
    })
  }

  // POST /api/unregistered-devices/{id}/register-access-point/ — the
  // access-point counterpart to registerSighting. A sighting whose
  // wireless role is "access-point" is institution infrastructure, so it
  // becomes an AccessPoint record rather than a customer Device. Same
  // MAC-conflict/confirm_replace behaviour as registerSighting above.
  function registerSightingAsAccessPoint(
    id: string,
    payload: { name?: string; site?: string },
    confirmReplace = false,
  ) {
    return apiFetch<AccessPoint>(`/api/unregistered-devices/${id}/register-access-point/`, {
      method: 'POST',
      body: { ...payload, confirm_replace: confirmReplace },
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

  return { listSightings, registerSighting, registerSightingAsAccessPoint, discardSighting }
}