<script setup lang="ts">
// Staff-account view. Only the main superadmin can create or change another staff account.
// Superadmins can choose a role and configure permissions:
//
//   * Pick a role: it pre-fills the permission checklist with what that kind of person normally
//     needs (the template).
//   * Tick extra permissions or untick ones they shouldn't have. What you save is exactly what
//     the account gets - the role is only a label and a starting point.
//   * A super administrator always has everything, so they get no checklist.
//
// Staff changes are server-authorized and audited. Destructive account removal uses a
// staged confirmation procedure; the main-superadmin designation is protected.
import { ChevronDown, KeyRound, ShieldCheck, Star, Trash2, UserCog, UserCheck, UserX } from 'lucide-vue-next'
import type { StaffRole } from '~/types/api/auth'
import type { PasswordResetResult, StaffAccount } from '~/types/api/superadmin'

definePageMeta({ layout: 'admin' })
const { fetchPermissionCatalog, listStaff, createStaff, updateStaff, resetStaffPassword, deleteStaff, transferMainSuperadmin } = useSuperAdminApi()
const authStore = useAuthStore()
const isSuperadmin = computed(() => authStore.user?.role === 'SUPERADMIN')
const isMainSuperadmin = computed(() => !!authStore.user?.is_main_superadmin)
const canManageStaff = computed(() => isMainSuperadmin.value)
const openAccountId = ref<string | null>(null)

const { data: catalog, error: catalogError, refresh: refreshCatalog } = await useAsyncData('superadmin-permission-catalog', () => isSuperadmin.value ? fetchPermissionCatalog() : Promise.resolve(null))

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
const { data: candidateData, refresh: refreshCandidates } = await useAsyncData(
  'main-superadmin-transfer-candidates',
  () => listStaff({ role: 'SUPERADMIN', is_active: 'true', page_size: 100 }),
)
const transferCandidates = computed(() => (candidateData.value?.results ?? []).filter(row => row.uuid !== authStore.user?.uuid))
const transferTarget = ref<StaffAccount | null>(null)
const transferModalCandidates = computed(() => transferTarget.value ? [transferTarget.value] : transferCandidates.value)

const isMe = (row: StaffAccount) => row.uuid === authStore.user?.uuid
const fullName = (row: StaffAccount) => `${row.first_name} ${row.last_name}`.trim() || row.email
const roleOptions = STAFF_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))
const visibleRoleOptions = computed(() => roleOptions.filter(option => isSuperadmin.value || option.value === 'TECHNICIAN' || option.value === 'FINANCE'))
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
        email: form.email, first_name: form.first_name, last_name: form.last_name, phone_number: form.phone_number,
        ...(editingSelf.value || limitedStaffManagerEdit.value ? {} : { role: form.role }), // role/permission changes stay superadmin-only
        ...(top || limitedStaffManagerEdit.value ? {} : { permissions: selected.value }),
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

// --- staged delete and leadership transfer -----------------------------------------------
const deleting = ref<StaffAccount | null>(null)
const transferring = ref(false)
async function submitDelete(payload: Parameters<typeof deleteStaff>[1]) {
  if (!deleting.value) throw new Error('Choose a staff account first.')
  await deleteStaff(deleting.value.uuid, payload)
}
async function onDeleted() {
  const deletedName = deleting.value ? fullName(deleting.value) : 'Staff account'
  deleting.value = null
  notice.value = `${deletedName} was permanently deleted.`
  await refresh()
  await refreshCandidates()
}
async function submitTransfer(payload: Parameters<typeof transferMainSuperadmin>[0]) {
  transferring.value = true
  try { await transferMainSuperadmin(payload) }
  finally { transferring.value = false }
}
async function onTransferred() {
  transferring.value = false
  transferTarget.value = null
  mode.value = null
  notice.value = 'Main-superadmin authority was transferred successfully.'
  try { authStore.setUser(await useAuthApi().fetchProfile()) } catch { /* session remains; server checks authority */ }
  await refresh()
  await refreshCandidates()
}
function canDelete(row: StaffAccount) {
  return isMainSuperadmin.value && !isMe(row) && !row.is_main_superadmin
}
function canDeactivate(row: StaffAccount) {
  return isMainSuperadmin.value && !isMe(row) && !row.is_main_superadmin
}
function canEdit(row: StaffAccount) {
  return isMainSuperadmin.value && (!isMe(row) || row.is_main_superadmin)
}
const limitedStaffManagerEdit = computed(() => false)

