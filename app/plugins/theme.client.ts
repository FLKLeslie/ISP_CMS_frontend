/**
 * Applies the saved/OS theme before the app mounts, so there's no flash of
 * the wrong theme on load. Client-only (.client.ts) since theme
 * preference is inherently a browser-storage concept.
 */
export default defineNuxtPlugin(() => {
  const { initTheme } = useTheme()
  initTheme()
})
