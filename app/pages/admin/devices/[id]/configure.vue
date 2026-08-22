<script setup lang="ts">
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const deviceId = route.params.id as string

const { getDevice } = useDevicesApi()
const { createCommand } = useDeviceCommandsApi()

const { data: device, pending, error, refresh } = await useAsyncData(
  `admin-device-${deviceId}-configure`,
  () => getDevice(deviceId),
)

// --- Reboot Now (immediate REBOOT command) ---------------------------------
// Separate from the scheduled auto_reboot config field below — this fires
// an immediate REBOOT command through Node right now, rather than setting
// a recurring schedule on the device itself.
const showRebootConfirm = ref(false)
const rebooting = ref(false)
const rebootResult = ref<{ ok: boolean; message: string } | null>(null)

async function handleConfirmedReboot() {
  showRebootConfirm.value = false
  rebooting.value = true
  rebootResult.value = null
  try {
    const command = await createCommand({ device: deviceId, command_type: 'REBOOT' })
    // Same honest-status pattern as the config-push flow below: a 201
    // response only confirms the command record was CREATED, not that
    // the device actually rebooted — command.status is Node's real
    // delivery/confirmation result, and that's what gets shown here.
    if (command.status === 'COMPLETED' || command.status === 'SENT') {
      rebootResult.value = { ok: true, message: 'Reboot command sent successfully.' }
    } else if (command.status === 'FAILED' || command.status === 'CANCELLED') {
      rebootResult.value = { ok: false, message: `Reboot ${command.status.toLowerCase()} — Node did not confirm delivery.` }
    } else {
      rebootResult.value = { ok: true, message: 'Reboot queued — device may be offline; will apply once reachable.' }
    }
  } catch {
    rebootResult.value = { ok: false, message: 'Could not send the reboot command. Try again.' }
  } finally {
    rebooting.value = false
  }
}

// Scope note: only SSID and the scheduled-reboot fields are exposed here.
// Wireless mode and static IP assignment are deliberately NOT editable
// through this screen — both can sever a device's own network link if
// pushed incorrectly (e.g. a device in Station mode losing its
// association, or a bad gateway/IP taking it off-subnet), which means
// recovering from a mistake requires a physical site visit. SSID and
// reboot scheduling carry no such risk. See the project's config-safety
// principles: "require confirmation for potentially disruptive changes"
// and "don't store every possible configuration option."
const ssid = ref('')
const autoReboot = ref<boolean | null>(null)
const rebootTime = ref('')

// Pre-fill the form from the device's current (last-synced) configuration
// once it loads, so the admin edits from a known starting point rather
// than a blank form.
watch(device, (d) => {
  if (!d?.configuration) return
  ssid.value = d.configuration.ssid ?? ''
  autoReboot.value = d.configuration.auto_reboot
  rebootTime.value = d.configuration.reboot_time ?? ''
}, { immediate: true })

const showConfigConfirm = ref(false)
const sending = ref(false)
const result = ref<{ ok: boolean; message: string } | null>(null)

// Only send fields that actually changed from the last-synced value —
// an empty/no-op UPDATE_CONFIG payload is rejected by the backend
// (UpdateConfigCommandPayloadSerializer requires at least one field), and
// sending unchanged fields would just be noise in the command log.
const changedPayload = computed(() => {
  const current = device.value?.configuration
  const payload: Record<string, unknown> = {}
  if (ssid.value !== (current?.ssid ?? '')) payload.ssid = ssid.value
  if (autoReboot.value !== (current?.auto_reboot ?? null)) payload.auto_reboot = autoReboot.value
  if (rebootTime.value !== (current?.reboot_time ?? '')) payload.reboot_time = rebootTime.value || null
  return payload
})
const hasChanges = computed(() => Object.keys(changedPayload.value).length > 0)

