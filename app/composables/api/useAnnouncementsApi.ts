import type { Paginated } from '~/types/api/common'
import type { Announcement } from '~/types/api/customer-domain'
export function useAnnouncementsApi() {
  function listAnnouncements(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Announcement>>('/api/announcements/', { params })
  }
  function createAnnouncement(payload: { title: string; message: string; is_active: boolean }) {
    return apiFetch<Announcement>('/api/announcements/', { method: 'POST', body: payload })
  }
  function updateAnnouncement(id: string, payload: Partial<{ title: string; message: string; is_active: boolean }>) {
    return apiFetch<Announcement>(`/api/announcements/${id}/`, { method: 'PATCH', body: payload })
  }
  return { listAnnouncements, createAnnouncement, updateAnnouncement }
}
