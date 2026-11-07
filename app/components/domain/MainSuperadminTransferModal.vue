<script setup lang="ts">
import { ArrowLeftRight, ShieldAlert } from 'lucide-vue-next'
import type { StaffAccount, MainSuperadminTransferPayload } from '~/types/api/superadmin'

const props = defineProps<{
  open: boolean
  candidates: StaffAccount[]
  submit: (payload: MainSuperadminTransferPayload) => Promise<void>
}>()
const emit = defineEmits<{ done: []; cancel: [] }>()
const targetUuid = ref('')
const email = ref('')
const password = ref('')
const acknowledged = ref(false)
const saving = ref(false)
const error = ref('')
const target = computed(() => props.candidates.find(item => item.uuid === targetUuid.value) ?? null)
watch(() => props.open, open => {
  if (open) { targetUuid.value = ''; email.value = ''; password.value = ''; acknowledged.value = false; error.value = '' }
})
async function transfer() {
  if (!target.value || saving.value) return
  error.value = ''
  saving.value = true
  try {
    await props.submit({ target_uuid: target.value.uuid, confirm_email: email.value.trim(), admin_password: password.value, acknowledged: acknowledged.value })
    emit('done')
  } catch (err) {
    error.value = apiErrorMessage(err, 'Leadership could not be transferred. Verify the confirmation details and try again.')
  } finally { saving.value = false }
}
</script>
<template>
  <div v-if="props.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <section class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="transfer-title">
      <header class="border-b border-border px-5 py-4">
        <div class="flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning"><ShieldAlert class="h-5 w-5" /></span><div><p class="text-xs font-semibold uppercase tracking-wider text-warning">Main administrator control</p><h2 id="transfer-title" class="text-lg font-semibold text-text-primary">Transfer main superadmin power</h2></div></div>
      </header>
      <div class="space-y-4 px-5 py-5">
        <p class="text-sm text-text-secondary">This transfers the main-superadmin designation. The recipient becomes the only account able to transfer leadership or manage other superadmins. You remain a superadmin, but will no longer hold the main designation.</p>
        <label class="block text-sm font-medium text-text-primary">Recipient
          <select v-model="targetUuid" class="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary">
            <option value="">Choose an active superadmin…</option>
            <option v-for="candidate in props.candidates" :key="candidate.uuid" :value="candidate.uuid">{{ candidate.first_name }} {{ candidate.last_name }} · {{ candidate.email }}</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-text-primary">Type the recipient's email
          <input v-model="email" type="email" autocomplete="off" class="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent" :placeholder="target?.email ?? 'Recipient email'">
        </label>
        <RevealPasswordInput v-model="password" id="transfer-admin-password" label="Your current password" autocomplete="current-password" required />
        <label class="flex items-start gap-2 text-sm text-text-primary"><input v-model="acknowledged" type="checkbox" class="mt-1 accent-warning"><span>I understand that the recipient will become the main superadministrator.</span></label>
        <p v-if="error" role="alert" class="rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{{ error }}</p>
        <div class="flex justify-end gap-2"><button type="button" class="btn-secondary" :disabled="saving" @click="emit('cancel')">Cancel</button><button type="button" class="btn-primary" :disabled="saving || !target || email.trim().toLowerCase() !== (target?.email ?? '').toLowerCase() || !password || !acknowledged" @click="transfer"><ArrowLeftRight class="mr-1 inline h-4 w-4" />{{ saving ? 'Transferring…' : 'Transfer authority' }}</button></div>
      </div>
    </section>
  </div>
</template>
