import type { Paginated } from '~/types/api/common'
import type { AppNotification } from '~/types/api/customer-domain'

export function useNotificationsApi() {
  function listNotifications(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<AppNotification>>('/api/notifications/', { params })
  }

  function markRead(id: string) {
    return apiFetch<AppNotification>(`/api/notifications/${id}/mark-read/`, { method: 'POST' })
  }

  return { listNotifications, markRead }
}
