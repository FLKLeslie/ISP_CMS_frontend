<script setup lang="ts">
// Every member of staff's own page: who they are, what their account may do, and - the reason
// it can never be locked away from anyone - the form to change their own password.
//
// It is also where an account is held after a super administrator reset it to the default
// password (or created it with a starting one): until a new password is chosen this is the only
// page that works (utils/authPaths.ts, and the server refuses everything else).
definePageMeta({ layout: 'admin' })
const { changePassword, updateProfile } = useAuthApi()
const authStore = useAuthStore()

const user = computed(() => authStore.user)
const roleLabel = computed(() => (user.value ? ROLE_LABELS[user.value.role] : ''))
const isTop = computed(() => isSuperAdmin(user.value?.role))
// "devices.manage" -> "Devices · manage" (the picker the super administrator used has the full descriptions)
const visiblePermissions = computed(() => (user.value?.permissions ?? []).filter(key => !key.startsWith('audit.')))
const prettyPermission = (key: string) => {
  const [area, action] = key.split('.')
  const name = (area ?? key).replace(/_/g, ' ')
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}${action ? ` · ${action}` : ''}`
}

const oldPassword = ref(''); const newPassword = ref(''); const confirmPassword = ref('')
const changing = ref(false); const error = ref(''); const success = ref(false)
const showPasswordForm = ref(authStore.mustChangePassword)
const firstName = ref(authStore.user?.first_name ?? '')
const lastName = ref(authStore.user?.last_name ?? '')
const savingProfile = ref(false); const profileError = ref(''); const profileSuccess = ref(false)
async function saveProfile() {
  profileError.value = ''; profileSuccess.value = false; savingProfile.value = true
  try { authStore.setUser(await updateProfile({ first_name: firstName.value.trim(), last_name: lastName.value.trim() })); profileSuccess.value = true }
  catch { profileError.value = 'Could not update your name. Please try again.' }
  finally { savingProfile.value = false }
}
watch(() => authStore.mustChangePassword, (mustChange) => {
  if (mustChange) showPasswordForm.value = true
}, { immediate: true })

async function handleChangePassword() {
  error.value = ''; success.value = false
  if (newPassword.value !== confirmPassword.value) {
    error.value = "The new passwords don't match."
    return
  }
  changing.value = true
  const wasForced = authStore.mustChangePassword
  try {
    await changePassword(oldPassword.value, newPassword.value)
    oldPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
    success.value = true
    authStore.markPasswordChanged() // lifts the hold; the menu comes back
    if (authStore.user) {
      // Go to the first page this account may open (its dashboard, normally) after a forced change.
      if (wasForced) await navigateTo(homeFor(authStore.user))
    }
  } catch (err) {
    const message = apiErrorMessage(err, '')
    error.value = message.includes('default one')
      ? 'Please choose a password other than the default one.'
      : "Couldn't change your password - check your current password and try again."
  } finally {
    changing.value = false
  }
}

const inputClass = 'w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent'
</script>

<template>
  <div class="w-full space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">My Account</h1>

    <p v-if="authStore.mustChangePassword" role="alert" class="rounded-card border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-primary">
      Your password was set for you (a starting password, or reset by a super administrator). Choose your own below to continue -
      nothing else is available until you do.
    </p>

    <div v-if="user" class="space-y-4 w-full rounded-card border border-border bg-surface p-5">
      <h2 class="text-sm font-semibold text-text-primary">Profile</h2>
      <form class="grid grid-cols-1 gap-3 sm:grid-cols-2" @submit.prevent="saveProfile">
        <label class="text-xs text-text-secondary">First name<input v-model="firstName" maxlength="150" required class="mt-1 w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary" /></label>
        <label class="text-xs text-text-secondary">Last name<input v-model="lastName" maxlength="150" required class="mt-1 w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary" /></label>
        <div><dt class="text-xs text-text-secondary">Email (username)</dt><dd class="mt-1 break-all text-sm text-text-primary">{{ user.email }}</dd><p class="mt-1 text-xs text-text-secondary">Email changes are managed by the main superadministrator.</p></div>
        <div><dt class="text-xs text-text-secondary">Role</dt><dd class="mt-1 text-sm text-text-primary">{{ roleLabel }}</dd></div>
        <p v-if="profileError" class="text-sm text-danger sm:col-span-2">{{ profileError }}</p><p v-if="profileSuccess" class="text-sm text-success sm:col-span-2">Name updated.</p>
        <div class="sm:col-span-2"><button type="submit" class="btn-primary" :disabled="savingProfile">{{ savingProfile ? 'Saving…' : 'Save name' }}</button></div>
      </form>
    </div>

    <div v-if="user && !authStore.mustChangePassword" class="space-y-3 rounded-card border border-border bg-surface p-5">
      <h2 class="text-sm font-semibold text-text-primary">What your account can do</h2>
      <p v-if="isTop" class="text-sm text-text-secondary">As a super administrator you can do everything, including managing staff accounts and their permissions, resetting passwords and reading the audit log.</p>
      <template v-else>
        <p class="text-sm text-text-secondary">Available features</p>
        <ul v-if="visiblePermissions.length" class="flex flex-wrap gap-2">
          <li v-for="key in visiblePermissions" :key="key" class="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-text-primary">{{ prettyPermission(key) }}</li>
        </ul>
        <p v-else class="text-sm text-text-secondary">No additional features are currently available.</p>
      </template>
    </div>

    <div v-if="!authStore.mustChangePassword" class="rounded-card border border-border bg-surface">
      <button type="button" class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-text-primary transition hover:bg-text-secondary/5" @click="showPasswordForm = !showPasswordForm">
        <span>Change password</span>
        <span class="text-xs text-text-secondary">{{ showPasswordForm ? 'Hide' : 'Show' }}</span>
      </button>
    </div>

    <form v-if="authStore.mustChangePassword || showPasswordForm" class="space-y-3 rounded-card border border-border bg-surface p-5" @submit.prevent="handleChangePassword">
      <h2 class="text-sm font-semibold text-text-primary">Change password</h2>
      <div>
        <RevealPasswordInput id="staff_old_password" v-model="oldPassword" :label="authStore.mustChangePassword ? 'Current (starting) password' : 'Current password'" autocomplete="current-password" required />
      </div>
      <div>
        <RevealPasswordInput id="staff_new_password" v-model="newPassword" label="New password" autocomplete="new-password" :min-length="8" required />
      </div>
      <div>
        <RevealPasswordInput id="staff_confirm_password" v-model="confirmPassword" label="Confirm new password" autocomplete="new-password" :min-length="8" required />
      </div>
      <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
      <p v-if="success" role="status" class="text-sm text-success">Password changed.</p>
      <button type="submit" :disabled="changing" class="btn-primary w-full sm:w-auto">{{ changing ? 'Changing…' : 'Change password' }}</button>
    </form>
  </div>
</template>
