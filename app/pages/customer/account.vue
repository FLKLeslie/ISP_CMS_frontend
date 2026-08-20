<script setup lang="ts">
definePageMeta({ layout: 'customer' })
const { fetchProfile, updateProfile } = useAuthApi()
const authStore = useAuthStore()
const { data: profile, pending, error, refresh } = await useAsyncData('customer-profile', () => fetchProfile())
const firstName = ref(''); const lastName = ref(''); const phoneNumber = ref('')
const saving = ref(false); const saveError = ref(''); const saveSuccess = ref(false)
watchEffect(() => { if (profile.value) { firstName.value = profile.value.first_name; lastName.value = profile.value.last_name; phoneNumber.value = profile.value.phone_number } })
async function handleSave() {
  saveError.value = ''; saveSuccess.value = false; saving.value = true
  try {
    const updated = await updateProfile({ first_name: firstName.value, last_name: lastName.value, phone_number: phoneNumber.value })
    profile.value = updated; authStore.user = updated; saveSuccess.value = true
  } catch { saveError.value = "We couldn't save your changes. Please try again." }
  finally { saving.value = false }
}
</script>
<template>
  <div class="max-w-lg space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Account</h1>
    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <form v-else class="space-y-4 rounded-card border border-border bg-surface p-5" @submit.prevent="handleSave">
      <div>
        <label class="mb-1 block text-sm font-medium text-text-primary">Email</label>
        <input :value="profile?.email" type="email" disabled class="w-full rounded-card border border-border bg-text-secondary/5 px-3 py-2 text-sm text-text-secondary" />
        <p class="mt-1 text-xs text-text-secondary">Your email can't be changed here.</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="first_name" class="mb-1 block text-sm font-medium text-text-primary">First name</label>
          <input id="first_name" v-model="firstName" type="text" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label for="last_name" class="mb-1 block text-sm font-medium text-text-primary">Last name</label>
          <input id="last_name" v-model="lastName" type="text" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
      </div>
      <div>
        <label for="phone" class="mb-1 block text-sm font-medium text-text-primary">Phone number</label>
        <input id="phone" v-model="phoneNumber" type="tel" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
      </div>
      <p v-if="saveError" role="alert" class="text-sm text-error">{{ saveError }}</p>
      <p v-if="saveSuccess" role="status" class="text-sm text-success">Changes saved.</p>
      <button type="submit" :disabled="saving" class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{{ saving ? 'Saving…' : 'Save Changes' }}</button>
    </form>
  </div>
</template>
