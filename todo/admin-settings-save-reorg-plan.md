# Implementation Plan: Admin Settings Save Reorg

Source PRD: [todo/admin-settings-save-reorg-ideas_todo.md](admin-settings-save-reorg-ideas_todo.md)
Date: 2026-09-03

## Summary

Bring every `/admin` app-settings surface onto one consistent save model: **each card/section
holds exactly one footer "Save" button** that persists all of that card's configs in a single
PUT, replacing the current mix of no-button immediate saves (Delivery / Counting / Replenishment),
onBlur/segmented-click saves (Replenishment), and multiple per-field Saves (General → PO Code
Prefix card). Save is **disabled until the card is dirty**, with a Discard (restore-saved) action
and an unsaved-changes guard when leaving a dirty card. Action-only controls (Refresh item cache,
Reset PO numbering, Reset setup wizard) stay as-is, visually separated. A single shared admin-local
hook carries the identical load / snapshot / dirty / save / message logic each card now hand-rolls.

## Affected Areas

- Modules / layers touched (all within `app/(authenticated)/admin/` — single module, no layer change):
  - New hook: `app/(authenticated)/admin/useSettingsSection.ts`
  - Rewritten cards: `DeliverySettingsCard.tsx`, `CountingSettingsCard.tsx`, `ReplenishmentSettingsCard.tsx`
  - General-tab rework in `page.tsx` (extract the PO Code Prefix + Scanner sections into cards) + new `PoCodeSettingsCard.tsx`, `ScannerSettingsCard.tsx`
  - `CompanyNameCard.tsx` / `ShelfGuideSettingsCard.tsx` — already one-Save; only adopt the shared hook for consistency (optional, low risk)
  - `DatabaseSettingsCard.tsx` — **out of scope** (distinct test/save form via `DbConnectionForm`); unchanged
- Shared code: reuses `Card`, `Button`, `Switch`, `Input`, `Label`, `Skeleton`, `cn` from `app/shared/ui/`; **no new shared (cross-module) code** — the hook is admin-only so it lives in the module per CLAUDE.md
- DB / `create-app-tables.sql`: **no change**
- `container.ts`: **no change** (settings read/write already wired; plan never touches the API route)
- `api/settings/route.ts`: **unchanged** — the existing per-key grouped PUT already supports bundling a card's keys in one body; the plan relies on it, it does not modify it

## Decisions

- Resolved by AI:
  - **Hook lives in `admin/` not `app/shared/`** — it is admin-settings-only, so single-module code stays in the module (CLAUDE.md). New card components also live in `admin/`.
  - **One card = one Save is implemented as one PUT body of that card's keys**, reusing the existing endpoint unchanged. Safe because the endpoint authorizes per key grouped by tab permission, and each card only owns keys under one tab. Card = the atomic save unit.
  - **General tab keeps multiple sections (each one-Save), not one global Save** — the user's rule is "each *section of similar configurations* has one Save," and the General tab groups unrelated configs (company name vs PO code vs scanner). Splitting is correct.
  - **PO Code Prefix + Display Width merge into one Save** on a single `PoCodeSettingsCard`; **Reset numbering stays a separate action button** (per resolved fork: actions stay immediate), but visually separated from the Save.
  - **Leave-guard covers both tab-switch and page unload** via a page-level dirty registry; tab switch confirms when any mounted card is dirty, plus a `beforeunload` browser prompt.
- Resolved by developer (from brainstorm): one card = one save · actions stay immediate · Save disabled-until-dirty + discard + unsaved-leave guard.
- Assumptions:
  - The kanban ("Order Scheduling") and the Users/Roles/Selling-Areas CRUD tabs are **out of scope** — they are immediate per-entity CRUD, not config-save; the user's rules target configuration surfaces that PUT `app_settings`.
  - Dirty = any card field differs from the last-loaded/saved snapshot (deep compare of the card's editable values). Discard restores the snapshot without a PUT.
  - A Save that a user can't submit (lacks the tab's edit permission) is not reachable: the tab itself is gated server-side already; no extra read-only state is added (Tier 3 dropped as YAGNI here).

