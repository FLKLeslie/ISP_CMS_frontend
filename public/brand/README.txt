BRANDING FILES
==============

logo.png   The logo shown inside the app (sidebar, sign-in page).
           Any shape. ~320 px wide is plenty; it is never drawn larger than ~80 px.

icon.png   The icon in the browser tab (and a phone's home screen).
           Must be SQUARE: the logo centred on a transparent square, ~192 x 192.

Replace either file keeping its name to change it. If you use a different name or
type (e.g. logo.svg), also change `LOGO` / `ICON` at the top of  ../../branding.config.ts .
The application NAME is not stored here - it is `name` in branding.config.ts.

The app's COLORS are not here either - the brand blue is --color-primary in
app/assets/css/tokens.css.

Browsers cache tab icons hard. After replacing a file, hard-refresh (Ctrl+Shift+R).
