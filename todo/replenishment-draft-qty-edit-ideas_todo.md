# Replenishment Draft Qty Edit -- Feature Ideas

Captured 2026-08-25. Not yet scoped -- each Tier 1 item likely warrants its own
PRD before implementation.

Context: Replenishment runs can be saved as drafts (`replenishment_run.status = 'draft'`)
and later approved from History (mints ActiveOne POs via
`ApproveReplenishmentDraftUseCase`) or hard-deleted. Today a draft's line
quantities are frozen at save time — if the numbers need adjusting before
approval, the admin must delete the whole draft and re-run the entire
replenishment. This feature lets an admin edit **only** each line's order qty
(`final_qty`) on a draft, in place, from the History run-detail page.

## Tier 1 -- Highest value

- [ ] **Edit final qty per draft line (status = draft only)** — the core value: tweak quantities without re-running; committed runs stay immutable snapshots.
- [ ] **New RBAC permission "Edit Replenishment Drafts"** (catalog entry, grouped with history/draft permissions) — enforced server-side on the edit endpoint, matching the `history.delete_draft` / `replenishment.approve` pattern.
- [ ] **Zero-out = line exclusion** — setting a line's qty to 0 excludes it from POs at approval (same semantics as unchecking before Generate); suggested qty preserved untouched for audit/override highlighting.

## Tier 2 -- Strong, moderate effort

- [ ] **Edit UX inline on run detail** — tap-to-edit qty fields on lines while status = draft (read-only rendering otherwise), with per-line save or batch save + optimistic-concurrency guard (reject if draft was approved/deleted meanwhile).
- [ ] **Recompute run summary after edits** — per-PO subtotals and grand total reflect edited quantities (reuse `createRecomputeReplenishmentSummaryUseCase` pattern or recompute on read).
- [ ] **Audit trail of edits** — record who changed which line from what qty to what qty (in-run metadata or app table), so override markers distinguish original overrides from post-save admin edits.

## Tier 3 -- Convenience / workflow

- [ ] **Restore-to-suggested action** — one-tap revert of a line's qty back to the system suggestion.
- [ ] **Draft list indicator** — "edited" badge on the replenishment-history list row for drafts modified after creation.

## Suggested starting point

Tier 1 as one small PRD: add the permission catalog entry + server-enforced
`PATCH`-style update on `/{history}/replenishment/api/[runId]` that (a) verifies
status = draft and the new permission, (b) updates `final_qty` per line
(0 allowed), and (c) leaves `suggested_qty`, decisions snapshot, and everything
else untouched. UI: editable qty inputs on the existing run-detail page shown
only when status = draft AND the viewer holds the permission. Tier 2's audit
trail is worth deciding up front in the PRD (schema impact) even if deferred.
