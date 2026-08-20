<script setup lang="ts">
definePageMeta({ layout: false })
const email = ref(''); const password = ref(''); const errorMessage = ref(''); const submitting = ref(false)
const { login } = useAuthApi(); const authStore = useAuthStore()
async function handleSubmit() {
  errorMessage.value = ''; submitting.value = true
  try {
    const response = await login(email.value, password.value)
    authStore.setSession(response)
    await navigateTo(response.user.role === 'ADMIN' ? '/admin' : '/customer')
  } catch {
    errorMessage.value = "We couldn't sign you in. Check your email and password and try again."
  } finally { submitting.value = false }
}
</script>
<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm rounded-card border border-border bg-surface p-8 shadow-sm">
      <h1 class="mb-1 text-xl font-semibold text-text-primary">Sign in</h1>
      <p class="mb-6 text-sm text-text-secondary">Internet Subscription Management System</p>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label for="email" class="mb-1 block text-sm font-medium text-text-primary">Email</label>
          <input id="email" v-model="email" type="email" required autocomplete="email" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label for="password" class="mb-1 block text-sm font-medium text-text-primary">Password</label>
          <input id="password" v-model="password" type="password" required autocomplete="current-password" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <p v-if="errorMessage" role="alert" class="text-sm text-error">{{ errorMessage }}</p>
        <button type="submit" :disabled="submitting" class="w-full rounded-card bg-secondary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>
