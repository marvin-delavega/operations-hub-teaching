# App Versioning / Version Display -- Feature Ideas

Captured 2026-09-01. Not yet scoped -- each Tier 1 item likely warrants its own
PRD before implementation.

Context: The app currently has no version display anywhere. `package.json`
version is `0.1.0`. The primary intent is **support / troubleshooting** -- so
support staff can ask "what build are you on?" and any user can read the answer
off a screen. Version source is the `package.json` semver (no schema/infra
changes, no DB round-trip).

## Tier 1 -- Highest value
- [ ] **Version line in the account menu** -- Show `v0.1.0` (semver from
  `package.json`) at the bottom of the `AccountMenu` dropdown in the header
  (`app/shared/ui/AccountMenu.tsx`). Every authenticated page has the header, so
  any user sees it. One-line rationale: cheapest, always reachable, zero new
  surface.
- [ ] **Server-side, build-time constant** -- Resolve the version once at build
  time (not hardcoded, not read live in a client component) so there is a single
  source of truth from `package.json`. One-line rationale: avoids importing the
  whole `package.json` bundle into client components and keeps one definition.

## Tier 2 -- Strong, moderate effort
- [ ] **Version on the login screen** -- A muted caption under the branded login
  content, using the pre-auth `app_settings` public read or a build-time
  constant. One-line rationale: reachable before sign-in, useful when a support
  rep is talking someone through a login failure.
- [ ] **Module-launcher footer** -- A small `type-caption text-muted-foreground`
  version line on the landing page. One-line rationale: discoverable from the
  app's home without opening a menu.

## Tier 3 -- Convenience / workflow
- [ ] **Copyable version** -- Tapping the version copies it to the clipboard.
  One-line rationale: support can paste the exact build string into a ticket.

## Suggested starting point
Tackle the account-menu version line first (Tier 1): it's the single most
reachable spot for a "what build is this?" question, requires only a build-time
constant plus one small UI addition, and needs no schema or routing changes.
Decide the exact constant location (e.g. a small `app/shared/lib/version.ts`)
during planning to avoid importing `package.json` wholesale into client code.
