// Device pictures.
//
// How it works end to end:
//   1. A device reports its model (e.g. "PBE-5AC-Gen2", "N5N").
//   2. The BACKEND looks that model up in the product catalog
//      (backend devices/data/device_icons_lines_products.json) and stores the
//      result on the device/access point/router record: `icon_id`,
//      `product_name`, `product_line`. They are re-read whenever the model changes.
//   3. This frontend never works anything out - it only turns the stored
//      `icon_id` into an image address and draws it. The images live in
//      frontend/devices/<icon_id>.png and are served at /devices/<icon_id>.png
//      (nuxt.config.ts -> nitro.publicAssets).
//   4. No `icon_id` (model not in the catalog), or no image file for it, or the
//      image fails to load -> the generic icon is drawn instead. Never a blank.
//
// To add pictures for new products: drop <icon id>.png into frontend/devices/.
// To teach the system a new model: add it to the catalog JSON (backend) - the
// frontend needs no change.

// Where the images are served from (see nuxt.config.ts). One place to change.
export const DEVICE_ICON_BASE = '/devices'

export function deviceIconUrl(iconId: string | null | undefined): string | null {
  return iconId ? `${DEVICE_ICON_BASE}/${encodeURIComponent(iconId)}.png` : null
}

// Icon ids whose image failed to load this session. Shared across the whole app
// so a table of twenty identical radios makes ONE failed request, not twenty, and
// a missing image never flickers between the image and the fallback as rows redraw.
const failedIconIds = reactive(new Set<string>())

export function markDeviceIconFailed(iconId: string) {
  failedIconIds.add(iconId)
}

export function isDeviceIconFailed(iconId: string | null | undefined): boolean {
  return !!iconId && failedIconIds.has(iconId)
}
