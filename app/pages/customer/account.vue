<script setup lang="ts">
import { MapPin } from 'lucide-vue-next'
definePageMeta({ layout: 'customer' })
const { fetchProfile, updateProfile, changePassword } = useAuthApi()
const { setMyLocation } = useDevicesApi()
const authStore = useAuthStore()
const { data: profile, pending, error, refresh } = await useAsyncData('customer-profile', () => fetchProfile())

// --- Phone number (the only profile field a customer can self-edit -
// name/email are administrator-only, see the backend's UserProfileSerializer) ---
const phoneNumber = ref('')
const savingPhone = ref(false); const phoneError = ref(''); const phoneSuccess = ref(false)
watchEffect(() => { if (profile.value) phoneNumber.value = profile.value.phone_number })
async function handleSavePhone() {
  phoneError.value = ''; phoneSuccess.value = false; savingPhone.value = true
  try {
    const updated = await updateProfile({ phone_number: phoneNumber.value })
    profile.value = updated; authStore.user = updated; phoneSuccess.value = true
  } catch { phoneError.value = "We couldn't save your changes. Please try again." }
  finally { savingPhone.value = false }
}

// --- Password change -----------------------------------------------------
const oldPassword = ref(''); const newPassword = ref(''); const confirmPassword = ref('')
const changingPassword = ref(false); const passwordError = ref(''); const passwordSuccess = ref(false)
async function handleChangePassword() {
  passwordError.value = ''; passwordSuccess.value = false
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = "New passwords don't match."
    return
  }
  changingPassword.value = true
  try {
    await changePassword(oldPassword.value, newPassword.value)
    oldPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
    passwordSuccess.value = true
  } catch { passwordError.value = "Couldn't change your password - check your current password and try again." }
  finally { changingPassword.value = false }
}

// --- Device location -------------------------------------------------------
// Requests the browser's geolocation permission, then saves the resulting
// coordinates against whichever device the customer is linked to. If
// they aren't linked to one yet, the backend returns a friendly 400 which
// we surface as-is (see devices.views.DeviceViewSet.my_location).
const locating = ref(false); const locationError = ref(''); const locationSuccess = ref(false)
function handleSetLocation() {
  locationError.value = ''; locationSuccess.value = false
  if (!('geolocation' in navigator)) {
    locationError.value = 'Location services are not available in this browser.'
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        await setMyLocation(position.coords.latitude, position.coords.longitude)
        locationSuccess.value = true
      } catch (err: any) {
        locationError.value = err?.data?.detail || "Couldn't save your location. Please try again."
      } finally {
        locating.value = false
      }
    },
    () => {
      locationError.value = 'Location permission was denied, so nothing was saved.'
      locating.value = false
    },
  )
}
</script>
<template>
  <div class="w-full space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Account</h1>
    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <template v-else>
      <div class="space-y-4 rounded-card border border-border bg-surface p-5">
        <h2 class="text-sm font-semibold text-text-primary">Profile</h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-medium text-text-primary">First name</label>
            <input :value="profile?.first_name" disabled class="w-full rounded-card border border-border bg-text-secondary/5 px-3 py-2 text-sm text-text-secondary">
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-text-primary">Last name</label>
            <input :value="profile?.last_name" disabled class="w-full rounded-card border border-border bg-text-secondary/5 px-3 py-2 text-sm text-text-secondary">
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Email</label>
          <input :value="profile?.email" type="email" disabled class="w-full rounded-card border border-border bg-text-secondary/5 px-3 py-2 text-sm text-text-secondary">
        </div>
        <p class="text-xs text-text-secondary">Name and email can only be changed by an administrator - contact yours if these need updating.</p>
        <form class="space-y-3" @submit.prevent="handleSavePhone">
          <div>
            <label for="phone" class="mb-1 block text-sm font-medium text-text-primary">Phone number</label>
            <input id="phone" v-model="phoneNumber" type="tel" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
          </div>
          <p v-if="phoneError" role="alert" class="text-sm text-error">{{ phoneError }}</p>
          <p v-if="phoneSuccess" role="status" class="text-sm text-success">Phone number saved.</p>
          <button type="submit" :disabled="savingPhone" class="btn-primary w-full sm:w-auto">{{ savingPhone ? 'Saving…' : 'Save phone number' }}</button>
        </form>
      </div>

      <div class="space-y-3 rounded-card border border-border bg-surface p-5">
        <h2 class="text-sm font-semibold text-text-primary">Device location</h2>
        <p class="text-sm text-text-secondary">
          Share your current location so we can pin it to your device on the map. Your browser will ask for
          permission first.
        </p>
        <button type="button" :disabled="locating" class="btn-secondary inline-flex w-full items-center justify-center gap-2 sm:w-auto" @click="handleSetLocation">
          <MapPin class="h-4 w-4" aria-hidden="true" />
          {{ locating ? 'Getting your location…' : 'Set my device location' }}
        </button>
        <p v-if="locationError" role="alert" class="text-sm text-error">{{ locationError }}</p>
        <p v-if="locationSuccess" role="status" class="text-sm text-success">Location saved to your device.</p>
      </div>

      <form class="space-y-3 rounded-card border border-border bg-surface p-5" @submit.prevent="handleChangePassword">
        <h2 class="text-sm font-semibold text-text-primary">Change password</h2>
        <div>
          <label for="old_password" class="mb-1 block text-sm font-medium text-text-primary">Current password</label>
          <input id="old_password" v-model="oldPassword" type="password" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        </div>
        <div>
          <label for="new_password" class="mb-1 block text-sm font-medium text-text-primary">New password</label>
          <input id="new_password" v-model="newPassword" type="password" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        </div>
        <div>
          <label for="confirm_password" class="mb-1 block text-sm font-medium text-text-primary">Confirm new password</label>
          <input id="confirm_password" v-model="confirmPassword" type="password" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        </div>
        <p v-if="passwordError" role="alert" class="text-sm text-error">{{ passwordError }}</p>
        <p v-if="passwordSuccess" role="status" class="text-sm text-success">Password changed.</p>
        <button type="submit" :disabled="changingPassword" class="btn-primary w-full sm:w-auto">{{ changingPassword ? 'Changing…' : 'Change password' }}</button>
      </form>
    </template>
  </div>
</template>