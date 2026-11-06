<script setup lang="ts">
// SUPER ADMINISTRATOR ONLY. Create the people who run the system - another super administrator,
// an administrator, a technician or a financial manager - and decide EXACTLY what each of them
// may do:
//
//   * Pick a role: it pre-fills the permission checklist with what that kind of person normally
//     needs (the template).
//   * Tick extra permissions or untick ones they shouldn't have. What you save is exactly what
//     the account gets - the role is only a label and a starting point.
//   * A super administrator always has everything, so they get no checklist.
//
// People are never deleted, only deactivated, so the audit log always points at a real person.
// Every change made here is recorded in the audit log under your name.
import { ShieldCheck } from 'lucide-vue-next'
import type { StaffRole } from '~/types/api/auth'
import type { PasswordResetResult, StaffAccount } from '~/types/api/superadmin'

definePageMeta({ layout: 'admin' })
const { fetchPermissionCatalog, listStaff, createStaff, updateStaff, resetStaffPassword } = useSuperAdminApi()
const authStore = useAuthStore()

const { data: catalog, error: catalogError, refresh: refreshCatalog } = await useAsyncData('superadmin-permission-catalog', () => fetchPermissionCatalog())

// --- the list ----------------------------------------------------------------------------
const search = ref('')
const roleFilter = ref('')
const page = ref(1)
watch([search, roleFilter], () => { page.value = 1 })
const queryParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (search.value) params.search = search.value
  if (roleFilter.value) params.role = roleFilter.value
  return params
})
const { data, pending, error, refresh } = await useAsyncData('superadmin-staff', () => listStaff(queryParams.value), { watch: [queryParams] })
const rows = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)

const isMe = (row: StaffAccount) => row.uuid === authStore.user?.uuid
const fullName = (row: StaffAccount) => `${row.first_name} ${row.last_name}`.trim() || row.email
const roleOptions = STAFF_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))
const permissionSummary = (row: StaffAccount) => {
  if (row.role === 'SUPERADMIN') return 'Everything'
  const total = catalog.value?.permissions.length ?? 0
  return `${row.permissions.length}${total ? ` of ${total}` : ''}${row.uses_role_template ? ' (role default)' : ' (custom)'}`
}

// --- create / edit -----------------------------------------------------------------------
type Mode = { kind: 'create' } | { kind: 'edit'; account: StaffAccount } | null
const mode = ref<Mode>(null)
const saving = ref(false)
const formError = ref('')
const notice = ref('')

const form = reactive({
  email: '', first_name: '', last_name: '', phone_number: '',
  role: 'TECHNICIAN' as StaffRole, password: '', confirm_password: '', require_password_change: true,
})
const selected = ref<string[]>([])

const templateFor = (role: StaffRole): string[] => catalog.value?.role_templates[role] ?? []
const matchesTemplate = computed(() => form.role !== 'SUPERADMIN' && sameSelection(selected.value, templateFor(form.role)))
const isCreating = computed(() => mode.value?.kind === 'create')
const editingSelf = computed(() => mode.value?.kind === 'edit' && isMe(mode.value.account))

function startCreate() {
  Object.assign(form, { email: '', first_name: '', last_name: '', phone_number: '', role: 'TECHNICIAN', password: '', confirm_password: '', require_password_change: true })
  selected.value = [...templateFor('TECHNICIAN')]
  formError.value = ''; notice.value = ''
  mode.value = { kind: 'create' }
}
function startEdit(account: StaffAccount) {
  Object.assign(form, {
    email: account.email, first_name: account.first_name, last_name: account.last_name, phone_number: account.phone_number,
    role: account.role, password: '', confirm_password: '', require_password_change: true,
  })
  selected.value = account.role === 'SUPERADMIN' ? [] : [...account.permissions]
  formError.value = ''; notice.value = ''
  mode.value = { kind: 'edit', account }
}
function cancelForm() { mode.value = null; form.password = ''; form.confirm_password = '' }

