/**
 * End staff sessions after a period without user activity.
 * This is a client-side usability/security layer; JWT expiry and server authorization
 * remain the authoritative controls.
 */
export function useStaffIdleTimeout(onTimeout: () => unknown | Promise<unknown>, idleMs = 20 * 60 * 1000) {
  if (!import.meta.client) return

  let timer: ReturnType<typeof setTimeout> | undefined
  let lastActivity = Date.now()
  let expired = false

  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  const expireIfIdle = () => {
    const remaining = idleMs - (Date.now() - lastActivity)
    if (remaining <= 0) {
      if (!expired) {
        expired = true
        clear()
        void onTimeout()
      }
      return
    }
    clear()
    timer = setTimeout(expireIfIdle, remaining)
  }
  const activity = () => {
    if (expired) return
    lastActivity = Date.now()
    expireIfIdle()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') expireIfIdle()
  }
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel']

  onMounted(() => {
    lastActivity = Date.now()
    expireIfIdle()
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)
  })
  onBeforeUnmount(() => {
    clear()
    events.forEach((event) => window.removeEventListener(event, activity))
    document.removeEventListener('visibilitychange', onVisibility)
  })
}
