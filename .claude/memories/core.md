# Core — GreatwallScanningApp (Operations Hub)

Next.js 15 app (App Router). Operations hub for Great Wall Trading. Bridges gaps in ActiveOne ERP.
Target: Android mobile/tablet browsers. Platform: Windows 11.

## Source Map

```
app/                   # Next.js App Router — route files ONLY
  (auth)/login/        # login route (public)
  (authenticated)/     # business module routes (layout-only group, no URL change)
    {module}/
      page.tsx         # client component ("use client")
      api/route.ts     # HTTP adapter (server-only)
  (setup)/setup/       # first-run wizard route
  connect/             # DB-connect route
  globals.css          # Tailwind v4 CSS-first config + semantic tokens
  layout.tsx           # root layout, company_name from app_settings
  page.tsx             # module launcher (route /)

src/                   # all non-route source (@/* → ./src/*)
  {module}/
    domain/            # entities, repository port interfaces
    application/       # use cases, external service port interfaces
    infrastructure/    # concrete adapters
  shared/              # cross-module code only
    domain/            # UserRole, shared types
    application/       # shared use cases
    infrastructure/    # db.ts (MySQL pool), auth.ts, authEdge.ts, authConfig.ts
    ui/                # shadcn components, useScanner.ts, utils.ts
  container.ts         # single composition root; all use-case factories

middleware.ts          # auth guard; only /login and /api/auth are public
tests/                 # test suites (empty)
```

## Active Modules

`delivery`, `counting`, `invoice`, `transfer`, `replenishment`, `history`, `admin`, `location`, `supplier`

## Key Invariants

- No `/dashboard` route — `/` is the home launcher.
- `app/` holds only Next.js route files; all other code lives in `src/` (`@/*` → `./src/*`).
- No DI container library — manual wiring in `src/container.ts` only.
- No ORM — raw SQL via `mysql2/promise` pool in `src/shared/infrastructure/db.ts`.
- API sub-routes: `/{module}/api` not `/api/{module}`.
- Module-internal imports: relative paths; route files import module code via `@/{module}/...`.
- Cross-module shared code → `src/shared/` only.

See `mem:tech_stack`, `mem:conventions`, `mem:task_completion`, `mem:suggested_commands`.
