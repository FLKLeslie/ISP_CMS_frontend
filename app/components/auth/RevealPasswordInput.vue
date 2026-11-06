<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: string
  id?: string
  label?: string
  placeholder?: string
  autocomplete?: string
  required?: boolean
  minLength?: number
  disabled?: boolean
}>(), {
  id: 'password-input', label: 'Password', placeholder: 'Enter password',
  autocomplete: 'new-password', required: false, minLength: undefined, disabled: false,
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const visible = ref(false)
const inputElement = ref<HTMLInputElement | null>(null)
defineExpose({ focus: () => inputElement.value?.focus() })
watch(() => props.modelValue, value => { if (!value) visible.value = false })
</script>

<template>
  <div class="min-w-0">
    <label :for="props.id" class="mb-1 block text-sm font-medium text-text-primary">{{ props.label }}</label>
    <div class="relative">
      <input
        :id="props.id" ref="inputElement" :value="props.modelValue" :type="visible ? 'text' : 'password'"
        :placeholder="props.placeholder" :autocomplete="props.autocomplete" :required="props.required"
        :minlength="props.minLength" :disabled="props.disabled" autocapitalize="none" autocorrect="off"
        spellcheck="false"
        class="w-full rounded-card border border-border bg-background px-3 py-2.5 pr-11 text-sm text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
      <button
        type="button" class="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-card text-text-secondary hover:bg-text-secondary/10"
        :aria-label="visible ? 'Hide password' : 'Show password'" :aria-pressed="visible"
        @mousedown.prevent @click="visible = !visible"
      >
        <EyeOff v-if="visible" class="h-4 w-4" aria-hidden="true" />
        <Eye v-else class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
