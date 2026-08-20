import type { Paginated } from '~/types/api/common'
import type { AppNotification, NotificationType } from '~/types/api/customer-domain'
export function useNotificationsApi() {
  function listNotifications(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<AppNotification>>('/api/notifications/', { params })
  }
  function markRead(id: string) { return apiFetch<AppNotification>(`/api/notifications/${id}/mark-read/`, { method: 'POST' }) }
  function sendNotification(payload: { customer: string; title: string; message: string; type: NotificationType }) {
    return apiFetch<AppNotification>('/api/notifications/', { method: 'POST', body: payload })
  }
  return { listNotifications, markRead, sendNotification }
}
