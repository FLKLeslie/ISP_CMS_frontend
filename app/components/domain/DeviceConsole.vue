<script setup lang="ts">
// Raw shell console for a single device (Administrator only). Talks to
// Django's /api/devices/{id}/console/open|write|close/ actions, which
// proxy to Node's terminal/open|write|close endpoints - see
// devices/node_client.py (open_terminal/write_terminal/close_terminal)
// and devices/views.py (DeviceViewSet.console_open/write/close) on the
// backend. Nothing about a session is persisted anywhere: `terminalId`
// only means anything to Node's own in-memory session map for as long as
// that one session is open.
import { LogOut, Terminal as TerminalIcon } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; deviceId: string; deviceName: string }>()
const emit = defineEmits<{ close: [] }>()

const { openConsole, writeConsole, closeConsole } = useDeviceConsoleApi()

type Phase = 'login' | 'connecting' | 'session'
type Line = { kind: 'input' | 'output' | 'system'; text: string }

const phase = ref<Phase>('login')
const username = ref('ubnt')
const password = ref('')
const loginError = ref('')
const connecting = ref(false)

const terminalId = ref<string | null>(null)
const lines = ref<Line[]>([])
const commandInput = ref('')
const sending = ref(false)

const history = ref<string[]>([])
const historyIndex = ref<number | null>(null)

const scrollbackEl = ref<HTMLElement | null>(null)
const commandInputEl = ref<HTMLInputElement | null>(null)
const passwordInputEl = ref<HTMLInputElement | null>(null)

function resetToLogin() {
  phase.value = 'login'
  password.value = ''
  loginError.value = ''
  terminalId.value = null
  lines.value = []
  commandInput.value = ''
  history.value = []
  historyIndex.value = null
}

// Re-arm the login form every time the panel is (re)opened for a device,
// and whenever it's opened for a DIFFERENT device while already showing
// one (shouldn't normally happen since the parent unmounts/remounts per
// device, but this keeps a stray leftover session from ever appearing to
// belong to the wrong device).
watch(() => [props.open, props.deviceId], ([isOpen]) => {
  if (isOpen) {
    resetToLogin()
    nextTick(() => passwordInputEl.value?.focus())
  }
}, { immediate: true })

async function scrollToBottom() {
  await nextTick()
  if (scrollbackEl.value) scrollbackEl.value.scrollTop = scrollbackEl.value.scrollHeight
}

async function handleConnect() {
  if (connecting.value) return
  loginError.value = ''
  connecting.value = true
  phase.value = 'connecting'
  try {
    const result = await openConsole(props.deviceId, username.value.trim() || 'ubnt', password.value)
    if (result.status === 'completed' && result.terminal_id) {
      terminalId.value = result.terminal_id
      lines.value = []
      if (result.output) lines.value.push({ kind: 'output', text: result.output })
      phase.value = 'session'
      await scrollToBottom()
      nextTick(() => commandInputEl.value?.focus())
    } else {
      phase.value = 'login'
      loginError.value = result.error === 'invalid-login'
        ? 'Incorrect username or password.'
        : result.error || (result.status === 'timeout' ? "The device didn't respond in time." : "Couldn't open a console on this device.")
    }
  } catch {
    phase.value = 'login'
    loginError.value = "Couldn't reach the device communication service. Try again."
  } finally {
    connecting.value = false
  }
}

async function handleSend() {
  if (sending.value || phase.value !== 'session' || !terminalId.value) return
  const command = commandInput.value
  lines.value.push({ kind: 'input', text: command })
  if (command.trim()) history.value.push(command)
  historyIndex.value = null
  commandInput.value = ''
  sending.value = true
  await scrollToBottom()
  try {
    const result = await writeConsole(props.deviceId, terminalId.value, command)
    if (result.output) lines.value.push({ kind: 'output', text: result.output })
    if (result.status !== 'completed') {
      lines.value.push({ kind: 'system', text: result.error || `(session ${result.status})` })
    }
  } catch {
    lines.value.push({ kind: 'system', text: "Couldn't reach the device communication service." })
  } finally {
    sending.value = false
    await scrollToBottom()
    nextTick(() => commandInputEl.value?.focus())
  }
}

