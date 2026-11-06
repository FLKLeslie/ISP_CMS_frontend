<script setup lang="ts">
// Every member of staff's own page: who they are, what their account may do, and - the reason
// it can never be locked away from anyone - the form to change their own password.
//
// It is also where an account is held after a super administrator reset it to the default
// password (or created it with a starting one): until a new password is chosen this is the only
// page that works (utils/authPaths.ts, and the server refuses everything else).
definePageMeta({ layout: 'admin' })
const { changePassword } = useAuthApi()
const authStore = useAuthStore()

const user = computed(() => authStore.user)
const roleLabel = computed(() => (user.value ? ROLE_LABELS[user.value.role] : ''))
const isTop = computed(() => isSuperAdmin(user.value?.role))
// "devices.manage" -> "Devices · manage" (the picker the super administrator used has the full descriptions)
const prettyPermission = (key: string) => {
  const [area, action] = key.split('.')
  const name = (area ?? key).replace(/_/g, ' ')
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}${action ? ` · ${action}` : ''}`
}

const oldPassword = ref(''); const newPassword = ref(''); const confirmPassword = ref('')
const changing = ref(false); const error = ref(''); const success = ref(false)
const showPasswordForm = ref(authStore.mustChangePassword)
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
      <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><dt class="text-xs text-text-secondary">Name</dt><dd class="text-text-primary">{{ user.first_name }} {{ user.last_name }}</dd></div>
        <div><dt class="text-xs text-text-secondary">Email (your username)</dt><dd class="break-all text-text-primary">{{ user.email }}</dd></div>
        <div><dt class="text-xs text-text-secondary">Role</dt><dd class="text-text-primary">{{ roleLabel }}</dd></div>
        <div><dt class="text-xs text-text-secondary">Phone</dt><dd class="text-text-primary">{{ user.phone_number || '—' }}</dd></div>
      </dl>
      <p class="text-xs text-text-secondary">Your name and email can only be changed by a super administrator.</p>
    </div>

    <div v-if="user && !authStore.mustChangePassword" class="space-y-3 rounded-card border border-border bg-surface p-5">
      <h2 class="text-sm font-semibold text-text-primary">What your account can do</h2>
      <p v-if="isTop" class="text-sm text-text-secondary">As a super administrator you can do everything, including managing staff accounts and their permissions, resetting passwords and reading the audit log.</p>
      <template v-else>
        <p class="text-sm text-text-secondary">
          Your role is a starting point; the list below is exactly what a super administrator has allowed your account.
          Anything not listed will be refused. Every change you make is recorded in the audit log under your name.
        </p>
        <ul v-if="user.permissions.length" class="flex flex-wrap gap-2">
          <li v-for="key in user.permissions" :key="key" class="rounded-full border border-border px-2.5 py-0.5 text-xs text-text-primary">{{ prettyPermission(key) }}</li>
        </ul>
        <p v-else class="text-sm text-warning">Your account hasn't been given any permissions yet. Ask a super administrator.</p>
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
