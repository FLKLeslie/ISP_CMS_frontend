<script setup lang="ts">
import L from 'leaflet'
import { LMap, LMarker, LPopup, LTileLayer } from '@vue-leaflet/vue-leaflet'
import { MapPin } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const { listDevicesWithLocation } = useDevicesApi()
const { listAccessPointsWithLocation } = useAccessPointsApi()

const { data: deviceData, pending: devicesPending, error: devicesError } = await useAsyncData(
  'admin-map-devices', () => listDevicesWithLocation(),
)
const { data: apData, pending: apsPending, error: apsError } = await useAsyncData(
  'admin-map-aps', () => listAccessPointsWithLocation(),
)

const pending = computed(() => devicesPending.value || apsPending.value)
const error = computed(() => devicesError.value || apsError.value)

const devices = computed(() => deviceData.value?.results ?? [])
const accessPoints = computed(() => apData.value?.results ?? [])
const hasAnyMarkers = computed(() => devices.value.length > 0 || accessPoints.value.length > 0)

// Small colored-dot markers built as plain divIcons rather than pulling in
// extra icon image assets — a solid circle is enough to distinguish
// status at a glance, and keeps every marker visually consistent.
function makeDivIcon(colorHex: string, sizePx = 16) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${sizePx}px;height:${sizePx}px;border-radius:9999px;background:${colorHex};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [sizePx, sizePx],
    iconAnchor: [sizePx / 2, sizePx / 2],
  })
}

const deviceOnlineIcon = makeDivIcon('#16A34A') // success green
const deviceOfflineIcon = makeDivIcon('#DC2626') // error red
const deviceUnknownIcon = makeDivIcon('#94A3B8') // neutral gray
const apIcon = makeDivIcon('#0F2747', 18) // primary navy, slightly larger to distinguish from devices

function deviceIconFor(online: boolean | null) {
  if (online === true) return deviceOnlineIcon
  if (online === false) return deviceOfflineIcon
  return deviceUnknownIcon
}

// Center/zoom the map to fit whatever markers actually exist, rather than
// guessing a fixed center — falls back to a reasonable default (Douala,
// matching the project's configured timezone) only when there's truly
// nothing to show yet.
const allCoords = computed(() => {
  const fromDevices = devices.value
    .filter((d) => d.latitude != null && d.longitude != null)
    .map((d) => [Number(d.latitude), Number(d.longitude)] as [number, number])
  const fromAPs = accessPoints.value
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => [Number(a.latitude), Number(a.longitude)] as [number, number])
  return [...fromDevices, ...fromAPs]
})
const mapCenter = computed<[number, number]>(() =>
  allCoords.value.length ? allCoords.value[0] : [4.0511, 9.7679]
)
const mapZoom = computed(() => (allCoords.value.length ? 12 : 6))

const mapRef = ref()
// Once markers exist, fit the view to show all of them with a bit of
// padding, rather than leaving the map centered on just the first one.
watch(allCoords, (coords) => {
  if (!coords.length || !mapRef.value?.leafletObject) return
  if (coords.length === 1) {
    mapRef.value.leafletObject.setView(coords[0], 14)
  } else {
    mapRef.value.leafletObject.fitBounds(coords, { padding: [40, 40] })
  }
}, { flush: 'post' })
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Device Map</h1>
      <p class="mt-1 text-sm text-text-secondary">
        Shows devices and access points that have a pinned location. Devices without one won't
        appear here — pin a location from the device's edit form whenever convenient.
      </p>
    </div>

    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="() => refreshNuxtData(['admin-map-devices', 'admin-map-aps'])" />
    <EmptyState
      v-else-if="!hasAnyMarkers"
      :icon="MapPin"
      title="No pinned locations yet"
      description="Add a latitude/longitude to a device or access point to see it here."
    />
    <template v-else>
      <div class="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-success" /> Device online</span>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-error" /> Device offline</span>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-text-secondary/50" /> Device status unknown</span>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-primary" /> Access point</span>
      </div>

      <div class="overflow-hidden rounded-card border border-border" style="height: 560px">
        <ClientOnly>
          <LMap ref="mapRef" :zoom="mapZoom" :center="mapCenter" :use-global-leaflet="false">
            <LTileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <LMarker
              v-for="d in devices.filter(dv => dv.latitude != null && dv.longitude != null)"
              :key="`device-${d.id}`"
              :lat-lng="[Number(d.latitude), Number(d.longitude)]"
              :icon="deviceIconFor(d.online)"
            >
              <LPopup>
                <div class="text-sm">
                  <p class="font-semibold">{{ d.device_name }}</p>
                  <p class="text-text-secondary">{{ d.customer_name }}</p>
                  <NuxtLink :to="`/admin/devices/${d.id}`" class="mt-1 inline-block text-accent hover:underline">
                    View device →
                  </NuxtLink>
                </div>
              </LPopup>
            </LMarker>
            <LMarker
              v-for="ap in accessPoints.filter(a => a.latitude != null && a.longitude != null)"
              :key="`ap-${ap.id}`"
              :lat-lng="[Number(ap.latitude), Number(ap.longitude)]"
              :icon="apIcon"
            >
              <LPopup>
                <div class="text-sm">
                  <p class="font-semibold">{{ ap.name }}</p>
                  <p class="text-text-secondary">{{ ap.site || 'Access Point' }}</p>
                </div>
              </LPopup>
            </LMarker>
          </LMap>
          <template #fallback>
            <div class="flex h-full items-center justify-center text-sm text-text-secondary">Loading map…</div>
          </template>
        </ClientOnly>
      </div>
    </template>
  </div>
</template>