## Implementation Steps

### Step 1 — Add `useSettingsSection` hook
File: `app/(authenticated)/admin/useSettingsSection.ts`

Centralize the state machine every settings card repeats. Contract:
```ts
interface SettingsSectionState {
  loading: boolean;
  dirty: boolean;
  saving: boolean;
  message: { type: "success" | "error"; text: string } | null;
  load: () => Promise<void>;                    // fetches GET /admin/api/settings once
  save: (patch: Record<string, unknown>) => Promise<boolean>; // PUT; on ok clears dirty, sets success
  fail: (text: string) => void;                 // set error + a success-msg timeout reset
  markSaved: () => void;                        // after optimistic apply, clears dirty
  reportDirty: (dirty: boolean) => void;        // calls optional onDirtyChange (see Step 5)
}
function useSettingsSection(onDirtyChange?: (dirty: boolean) => void): SettingsSectionState
```
Key logic:
- `message` auto-clears after ~3–4 s on success (mirror current per-card `setTimeout`s); errors persist until next action.
- `save` sends one PUT to `/admin/api/settings` with the card's whole patch, returns ok, sets success/error message, and on success calls `markSaved()` + `onDirtyChange(false)`. It does **not** optimistically mutate — the card compares its fields against a caller-held snapshot.
- No DB/auth imports (client-only).

### Step 2 — Counting card (smallest proof of the pattern)
File: `app/(authenticated)/admin/CountingSettingsCard.tsx`

- Keep `continuousScanning` state; add a `saved` snapshot copy loaded alongside it.
- Render a footer Save button (the `Button` from `app/shared/ui/button`) **disabled when `!dirty || loading || saving`**; on click PUT `{ counting_continuous_scanning: continuousScanning }` (one key).
- Add a **Discard** button (secondary) shown only when `dirty`, restoring `saved`.
- Delete the `toggle()` onCheckedChange auto-save; the `Switch` now only updates local state.
- Section still a single `Card`. Keep the existing `message` line driven by the hook.

### Step 3 — Delivery card
File: `app/(authenticated)/admin/DeliverySettingsCard.tsx`

- Two switches (`continuousScanning`, `blindDelivery`) + one saved snapshot of both.
- One footer Save → single PUT `{ delivery_continuous_scanning, delivery_blind_delivery }` (both keys under the one `admin.delivery_settings` permission — atomic card save).
- Dirty when either differs from snapshot. Discard restores both. Delete `toggle()`.

### Step 4 — Replenishment card (most complex)
File: `app/(authenticated)/admin/ReplenishmentSettingsCard.tsx`

- Replace **all** immediate saves with local state only: the three switches (`showAllItems`, `showIncoming`, `requireApproval`), the safety-stock `mode` segmented control, the conditional numeric fields, and `defaultDatePreset` segmented control all become pure local state that only a single Save commits.
- Snapshot all of them from the GET response. **Important**: only snapshot fields that are *editable-and-shown* — but because the numeric fields are conditionally revealed by mode, keep their latest values in snapshot regardless so switching modes doesn't falsely mark dirty. Initialize snapshot from the same load defaults the GET already returns (it returns defaults for all four safety keys even when mode is `off`).
- Remove `persistedLevelRef/MaxLevelRef/DaysRef` and the `onBlur`/segmented `onClick` commit handlers (`commitSafetyStockLevel`/`...MaxLevel`/`...Days`, `changeSafetyStockMode`, `changeDefaultDatePreset`, `toggleSetting`, `saveSafetyStock`).
- One footer Save PUTs the whole card: `{ replenishment_show_all_items, replenishment_show_incoming, replenishment_require_approval, replenishment_safety_stock_mode, replenishment_safety_stock_level, replenishment_safety_stock_max_level, replenishment_safety_stock_days, replenishment_default_date_preset }`. Endpoint validates each per existing rules.
- Validation (level 1–100, maxLevel 1–99.99, days 1–30) moves client-side to *before* Save: invalid input blocks the PUT with a message (mirror the current messages); Save disabled while any shown numeric field is out of range.

