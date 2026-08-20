export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
const STORAGE_KEY = 'isms-theme'

function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return choice
}
function applyTheme(resolved: ResolvedTheme) { document.documentElement.setAttribute('data-theme', resolved) }

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
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (choice.value === 'system') { resolved.value = resolveTheme('system'); applyTheme(resolved.value) }
    })
  }
  return { choice, resolved, setTheme, initTheme }
}
