<script setup lang="ts">
// The audit trail: who changed what, from where, and when. Needs the "View the audit log"
// permission (a super administrator always has it).
//
// Every change a member of staff makes is recorded by the server - which fields changed from what
// to what, who did it, their IP address and browser, and the request it was part of. Passwords,
// hashes and other secrets are never in it (only "(changed)"). Entries can't be edited or deleted.
// The "Request" reference ties an entry to the server's log lines and to the other entries made by
// the same click.
import { ScrollText } from 'lucide-vue-next'
import type { AuditEntry } from '~/types/api/superadmin'

definePageMeta({ layout: 'admin' })
const { listAuditLog } = useSuperAdminApi()

const search = ref('')
const actorRole = ref('')
const action = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const requestId = ref('')
const page = ref(1)
watch([search, actorRole, action, dateFrom, dateTo, requestId], () => { page.value = 1 })
const queryParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 25 }
  if (search.value) params.search = search.value
  if (actorRole.value) params.actor_role = actorRole.value
  if (action.value) params.action = action.value
  if (dateFrom.value) params.date_from = dateFrom.value
  if (dateTo.value) params.date_to = dateTo.value
  if (requestId.value) params.request_id = requestId.value
  return params
})
const filtersActive = computed(() => !!(search.value || actorRole.value || action.value || dateFrom.value || dateTo.value || requestId.value))
function clearFilters() { search.value = ''; actorRole.value = ''; action.value = ''; dateFrom.value = ''; dateTo.value = ''; requestId.value = '' }

const { data, pending, error, refresh } = await useAsyncData('audit-log', () => listAuditLog(queryParams.value), { watch: [queryParams] })
const entries = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)

type Tone = 'success' | 'warning' | 'error' | 'neutral' | 'info'
function toneFor(entry: AuditEntry): Tone {
  const a = entry.action
  if (a === 'API_DENIED' || a === 'API_ERROR' || a.endsWith('_REFUSED')) return 'error'
  if (a.includes('PASSWORD')) return 'warning'
  if (a === 'STAFF_LOGIN') return 'info'
  if (a.endsWith('.deleted')) return 'error'
  return 'neutral'
}
// "customer.updated" -> "Customer updated"; "CUSTOMER_PASSWORD_RESET" -> "Customer password reset"
function readableAction(action: string): string {
  const text = action.replace(/[._]/g, ' ').toLowerCase()
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

// Automatic entries carry {fields: {name: [before, after]}} (or {name: value} when created/deleted).
type FieldChange = { name: string; before?: unknown; after?: unknown; single?: unknown }
function fieldChanges(entry: AuditEntry): FieldChange[] {
  const fields = entry.changes?.fields
  if (!fields || typeof fields !== 'object') return []
  return Object.entries(fields as Record<string, unknown>).map(([name, value]) =>
    Array.isArray(value) && value.length === 2 ? { name, before: value[0], after: value[1] } : { name, single: value },
  )
}
function otherDetails(entry: AuditEntry): Record<string, unknown> {
  const { fields: _fields, ...rest } = entry.changes ?? {}
  return rest
}
const show = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value))