### Step 5 — General-tab rework in `page.tsx` + new cards
Files: `app/(authenticated)/admin/PoCodeSettingsCard.tsx` (new), `app/(authenticated)/admin/ScannerSettingsCard.tsx` (new), `app/(authenticated)/admin/page.tsx`

- Extract the PO Code Prefix section (page.tsx ~400–522) into `PoCodeSettingsCard`:
  - State: `poCodePrefix`, `poCodeDisplayWidth` (+ saved snapshot), plus read-only `poCodePrefixHasHistory` (loaded, not editable).
  - One footer **Save** → PUT `{ po_code_prefix: prefix.toUpperCase(), po_code_display_width: Number(width) }` in one body. Disabled until dirty.
  - **Reset numbering to 1** stays as a separate immediate action button (existing `ConfirmDialog` flow), visually separated below the footer with a rule, labeled as an action — it is not the section's Save.
  - On save success, refetch the read to refresh `poCodePrefixHasHistory` and the reset dialog's collision warning (keep `refreshPoCodeControls` behavior inside the card).
- Extract the Scanner section (page.tsx ~525–572) into `ScannerSettingsCard`: single field + one Save PUT `{ scan_batch_delay_ms }`, dirty when number differs.
- In `page.tsx`, replace the inline JSX/state/handlers for these sections with `<PoCodeSettingsCard/>` / `<ScannerSettingsCard/>` (mirroring how `<CompanyNameCard/>` etc. are used), deleting the now-dead `useState`s and `save*`/`refresh*` functions (lines 47–60, 178–298 relevant parts). `CompanyNameCard` and the Item-cache + First-run action sections are unchanged.
- **Leave-guard plumbing**: keep a `dirtyCards` state in `page.tsx`; each settings card receives `onDirtyChange` from `useSettingsSection`. Add:
  - a `useEffect` setting `beforeunload` → preventDefault when any card dirty;
  - wrap the `Tabs` `onValueChange` so switching tabs while a card is dirty shows a confirm (`window.confirm`) before unmounting it. Cards only unmount on tab switch, which is what makes the guard necessary.

### Step 6 — Adopt hook in the already-one-Save cards (optional consistency)
Files: `app/(authenticated)/admin/CompanyNameCard.tsx`, `app/(authenticated)/admin/ShelfGuideSettingsCard.tsx`

- Rewire their load/save/message + dirty/disabled-Save onto `useSettingsSection` so every settings card behaves identically. Behavior otherwise unchanged (Company name Save PUTs `{ company_name }`; Shelf Guide Save PUTs `{ shelfguide_default_location_id }`). This is low-risk consistency, not a behavior change.

## Risks & Open Questions

- **General tab split sections still each save independently** — a "general" admin edits company name, then PO code, and must Save each section separately. This matches the agreed rule ("each section = one save"); confirm it's acceptable vs. a single General "Save all" later.
- **Replenishment atomicity** — one Save now writes 8 keys. If one is invalid the endpoint still applies the others *before* returning 400 (the route validates per-key sequentially, not as a transaction). Client-side pre-validation prevents this in practice; note that a mid-body failure could leave a partial card state. Acceptable for app_settings (idempotent per-key) but worth being aware of.
- **Leave-guard uses `window.confirm`** (no custom dialog) to avoid a new Dialog/context on the 993-line page.tsx. If a custom modal is preferred, that is a follow-up.
- **Numeric input while dirty** — free-text number fields can hold transient invalid text (empty, "1.5" for an int field). The plan disables Save while out-of-range but does not force-commit on blur (current behavior); if a user edits then abandons without leaving the card, no save occurs and no error shows until they click Save.
