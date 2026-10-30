// =============================================================================
// BRANDING - the ONE place the application's name and logo are defined.
//
//   To rename the app:     change `name` below. Nothing else.
//   To change the logo:    replace public/brand/logo.png (shown in the app) and
//                          public/brand/icon.png (the browser-tab icon) - keep the
//                          file names, or change `LOGO` / `ICON` below.
//
// This file is read both by the build (nuxt.config.ts: the browser-tab title and
// the favicon) and by the running app (useBrand(): sidebar, sign-in page, ...), so
// the two can never disagree. After changing it, restart `npm run dev` (or rebuild)
// - the tab title and icon are written into the page at build time.
//
// See docs/PROJECT_HANDOVER.txt ("Branding") for the full guide.
// =============================================================================

// Where the logo lives. Anything under public/ is served from the site root, so
// public/brand/logo.png is available at /brand/logo.png.
//   - PNG, SVG or WebP all work. SVG is sharpest at every size.
//   - A SQUARE image, at least 512 x 512, with a transparent background works best:
//     it is used both as the logo in the app and as the icon in the browser tab.
//   - If you use another file name or type (e.g. logo.svg), change it HERE.
const LOGO = '/brand/logo.png'

// The browser-tab icon. Browsers want a SQUARE image and the AirFiber logo isn't, so
// the tab uses icon.png: the same artwork centred on a transparent square. If your
// logo IS square you can point this at LOGO instead and delete icon.png.
const ICON = '/brand/icon.png'

export const BRAND = {
  /** The application's name. Shown in the browser tab, the sidebar and the sign-in page. */
  name: 'AirFiber',

  /** One line describing the product, shown under the name on the sign-in page. Set to '' to hide it. */
  tagline: 'Unlimited High speed internet',

  /**
   * The logo drawn inside the app. Until the file exists (or if it is set to null)
   * the app draws a simple tile with the first letter of the name instead, so there
   * is never a broken image.
   */
  logo: LOGO as string | null,

  /**
   * The small icon in the browser tab (and when the site is saved to a phone's home
   * screen). A square image - see ICON above. null = no tab icon.
   */
  icon: ICON as string | null,
}

/** The MIME type for an image path, from its extension (used for the <link rel="icon"> tag). */
export function imageMimeType(path: string): string {
  const extension = path.split('?')[0]?.split('.').pop()?.toLowerCase()
  return (
    { svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', ico: 'image/x-icon', jpg: 'image/jpeg', jpeg: 'image/jpeg' } as Record<string, string>
  )[extension ?? ''] ?? 'image/png'
}