async function handleConfirmedConfigSend() {
  showConfigConfirm.value = false
  sending.value = true
  result.value = null
  try {
    const command = await createCommand({
      device: deviceId,
      command_type: 'UPDATE_CONFIG',
      payload: changedPayload.value,
    })
    // Mirrors the same honest-status pattern used for Reboot: a 201
    // response only confirms the command was CREATED, not that the
    // device applied it — command.status is Node's actual delivery/
    // confirmation result, and that's what must be shown, not an
    // assumption drawn from the request succeeding.
    if (command.status === 'COMPLETED') {
      result.value = { ok: true, message: 'Configuration applied and confirmed by the device.' }
      await refresh() // pulls the now-synced DeviceConfiguration back in
    } else if (command.status === 'FAILED' || command.status === 'CANCELLED') {
      result.value = { ok: false, message: `Device did not apply the change (${command.status.toLowerCase()}). Nothing was changed.` }
    } else if (command.status === 'PENDING') {
      result.value = { ok: true, message: 'Queued — device may be offline. Will apply once reachable; nothing confirmed yet.' }
    } else {
      result.value = { ok: true, message: 'Sent to the device — awaiting its confirmation.' }
    }
  } catch {
    result.value = { ok: false, message: 'Could not send this configuration change. Try again.' }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <NuxtLink :to="`/admin/devices/${deviceId}`" class="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
      <ArrowLeft class="h-4 w-4" /> Back to {{ device?.device_name || 'Device' }}
    </NuxtLink>

    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />

    <template v-else-if="device">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Configure {{ device.device_name }}</h1>
        <p class="mt-1 text-sm text-text-secondary">
          Changes are sent to the device and only take effect once it confirms them — nothing here is
          applied just by saving the form.
        </p>
      </div>

      <div v-if="device.configuration?.last_synced" class="text-xs text-text-secondary">
        Last confirmed by device: {{ formatDateTime(device.configuration.last_synced) }}
        <span v-if="device.configuration.updated_by_name"> · by {{ device.configuration.updated_by_name }}</span>
      </div>

      <!-- Device Actions -->
      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Device Actions</h2>
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            :disabled="rebooting"
            class="inline-flex items-center gap-1.5 rounded-card border border-error px-4 py-2 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
            @click="showRebootConfirm = true"
          >
            <RefreshCw class="h-4 w-4" /> {{ rebooting ? 'Sending…' : 'Reboot Now' }}
          </button>
          <p v-if="rebootResult" class="flex items-center gap-1.5 text-sm" :class="rebootResult.ok ? 'text-text-secondary' : 'text-error'">
            <ShieldAlert v-if="!rebootResult.ok" class="h-4 w-4 shrink-0" />
            {{ rebootResult.message }}
          </p>
        </div>
      </div>

      <div class="space-y-4 rounded-card border border-border bg-surface p-5">
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Network Name (SSID)</label>
          <input
            v-model="ssid"
            maxlength="100"
            class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent sm:max-w-sm"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-medium text-text-primary">Scheduled Reboot</label>
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 text-sm text-text-primary">
              <input v-model="autoReboot" type="checkbox" class="rounded border-border" />
              Enable scheduled reboot
            </label>
            <input
              v-model="rebootTime"
              type="time"
              :disabled="!autoReboot"
              class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
        </div>

        <div class="border-t border-border pt-4">
          <button
            type="button"
            :disabled="!hasChanges || sending"
            class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            @click="showConfigConfirm = true"
          >
            {{ sending ? 'Sending…' : 'Send to Device' }}
          </button>
          <p v-if="!hasChanges" class="mt-2 text-xs text-text-secondary">No changes to send yet.</p>
        </div>

        <p
          v-if="result"
          class="flex items-start gap-1.5 text-sm"
          :class="result.ok ? 'text-text-secondary' : 'text-error'"
        >
          <ShieldAlert v-if="!result.ok" class="mt-0.5 h-4 w-4 shrink-0" />
          {{ result.message }}
        </p>
      </div>

      <p class="text-xs text-text-secondary">
        Wireless mode and IP assignment aren't editable here — an incorrect change to either can
        disconnect the device from the network entirely and require an on-site visit to recover.
      </p>
    </template>

    <ConfirmationDialog
      :open="showConfigConfirm"
      title="Send this configuration to the device?"
      description="The device will apply this the next time it checks in. This may briefly interrupt its connection."
      confirm-label="Send"
      @confirm="handleConfirmedConfigSend"
      @cancel="showConfigConfirm = false"
    />

    <ConfirmationDialog
      :open="showRebootConfirm"
      title="Reboot this device now?"
      description="The device will restart immediately. Its connection will briefly drop while it comes back up."
      confirm-label="Reboot"
      danger
      @confirm="handleConfirmedReboot"
      @cancel="showRebootConfirm = false"
    />
  </div>
</template>