const workflowOpen = computed(() => !!mode.value || !!deleting.value || !!deactivating.value || !!resetting.value || transferring.value)
function cancelOpenWorkflow() {
  mode.value = null
  deleting.value = null
  deactivating.value = null
  resetting.value = null
  transferring.value = false
  transferTarget.value = null
  form.password = ''
  form.confirm_password = ''
}
function toggleAccount(row: StaffAccount) {
  const isCurrentlyOpen = openAccountId.value === row.uuid
  if (workflowOpen.value) {
    if (saving.value || toggling.value) {
      window.alert('Please wait for the current account action to finish.')
      return
    }
    const cancelCurrent = window.confirm('An account action is open. Choose OK to cancel it and continue, or Cancel to finish the current action.')
    if (!cancelCurrent) return
    cancelOpenWorkflow()
  }
  openAccountId.value = isCurrentlyOpen ? null : row.uuid
}
function beginTransfer(row: StaffAccount) {
  transferTarget.value = row
  transferring.value = true
}
function cancelTransfer() {
  transferring.value = false
  transferTarget.value = null
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
          <span v-if="isSuperadmin">Review staff profiles and account access.</span>
          <span v-else>Review subordinate staff profiles.</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-if="isSuperadmin && !mode" type="button" class="btn-primary" @click="startCreate">New staff account</button>
      </div>
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
          <input id="st_email" v-model="form.email" type="email" required autocomplete="off" :class="inputClass">
        </div>
        <div>
          <label for="st_phone" class="mb-1 block text-sm font-medium text-text-primary">Phone</label>
          <input id="st_phone" v-model="form.phone_number" type="tel" :class="inputClass">
        </div>
      </div>

      <div v-if="!limitedStaffManagerEdit">
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
      <div v-if="limitedStaffManagerEdit" class="rounded-card border border-border bg-text-secondary/5 px-4 py-3 text-sm text-text-secondary">
        You can update this staff member's profile details. Role and access settings are not editable here.
      </div>
      <div v-else-if="form.role === 'SUPERADMIN'" class="rounded-card border border-border bg-text-secondary/5 px-4 py-3 text-sm text-text-secondary">
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
        <option v-for="option in visibleRoleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </div>

    <LoadingState v-if="pending" :rows="5" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!rows.length" :icon="ShieldCheck" title="No staff accounts found" />
    <div v-else class="space-y-3">
      <article v-for="row in rows" :key="row.uuid" class="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
        <button type="button" class="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-text-secondary/5 sm:px-5"
          :aria-expanded="openAccountId === row.uuid" @click="toggleAccount(row as StaffAccount)">
          <span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">{{ fullName(row).charAt(0).toUpperCase() }}
            <svg v-if="row.is_main_superadmin" class="absolute -right-1 -top-1 h-5 w-5 drop-shadow-[0_0_5px_rgba(255,204,51,0.9)]" viewBox="0 0 24 24" role="img" aria-label="Main superadministrator" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2 14.9 8.1 21.4 9.1 16.7 13.7 17.8 20.2 12 17.1 6.2 20.2 7.3 13.7 2.6 9.1 9.1 8.1Z" fill="#FFD84D" stroke="#FFF3A6" stroke-width="1.2" stroke-linejoin="round"/><path d="m9.3 8.8 2.7-4.3 2.7 4.3" fill="none" stroke="#FFFBE0" stroke-width="1" stroke-linecap="round"/></svg>
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-1.5 font-medium text-text-primary">
              {{ fullName(row) }}<span v-if="isMe(row)" class="text-xs font-normal text-text-secondary">(you)</span>
            </span>
            <span class="block break-all text-xs text-text-secondary">{{ row.email }}</span>
          </span>
          <span class="hidden items-center gap-2 sm:flex">
            <StatusBadge :label="ROLE_LABELS[row.role as StaffRole]" :tone="row.role === 'SUPERADMIN' ? 'info' : 'neutral'" />
            <StatusBadge :label="row.is_active ? 'Active' : 'Deactivated'" :tone="row.is_active ? 'success' : 'error'" />
          </span>
          <ChevronDown class="h-5 w-5 shrink-0 text-text-secondary transition-transform duration-200" :class="openAccountId === row.uuid ? 'rotate-180' : ''" aria-hidden="true" />
        </button>
        <Transition name="soft-dropdown">
          <section v-if="openAccountId === row.uuid" class="border-t border-border bg-background/60 px-4 py-4 sm:px-5" :aria-label="`${fullName(row)} account details`">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><p class="text-xs font-medium uppercase tracking-wide text-text-secondary">Role</p><p class="mt-1 text-sm text-text-primary">{{ ROLE_LABELS[row.role as StaffRole] }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-text-secondary">Phone</p><p class="mt-1 text-sm text-text-primary">{{ row.phone_number || 'Not provided' }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-text-secondary">Account status</p><p class="mt-1 text-sm text-text-primary">{{ row.is_active ? 'Active' : 'Deactivated' }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-text-secondary">Permissions</p><p class="mt-1 text-sm text-text-primary">{{ permissionSummary(row as StaffAccount) }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-text-secondary">Password status</p><div class="mt-1"><PasswordStatus :must-change="row.must_change_password" /></div></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-text-secondary">Last sign-in</p><p class="mt-1 text-sm text-text-primary">{{ row.last_login ? formatDateTime(row.last_login) : 'Never' }}</p></div>
              <div><p class="text-xs font-medium uppercase tracking-wide text-text-secondary">Created</p><p class="mt-1 text-sm text-text-primary">{{ formatDateTime(row.date_joined) }}</p></div>
            </div>
            <div class="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <button v-if="canEdit(row as StaffAccount)" type="button" class="btn-action-primary" @click="startEdit(row as StaffAccount)"><UserCog class="mr-1.5 inline h-4 w-4" />Edit account</button>
              <button v-if="canManageStaff && !isMe(row)" type="button" class="btn-action-warning" @click="resetting = row as StaffAccount"><KeyRound class="mr-1.5 inline h-4 w-4" />Reset password</button>
              <button v-if="isMainSuperadmin && row.role === 'SUPERADMIN' && !row.is_main_superadmin && !isMe(row)" type="button" class="btn-action-primary" @click="beginTransfer(row as StaffAccount)"><Star class="mr-1.5 inline h-4 w-4" />Grant main authority</button>
              <button v-if="canDeactivate(row as StaffAccount) && row.is_active" type="button" class="btn-action-danger" :disabled="toggling" @click="deactivating = row as StaffAccount"><UserX class="mr-1.5 inline h-4 w-4" />Deactivate</button>
              <button v-else-if="canDeactivate(row as StaffAccount) && !row.is_active" type="button" class="btn-action-success" :disabled="toggling" @click="setActive(row as StaffAccount, true)"><UserCheck class="mr-1.5 inline h-4 w-4" />Reactivate</button>
              <button v-if="canDelete(row as StaffAccount)" type="button" class="btn-action-danger" @click="deleting = row as StaffAccount"><Trash2 class="mr-1.5 inline h-4 w-4" />Delete account</button>
            </div>
          </section>
        </Transition>
      </article>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </div>

    <StaffDeleteProcedureModal :open="!!deleting" :target="deleting" :submit="submitDelete" @done="onDeleted" @cancel="deleting = null" />
    <MainSuperadminTransferModal :open="transferring" :candidates="transferModalCandidates" :submit="submitTransfer" @done="onTransferred" @cancel="cancelTransfer" />
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

<style scoped>
.soft-dropdown-enter-active,
.soft-dropdown-leave-active {
  transition: opacity 180ms ease, transform 180ms ease, max-height 220ms ease;
  transform-origin: top;
  overflow: hidden;
}
.soft-dropdown-enter-from,
.soft-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-5px);
  max-height: 0;
}
.soft-dropdown-enter-to,
.soft-dropdown-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 600px;
}
@media (prefers-reduced-motion: reduce) {
  .soft-dropdown-enter-active,
  .soft-dropdown-leave-active { transition: none; }
}
</style>
