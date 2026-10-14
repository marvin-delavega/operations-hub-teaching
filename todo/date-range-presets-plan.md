# Implementation Plan: Replenishment Date Range Presets
Source PRD: `todo/date-range-presets-ideas_todo.md`
Date: 2026-08-30

## Summary
Add quick-select preset buttons (Past Week, Past 2 Weeks, Past Month) alongside the existing From/To date pickers on the replenishment screen. Add a new admin-configurable setting `replenishment_default_date_preset` to control which preset initializes the date range on first load. The presets calculate from "today" (inclusive) and apply only on initial page load — manual date changes persist across tab switches and PO Review navigation.

## Affected Areas
- **Module**: `replenishment`
- **Layers touched**:
  - `app/(authenticated)/replenishment/page.tsx` — client UI (preset buttons, default init logic)
  - `app/(authenticated)/admin/ReplenishmentSettingsCard.tsx` — admin UI for the new setting
  - `app/(authenticated)/admin/api/settings/route.ts` — GET/PUT for the new setting
  - `app/(authenticated)/replenishment/api/settings/route.ts` — expose setting to replenishment screen
  - `container.ts` — no new factories needed (uses existing `createGetAppSettingUseCase`/`createUpdateAppSettingUseCase`)
- **DB**: `app_settings` table — new key `replenishment_default_date_preset` (values: `week`, `2weeks`, `month`); no schema change (key-value table)
- **Shared code**: Reuses existing `today()` and `daysAgo()` helpers from `page.tsx`; no new shared code needed

## Decisions
- **Resolved by AI**: Preset buttons sit alongside date pickers (not replacing) — follows the "reuse-first" pattern; existing date pickers remain for custom ranges.
- **Resolved by AI**: Presets anchored to "today" (inclusive) — `from = daysAgo(n)`, `to = today()` where n = 6, 13, 29 days respectively.
- **Resolved by AI**: Default preset applies only on first load — uses a `useRef` flag to track initialization; matches how `showAllItems`/`showIncoming` settings are applied once on mount.
- **Resolved by developer**: Confirmed layout (alongside), anchor (today), scope (first load only).

## Implementation Steps

### 1. Add the new setting to admin API (`app/(authenticated)/admin/api/settings/route.ts`)
- **GET**: Read `replenishment_default_date_preset` via `createGetAppSettingUseCase()`; validate against `week|2weeks|month`; default to `month` if null/invalid.
- **PUT**: Accept `replenishment_default_date_preset` in body; require `admin.replenishment_settings` permission; validate enum; store via `createUpdateAppSettingUseCase()`.

### 2. Expose the setting to replenishment screen (`app/(authenticated)/replenishment/api/settings/route.ts`)
- Add `replenishment_default_date_preset` to the Promise.all fetch alongside existing settings.
- Return in the response object (default `"month"` if null).

### 3. Update admin Replenishment settings card (`app/(authenticated)/admin/ReplenishmentSettingsCard.tsx`)
- Add state `defaultDatePreset` (type `"week" | "2weeks" | "month"`).
- Load from `/admin/api/settings` response.
- Add a segmented control (matching existing safety stock mode pattern) with three buttons: "Past Week", "Past 2 Weeks", "Past Month".
- On change, PUT to `/admin/api/settings` with the new value.

### 4. Add preset logic to replenishment page (`app/(authenticated)/replenishment/page.tsx`)
- **Constants**: Define preset map:
  ```ts
  const DATE_PRESETS = {
    week: { label: "Past Week", days: 6 },
    "2weeks": { label: "Past 2 Weeks", days: 13 },
    month: { label: "Past Month", days: 29 },
  } as const;
  ```
- **State**: Add `defaultPresetLoadedRef = useRef(false)` to track first-load initialization.
- **Effect**: In the settings-loaded effect (after `fetch("/replenishment/api/settings")`), read the preset value, compute `from`/`to` using `daysAgo(preset.days)` and `today()`, set both state and `appliedFrom`/`appliedTo`, then set `defaultPresetLoadedRef.current = true`. Only run if `!defaultPresetLoadedRef.current`.
- **UI**: In the controls bar (after the To date picker), add a segmented control with the three preset buttons. On click, update both `from`/`to` state (not `applied*` — user must tap Refresh to apply).
- **Visual**: Match existing `SEG_TRACK` + `seg()` styling; active preset highlighted.

## Risks & Open Questions
- None — all patterns exist in the codebase (settings flow, segmented controls, date helpers).
- Verify that `daysAgo(29)` correctly yields "30 days ago" (inclusive of today = 30 days total).
- The `replenishment/api/settings` endpoint is public to staff (middleware allows `module.replenishment`); ensure the new setting is safe to expose (it's display-only, no sensitive data).