// Choosing another role starts from THAT role's template (the server does the same when a role
// changes without permissions), so what's ticked always matches what the role normally means.
function onRoleChange(event: Event) {
  form.role = (event.target as HTMLSelectElement).value as StaffRole
  selected.value = form.role === 'SUPERADMIN' ? [] : [...templateFor(form.role)]
}
function resetToTemplate() { selected.value = [...templateFor(form.role)] }

async function save() {
  if (!mode.value || saving.value) return
  formError.value = ''
  if (mode.value.kind === 'create' && form.password !== form.confirm_password) { formError.value = "The two passwords don't match."; return }
  saving.value = true
  try {
    const top = form.role === 'SUPERADMIN'
    if (mode.value.kind === 'create') {
      const created = await createStaff({
        email: form.email, first_name: form.first_name, last_name: form.last_name, phone_number: form.phone_number, role: form.role,
        ...(top ? {} : { permissions: selected.value }),
        password: form.password, confirm_password: form.confirm_password, require_password_change: form.require_password_change,
      })
      notice.value = `${fullName(created)} was created${created.must_change_password ? ' and will be asked to choose a new password at first sign-in' : ''}.`
    } else {
      const updated = await updateStaff(mode.value.account.uuid, {
        first_name: form.first_name, last_name: form.last_name, phone_number: form.phone_number,
        ...(editingSelf.value ? {} : { role: form.role }), // your own role can't be changed here
        ...(top ? {} : { permissions: selected.value }),
      })
      notice.value = `${fullName(updated)} was updated. Changes apply to their next request.`
      if (isMe(updated)) authStore.setUser({ ...(authStore.user as NonNullable<typeof authStore.user>), first_name: updated.first_name, last_name: updated.last_name, phone_number: updated.phone_number })
    }
    mode.value = null
    await refresh()
  } catch (err) {
    formError.value = apiErrorMessage(err, "Couldn't save - check the details and try again.")
  } finally {
    saving.value = false
  }
}

// --- activate / deactivate ---------------------------------------------------------------
const deactivating = ref<StaffAccount | null>(null)
const toggling = ref(false)
async function setActive(account: StaffAccount, active: boolean) {
  toggling.value = true
  notice.value = ''
  try {
    await updateStaff(account.uuid, { is_active: active })
    notice.value = `${fullName(account)} was ${active ? 'reactivated' : 'deactivated'}.`
    await refresh()
  } catch (err) {
    notice.value = apiErrorMessage(err, `Couldn't ${active ? 'reactivate' : 'deactivate'} this account.`)
  } finally {
    toggling.value = false
    deactivating.value = null
  }
}

// --- reset password ----------------------------------------------------------------------
const resetting = ref<StaffAccount | null>(null)
const lastReset = ref<{ name: string; email: string; result: PasswordResetResult } | null>(null)
const submitReset = (payload: Parameters<typeof resetStaffPassword>[1]) => resetStaffPassword((resetting.value as StaffAccount).uuid, payload)
async function onReset(result: PasswordResetResult) {
  if (resetting.value) lastReset.value = { name: fullName(resetting.value), email: resetting.value.email, result }
  resetting.value = null
  await refresh()
}

