// Wraps GET/POST .../credentials/ - available on BOTH /api/devices/{id}/
// and /api/access-points/{id}/ (devices.views.DeviceCredentialsActionMixin
// on the backend, mixed into both viewsets). Administrator only. GET
// deliberately returns the plaintext password - the point of this
// endpoint is that a stored device/AP password is viewable, not just
// settable.
import type { DeviceCredentials } from '~/types/api/devices'

export type CredentialsResource = 'devices' | 'access-points'

export function useDeviceCredentialsApi() {
  function getCredentials(resource: CredentialsResource, id: string) {
    return apiFetch<DeviceCredentials>(`/api/${resource}/${id}/credentials/`)
  }

  // Have Node generate a strong password itself and set it on the device/AP
  // right now - requires it to be currently connected (Node dispatches a
  // live command). `username` optionally renames the admin account too.
  function generateCredentials(resource: CredentialsResource, id: string, username?: string) {
    return apiFetch<DeviceCredentials>(`/api/${resource}/${id}/credentials/`, {
      method: 'POST',
      body: { mode: 'generate', ...(username ? { username } : {}) },
    })
  }

  // Set a specific admin-chosen password. Same live-connection requirement
  // as generateCredentials above.
  function setCredentials(resource: CredentialsResource, id: string, password: string, username?: string) {
    return apiFetch<DeviceCredentials>(`/api/${resource}/${id}/credentials/`, {
      method: 'POST',
      body: { mode: 'set', password, ...(username ? { username } : {}) },
    })
  }

  return { getCredentials, generateCredentials, setCredentials }
}
