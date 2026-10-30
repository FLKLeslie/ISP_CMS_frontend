import type { Config } from 'tailwindcss'
export default <Partial<Config>>{
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        // The brand color as TEXT / LINES on the page (icons, chart lines) - see tokens.css.
        'primary-text': 'rgb(var(--color-primary-text) / <alpha-value>)',
        // The white tile a logo sits on over the dark sidebar and brand panels.
        'logo-tile': 'rgb(var(--color-logo-tile) / <alpha-value>)',
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
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      borderRadius: { card: '0.625rem' },
    },
  },
}
