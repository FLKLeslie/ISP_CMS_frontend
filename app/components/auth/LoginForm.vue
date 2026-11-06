<script setup lang="ts">
// The sign-in form, shared by the two sign-in pages. `portal` decides which door it
// knocks on:
//
//   portal="customer"  -> POST /api/auth/login/         (pages/login.vue)
//   portal="admin"     -> POST /api/auth/admin/login/   (pages/staff/login.vue) - every staff role
//
// The server only admits the matching kind of account at each door (see
// backend accounts/serializers.py). This form adds one more check of its own - it
// refuses to keep a session of the wrong kind even if one somehow came back - and
// otherwise just handles the experience: a visible busy state, one calm error message,
// and focus returned to the password field after a failure.
import { CircleAlert, Loader2, Mail } from 'lucide-vue-next'

const props = defineProps<{ portal: 'customer' | 'admin' }>()

const { login, adminLogin } = useAuthApi()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')
const passwordField = ref<{ focus: () => void } | null>(null)
const emailInput = ref<HTMLInputElement | null>(null)

async function submit() {
  if (submitting.value) return // a double-click must not send two requests
  error.value = ''
  // Nothing to send yet: say so and put the cursor where it is needed, rather than
  // greying the button out (a washed-out button on every fresh page looks broken).
  if (!email.value.trim() || !password.value) {
    error.value = 'Enter your email address and password.'
    if (!email.value.trim()) emailInput.value?.focus()
    else passwordField.value?.focus()
    return
  }
  submitting.value = true
  try {
    const signIn = props.portal === 'admin' ? adminLogin : login
    const response = await signIn(email.value.trim(), password.value)
    // The server never returns the other kind of account at this door; if it ever did,
    // that is a bug, and the safe answer is to keep nothing.
    // (The staff door admits all four staff roles; the customer door only customers.)
    const rightKind = props.portal === 'admin' ? isStaffRole(response.user.role) : response.user.role === 'CUSTOMER'
    if (!rightKind) throw { statusCode: 400 }
    authStore.setSession(response)
    await navigateTo(resolveAuthRedirect('/', response.user) ?? homeFor(response.user))
  } catch (e) {
    error.value = loginErrorMessage(e)
    password.value = '' // never leave a rejected password sitting in the field
    // The fields are disabled while a sign-in is in flight and a disabled field can't
    // take focus, so end the busy state BEFORE moving the cursor back to the password.
    submitting.value = false
    await nextTick()
    passwordField.value?.focus()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <div
      v-if="error" role="alert"
      class="flex items-start gap-2.5 rounded-card border border-error/30 bg-error/5 px-3.5 py-3 text-sm text-error"
    >
      <CircleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{{ error }}</span>
    </div>

    <div>
      <label for="email" class="mb-1.5 block text-sm font-medium text-text-primary">Email address</label>
      <div class="relative">
        <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-text-secondary" aria-hidden="true" />
        <input
          id="email" ref="emailInput" v-model="email" type="email" inputmode="email" autocomplete="username" required autofocus
          autocapitalize="none" autocorrect="off" spellcheck="false" :disabled="submitting" placeholder="you@example.com"
          class="w-full rounded-card border border-border bg-background py-3 pl-11 pr-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
        >
      </div>
    </div>

    <PasswordField ref="passwordField" v-model="password" :disabled="submitting" />

    <button
      type="submit" :disabled="submitting"
      class="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base"
    >
      <Loader2 v-if="submitting" class="h-4 w-4 animate-spin" aria-hidden="true" />
      {{ submitting ? 'Signing in…' : 'Sign in' }}
    </button>
  </form>
</template>