const inputClass = 'w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent'
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Staff Accounts</h1>
        <p class="mt-1 max-w-2xl text-sm text-text-secondary">
          Create the people who run the system and choose exactly what each may do. Everything here is recorded in the audit log under your name.
        </p>
      </div>
      <button v-if="!mode" type="button" class="btn-primary" @click="startCreate">New staff account</button>
    </div>

    <p v-if="notice" role="status" class="rounded-card border border-success/30 bg-success/5 px-4 py-3 text-sm text-text-primary">{{ notice }}</p>
    <div v-if="lastReset" role="status" class="rounded-card border border-success/30 bg-success/5 px-4 py-3 text-sm text-text-primary">
      <p>
        <strong>{{ lastReset.name }}</strong> ({{ lastReset.email }}) has been reset. Their temporary password is
        <code class="rounded bg-text-secondary/10 px-1.5 py-0.5 font-semibold">{{ lastReset.result.default_password }}</code>.
        They must choose a new one when they sign in, and are signed out everywhere else.
      </p>
      <button type="button" class="mt-2 text-xs font-medium text-accent hover:underline" @click="lastReset = null">Dismiss</button>
    </div>
    <ErrorState v-if="catalogError" @retry="refreshCatalog()" />

    <!-- create / edit -->
    <form v-if="mode && catalog" class="space-y-5 rounded-card border border-border bg-surface p-5" @submit.prevent="save">
      <h2 class="text-base font-semibold text-text-primary">{{ isCreating ? 'New staff account' : `Edit ${form.first_name} ${form.last_name}` }}</h2>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label for="st_first" class="mb-1 block text-sm font-medium text-text-primary">First name</label>
          <input id="st_first" v-model="form.first_name" required :class="inputClass">
        </div>
        <div>
          <label for="st_last" class="mb-1 block text-sm font-medium text-text-primary">Last name</label>
          <input id="st_last" v-model="form.last_name" required :class="inputClass">
        </div>
        <div>
          <label for="st_email" class="mb-1 block text-sm font-medium text-text-primary">Email (their username)</label>
          <input id="st_email" v-model="form.email" type="email" required :disabled="!isCreating" autocomplete="off" :class="[inputClass, !isCreating && 'opacity-60']">
        </div>
        <div>
          <label for="st_phone" class="mb-1 block text-sm font-medium text-text-primary">Phone</label>
          <input id="st_phone" v-model="form.phone_number" type="tel" :class="inputClass">
        </div>
      </div>

      <div>
        <label for="st_role" class="mb-1 block text-sm font-medium text-text-primary">Role</label>
        <select id="st_role" :value="form.role" :disabled="editingSelf" :class="[inputClass, editingSelf && 'opacity-60']" @change="onRoleChange">
          <option v-for="option in roleOptions" :key="option.value" :value="option.value" :selected="option.value === form.role">{{ option.label }}</option>
        </select>
        <p class="mt-1 text-xs text-text-secondary">{{ ROLE_DESCRIPTIONS[form.role] }}</p>
        <p v-if="editingSelf" class="mt-1 text-xs text-text-secondary">You can't change your own role.</p>
        <p v-else-if="!isCreating" class="mt-1 text-xs text-text-secondary">Changing the role starts the permissions again from that role's defaults.</p>
      </div>

      <div v-if="isCreating" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <RevealPasswordInput id="st_pw" v-model="form.password" label="Starting password" autocomplete="new-password" :min-length="8" required />
          <p class="mt-1 text-xs text-text-secondary">At least 8 characters.</p>
        </div>
        <div>
          <RevealPasswordInput id="st_pw2" v-model="form.confirm_password" label="Repeat it" autocomplete="new-password" :min-length="8" required />
        </div>
        <label class="flex items-start gap-2 text-sm text-text-primary sm:col-span-2">
          <input v-model="form.require_password_change" type="checkbox" class="mt-0.5 rounded border-border">
          They must choose their own password the first time they sign in (recommended)
        </label>
      </div>

      <!-- what they may do -->
      <div v-if="form.role === 'SUPERADMIN'" class="rounded-card border border-border bg-text-secondary/5 px-4 py-3 text-sm text-text-secondary">
        A super administrator can do <strong class="text-text-primary">everything</strong>, including managing staff accounts, resetting passwords and reading the audit log. There's nothing to choose.
      </div>
      <div v-else class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-text-primary">What {{ form.first_name || 'this person' }} may do</h3>
          <div class="flex items-center gap-3 text-xs">
            <span :class="matchesTemplate ? 'text-text-secondary' : 'font-medium text-accent'">{{ matchesTemplate ? `Exactly the ${ROLE_LABELS[form.role].toLowerCase()} defaults` : 'Customised' }}</span>
            <button v-if="!matchesTemplate" type="button" class="font-medium text-accent hover:underline" @click="resetToTemplate">Reset to {{ ROLE_LABELS[form.role].toLowerCase() }} defaults</button>
          </div>
        </div>
        <PermissionPicker v-model="selected" :catalog="catalog" :disabled="saving" />
      </div>

      <p v-if="formError" role="alert" class="text-sm text-error">{{ formError }}</p>
      <div class="flex gap-2">
        <button type="submit" :disabled="saving" class="btn-primary">{{ saving ? 'Saving…' : isCreating ? 'Create account' : 'Save changes' }}</button>
        <button type="button" :disabled="saving" class="btn-secondary" @click="cancelForm">Cancel</button>
      </div>
    </form>

    <!-- the list -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput v-model="search" placeholder="Search by name, email or phone…" class="sm:max-w-sm" />
      <select v-model="roleFilter" aria-label="Filter by role" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary">
        <option value="">All roles</option>
        <option v-for="option in roleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </div>

    <LoadingState v-if="pending" :rows="5" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!rows.length" :icon="ShieldCheck" title="No staff accounts found" />
    <template v-else>
      <DataTable
        :columns="[{key:'person',label:'Person'},{key:'role',label:'Role'},{key:'access',label:'Permissions'},{key:'state',label:'State'},{key:'password',label:'Password'},{key:'login',label:'Last sign-in'},{key:'actions',label:''}]"
        :rows="rows" row-key="uuid"
      >
        <template #cell-person="{ row }">
          <span class="font-medium text-text-primary">{{ fullName(row) }}<span v-if="isMe(row)" class="ml-1 text-xs font-normal text-text-secondary">(you)</span></span>
          <span class="block break-all text-xs text-text-secondary">{{ row.email }}</span>
        </template>
        <template #cell-role="{ row }"><StatusBadge :label="ROLE_LABELS[row.role as StaffRole]" :tone="row.role === 'SUPERADMIN' ? 'info' : 'neutral'" /></template>
        <template #cell-access="{ row }">{{ permissionSummary(row) }}</template>
        <template #cell-state="{ row }">
          <div class="flex flex-wrap gap-1">
            <StatusBadge :label="row.is_active ? 'Active' : 'Deactivated'" :tone="row.is_active ? 'success' : 'error'" />
            <StatusBadge v-if="row.must_change_password" label="Must change password" tone="info" />
          </div>
        </template>
        <template #cell-password="{ row }"><PasswordStatus :must-change="row.must_change_password" /></template>
        <template #cell-login="{ row }">{{ row.last_login ? formatDateTime(row.last_login) : 'Never' }}</template>
        <template #cell-actions="{ row }">
          <div class="flex flex-wrap justify-end gap-1.5" @click.stop>
            <button type="button" class="btn-action-primary" :disabled="!!mode" @click="startEdit(row as StaffAccount)">Edit</button>
            <button v-if="!isMe(row)" type="button" class="btn-action-warning" @click="resetting = row as StaffAccount">Reset password</button>
            <template v-if="!isMe(row)">
              <button v-if="row.is_active" type="button" class="btn-action-danger" @click="deactivating = row as StaffAccount">Deactivate</button>
              <button v-else type="button" class="btn-action-success" :disabled="toggling" @click="setActive(row as StaffAccount, true)">Reactivate</button>
            </template>
          </div>
        </template>
      </DataTable>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>

    <ConfirmationDialog
      :open="!!deactivating" :title="`Deactivate ${deactivating ? fullName(deactivating) : ''}?`"
      description="They won't be able to sign in or do anything. Their history stays in the audit log, and you can reactivate them later."
      :confirm-label="toggling ? 'Please wait…' : 'Deactivate'" danger
      @confirm="deactivating && setActive(deactivating, false)" @cancel="deactivating = null"
    />
    <PasswordResetModal
      :open="!!resetting" kind="staff"
      :target-name="resetting ? fullName(resetting) : ''" :target-email="resetting?.email ?? ''"
      :submit="submitReset" @done="onReset" @cancel="resetting = null"
    />
  </div>
</template>
