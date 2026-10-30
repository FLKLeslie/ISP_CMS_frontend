// The application's branding (name, tagline, logo) for use in components:
//
//   const brand = useBrand()
//   brand.name   // 'AirFiber'
//
// There is exactly one source - branding.config.ts at the project root. Change the
// name or logo THERE; never write the application's name as text in a template.
import { BRAND } from '~~/branding.config'

export const useBrand = () => BRAND