function historyUp() {
  if (!history.value.length) return
  const next = historyIndex.value === null ? history.value.length - 1 : Math.max(0, historyIndex.value - 1)
  historyIndex.value = next
  commandInput.value = history.value[next] ?? ''
}
function historyDown() {
  if (historyIndex.value === null) return
  const next = historyIndex.value + 1
  if (next >= history.value.length) {
    historyIndex.value = null
    commandInput.value = ''
    return
  }
  historyIndex.value = next
  commandInput.value = history.value[next] ?? ''
}

// Best-effort: fires the close request but never blocks the UI on it -
// the backend itself tolerates Node being unreachable here (see
// DeviceViewSet.console_close), so there's nothing more useful to do
// than let the panel close either way.
function endSession() {
  const idToClose = terminalId.value
  if (idToClose) closeConsole(props.deviceId, idToClose).catch(() => {})
  resetToLogin()
  emit('close')
}

// A closed browser tab / navigation-away never fires the click handler
// above, so also close on unmount whenever a session is still open.
onUnmounted(() => {
  if (terminalId.value) closeConsole(props.deviceId, terminalId.value).catch(() => {})
})
</script>

<template>
  <div v-if="props.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
    <div class="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-card border border-border bg-surface shadow-lg">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="flex items-center gap-2">
          <TerminalIcon class="h-4 w-4 text-text-secondary" />
          <h2 class="text-sm font-semibold text-text-primary">Console — {{ props.deviceName }}</h2>
          <span
            v-if="phase === 'session'"
            class="rounded-full bg-success/15 px-2 py-0.5 text-[0.65rem] font-medium text-success"
          >Connected</span>
        </div>
        <button
          type="button"
          class="flex items-center gap-1 rounded-card px-2 py-1 text-xs font-medium text-text-secondary hover:bg-text-secondary/10 hover:text-text-primary"
          @click="endSession"
        >
          <LogOut class="h-3.5 w-3.5" />
          {{ phase === 'session' ? 'Disconnect' : 'Close' }}
        </button>
      </div>

      <!-- Login form -->
      <div v-if="phase !== 'session'" class="flex flex-1 items-center justify-center p-6">
        <form class="w-full max-w-xs space-y-3" @submit.prevent="handleConnect">
          <p class="text-xs text-text-secondary">
            Log in to this device's console. Credentials are sent for this session only and are never stored.
          </p>
          <div>
            <label class="mb-1 block text-xs font-medium text-text-secondary">Username</label>
            <input
              v-model="username" type="text" autocomplete="off"
              class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-text-secondary">Password</label>
            <input
              ref="passwordInputEl" v-model="password" type="password" autocomplete="off"
              class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
          </div>
          <p v-if="loginError" role="alert" class="text-sm text-error">{{ loginError }}</p>
          <button type="submit" :disabled="connecting" class="btn-primary w-full">
            {{ connecting ? 'Connecting…' : 'Connect' }}
          </button>
        </form>
      </div>

      <!-- Terminal -->
      <template v-else>
        <div
          ref="scrollbackEl"
          class="flex-1 overflow-y-auto bg-black px-4 py-3 font-mono text-[0.8rem] leading-relaxed text-slate-100"
        >
          <template v-for="(line, index) in lines" :key="index">
            <div v-if="line.kind === 'input'" class="text-sky-400">
              <span class="select-none text-slate-500">$ </span>{{ line.text }}
            </div>
            <div v-else-if="line.kind === 'system'" class="text-amber-400">{{ line.text }}</div>
            <pre v-else class="whitespace-pre-wrap font-mono">{{ line.text }}</pre>
          </template>
        </div>
        <form class="flex items-center gap-2 border-t border-border bg-black px-4 py-2" @submit.prevent="handleSend">
          <span class="select-none font-mono text-[0.8rem] text-slate-500">$</span>
          <input
            ref="commandInputEl" v-model="commandInput" type="text" autocomplete="off" spellcheck="false"
            :disabled="sending"
            class="flex-1 bg-transparent font-mono text-[0.8rem] text-slate-100 outline-none disabled:opacity-50"
            placeholder="Type a command and press Enter…"
            @keydown.up.prevent="historyUp"
            @keydown.down.prevent="historyDown"
          >
        </form>
      </template>
    </div>
  </div>
</template>
