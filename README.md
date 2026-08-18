# ISMS Frontend

Nuxt 4 + TypeScript + Tailwind CSS frontend for the Internet Subscription
Management System, consuming the Django REST API. Never talks to the
Node.js device-communication service directly.

This is the **first build slice**: project scaffold, design tokens, both
themes, and the shared shell (`AppShell`/`Sidebar`/`Topbar`/
`ThemeSwitcher`/`NotificationBell`/`StatusBadge`). Auth flow and real
pages come next.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` if your Django API isn't running at the default
`http://127.0.0.1:8000` (e.g. if you're pointing at an ngrok tunnel or a
deployed backend):

```
NUXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

Run it:

```bash
npm run dev
```

Open `http://localhost:3000`. You should see a small "Scaffold OK" page
at `/`, and can visit `/customer` and `/admin` directly to see each
portal's shell (sidebar nav, topbar, theme switcher) rendering with
placeholder dashboard content - the nav links between pages will 404 for
now, since those pages don't exist yet.

## Verifying it's working correctly

```bash
npm run build   # production build - should complete with no errors
```

Try the theme switcher (top right, in `/customer` or `/admin`) - it
should immediately flip all colors, including on a full page reload
(persisted via `localStorage`, key `isms-theme`).

## Project structure

```
app/
├── app.vue                  root component (NuxtLayout + NuxtPage)
├── assets/css/tokens.css    design tokens (colors, both themes) - single
│                             source of truth, see comments inline
├── components/
│   ├── shell/                AppShell, Sidebar, Topbar, ThemeSwitcher, NotificationBell
│   ├── domain/                 StatusBadge (more domain components land here as pages are built)
│   ├── data/                     (empty - DataTable, Pagination etc. land here next)
│   ├── charts/                     (empty - MetricChart etc. land here later)
│   └── map/                          (empty - DeviceMap lands here later)
├── composables/
│   └── useTheme.ts           light/dark/system theme state + persistence
├── layouts/
│   ├── customer.vue          wires AppShell with the customer nav
│   └── admin.vue             wires AppShell with the admin nav
├── pages/
│   ├── index.vue             placeholder (will become the auth-aware redirect)
│   ├── customer/index.vue    placeholder dashboard
│   └── admin/index.vue       placeholder dashboard
├── plugins/
│   └── theme.client.ts       applies saved theme before first paint
└── types/
    └── nav.ts                shared NavItem type
```

Tailwind config (`tailwind.config.ts`, project root) maps every token in
`tokens.css` to a Tailwind color name - `bg-primary`, `text-error`,
`border-border`, etc. - all opacity-modifier compatible (`bg-primary/10`).

## What's next

Auth flow (JWT login/refresh, Pinia store, route guards by role), then
the customer portal pages, then admin.
