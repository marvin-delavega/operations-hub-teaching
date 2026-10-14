# Design System & Theming

**This is the authoritative design specification for Operations Hub.** Read it before building or modifying any UI. CLAUDE.md carries a condensed summary and points here for the full spec.

Originally authored as a PRD on 2026-06-20.

## 1. Overview

Operations Hub currently styles every screen with raw, hand-typed Tailwind color classes (`bg-blue-600`, `text-red-700 dark:text-red-400`, etc.) duplicated across modules. Consistency exists only by discipline, not enforcement. This effort formalizes a centralized design system: a semantic token palette built on shadcn/ui, a shared set of component primitives, a user-controlled theme (light/dark/system), and a small set of cross-cutting quality rules. The existing blue-primary look is preserved — this is about control and consistency, not a visual redesign.

## 2. Goals

- Centralize all colors into semantic CSS-variable tokens so the palette is defined once and drift is eliminated.
- Preserve the current blue-primary aesthetic; no brand-color change.
- Let users manually choose Light / Dark / System theme, remembered per-device, with no flash of the wrong theme on load.
- Adopt shadcn/ui component primitives for high-repetition elements, with variants defined once.
- Make the `supplier` selection screen a visual sibling of the `location` selection screen via a shared tile-grid pattern.
- Introduce a header account menu holding user identity, the theme control, and sign-out.
- Standardize scale primitives: one radius token, a named type scale, and a 48px minimum touch target.
- Retrofit all existing real screens to the new system in this effort (clean cutover).
- Document the system in a token reference and a CLAUDE.md section.

## 3. Non-Goals

- No change to the primary brand color (stays blue).
- No new font (Geist Sans + Geist Mono retained).
- No per-user (DB-stored) theme preference — per-device localStorage only.
- No data Table primitive conversion — tables stay semi-hand-rolled (token-based, but not a shadcn component).
- No conversion of the `sales-rate` collapsible supplier-group sections into a shared component — they stay module-local.
- No new business logic, routes, or module behavior changes (supplier multi-select semantics are unchanged).
- No redesign of information architecture or navigation flows beyond the supplier tile layout.

## 4. Users & Roles

- **All authenticated users (staff + admin)** — use themed screens; access the account menu; set their theme; sign out.
- **Admin** — no design-system-specific permissions; admin screens are retrofitted like any other.
- Theme choice is per-device and not role-gated. The account menu displays the signed-in user's name and role (read-only).

## 5. Functional Requirements

