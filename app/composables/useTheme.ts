/**
 * Theme switching: Light / Dark / System, persisted to localStorage,
 * applied via a `data-theme` attribute on <html> (see tailwind.config.ts's
 * `darkMode: ['selector', '[data-theme="dark"]']` and tokens.css).
 *
 * "System" isn't a stored theme value in the DOM sense - it means "don't
 * force either theme, follow the OS preference", so we track the user's
 * explicit *choice* (which may be 'system') separately from the
 * *resolved* theme actually applied to the page.
 */
export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'isms-theme'

function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return choice
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved)
}

export function useTheme() {
  const choice = useState<ThemeChoice>('theme-choice', () => 'system')
  const resolved = useState<ResolvedTheme>('theme-resolved', () => 'light')

  function setTheme(next: ThemeChoice) {
    choice.value = next
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, next)
      resolved.value = resolveTheme(next)
      applyTheme(resolved.value)
    }
  }

  function initTheme() {
    if (!import.meta.client) return
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null
    choice.value = stored ?? 'system'
    resolved.value = resolveTheme(choice.value)
    applyTheme(resolved.value)

    // Keep in sync if the OS preference changes while "system" is active.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (choice.value === 'system') {
        resolved.value = resolveTheme('system')
        applyTheme(resolved.value)
      }
    })
  }

  return { choice, resolved, setTheme, initTheme }
}
