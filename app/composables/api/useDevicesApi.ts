// Wraps every endpoint under `devices/urls.py` and `devices/views.py`
// EXCEPT the internal (Node-only) heartbeat/resolve/result endpoints under
// /api/internal/devices/ — the frontend never calls those directly, per the
// architecture rule that the frontend only ever talks to Django's public API.
//
// Permission note (DeviceOwnedPermission on the backend): Administrators
// get full CRUD on any device. Customers get read-only (GET) access, and
// ONLY for devices linked to their own customer profile — the backend
// filters listDevices()/getDevice() results to "own devices" automatically
// for a customer session, so no extra client-side filtering is needed.
import type { Paginated } from '~/types/api/common'
import type {
  DeviceCommand,
  DeviceConfiguration,
  DeviceConsoleCloseResult,
  DeviceConsoleOpenResult,
  DeviceConsoleWriteResult,
  DeviceDetail,
  DeviceListItem,
  DeviceMetric,
  DeviceMetricSummary,
  DeviceWritePayload,
} from '~/types/api/devices'

export function useDevicesApi() {
  // GET /api/devices/ — paginated, filterable (status, customer,
  // access_point, model, online, last_seen_after/before, has_location,
  // search=, ordering=). Pass any of those straight through in `params`.
  function listDevices(params: Record<string, string | number | boolean> = {}) {
    return apiFetch<Paginated<DeviceListItem>>('/api/devices/', { params })
  }

  // GET /api/devices/{id}/ — full detail, nests customer/access_point/
  // configuration/current_status.
  function getDevice(id: string) {
    return apiFetch<DeviceDetail>(`/api/devices/${id}/`)
  }

  // POST /api/devices/ — only `customer` and `device_name` are required;
  // every other field may be left unset and filled in later.
  function createDevice(payload: DeviceWritePayload) {
    return apiFetch<DeviceDetail>('/api/devices/', { method: 'POST', body: payload })
  }

  // PATCH /api/devices/{id}/ — partial update, same payload shape.
  function updateDevice(id: string, payload: Partial<DeviceWritePayload>) {
    return apiFetch<DeviceDetail>(`/api/devices/${id}/`, { method: 'PATCH', body: payload })
  }

  // POST /api/devices/my-location/ (Customer only) - saves coordinates
  // (typically from the browser's geolocation permission prompt) to the
  // calling customer's linked device. The backend 400s with a friendly
  // message if they aren't linked to any device yet.
  function setMyLocation(latitude: number, longitude: number) {
    return apiFetch<DeviceDetail>('/api/devices/my-location/', { method: 'POST', body: { latitude, longitude } })
  }

  function deleteDevice(id: string) {
    return apiFetch<void>(`/api/devices/${id}/`, { method: 'DELETE' })
  }

  // Soft-delete/restore - distinct from Device.status (ACTIVE/INACTIVE/
  // etc, a business/operational state). Deactivating drops the device out
  // of the default listing entirely; restore brings it back.
  function deactivateDevice(id: string) {
    return apiFetch<DeviceDetail>(`/api/devices/${id}/deactivate/`, { method: 'POST' })
  }
  function restoreDevice(id: string) {
    return apiFetch<DeviceDetail>(`/api/devices/${id}/restore/`, { method: 'POST' })
  }

  // Associate/remove an additional customer's access to this device -
  // independent of the device's primary `customer`. See the
  // DeviceCustomerAccess model on the backend.
  function addDeviceUser(id: string, customerId: string) {
    return apiFetch<DeviceDetail>(`/api/devices/${id}/add-user/`, { method: 'POST', body: { customer: customerId } })
  }
  function removeDeviceUser(id: string, customerId: string) {
    return apiFetch<DeviceDetail>(`/api/devices/${id}/remove-user/`, { method: 'POST', body: { customer: customerId } })
  }

  // GET /api/devices/{id}/metrics/ — historical time-series samples for
  // the "Signal & traffic, last 24h" charts on the device detail page.
  // Supports the same DeviceMetricFilter params (timestamp_after/before,
  // link_state) plus standard pagination.
  function getDeviceMetrics(id: string, params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<DeviceMetric>>(`/api/devices/${id}/metrics/`, { params })
  }

  // GET /api/devices/{id}/metrics/summary/?range=24h|7d — the History
  // page's data source. Pre-aggregated at the database level (24 hourly
  // buckets for '24h', 42 four-hourly buckets for '7d') — NOT the raw
  // per-10-second samples. Use getDeviceMetrics() above instead if raw,
  // unaggregated samples are ever needed for something else.
  function getDeviceMetricsSummary(id: string, range: '24h' | '7d') {
    return apiFetch<DeviceMetricSummary>(`/api/devices/${id}/metrics/summary/`, {
      params: { range },
    })
  }

  // Convenience wrapper: fetch devices that DO have a pinned location, for
  // the admin device-map page. Filters server-side (has_location=true)
  // rather than pulling the full list and filtering client-side.
  function listDevicesWithLocation() {
    return apiFetch<Paginated<DeviceListItem>>('/api/devices/', {
      params: { has_location: true, page_size: 200 },
    })
  }

  return {
    listDevices,
    getDevice,
    createDevice,
    updateDevice,
    deleteDevice,
    deactivateDevice,
    restoreDevice,
    addDeviceUser,
    removeDeviceUser,
    setMyLocation,
    getDeviceMetrics,
    getDeviceMetricsSummary,
    listDevicesWithLocation,
  }
}

