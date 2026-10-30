<script setup lang="ts">
// The frame around a sign-in form: a brand panel beside the form on a wide screen, a
// compact brand header above it on a phone.
//
//   <AuthShell variant="customer" heading="Welcome back" subheading="..."> <LoginForm/> </AuthShell>
//
// `variant` only changes the wording of the brand panel; the colors come from the design
// tokens, so the panel follows the brand color (and its deeper dark-theme shade).
import { ShieldCheck } from 'lucide-vue-next'

const props = defineProps<{
  variant: 'customer' | 'admin'
  heading: string
  subheading?: string
}>()

const brand = useBrand()
const year = new Date().getFullYear()

// A few plain statements of what each side of the system is for - all things the
// system really does (see docs/USER_MANUAL.txt).
const points = computed(() => (props.variant === 'admin'
  ? ['Customers, plans and payments', 'Radios, access points and routers', 'Speed limits and access control']
  : ['See your plan and when it ends', 'Renew in a few taps', 'Follow your payments and notifications']))
</script>

<template>
  <div class="grid min-h-screen grid-rows-[auto_1fr] bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-rows-1">
    <!-- Brand panel -->
    <aside class="relative flex flex-col justify-between overflow-hidden bg-primary px-6 py-7 text-white sm:px-10 lg:px-14 lg:py-12">
      <!-- Soft light and signal rings echoing the logo; purely decorative. -->
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-black/25" aria-hidden="true" />
      <svg class="pointer-events-none absolute -bottom-32 -right-32 hidden h-[34rem] w-[34rem] text-white/10 lg:block" viewBox="0 0 400 400" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="200" cy="200" r="60" /><circle cx="200" cy="200" r="110" /><circle cx="200" cy="200" r="160" /><circle cx="200" cy="200" r="210" />
      </svg>

      <div class="relative flex items-center gap-3">
        <BrandLogo size="lg" tile />
        <div class="leading-tight">
          <span class="block text-xl font-semibold tracking-tight">{{ brand.name }}</span>
          <!-- Marks the administrators' page at a glance, like the "Admin" tag in the sidebar. -->
          <span v-if="props.variant === 'admin'" class="block text-[11px] font-medium uppercase tracking-wider text-white/90">Administration</span>
        </div>
      </div>

      <div class="relative hidden lg:block">
        <p v-if="brand.tagline" class="max-w-md text-4xl font-semibold leading-tight tracking-tight">{{ brand.tagline }}</p>
        <ul class="mt-8 space-y-3 text-base text-white/90">
          <li v-for="point in points" :key="point" class="flex items-center gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15" aria-hidden="true">
              <svg viewBox="0 0 16 16" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
            </span>
            {{ point }}
          </li>
        </ul>
      </div>

      <!-- On a phone the tagline sits right under the name instead. -->
      <p v-if="brand.tagline" class="relative mt-3 text-sm text-white/90 lg:hidden">{{ brand.tagline }}</p>
      <p class="relative hidden text-sm text-white/70 lg:block">&copy; {{ year }} {{ brand.name }}</p>
    </aside>

    <!-- Form side -->
    <main class="relative flex flex-col px-5 py-8 sm:px-10">
      <div class="flex justify-end"><ThemeSwitcher /></div>

      <div class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <div v-if="props.variant === 'admin'" class="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-card bg-primary-text/10 text-primary-text" aria-hidden="true">
          <ShieldCheck class="h-6 w-6" />
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{{ props.heading }}</h1>
        <p v-if="props.subheading" class="mt-2 text-sm text-text-secondary">{{ props.subheading }}</p>
        <div class="mt-8"><slot /></div>
      </div>

      <p class="text-center text-xs text-text-secondary lg:hidden">&copy; {{ year }} {{ brand.name }}</p>
    </main>
  </div>
</template>
