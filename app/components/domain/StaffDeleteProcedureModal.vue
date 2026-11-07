<script setup lang="ts">
import { AlertTriangle, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-vue-next'
import type { StaffAccount, StaffDeletePayload } from '~/types/api/superadmin'

const props = defineProps<{
  open: boolean
  target: StaffAccount | null
  submit: (payload: StaffDeletePayload) => Promise<void>
}>()
const emit = defineEmits<{ done: []; cancel: [] }>()
const step = ref(1)
const email = ref('')
const password = ref('')
const acknowledged = ref(false)
const saving = ref(false)
const error = ref('')
watch(() => props.open, open => {
  if (open) { step.value = 1; email.value = ''; password.value = ''; acknowledged.value = false; error.value = '' }
})
function close() { emit('cancel') }
async function remove() {
  if (!props.target || saving.value) return
  error.value = ''
  saving.value = true
  try {
    await props.submit({ confirm_email: email.value.trim(), admin_password: password.value, acknowledged: acknowledged.value })
    emit('done')
  } catch (err) {
    error.value = apiErrorMessage(err, 'The account could not be deleted. Verify the confirmation details and try again.')
  } finally { saving.value = false }
}
</script>
<template>
  <div v-if="props.open && props.target" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <section class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="staff-delete-title">
      <header class="border-b border-border px-5 py-4">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-error/10 text-error"><AlertTriangle class="h-5 w-5" /></span>
          <div><p class="text-xs font-semibold uppercase tracking-wider text-error">Permanent action · Step {{ step }} of 2</p><h2 id="staff-delete-title" class="text-lg font-semibold text-text-primary">Delete staff account</h2></div>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-text-secondary/10"><div class="h-full rounded-full bg-error transition-all" :style="{ width: step === 1 ? '50%' : '100%' }" /></div>
      </header>
      <div class="space-y-4 px-5 py-5">
        <div class="rounded-xl border border-border bg-background p-3">
          <p class="font-semibold text-text-primary">{{ props.target.first_name }} {{ props.target.last_name }}</p>
          <p class="break-all text-sm text-text-secondary">{{ props.target.email }}</p>
          <p class="mt-1 text-xs text-text-secondary">{{ ROLE_LABELS[props.target.role] }} · {{ props.target.is_active ? 'Active' : 'Deactivated' }}</p>
        </div>
        <template v-if="step === 1">
          <p class="text-sm text-text-secondary">This permanently removes the staff account. They will lose access, and account-owned records may be affected. The audit record of this action will remain.</p>
          <label class="block text-sm font-medium text-text-primary">Type the account email to continue
            <input v-model="email" type="email" autocomplete="off" class="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent" :placeholder="props.target.email">
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-secondary" @click="close">Cancel</button>
            <button type="button" class="btn-primary" :disabled="email.trim().toLowerCase() !== props.target.email.toLowerCase()" @click="step = 2">Continue <ArrowRight class="ml-1 inline h-4 w-4" /></button>
          </div>
        </template>
        <template v-else>
          <p class="text-sm text-text-secondary">To complete deletion, verify your own password and acknowledge the permanent action.</p>
          <RevealPasswordInput v-model="password" id="staff-delete-admin-password" label="Your current password" autocomplete="current-password" required />
          <label class="flex items-start gap-2 text-sm text-text-primary"><input v-model="acknowledged" type="checkbox" class="mt-1 accent-error"><span>I understand this account will be permanently deleted and this action cannot be undone.</span></label>
          <p v-if="error" role="alert" class="rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{{ error }}</p>
          <div class="flex flex-wrap justify-between gap-2">
            <button type="button" class="btn-secondary" :disabled="saving" @click="step = 1"><ArrowLeft class="mr-1 inline h-4 w-4" /> Back</button>
            <div class="flex gap-2"><button type="button" class="btn-secondary" :disabled="saving" @click="close">Cancel</button><button type="button" class="rounded-card bg-error px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving || !password || !acknowledged" @click="remove"><ShieldCheck class="mr-1 inline h-4 w-4" />{{ saving ? 'Deleting…' : 'Delete permanently' }}</button></div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
