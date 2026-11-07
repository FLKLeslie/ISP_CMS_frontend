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
  <div class="mx-auto w-full max-w-7xl space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span class="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent"><ScrollText class="h-5 w-5" /></span>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Security & accountability</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Audit trail</h1>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">A chronological record of staff actions, account changes, and system events. Sensitive credentials are never displayed; audit entries cannot be edited or deleted.</p>
        </div>
      </div>
      <div v-if="data" class="rounded-xl border border-border bg-surface px-4 py-2.5">
        <p class="text-[11px] font-medium uppercase tracking-wide text-text-secondary">Matching records</p>
        <p class="text-xl font-semibold tabular-nums text-text-primary">{{ data.count }}</p>
      </div>
    </header>

    <section class="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-text-primary">Filter records</h2>
        <button v-if="filtersActive" type="button" class="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10" @click="clearFilters">Clear all filters</button>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SearchInput v-model="search" placeholder="Search people, action, record…" class="sm:col-span-2 xl:col-span-2" />
        <select v-model="actorRole" aria-label="Filter by role" :class="inputClass">
          <option value="">Any role</option>
          <option v-for="role in STAFF_ROLES" :key="role" :value="role">{{ ROLE_LABELS[role] }}</option>
        </select>
        <input v-model="action" aria-label="Filter by action" placeholder="Action contains…" :class="inputClass">
        <div class="flex items-center gap-2">
          <label class="min-w-0 flex-1 text-xs text-text-secondary">From<input v-model="dateFrom" type="date" aria-label="From date" :class="[inputClass, 'mt-1 w-full']"></label>
          <label class="min-w-0 flex-1 text-xs text-text-secondary">To<input v-model="dateTo" type="date" aria-label="To date" :class="[inputClass, 'mt-1 w-full']"></label>
        </div>
      </div>
      <div v-if="requestId" class="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-text-secondary">
        <span>Scoped to request</span><code class="rounded-md bg-background px-2 py-1 font-semibold text-text-primary">{{ requestId.slice(0, 8) }}</code>
        <button type="button" class="font-semibold text-accent hover:underline" @click="requestId = ''">Show all records</button>
      </div>
    </section>

    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!entries.length" :icon="ScrollText" title="No audit records found" description="Try widening the date range or clearing one or more filters." />
    <template v-else>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-medium text-text-secondary">Newest first <span class="mx-1.5">·</span> {{ data?.count }} total record{{ data?.count === 1 ? '' : 's' }}</p>
        <p class="text-xs text-text-secondary">Page {{ page }} of {{ totalPages }}</p>
      </div>
      <ul class="space-y-3">
        <li v-for="entry in entries" :key="entry.id" class="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
          <details class="group">
            <summary class="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
              <div class="flex shrink-0 items-center gap-2 sm:w-44">
                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-text-secondary/5 text-text-secondary"><ScrollText class="h-4 w-4" /></span>
                <span class="text-xs leading-5 text-text-secondary">{{ formatDateTime(entry.created_at) }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <StatusBadge :label="readableAction(entry.action)" :tone="toneFor(entry)" />
                  <span class="min-w-0 truncate text-sm font-semibold text-text-primary">{{ entry.target_type }}<span v-if="entry.target_repr" class="font-normal text-text-secondary"> · {{ entry.target_repr }}</span></span>
                </div>
                <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
                  <span class="font-medium text-text-primary">{{ entry.actor_name || entry.actor_email || 'System' }}</span>
                  <span v-if="entry.actor_role" class="rounded-md bg-text-secondary/5 px-1.5 py-0.5">{{ ROLE_LABELS[entry.actor_role as keyof typeof ROLE_LABELS] ?? entry.actor_role }}</span>
                  <span v-if="entry.ip_address" class="font-mono">{{ entry.ip_address }}</span>
                </p>
              </div>
              <span class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-secondary group-open:hidden">Inspect <icon name="chevron-down" size="xs" /></span>
              <span class="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-secondary group-open:inline-flex">Collapse <icon name="chevron-up" size="xs" /></span>
            </summary>

            <div class="space-y-4 border-t border-border bg-background/50 px-4 py-4 sm:px-5">
              <div v-if="fieldChanges(entry).length" class="overflow-hidden rounded-xl border border-border bg-surface">
                <div class="border-b border-border px-3 py-2"><h3 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Changed fields</h3></div>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[480px] text-left text-xs">
                    <thead class="bg-text-secondary/5 text-text-secondary"><tr><th class="px-3 py-2 font-semibold">Field</th><th class="px-3 py-2 font-semibold">Before</th><th class="px-3 py-2 font-semibold">After</th></tr></thead>
                    <tbody>
                      <tr v-for="change in fieldChanges(entry)" :key="change.name" class="border-t border-border align-top">
                        <td class="px-3 py-2 font-semibold text-text-primary">{{ change.name }}</td>
                        <template v-if="change.single !== undefined"><td class="px-3 py-2 text-text-secondary">—</td><td class="break-all px-3 py-2 text-text-primary">{{ show(change.single) }}</td></template>
                        <template v-else><td class="break-all px-3 py-2 text-text-secondary">{{ show(change.before) }}</td><td class="break-all px-3 py-2 text-text-primary">{{ show(change.after) }}</td></template>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div v-if="Object.keys(otherDetails(entry)).length" class="overflow-hidden rounded-xl border border-border bg-surface">
                <div class="border-b border-border px-3 py-2"><h3 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Additional context</h3></div>
                <pre class="max-h-64 overflow-auto p-3 text-[11px] leading-5 text-text-primary">{{ JSON.stringify(otherDetails(entry), null, 2) }}</pre>
              </div>
              <dl class="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-3 text-xs sm:grid-cols-2">
                <div><dt class="mb-1 font-semibold uppercase tracking-wide text-text-secondary">Actor email</dt><dd class="break-all text-text-primary">{{ entry.actor_email || 'System' }}</dd></div>
                <div v-if="entry.method"><dt class="mb-1 font-semibold uppercase tracking-wide text-text-secondary">Request</dt><dd class="break-all text-text-primary">{{ entry.method }} {{ entry.path }}<span v-if="entry.status_code"> → {{ entry.status_code }}</span></dd></div>
                <div v-if="entry.user_agent" class="sm:col-span-2"><dt class="mb-1 font-semibold uppercase tracking-wide text-text-secondary">Browser</dt><dd class="break-all text-text-primary">{{ entry.user_agent }}</dd></div>
                <div v-if="entry.target_id"><dt class="mb-1 font-semibold uppercase tracking-wide text-text-secondary">Record ID</dt><dd class="break-all font-mono text-text-primary">{{ entry.target_id }}</dd></div>
                <div v-if="entry.request_id"><dt class="mb-1 font-semibold uppercase tracking-wide text-text-secondary">Request reference</dt><dd class="break-all text-text-primary"><code>{{ entry.request_id.slice(0, 8) }}</code><button type="button" class="ml-2 font-semibold text-accent hover:underline" @click="requestId = entry.request_id">View related entries</button></dd></div>
              </dl>
            </div>
          </details>
        </li>
      </ul>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
