# Implementation Plan: Edit Replenishment Draft Quantities

Source idea: [replenishment-draft-qty-edit-ideas_todo.md](replenishment-draft-qty-edit-ideas_todo.md) (no formal PRD — follows the `replenishment-draft-status` brainstorm→plan precedent)
Date: 2026-08-25

## Summary

Let a permitted admin edit **only** each line's order qty (`final_qty`) on a
replenishment run while `status = 'draft'`, from the existing History run-detail
page. Zeroing a line excludes it from the ActiveOne POs minted at approval (the
approval path already filters `finalQty > 0`). Committed (`active`) runs stay
immutable snapshots. Gated by a new RBAC permission
`history.edit_draft`, enforced server-side. **No schema change** —
`replenishment_run_line.final_qty` already exists and per-PO subtotals are
computed on read.

## Affected Areas

- [app/shared/domain/permissions.ts](../app/shared/domain/permissions.ts) — new catalog entry
- [app/(authenticated)/history/domain/ReplenishmentHistoryRepository.ts](../app/(authenticated)/history/domain/ReplenishmentHistoryRepository.ts) — port method + types
- [app/(authenticated)/history/application/](../app/(authenticated)/history/application/) — new `UpdateReplenishmentDraftQuantitiesUseCase`
- [app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts](../app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts) — transactional update
- [container.ts](../container.ts) — new factory
- [app/(authenticated)/history/replenishment/api/[runId]/route.ts](../app/(authenticated)/history/replenishment/api/[runId]/route.ts) — new PATCH handler
- [app/(authenticated)/history/replenishment/[runId]/page.tsx](../app/(authenticated)/history/replenishment/[runId]/page.tsx) — inline edit UI

**No changes:** `create-app-tables.sql` (no new columns), middleware
(`/history/*` already gated by `module.history`), approve/delete flows,
`createPOsFromDraft` (already skips `finalQty <= 0`, including whole PO groups
whose lines are all zeroed).

## Decisions

- Resolved by developer — **new RBAC permission** (`history.edit_draft`) rather than reusing `replenishment.approve`: matches the `history.delete_run` / `history.delete_draft` History Actions pattern.
- Resolved by developer — **qty-only edits incl. zero-out**: `final_qty ≥ 0`; zero = excluded at approval; `suggested_qty` never touched (override marker keeps working).
- Resolved by developer — **no audit trail**: plain `UPDATE final_qty`; no new columns/tables.
- Resolved by AI — **PATCH on the existing `[runId]` route** rather than a new sub-route: same resource, mirrors REST shape used by DELETE there.
- Resolved by AI — **use case in `history/application/`** (not replenishment): it touches only the history repository; `ApproveReplenishmentDraftUseCase` lives in replenishment only because it needs the PO repo.
- Resolved by AI — **batch save** (single "Save" button for all changed lines) over per-line autosave: fewer writes, one confirmation, mobile-friendly.
- Assumption — max qty capped at 999,999 at the API boundary (fail-fast sanity bound); empty-change submit disabled client-side, rejected server-side.

## Implementation Steps

### 1. Permission catalog

[permissions.ts](../app/shared/domain/permissions.ts):

- Add `"history.edit_draft"` to `PermissionKey` (under the History actions comment).
- Add to the `History Actions` group: `{ key: "history.edit_draft", label: "Edit Draft Replenishment Quantities" }`.

Nothing else — `isSensitivePermission()` intentionally does not cover `history.*`
(same as the delete permissions), so granting it prompts no confirm dialog.
Seeded Administrator gets it automatically (holds all catalog keys).

### 2. Domain — port extension

[ReplenishmentHistoryRepository.ts](../app/(authenticated)/history/domain/ReplenishmentHistoryRepository.ts):

```ts
export interface DraftLineQtyUpdate { lineId: number; finalQty: number; }
export interface UpdateReplenishmentDraftResult { success: boolean; reason?: string; }
```

Add to the interface:

```ts
updateDraftLineQuantities(runId: number, updates: DraftLineQtyUpdate[]): Promise<UpdateReplenishmentDraftResult>;
```

### 3. Application — use case

New [UpdateReplenishmentDraftQuantitiesUseCase.ts](../app/(authenticated)/history/application/UpdateReplenishmentDraftQuantitiesUseCase.ts),
mirroring [DeleteDraftReplenishmentRunUseCase.ts](../app/(authenticated)/history/application/DeleteDraftReplenishmentRunUseCase.ts):
constructor takes `ReplenishmentHistoryRepository`; `execute(runId, updates)` delegates
and returns the result. No business logic beyond pass-through (validation lives at the API boundary).

### 4. Infrastructure — repository method

In [MySQLReplenishmentHistoryRepository.ts](../app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts),
add `updateDraftLineQuantities` modeled on `hardDeleteDraft`'s transaction shape:

