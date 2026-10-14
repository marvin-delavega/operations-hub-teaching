# Implementation Plan: App Version Display (account menu)

Source: `todo/versioning-ideas_todo.md`
Date: 2026-09-01

## Summary

Add a single build-time version constant sourced from `package.json` and surface it
as a muted `v0.1.0` caption at the bottom of the header account menu. This gives any
authenticated user (and support staff) a one-glance "what build is this?" answer on
every page, with no schema, routing, or DB changes. Scope is the Tier 1 idea only;
Tier 2 (login/launcher surfaces) and Tier 3 (copy-to-clipboard) are intentionally
deferred.

## Affected Areas

- Shared constant: new `app/shared/lib/version.ts` (exports `APP_VERSION`).
- Client UI: `app/shared/ui/AccountMenu.tsx` (add a caption line).
- `package.json` remains the single source of truth for the version value.
- No `container.ts`, no domain/application/infrastructure changes, no SQL, no `create-app-tables.sql` changes.

## Decisions

- Resolved by AI: version source is `package.json` `version` (`0.1.0`), read via a
  build-time constant rather than hardcoding — keeps one definition and is bumped by
  the normal version-bump workflow.
- Resolved by AI: constant lives in a new `app/shared/lib/version.ts` (the `lib/`
  directory does not exist yet; this is the first cross-cutting non-UI util). It is
  imported from the `AccountMenu` client component.
- Resolved by AI: import `version` from `package.json` (allowed: `resolveJsonModule`
  is enabled in `tsconfig.json` and bundler resolution tree-shakes it to the string).
  Fallback is not needed — `package.json` always carries a `version`.
- Resolved by developer: intent is support/troubleshooting; display goes in the
  account menu (reachable on every authenticated page). Source = `package.json`.
- Assumptions: display the raw `APP_VERSION` prefixed with `v` (e.g. `v0.1.0`) using
  the `type-caption` role and `text-muted-foreground` token, matching existing muted
  caption styling. No clipboard interaction this iteration.

## Implementation Steps

1. **Create `app/shared/lib/version.ts`**
   - `import pkg from "@/package.json";`
   - `export const APP_VERSION: string = pkg.version;`
   - Note: the `lib/` folder does not exist yet — creating it is a new shared home for
     cross-cutting client-safe constants. Mirrors the existing `app/shared/` layering
     (`ui/`, `domain/`, `application/`, `infrastructure/`).

2. **Add the version line to `app/shared/ui/AccountMenu.tsx`**
   - Import `APP_VERSION` from `@/app/shared/lib/version`.
   - Inside the `<DropdownMenuContent>`, after the Sign out `DropdownMenuItem`, add a
     `DropdownMenuSeparator` followed by a caption:
     `<DropdownMenuLabel className="flex justify-center px-2 py-1 type-caption text-muted-foreground">v{APP_VERSION}</DropdownMenuLabel>`.
   - Uses existing `DropdownMenuLabel` + `type-caption` + `text-muted-foreground`
     primitives; no new primitives required.

## Risks & Open Questions

- Tree-shaking of the `package.json` import into a client component is the only mild
  concern; if Turbopack inlines the whole JSON instead of just `.version`, switch to a
  hardcoded string constant in `version.ts` and document that `package.json` must stay
  in sync (acceptable fallback, noted only as a contingency).
- Placement inside the dropdown is additive and non-breaking; the design-system lint
  will not flag the tokens used (`type-caption`, `text-muted-foreground`, no raw
  palette colors, no `font-mono`).

## Verification

- `npx tsc --noEmit` and `npm run lint` (do **not** run `next build` — it hangs on this
  machine; see CLAUDE.md).
- Manual: `npm run dev`, open any authenticated page, open the account menu, confirm a
  muted `v0.1.0` caption below Sign out.
