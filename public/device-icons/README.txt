Device pictures go here.

1. Add the image (square, transparent background works best; .png/.svg/.webp).
2. Register it in app/utils/deviceIcons.ts -> DEVICE_ICON_IMAGES, e.g.
     powerbeam: '/device-icons/powerbeam.png',

The keys are: powerbeam, nanobeam, litebeam, liteap, nanostation, rocket,
gigabeam, airfiber, antenna, mikrotik, generic.

Which key a device gets is decided by the backend from the device's model
(backend/devices/identity.py); an administrator can also pin one per device.
