// Shared by every page that offers Block / Connect on a device (the MikroTik
// page and the customer page), so the confirmation wording, the request, and
// how outcomes are reported are identical everywhere.
//
// The flow it drives: ask(lease, type) opens a confirmation; confirm() calls
// the API. A successful request does NOT mean the device is blocked/connected
// — the device becomes PENDING and settles only when the MikroTik's next
// report confirms it, so `notice` says exactly that. `onChange` is called
// after every attempt so the caller can refresh its lists.
import type { MikroTikLease } from '~/types/api/microtik'

export type LeaseControlType = 'block' | 'reconnect'

export function useLeaseControls(onChange: () => void | Promise<void>) {
  const { blockLease, reconnectLease } = useMikroTikApi()

  const request = ref<{ lease: MikroTikLease; type: LeaseControlType } | null>(null)
  const actingId = ref<string | null>(null)
  const error = ref('')
  const notice = ref('')

  function ask(lease: MikroTikLease, type: LeaseControlType) {
    error.value = ''
    notice.value = ''
    request.value = { lease, type }
  }

  function cancel() {
    request.value = null
  }

  async function confirm() {
    if (!request.value) return
    const { lease, type } = request.value
    actingId.value = lease.id
    error.value = ''
    notice.value = ''
    try {
      const result = type === 'block' ? await blockLease(lease.id) : await reconnectLease(lease.id)
      if (result.command.status === 'FAILED') {
        error.value = result.command.error_message
          || `The ${type === 'block' ? 'block' : 'connect'} request couldn't be delivered to the MikroTik.`
      } else {
        notice.value = type === 'block'
          ? 'Block request sent. The device shows Pending until the MikroTik confirms it.'
          : 'Connect request sent. The device shows Pending until the MikroTik confirms it.'
      }
    } catch (err) {
      // e.g. 409 when the previous command for this device is still pending.
      error.value = apiErrorMessage(err, `Couldn't ${type === 'block' ? 'block' : 'connect'} this device. Please try again.`)
    } finally {
      actingId.value = null
      request.value = null
      await onChange()
    }
  }

  const dialog = computed(() => {
    const type = request.value?.type
    const who = request.value?.lease.customer_name
    return {
      open: !!request.value,
      danger: type === 'block',
      title: type === 'block' ? 'Block this device\'s internet?' : 'Connect this device to the internet?',
      description: type === 'block'
        ? `${who ? `${who}'s device` : 'This device'} will lose internet access once the MikroTik applies it. It shows Pending until the MikroTik's next report confirms the block.`
        : `${who ? `${who}'s device` : 'This device'} will be given internet access once the MikroTik applies it. It shows Pending until the MikroTik's next report confirms it.`,
      confirmLabel: actingId.value ? 'Please wait…' : type === 'block' ? 'Block' : 'Connect',
    }
  })

  return { request, actingId, error, notice, dialog, ask, cancel, confirm }
}