**Tokens & Palette**
- FR-1: All color usage across retrofitted screens resolves through semantic tokens (CSS variables), not raw Tailwind color classes.
- FR-2: The token set extends the shadcn/ui base set (`background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `card`, `popover`, each with `-foreground` where applicable).
- FR-3: The system adds four domain status tokens — `critical`, `success`, `warning`, `incoming` — each with a light/dark value and a readable foreground pairing.
- FR-4: `critical` and `destructive` remain distinct tokens even if visually similar (critical = data needs attention; destructive = dangerous action).
- FR-5: `primary` serves informational/“info” blue; no separate `info` token is added.
- FR-6: Every token's light and dark foreground-on-background pairing meets WCAG AA (4.5:1) for normal text.
- FR-7: Focus states resolve through the `ring` token.

**Theming**
- FR-8: A theme control offers three options: Light, Dark, System.
- FR-9: System mode follows the device `prefers-color-scheme`; it is the default before a user makes a choice.
- FR-10: The user's choice persists per-device via localStorage and survives reloads and navigation.
- FR-11: No flash of incorrect theme occurs on initial load (handled via `next-themes`' pre-paint script).

**Account Menu**
- FR-12: A user/account menu is reachable from the header on every authenticated page.
- FR-13: The menu displays the signed-in user's name and role (read-only).
- FR-14: The menu contains the Light/Dark/System theme control.
- FR-15: The menu contains a Sign out action that ends the session.

**Component Primitives**
- FR-16: The following shadcn primitives are installed into `app/shared/ui/` with variants defined once: Button, Badge, Input, Label, Checkbox, Card, DropdownMenu, Skeleton.
- FR-17: Button exposes variants covering current usage (primary action, secondary/toggle, ghost/link) plus a disabled state.
- FR-18: Badge exposes `critical`, `success`, `warning`, and `neutral` variants.
- FR-19: The disabled state is a single standardized treatment applied uniformly (no per-component variation).

**Selection Tile Pattern**
- FR-20: A shared selection-tile pattern lives in `app/shared/ui/`, supporting single-select (tap → navigate) and multi-select (tap → toggle) modes.
- FR-21: `location` renders selectable tiles in single-select mode (tap a tile → navigate), preserving its current behavior and "← Home" link and "Show all" toggle.
- FR-22: `supplier` renders the same 2-column tile grid (`grid-cols-1 sm:grid-cols-2`) at the same tile size as `location`, in multi-select mode.
- FR-23: A selected supplier tile uses a full-tile selected treatment (accent/primary border + tinted background) plus a corner check icon.
- FR-24: `supplier` retains its search input, sticky "Continue (N selected)" button, pre-selection via `supplierIds`, and gains a "← Home" link to match `location`.

**Scale Standardization**
- FR-25: A single `--radius` token drives all rounding; `lg`/`md`/`sm` derive from it. No ad-hoc mixed radii remain.
- FR-26: A named type scale (page title, section title, body, label, caption, data/mono) is defined; modules use roles rather than free-picking sizes.
- FR-27: All interactive elements (buttons, selection tiles, checkboxes, menu items) meet a 48px minimum touch target.

**Motion & Quality**
- FR-28: Motion effects (`active:scale-95`, `animate-pulse`) are gated behind `prefers-reduced-motion`.
- FR-29: A token reference document is produced, and CLAUDE.md gains a design-system section.

**Rollout**
- FR-30: All existing real screens — landing page, `location`, `supplier`, `admin`, `sales-rate` — are migrated to the token system and primitives in this effort; no screen is left on raw-color markup.

## 6. Data Model

No database changes. Theme preference is stored client-side in localStorage (managed by `next-themes`), keyed per device/browser. User identity shown in the account menu is read from the existing NextAuth session (`name`, `role`); no new persistence.

## 7. API Contract

No new API endpoints. Sign-out uses the existing NextAuth `signOut` flow. The account menu reads the existing session (no new fetch). No request/response shapes are introduced or changed by this effort.

## 8. UI/UX Flow

**Theme selection**
1. User taps the account menu trigger in the header (avatar/identity affordance).
2. Menu opens showing name + role at top, a Light/Dark/System control, and Sign out.
3. User selects a theme; the UI updates immediately and the choice is written to localStorage.
4. On any future load on the same device, the chosen theme is applied before first paint (no flash).
5. If the user chose System, the theme tracks the device's light/dark setting.

**Sign out**
1. User opens the account menu and taps Sign out.
2. The session ends and the user is returned to the login flow.

**Supplier selection (redesigned)**
1. User arrives at `/supplier` (with `returnTo`, optional `supplierIds`, `locationId`).
2. Screen shows a "← Home" link + "Select Suppliers" title, a search box, and a 2-column grid of supplier tiles matching the location screen's tile size.
3. Pre-selected suppliers (from `supplierIds`) render with the full-tile selected treatment + corner check.
4. Tapping a tile toggles its selected state; the sticky "Continue (N selected)" button updates its count and is disabled at 0.
5. Search filters tiles by name; filtered-out tiles retain their selected state.
6. Tapping Continue appends `supplierIds` and returns to the calling module.

**Location selection (retrofitted, behavior preserved)**
1. User arrives at `/location` with `module` + `returnTo`.
2. Same tile grid, single-select mode: tapping a tile navigates immediately to `returnTo` with `locationId` appended.
3. "← Home" link and "Show all locations" toggle remain.

## 9. Edge Cases & Error Handling

- **localStorage unavailable/blocked:** theme falls back to System; no crash.
- **No stored preference (first visit):** default to System.
- **Session missing name/role in account menu:** show a graceful fallback (e.g. role omitted / generic label) rather than blank or error.
- **Supplier multi-select with all items filtered out by search:** existing "No suppliers found" empty state is preserved; selected state of hidden items is retained for the count and on Continue.
- **Supplier Continue at 0 selected:** button stays disabled (unchanged).
- **Reduced-motion users:** scale/pulse animations are suppressed; static equivalents shown.
- **Token contrast in dark mode:** any token failing AA is adjusted during definition, not at runtime.

## 10. Open Questions

- Exact corner-check icon and its placement within the selection tile (top-right assumed).
- Final concrete hex values for each token's light/dark pair (to be chosen during implementation to satisfy AA while matching the current look).
- The precise base value for `--radius` (which current radius — closer to `lg` or `md` — becomes the root).
- Header account-menu trigger affordance (avatar with initials vs. a generic user/settings icon).
- Whether the account menu should also surface the company name (already shown in page titles) — likely not, but unconfirmed.

## 11. Out of Scope / Deferred

- Per-user (cross-device) theme preference stored in the database.
- A shared data-Table primitive and migration of existing tables to it.
- Extracting the `sales-rate` collapsible supplier-group sections into a shared component.
- Additional primitives not listed (e.g. Select, Separator, Tabs, Toast) — added later if a module needs them.
- A full Storybook / living component gallery (the written token reference covers documentation for now).
- Any change to fonts, primary brand color, or module business logic.