1. `getConnection` → `beginTransaction`.
2. `SELECT id, status FROM replenishment_run WHERE id = ? FOR UPDATE`.
3. Guards: not found → `{ success:false, reason:"Run not found." }`;
   `status !== 'draft'` → `{ success:false, reason:"Only drafts can be edited." }`
   (also covers the approved-mid-edit race — row is locked).
4. For each update:
   `UPDATE replenishment_run_line SET final_qty = ? WHERE id = ? AND final_qty <> ? AND run_po_id IN (SELECT id FROM replenishment_run_po WHERE run_id = ?)`
   — the subquery scope guarantees a forged `lineId` from another run cannot be touched;
   `final_qty <> ?` skips no-op writes.
5. Commit / rollback / release, returning `{ success: true }`.

### 5. Composition root

[container.ts](../container.ts): import the use case, add

```ts
export function createUpdateReplenishmentDraftQuantitiesUseCase(): UpdateReplenishmentDraftQuantitiesUseCase {
  return new UpdateReplenishmentDraftQuantitiesUseCase(new MySQLReplenishmentHistoryRepository());
}
```

### 6. API — PATCH handler

In [[runId]/route.ts](../app/(authenticated)/history/replenishment/api/[runId]/route.ts)
add `export async function PATCH(req, { params })` alongside the existing handlers:

1. `auth()` → 401 if no session.
2. Permission gate: `perms.includes("history.edit_draft")` else 403 (same shape as DELETE).
3. Parse body: `{ lines: [{ lineId, finalQty }] }` — fail fast 400 unless:
   `lines` is a non-empty array; every `lineId` a positive integer; every `finalQty`
   an integer `0 ≤ finalQty ≤ 999999`. Deduplicate repeated `lineId`s (or reject).
4. Call `createUpdateReplenishmentDraftQuantitiesUseCase().execute(runId, lines)`.
5. Map: `!success` → 409 with `reason`; success → `{ success: true }` (client re-fetches GET).

### 7. UI — inline editing on the run-detail page

[[runId]/page.tsx](../app/(authenticated)/history/replenishment/[runId]/page.tsx):

- Compute once: `const canEditDraft = run?.status === "draft" && permissions.includes("history.edit_draft");`
- **State:** `draftQtys: Record<number, string>` (line id → raw input value, initialized from each line's `finalQty` when the run loads/is a draft), plus `savingQtys: boolean`.
- **Rows:** thread `canEditDraft` + value/onChange into `RunLinesTable` → `LineRow`. When editing,
  render the Final Qty cell as a numeric `<Input inputMode="numeric">` (48px touch target,
  `type-data` styling, min-width ~20ch) instead of the plain number; keep the `*`
  override marker logic driven by committed `finalQty !== suggestedQty`.
- **Dirty tracking:** changed = parsed value differs from the line's loaded `finalQty`.
  Header controls block (next to **Approve** / **Delete Draft**, which already render for
  drafts at lines ~704–712): show **Save Quantities** button when dirty ∧ `canEditDraft`,
  disabled while saving or any parsed value invalid (negative/non-numeric).
- **`handleSaveQuantities`:** PATCH with only changed lines → on success `load()`
  (re-fetches detail, clearing dirty state); on failure surface `data.error` via the
  page's existing `error` state. After save the status may have changed (approved
  elsewhere) — `load()` handles that naturally since edit inputs render only while draft.
- Print report and CSV export stay read-only from committed data — no changes.
- Copy pattern for the input styling from the replenishment Review override field
  ([replenishment/page.tsx](../app/(authenticated)/replenishment/page.tsx)).

### Verification

Per CLAUDE.md build policy: `npx tsc --noEmit` + `npm run lint` (do **not** wait on
`next build` — known environment hang). Manual check via `npm run dev`: edit a draft's
qtys as permission holder; confirm zeroed lines drop out of the approval-created POs;
confirm active runs and non-holders see no inputs; confirm 403 when permission removed.

## Risks & Open Questions

- **Edit-vs-approve race:** `createPOsFromDraft` reads lines without locking before
  `approveDraft` flips status, so an edit committing between PO mint and status flip
  could land after POs were created (lines then belong to an active run but carry edited
  qtys only in our snapshot). Window is milliseconds and the same exposure already
  exists between hardDeleteDraft and approve; accepted for v1. If ever needed, wrap
  approval's read in the same `FOR UPDATE` transaction.
- **Whole-PO zero-out:** if every line of one supplier/manufacturer group is zeroed,
  approval creates **no PO for that group** (`lineValues.length === 0 → continue`) —
  correct behavior, worth noting in QA expectations.
- **Live-data check:** confirm on the real DB that no downstream consumer treats
  `final_qty = 0` draft lines differently (list counts still include them — intended).
