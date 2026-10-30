import type { NuxtConfig } from 'nuxt/schema'
import { BRAND, imageMimeType } from './branding.config'

// One <link> entry, typed from Nuxt's own config so the icon tags below are checked.
type HeadLink = NonNullable<NonNullable<NonNullable<NuxtConfig['app']>['head']>['link']>[number]

// The icon in the browser tab (and on a phone's home screen), from branding.config.ts.
// No icon configured = no tags.
const brandIconLinks: HeadLink[] = BRAND.icon
  ? [
      { rel: 'icon', type: imageMimeType(BRAND.icon), href: BRAND.icon },
      { rel: 'apple-touch-icon', href: BRAND.icon },
    ]
  : []

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
      // The application name and tab icon come from branding.config.ts - change them
      // there, not here. (Per-page titles get " · <name>" appended: see app.vue.)
      title: BRAND.name,
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'application-name', content: BRAND.name },
        { name: 'apple-mobile-web-app-title', content: BRAND.name },
        ...(BRAND.tagline ? [{ name: 'description', content: `${BRAND.name} - ${BRAND.tagline}` }] : []),
      ],
      link: [
        ...brandIconLinks,
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    public: { apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000' },
  },
  // Device pictures. The product images (and the JSON that names them) live in
  // frontend/devices/ - outside public/ - so Nitro is told to serve that folder
  // at /devices/<icon id>.png. The backend stores each device's icon id; see
  // docs/PROJECT_HANDOVER.txt (Device pictures) and components/domain/DeviceIcon.vue.
  // A folder that doesn't exist (yet) is simply not served - the app then draws
  // its generic icons.
  //
  // Registered in a hook because Nitro needs an ABSOLUTE path here and a plain
  // relative one is not resolved against the project root; building it from
  // Nitro's own rootDir also avoids importing Node's path/url helpers.
  hooks: {
    'nitro:config'(nitroConfig) {
      nitroConfig.publicAssets = [
        ...(nitroConfig.publicAssets ?? []),
        {
          dir: `${nitroConfig.rootDir}/devices`,
          baseURL: '/devices',
          maxAge: 60 * 60 * 24 * 30, // an image never changes under the same id; cache for 30 days
        },
      ]
    },
  },
  typescript: { strict: true },
})