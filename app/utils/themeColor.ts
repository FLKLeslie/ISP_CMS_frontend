// Design-token colors as literal values.
//
// Almost everything is colored with Tailwind classes (bg-primary, text-secondary...)
// which follow the tokens in assets/css/tokens.css automatically. A few things can't
// use a class - Leaflet map markers, chart libraries - and need an actual color value.
// Those must read it from the token HERE, never type a hex code: a hex typed into a
// page is a copy that silently stops following the brand color (that is exactly how
// the map's access-point markers stayed navy when the nav color was meant to change).
//
//   tokenHex('primary')       ->  '#0062cc'   the brand color as a FILL (deeper in the dark theme)
//   tokenHex('primary-text')  ->  '#0062cc'   the brand color as a LINE/TEXT (lighter in the dark theme)
export type ColorToken = 'primary' | 'primary-text' | 'secondary' | 'accent' | 'success' | 'warning' | 'error'

export function tokenHex(token: ColorToken, fallback = '#475569'): string {
  if (typeof document === 'undefined') return fallback // no DOM (never the case in this client-only app)
  // The tokens are stored as "R G B", e.g. "0 98 204".
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim()
  const channels = raw.split(/[\s,]+/).map(Number)
  if (channels.length < 3 || channels.slice(0, 3).some((n) => !Number.isFinite(n))) return fallback
  return `#${channels.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`
}
