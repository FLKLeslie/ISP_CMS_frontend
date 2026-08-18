// Nuxt configuration for the ISMS frontend.
//
// Key decisions, matching the approved architecture doc:
// - @nuxtjs/tailwindcss for styling (design tokens live in assets/css/tokens.css)
// - @pinia/nuxt for the auth store (JWT access/refresh handling)
// - runtimeConfig.public.apiBase points at the Django REST API - the ONLY
//   backend this frontend ever talks to directly (never Node, per the spec)
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Client-rendered SPA, not server-rendered - see commit message / chat
  // for why: auth state lives in localStorage, which the server can't see,
  // so SSR would mean protected pages briefly render before a client-side
  // redirect fires. Nothing here needs SEO, so this is a clean trade.
  ssr: false,

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  // Nuxt auto-imports composables from the top level of composables/ by
  // default, but NOT from subdirectories - composables/api/*.ts needs to
  // be explicitly added, or every function in there is undefined at
  // runtime (this bit us once already: useAuthApi() threw
  // "useAuthApi is not defined" until this was added).
  imports: {
    dirs: ['composables/api'],
  },

  tailwindcss: {
    cssPath: '~/assets/css/tokens.css',
    configPath: 'tailwind.config.ts',
  },

  components: [{ path: '~/components', pathPrefix: false }],

  app: {
    head: {
      title: 'ISMS',
      htmlAttrs: { lang: 'en' },
      link: [
        // Inter, per the design spec's typography section.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // Django REST API base URL. Overridden per-environment via the
      // NUXT_PUBLIC_API_BASE env var - never hard-coded per environment.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000',
    },
  },

  typescript: {
    strict: true,
  },
})