export function useDeviceConfigurationApi() {
  // GET/PUT/PATCH only — configuration rows are auto-created alongside
  // their Device server-side, never created/deleted through this endpoint.
  function getConfiguration(id: string) {
    return apiFetch<DeviceConfiguration>(`/api/device-configurations/${id}/`)
  }
  function updateConfiguration(id: string, payload: Partial<DeviceConfiguration>) {
    return apiFetch<DeviceConfiguration>(`/api/device-configurations/${id}/`, {
      method: 'PATCH',
      body: payload,
    })
  }
  // List is mainly useful for looking up a device's configuration id by
  // device UUID (?device=<uuid>), since DeviceDetail already nests the
  // configuration object directly for the common case.
  function listConfigurations(params: Record<string, string> = {}) {
    return apiFetch<Paginated<DeviceConfiguration>>('/api/device-configurations/', { params })
  }
  return { getConfiguration, updateConfiguration, listConfigurations }
}

export function useDeviceCommandsApi() {
  // GET /api/device-commands/ — admin-only command queue/history. Filter
  // by device, status, or command_type.
  function listCommands(params: Record<string, string> = {}) {
    return apiFetch<Paginated<DeviceCommand>>('/api/device-commands/', { params })
  }

  // POST /api/device-commands/ — creates the command AND synchronously
  // attempts delivery through Node (see DeviceCommandViewSet.perform_create
  // on the backend). The response reflects whatever status Node returned
  // (SENT/COMPLETED/FAILED) or stays PENDING if Node was unreachable —
  // always re-fetch/poll rather than assuming success from a 201 alone.
  function createCommand(payload: {
    device: string
    command_type: DeviceCommand['command_type']
    payload?: Record<string, unknown>
  }) {
    return apiFetch<DeviceCommand>('/api/device-commands/', { method: 'POST', body: payload })
  }

  return { listCommands, createCommand }
}

// Raw shell console on a device (Administrator only — see
// devices/permissions.py DeviceConsolePermission). Nothing here is
// persisted: `terminal_id` only means anything to Node's own in-memory
// session map for the lifetime of that one session. Always call
// closeConsole when the console panel closes (including on unmount) —
// see components/domain/DeviceConsole.vue.
export function useDeviceConsoleApi() {
  // POST /api/devices/{id}/console/open/ — logs into the device's shell
  // with the given credentials (never stored) and returns a terminal_id
  // for the write/close calls below, plus whatever the device printed
  // while logging in.
  function openConsole(deviceId: string, username: string, password: string) {
    return apiFetch<DeviceConsoleOpenResult>(`/api/devices/${deviceId}/console/open/`, {
      method: 'POST',
      body: { username, password },
    })
  }

  // POST /api/devices/{id}/console/write/ — sends one line (a typed
  // command) to an already-open session and waits for the device's
  // response. `input` may be an empty string (pressing Enter with
  // nothing typed is a normal terminal action).
  function writeConsole(deviceId: string, terminalId: string, input: string) {
    return apiFetch<DeviceConsoleWriteResult>(`/api/devices/${deviceId}/console/write/`, {
      method: 'POST',
      body: { terminal_id: terminalId, input },
    })
  }

  // POST /api/devices/{id}/console/close/ — ends the session. Best-effort
  // on the backend (still returns 200 even if Node itself couldn't be
  // reached), so the frontend can always safely drop its local state
  // after calling this.
  function closeConsole(deviceId: string, terminalId: string) {
    return apiFetch<DeviceConsoleCloseResult>(`/api/devices/${deviceId}/console/close/`, {
      method: 'POST',
      body: { terminal_id: terminalId },
    })
  }

  return { openConsole, writeConsole, closeConsole }
}