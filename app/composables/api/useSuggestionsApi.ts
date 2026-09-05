import type { Paginated } from '~/types/api/common'
import type { Suggestion, SuggestionCategory, SuggestionStatus } from '~/types/api/customer-domain'
export function useSuggestionsApi() {
  function listSuggestions(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Suggestion>>('/api/suggestions/', { params })
  }
  function fetchSuggestion(id: string) { return apiFetch<Suggestion>(`/api/suggestions/${id}/`) }
  function createSuggestion(payload: { subject: string; category: SuggestionCategory; message: string }) {
    return apiFetch<Suggestion>('/api/suggestions/', { method: 'POST', body: payload })
  }
  // Backend only allows this while the suggestion is still PENDING (not
  // yet viewed/reviewed by an administrator) - enforced server-side, not
  // just hidden here. Expect a 403 once it's been reviewed.
  function updateSuggestion(id: string, payload: { subject?: string; category?: SuggestionCategory; message?: string }) {
    return apiFetch<Suggestion>(`/api/suggestions/${id}/`, { method: 'PATCH', body: payload })
  }
  function deleteSuggestion(id: string) {
    return apiFetch<void>(`/api/suggestions/${id}/`, { method: 'DELETE' })
  }
  function respondToSuggestion(id: string, adminResponse: string, status: SuggestionStatus = 'RESPONDED') {
    return apiFetch<Suggestion>(`/api/suggestions/${id}/respond/`, { method: 'POST', body: { admin_response: adminResponse, status } })
  }
  return {
    listSuggestions, fetchSuggestion, createSuggestion,
    updateSuggestion, deleteSuggestion, respondToSuggestion,
  }
}
