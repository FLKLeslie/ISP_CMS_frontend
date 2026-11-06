<script setup lang="ts">
// A deliberately slow, three-step dialog for RESETTING SOMEONE ELSE'S PASSWORD to the default.
// A reset locks the person out of their current password at once and is easy to do to the wrong
// account, so nothing happens on a single click:
//
//   1. Read what will happen and tick "I understand".
//   2. Type the account's email address, exactly - proof you picked the right person.
//   3. Type YOUR OWN password - proof it's really you at the keyboard.
//
// This is a convenience, not the protection: the server demands the very same three things
// (backend accounts/superadmin_serializers.ResetConfirmationSerializer) and refuses the request
// without them, so skipping a step in the browser gets nobody anywhere.
//
//   <PasswordResetModal
//     :open="..." kind="customer" target-name="Cora Customer" target-email="cora@example.com"
//     :submit="(payload) => resetCustomerPassword(uuid, payload)"
//     @done="..." @cancel="..." />
import { TriangleAlert } from 'lucide-vue-next'
import type { PasswordResetResult, ResetConfirmation } from '~/types/api/superadmin'

const props = defineProps<{
  open: boolean
  kind: 'customer' | 'staff'
  targetName: string
  targetEmail: string
  /** Sends the request. The dialog shows whatever error it throws. */
  submit: (payload: ResetConfirmation) => Promise<PasswordResetResult>
}>()
const emit = defineEmits<{ done: [result: PasswordResetResult]; cancel: [] }>()

const TOTAL_STEPS = 3
const step = ref(1)
const acknowledged = ref(false)
const confirmEmail = ref('')
const adminPassword = ref('')
const submitting = ref(false)
const error = ref('')

function reset() {
  step.value = 1
  acknowledged.value = false
  confirmEmail.value = ''
  adminPassword.value = ''
  submitting.value = false
  error.value = ''
}
// Every time the dialog opens it starts from scratch, and nothing typed survives it closing.
watch(() => props.open, () => reset())

const emailMatches = computed(() => confirmEmail.value.trim().toLowerCase() === props.targetEmail.toLowerCase())
const canContinue = computed(() => {
  if (step.value === 1) return acknowledged.value
  if (step.value === 2) return emailMatches.value
  return adminPassword.value.length > 0
})

function next() { if (canContinue.value && step.value < TOTAL_STEPS) { error.value = ''; step.value += 1 } }
function back() { if (step.value > 1) { error.value = ''; step.value -= 1 } }
function cancel() { reset(); emit('cancel') }

// The server names the check that failed; take the person back to the step where they can fix it.
function fieldError(err: unknown, field: string): string | null {
  const data = (err as { data?: any })?.data
  const body = data && typeof data === 'object' && 'errors' in data ? data.errors : data
  const value = body?.[field]
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null
  return typeof value === 'string' ? value : null
}

async function confirm() {
  if (submitting.value || !canContinue.value) return
  submitting.value = true
  error.value = ''
  try {
    const result = await props.submit({
      confirm_email: confirmEmail.value,
      admin_password: adminPassword.value,
      acknowledged: acknowledged.value,
    })
    reset()
    emit('done', result)
  } catch (err) {
    adminPassword.value = '' // a rejected password never stays in the field
    const own = fieldError(err, 'admin_password')
    const email = fieldError(err, 'confirm_email')
    if (own) { step.value = 3; error.value = own }
    else if (email) { step.value = 2; error.value = email }
    else error.value = apiErrorMessage(err, "The password couldn't be reset. Nothing was changed - try again.")
  } finally {
    submitting.value = false
  }
}

const inputClass = 'w-full rounded-card border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
</script>

<template>
  <div v-if="props.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div
      class="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-lg"
      role="dialog" aria-modal="true" aria-labelledby="prm-title"
    >
      <div class="flex items-start justify-between gap-3">
        <h2 id="prm-title" class="text-base font-semibold text-text-primary">Reset password</h2>
        <span class="shrink-0 text-xs text-text-secondary" aria-live="polite">Step {{ step }} of {{ TOTAL_STEPS }}</span>
      </div>
      <div class="mt-2 flex gap-1" aria-hidden="true">
        <span v-for="n in TOTAL_STEPS" :key="n" class="h-1 flex-1 rounded-full" :class="n <= step ? 'bg-secondary' : 'bg-border'" />
      </div>

      <p v-if="error" role="alert" class="mt-4 rounded-card border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{{ error }}</p>

      <!-- 1. understand -->
      <div v-if="step === 1" class="mt-4 space-y-3">
        <div class="flex items-start gap-2 rounded-card border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-text-primary">
          <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p>
            You are about to reset the password of <strong>{{ props.targetName }}</strong>
            (<span class="break-all">{{ props.targetEmail }}</span>) to the <strong>default password</strong>.
          </p>
        </div>
        <ul class="list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Their <strong>current password stops working immediately</strong>.</li>
          <li>They are <strong>signed out on every device</strong>.</li>
          <li>The default password is not secret, so the account can <strong>do nothing</strong> until they choose a new one at their next sign-in.</li>
          <li v-if="props.kind === 'customer'">Tell the customer the default password so they can sign in and choose their own.</li>
          <li v-else>Tell them the default password so they can sign in and choose their own.</li>
          <li>The reset is recorded in the audit log under <strong>your</strong> name.</li>
        </ul>
        <label class="flex items-start gap-2 text-sm text-text-primary">
          <input v-model="acknowledged" type="checkbox" class="mt-0.5 rounded border-border">
          I understand, and I want to reset this password.
        </label>
      </div>

      <!-- 2. the right person -->
      <div v-else-if="step === 2" class="mt-4 space-y-3">
        <p class="text-sm text-text-secondary">
          To make sure you picked the right account, type its email address exactly:
          <strong class="break-all text-text-primary">{{ props.targetEmail }}</strong>
        </p>
        <div>
          <label for="prm-email" class="mb-1 block text-sm font-medium text-text-primary">Email address of the account</label>
          <input
            id="prm-email" v-model="confirmEmail" type="email" autocomplete="off" autocapitalize="none" spellcheck="false"
            :class="inputClass" placeholder="Type the email address"
          >
          <p v-if="confirmEmail && !emailMatches" class="mt-1 text-xs text-text-secondary">That doesn't match yet.</p>
        </div>
      </div>

      <!-- 3. it's really you -->
      <div v-else class="mt-4 space-y-3">
        <p class="text-sm text-text-secondary">Last step. Enter <strong>your own</strong> password to confirm it's you making this change.</p>
        <PasswordField id="prm-own-password" v-model="adminPassword" label="Your own password" autocomplete="current-password" />
      </div>

      <div class="mt-5 flex items-center justify-between gap-2">
        <button type="button" class="rounded-card border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-text-secondary/10" @click="cancel">
          Cancel
        </button>
        <div class="flex gap-2">
          <button
            v-if="step > 1" type="button" :disabled="submitting"
            class="rounded-card border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-text-secondary/10 disabled:opacity-50"
            @click="back"
          >
            Back
          </button>
          <button
            v-if="step < TOTAL_STEPS" type="button" :disabled="!canContinue"
            class="rounded-card bg-secondary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            @click="next"
          >
            Continue
          </button>
          <button
            v-else type="button" :disabled="!canContinue || submitting"
            class="rounded-card bg-error px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            @click="confirm"
          >
            {{ submitting ? 'Resetting…' : 'Reset password' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
