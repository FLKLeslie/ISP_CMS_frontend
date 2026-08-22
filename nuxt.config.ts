export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  imports: { dirs: ['composables/api'] },
  tailwindcss: { cssPath: '~/assets/css/tokens.css', configPath: 'tailwind.config.ts' },
  css: ['leaflet/dist/leaflet.css'],
  components: [{ path: '~/components', pathPrefix: false }],
  app: {
    head: {
      title: 'ISMS',
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    public: { apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000' },
  },
  typescript: { strict: true },
})