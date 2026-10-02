<script setup lang="ts">
// Adopt flow for a source="ap_scan" ("unknown device") sighting - pushes
// an adoption request to a device we've only ever SEEN (via one of our
// access points' discovery scans), never heard from directly. See
// devices.views.UnregisteredDeviceSightingViewSet.adopt on the backend and
// useUnregisteredDevicesApi.adoptSighting.
import { KeyRound, Loader2, ShieldCheck, ShieldX } from 'lucide-vue-next'
import type { UnregisteredDeviceSighting } from '~/types/api/devices'

const props = defineProps<{ open: boolean; sighting: UnregisteredDeviceSighting | null }>()
const emit = defineEmits<{ close: []; adopted: [sighting: UnregisteredDeviceSighting] }>()

const { adoptSighting } = useUnregisteredDevicesApi()
const { getAccessPoint } = useAccessPointsApi()

// Whether the AP that spotted this device already has a password on file -
// if so, the AP password field is optional (pre-filled state shown, not
// the password itself) rather than required.
const apHasPassword = ref(false)
const checkingAp = ref(false)

const apUsername = ref('ubnt')
const apPassword = ref('')
const deviceUsername = ref('ubnt')
const deviceMode = ref<'generate' | 'set'>('generate')
const devicePassword = ref('')

const submitting = ref(false)
const formError = ref('')
const result = ref<UnregisteredDeviceSighting | null>(null)

function resetForm() {
  apUsername.value = 'ubnt'
  apPassword.value = ''
  deviceUsername.value = 'ubnt'
  deviceMode.value = 'generate'
  devicePassword.value = ''
  formError.value = ''
  result.value = null
}

watch(() => [props.open, props.sighting?.id], async ([isOpen]) => {
  if (!isOpen || !props.sighting) return
  resetForm()
  const apId = props.sighting.discovered_via_access_point
  if (!apId) return
  checkingAp.value = true
  try {
    const ap = await getAccessPoint(apId)
    apHasPassword.value = ap.has_admin_password
  } catch {
    apHasPassword.value = false
  } finally {
    checkingAp.value = false
  }
}, { immediate: true })

async function handleSubmit() {
  if (!props.sighting) return
  formError.value = ''
  if (!apHasPassword.value && !apPassword.value.trim()) {
    formError.value = "Enter this access point's password to continue - it has none saved yet."
    return
  }
  if (deviceMode.value === 'set' && !devicePassword.value.trim()) {
    formError.value = 'Enter the password to set on the device, or switch to "Generate one for me".'
    return
  }

  submitting.value = true
  try {
    const updated = await adoptSighting(props.sighting.id, {
      ap_username: apUsername.value.trim() || undefined,
      ap_password: apPassword.value.trim() || undefined,
      device_username: deviceUsername.value.trim() || undefined,
      ...(deviceMode.value === 'generate'
        ? { autogenerate_device_password: true }
        : { device_password: devicePassword.value }),
    })
    result.value = updated
    emit('adopted', updated)
    // The AP password field may have just been saved server-side even on
    // a failed attempt (see the backend docstring) - reflect that so a
    // retry doesn't ask for it again.
    if (apPassword.value.trim()) apHasPassword.value = true
  } catch (err) {
    formError.value = apiErrorMessage(err, "Couldn't reach the device communication service. Try again.")
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  resetForm()
  emit('close')
}
</script>

<template>
  <div v-if="props.open && props.sighting" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg">
      <div class="mb-1 flex items-center gap-2">
        <KeyRound class="h-4 w-4 text-text-secondary" />
        <h2 class="text-sm font-semibold text-text-primary">Adopt unknown device</h2>
      </div>
      <p class="mb-4 font-mono text-xs text-text-secondary">
        {{ props.sighting.mac_address }}
        <span v-if="props.sighting.discovered_ip_address" class="font-sans"> · {{ props.sighting.discovered_ip_address }}</span>
      </p>

      <!-- Result banner: shown after a submit, replaces nothing (form stays
           editable below it, so a failed attempt can be retried in place) -->
      <div
        v-if="result" class="mb-4 flex items-start gap-2 rounded-card border px-3 py-2 text-sm"
        :class="result.adoption_status === 'adopted' ? 'border-success/40 bg-success/5 text-text-primary' : 'border-error/40 bg-error/5 text-text-primary'"
      >
        <ShieldCheck v-if="result.adoption_status === 'adopted'" class="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <ShieldX v-else class="mt-0.5 h-4 w-4 shrink-0 text-error" />
        <div>
          <p class="font-medium">
            {{ result.adoption_status === 'adopted' ? 'Adoption request sent.' : "The device didn't accept the adoption request." }}
          </p>
          <p class="mt-0.5 text-xs text-text-secondary">
            <template v-if="result.adoption_status === 'adopted'">
              Once it starts reporting to us under its real identity, register it as usual from this queue -
              the password you set here will be applied to it automatically.
            </template>
            <template v-else>
              This can be retried - the adoption script this relies on is still being finalized, so failures are
              expected in the meantime.
            </template>
          </p>
        </div>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <fieldset class="space-y-2 rounded-card border border-border p-3">
          <legend class="px-1 text-xs font-medium text-text-secondary">
            Access point password
            <span v-if="props.sighting.discovered_via_access_point_name">
              ({{ props.sighting.discovered_via_access_point_name }})
            </span>
          </legend>
          <p v-if="checkingAp" class="text-xs text-text-secondary">Checking for a saved password…</p>
          <p v-else-if="apHasPassword" class="text-xs text-text-secondary">
            Using the password already saved for this access point. Enter a different one below to override it.
          </p>
          <p v-else class="text-xs text-text-secondary">
            No password saved for this access point yet - enter it below. It'll be saved for next time.
          </p>
          <input
            v-model="apPassword" type="password" autocomplete="off"
            :placeholder="apHasPassword ? 'Leave blank to use the saved password' : 'Access point password'"
            class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
        </fieldset>

        <fieldset class="space-y-2 rounded-card border border-border p-3">
          <legend class="px-1 text-xs font-medium text-text-secondary">Password to set on the device</legend>
          <div class="flex gap-3 text-sm text-text-primary">
            <label class="flex items-center gap-1.5">
              <input v-model="deviceMode" type="radio" value="generate"> Generate one for me
            </label>
            <label class="flex items-center gap-1.5">
              <input v-model="deviceMode" type="radio" value="set"> I'll set it myself
            </label>
          </div>
          <input
            v-if="deviceMode === 'set'" v-model="devicePassword" type="text" autocomplete="off"
            placeholder="New device password"
            class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
        </fieldset>

        <p v-if="formError" role="alert" class="text-sm text-error">{{ formError }}</p>

        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn-secondary" @click="handleClose">Close</button>
          <button type="submit" :disabled="submitting" class="btn-primary inline-flex items-center gap-1.5">
            <Loader2 v-if="submitting" class="h-3.5 w-3.5 animate-spin" />
            {{ submitting ? 'Adopting…' : result ? 'Try again' : 'Adopt device' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