const inputClass = 'rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent'
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Audit Log</h1>
      <p class="mt-1 max-w-2xl text-sm text-text-secondary">
        Every change a member of staff makes is recorded here - who, what, when, and from where. Passwords and other secrets are never shown. Entries can't be edited or deleted.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SearchInput v-model="search" placeholder="Search action, person, record, address…" class="sm:col-span-2" />
      <select v-model="actorRole" aria-label="Filter by role" :class="inputClass">
        <option value="">Any role</option>
        <option v-for="role in STAFF_ROLES" :key="role" :value="role">{{ ROLE_LABELS[role] }}</option>
      </select>
      <input v-model="action" aria-label="Filter by action" placeholder="Action contains… (e.g. customer)" :class="inputClass">
      <label class="flex items-center gap-2 text-xs text-text-secondary">From <input v-model="dateFrom" type="date" :class="[inputClass, 'flex-1']"></label>
      <label class="flex items-center gap-2 text-xs text-text-secondary">To <input v-model="dateTo" type="date" :class="[inputClass, 'flex-1']"></label>
      <div v-if="requestId" class="flex items-center gap-2 text-xs text-text-secondary sm:col-span-2">
        Showing one request: <code class="rounded bg-text-secondary/10 px-1.5 py-0.5">{{ requestId.slice(0, 8) }}</code>
        <button type="button" class="font-medium text-accent hover:underline" @click="requestId = ''">Show all</button>
      </div>
      <button v-if="filtersActive" type="button" class="justify-self-start text-xs font-medium text-accent hover:underline" @click="clearFilters">Clear filters</button>
    </div>

    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!entries.length" :icon="ScrollText" title="No entries match" description="Try widening the dates or clearing the filters." />
    <template v-else>
      <p class="text-xs text-text-secondary">{{ data?.count }} entr{{ data?.count === 1 ? 'y' : 'ies' }}, newest first</p>
      <ul class="space-y-2">
        <li v-for="entry in entries" :key="entry.id" class="rounded-card border border-border bg-surface">
          <details class="group">
            <summary class="flex cursor-pointer list-none flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span class="w-40 shrink-0 text-xs text-text-secondary">{{ formatDateTime(entry.created_at) }}</span>
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-2">
                  <StatusBadge :label="readableAction(entry.action)" :tone="toneFor(entry)" />
                  <span class="truncate text-sm text-text-primary">{{ entry.target_type }}<span v-if="entry.target_repr"> · {{ entry.target_repr }}</span></span>
                </span>
                <span class="mt-0.5 block text-xs text-text-secondary">
                  by <strong class="font-medium text-text-primary">{{ entry.actor_name || entry.actor_email || 'the system' }}</strong>
                  <span v-if="entry.actor_role"> ({{ ROLE_LABELS[entry.actor_role as keyof typeof ROLE_LABELS] ?? entry.actor_role }})</span>
                  <span v-if="entry.ip_address"> · {{ entry.ip_address }}</span>
                </span>
              </span>
              <span class="shrink-0 text-xs text-text-secondary group-open:hidden">Details</span>
            </summary>

            <div class="space-y-3 border-t border-border px-4 py-3 text-sm">
              <div v-if="fieldChanges(entry).length" class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="text-text-secondary"><tr><th class="py-1 pr-4 font-medium">Field</th><th class="py-1 pr-4 font-medium">Before</th><th class="py-1 font-medium">After</th></tr></thead>
                  <tbody>
                    <tr v-for="change in fieldChanges(entry)" :key="change.name" class="border-t border-border align-top">
                      <td class="py-1 pr-4 font-medium text-text-primary">{{ change.name }}</td>
                      <template v-if="change.single !== undefined">
                        <td class="py-1 pr-4 text-text-secondary">—</td>
                        <td class="break-all py-1 text-text-primary">{{ show(change.single) }}</td>
                      </template>
                      <template v-else>
                        <td class="break-all py-1 pr-4 text-text-secondary">{{ show(change.before) }}</td>
                        <td class="break-all py-1 text-text-primary">{{ show(change.after) }}</td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
              <pre v-if="Object.keys(otherDetails(entry)).length" class="overflow-x-auto rounded-card bg-text-secondary/10 p-2 text-[11px] text-text-primary">{{ JSON.stringify(otherDetails(entry), null, 2) }}</pre>

              <dl class="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div><dt class="inline text-text-secondary">Who: </dt><dd class="inline break-all text-text-primary">{{ entry.actor_email || 'the system' }}</dd></div>
                <div v-if="entry.method"><dt class="inline text-text-secondary">Request: </dt><dd class="inline break-all text-text-primary">{{ entry.method }} {{ entry.path }}<span v-if="entry.status_code"> → {{ entry.status_code }}</span></dd></div>
                <div v-if="entry.user_agent" class="sm:col-span-2"><dt class="inline text-text-secondary">Browser: </dt><dd class="inline break-all text-text-primary">{{ entry.user_agent }}</dd></div>
                <div v-if="entry.target_id"><dt class="inline text-text-secondary">Record id: </dt><dd class="inline break-all text-text-primary">{{ entry.target_id }}</dd></div>
                <div v-if="entry.request_id">
                  <dt class="inline text-text-secondary">Reference: </dt>
                  <dd class="inline text-text-primary">
                    <code>{{ entry.request_id.slice(0, 8) }}</code>
                    <button type="button" class="ml-2 font-medium text-accent hover:underline" @click="requestId = entry.request_id">Show everything from this request</button>
                  </dd>
                </div>
              </dl>
            </div>
          </details>
        </li>
      </ul>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
