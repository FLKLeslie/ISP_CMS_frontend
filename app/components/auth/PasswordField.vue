<script setup lang="ts">
// A password input with a show/hide key and a Caps Lock warning.
//
//   <PasswordField v-model="password" label="Password" autocomplete="current-password" />
//
// - The key toggles the field between hidden and visible. It is a real button with a
//   label that says what it will DO ("Show password" / "Hide password"), `aria-pressed`
//   for screen readers, and it does not take focus away from the field when clicked, so
//   you can reveal the password and keep typing.
// - The password is hidden by default, and hidden again whenever the field is cleared
//   (a failed sign-in empties it), so a revealed password never "sticks" to the next try.
// - Caps Lock is detected while typing and reported, because it is the commonest reason
//   a correct password is rejected.
import { Eye, EyeOff, Lock, TriangleAlert } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: string
  id?: string
  label?: string
  autocomplete?: 'current-password' | 'new-password'
  disabled?: boolean
  required?: boolean
}>(), { id: 'password', label: 'Password', autocomplete: 'current-password', disabled: false, required: true })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const visible = ref(false)
const capsLock = ref(false)
const input = ref<HTMLInputElement | null>(null)

// An emptied field goes back to hidden.
watch(() => props.modelValue, (value) => { if (!value) visible.value = false })

function onKey(event: KeyboardEvent) {
  // getModifierState isn't available on every synthetic event; treat "unknown" as off.
  capsLock.value = event.getModifierState?.('CapsLock') ?? false
}

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div>
    <label :for="props.id" class="mb-1.5 block text-sm font-medium text-text-primary">{{ props.label }}</label>
    <div class="relative">
      <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-text-secondary" aria-hidden="true" />
      <input
        :id="props.id" ref="input"
        :value="props.modelValue" :type="visible ? 'text' : 'password'" :autocomplete="props.autocomplete"
        :disabled="props.disabled" :required="props.required"
        autocapitalize="none" autocorrect="off" spellcheck="false"
        placeholder="Enter your password"
        class="w-full rounded-card border border-border bg-background py-3 pl-11 pr-12 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
        :aria-describedby="capsLock ? `${props.id}-caps` : undefined"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown="onKey" @keyup="onKey" @blur="capsLock = false"
      >
      <!-- mousedown.prevent: pressing the key must not move focus out of the field. -->
      <button
        type="button" :disabled="props.disabled"
        class="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-card text-text-secondary transition-colors hover:bg-text-secondary/10 hover:text-text-primary focus-visible:outline-accent"
        :aria-label="visible ? 'Hide password' : 'Show password'" :aria-pressed="visible"
        @mousedown.prevent @click="visible = !visible"
      >
        <EyeOff v-if="visible" class="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
        <Eye v-else class="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
      </button>
    </div>
    <p v-if="capsLock" :id="`${props.id}-caps`" role="status" class="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
      <TriangleAlert class="h-3.5 w-3.5" aria-hidden="true" />Caps Lock is on
    </p>
  </div>
</template>
