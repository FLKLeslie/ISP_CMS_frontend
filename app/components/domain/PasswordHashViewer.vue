<script setup lang="ts">
// A password is stored only as a one-way HASH; nobody can read the password back. A super
// administrator may still look at the hash, if they want to - hidden by default, shown on
// request, hidden again after a minute or when they leave. Every look is recorded in the audit
// log by the server (the hash itself never is).
//
//   <PasswordHashViewer :fetcher="() => showCustomerPasswordHash(uuid)" />
import type { PasswordHashResult } from '~/types/api/superadmin'

const props = defineProps<{ fetcher: () => Promise<PasswordHashResult> }>()
const AUTO_HIDE_MS = 60_000

const shown = ref<PasswordHashResult | null>(null)
const loading = ref(false)
const error = ref('')
let timer: ReturnType<typeof setTimeout> | null = null

function hide() {
  shown.value = null
  if (timer) { clearTimeout(timer); timer = null }
}
async function show() {
  error.value = ''
  loading.value = true
  try {
    shown.value = await props.fetcher()
    if (timer) clearTimeout(timer)
    timer = setTimeout(hide, AUTO_HIDE_MS)
  } catch (err) {
    error.value = apiErrorMessage(err, "Couldn't load the hash.")
  } finally {
    loading.value = false
  }
}
onBeforeUnmount(hide)
</script>

<template>
  <div class="min-w-0 text-sm">
    <template v-if="!shown">
      <span class="text-text-secondary" aria-label="Password hidden">••••••••</span>
      <button type="button" :disabled="loading" class="ml-2 text-xs font-medium text-accent hover:underline disabled:opacity-50" @click="show">
        {{ loading ? 'Loading…' : 'Show hash' }}
      </button>
    </template>
    <template v-else>
      <p class="text-xs text-text-secondary">
        {{ shown.usable ? shown.algorithm || 'hash' : 'No password is set' }}
        <button type="button" class="ml-2 font-medium text-accent hover:underline" @click="hide">Hide</button>
      </p>
      <code class="mt-1 block max-w-xs whitespace-normal break-all rounded-card bg-text-secondary/10 px-2 py-1 text-[11px] text-text-primary">{{ shown.hash }}</code>
    </template>
    <p v-if="error" role="alert" class="mt-1 text-xs text-error">{{ error }}</p>
  </div>
</template>
