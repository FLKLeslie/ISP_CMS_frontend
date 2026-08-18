import type { Paginated } from '~/types/api/common'
import type { Suggestion, SuggestionCategory } from '~/types/api/customer-domain'

export function useSuggestionsApi() {
  function listSuggestions(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Suggestion>>('/api/suggestions/', { params })
  }

  function fetchSuggestion(id: string) {
    return apiFetch<Suggestion>(`/api/suggestions/${id}/`)
  }

  function createSuggestion(payload: { subject: string; category: SuggestionCategory; message: string }) {
    return apiFetch<Suggestion>('/api/suggestions/', { method: 'POST', body: payload })
  }

  return { listSuggestions, fetchSuggestion, createSuggestion }
}
