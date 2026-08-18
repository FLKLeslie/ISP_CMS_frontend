import type { Config } from 'tailwindcss'

/**
 * Maps the CSS custom properties in assets/css/tokens.css to Tailwind
 * color utilities. `rgb(var(--x) / <alpha-value>)` is what enables opacity
 * modifiers (bg-primary/10, text-error/80, etc.) while still reading the
 * value from a CSS variable that changes per-theme.
 */
export default <Partial<Config>>{
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // A restrained radius scale - the spec explicitly warns against
      // "excessive rounded cards", so we keep this modest rather than
      // reaching for Tailwind's largest defaults everywhere.
      borderRadius: {
        card: '0.625rem',
      },
    },
  },
}
