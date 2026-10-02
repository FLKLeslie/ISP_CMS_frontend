<script setup lang="ts">
// View/generate/set the stored admin login for a Device or AccessPoint
// (devices.views.DeviceCredentialsActionMixin on the backend - same action
// shape for both, only the resource path differs). Administrator only.
// Requires the device/AP to currently be connected: generating or setting
// a password dispatches a live command to it via Node.
import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-vue-next'
import type { CredentialsResource } from '~/composables/api/useDeviceCredentialsApi'

const props = defineProps<{ open: boolean; resource: CredentialsResource; id: string | null; label: string }>()
const emit = defineEmits<{ close: [] }>()

const { getCredentials, generateCredentials, setCredentials } = useDeviceCredentialsApi()

const loading = ref(false)
const loadError = ref('')
const username = ref('')
const password = ref<string | null>(null)
const hasPassword = ref(false)
const updatedAt = ref<string | null>(null)
const updatedByName = ref<string | null>(null)
const revealed = ref(false)

const mode = ref<'generate' | 'set'>('generate')
const newPassword = ref('')
const saving = ref(false)
const saveError = ref('')

async function load() {
  if (!props.id) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await getCredentials(props.resource, props.id)
    username.value = data.username
    password.value = data.password
    hasPassword.value = data.has_password
    updatedAt.value = data.updated_at
    updatedByName.value = data.updated_by_name
    revealed.value = false
  } catch (err) {
    loadError.value = apiErrorMessage(err, "Couldn't load the stored password.")
  } finally {
    loading.value = false
  }
}

watch(() => [props.open, props.id], ([isOpen]) => {
  if (isOpen) {
    mode.value = 'generate'
    newPassword.value = ''
    saveError.value = ''
    load()
  }
}, { immediate: true })

async function handleSave() {
  if (!props.id) return
  saveError.value = ''
  if (mode.value === 'set' && !newPassword.value.trim()) {
    saveError.value = 'Enter a password, or switch to "Generate one for me".'
    return
  }
  saving.value = true
  try {
    const data = mode.value === 'generate'
      ? await generateCredentials(props.resource, props.id)
      : await setCredentials(props.resource, props.id, newPassword.value)
    username.value = data.username
    password.value = data.password
    hasPassword.value = data.has_password
    updatedAt.value = data.updated_at
    updatedByName.value = data.updated_by_name
    revealed.value = true
    newPassword.value = ''
  } catch (err) {
    saveError.value = apiErrorMessage(
      err, "Couldn't set a new password - make sure this is currently online and try again.",
    )
  } finally {
    saving.value = false
  }
}

async function copyPassword() {
  if (password.value) {
    try { await navigator.clipboard.writeText(password.value) } catch { /* clipboard may be unavailable - no-op */ }
  }
}
</script>

<template>
  <div v-if="props.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div class="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-lg">
      <div class="mb-4 flex items-center gap-2">
        <KeyRound class="h-4 w-4 text-text-secondary" />
        <h2 class="text-sm font-semibold text-text-primary">Password — {{ props.label }}</h2>
      </div>

      <LoadingState v-if="loading" :rows="2" />
      <p v-else-if="loadError" role="alert" class="text-sm text-error">{{ loadError }}</p>
      <template v-else>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-text-secondary">Username</label>
            <p class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary">{{ username }}</p>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-text-secondary">Password</label>
            <div v-if="hasPassword" class="flex items-center gap-2">
              <p class="flex-1 truncate rounded-card border border-border bg-background px-3 py-2 font-mono text-sm text-text-primary">
                {{ revealed ? password : '••••••••••••' }}
              </p>
              <button type="button" class="shrink-0 rounded-card border border-border p-2 text-text-secondary hover:text-text-primary" @click="revealed = !revealed">
                <EyeOff v-if="revealed" class="h-4 w-4" /><Eye v-else class="h-4 w-4" />
              </button>
              <button type="button" class="shrink-0 rounded-card border border-border p-2 text-text-secondary hover:text-text-primary" @click="copyPassword">
                <Copy class="h-4 w-4" />
              </button>
            </div>
            <p v-else class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-secondary">No password stored yet.</p>
          </div>
          <p v-if="updatedAt" class="text-xs text-text-secondary">
            Last set {{ formatRelativeTime(updatedAt) }}<template v-if="updatedByName"> by {{ updatedByName }}</template>.
          </p>
        </div>

        <div class="mt-4 space-y-2 border-t border-border pt-4">
          <p class="text-xs font-medium text-text-secondary">
            {{ hasPassword ? 'Set a new password' : 'Set a password' }}
            <span class="font-normal">(requires this to be online right now)</span>
          </p>
          <div class="flex gap-3 text-sm text-text-primary">
            <label class="flex items-center gap-1.5">
              <input v-model="mode" type="radio" value="generate"> <RefreshCw class="h-3 w-3" /> Generate one for me
            </label>
            <label class="flex items-center gap-1.5">
              <input v-model="mode" type="radio" value="set"> I'll set it myself
            </label>
          </div>
          <input
            v-if="mode === 'set'" v-model="newPassword" type="text" autocomplete="off" placeholder="New password"
            class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
          <p v-if="saveError" role="alert" class="text-sm text-error">{{ saveError }}</p>
        </div>
      </template>

      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="emit('close')">Close</button>
        <button v-if="!loading && !loadError" type="button" :disabled="saving" class="btn-primary" @click="handleSave">
          {{ saving ? 'Saving…' : mode === 'generate' ? 'Generate & set' : 'Set password' }}
        </button>
      </div>
    </div>
  </div>
</template>
