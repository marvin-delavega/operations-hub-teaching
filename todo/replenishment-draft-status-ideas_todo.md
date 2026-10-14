# Replenishment Draft Status — Feature Ideas

Captured 2026-08-06. Not yet scoped — each Tier 1 item likely warrants its own PRD before implementation.

Context: Currently, replenishment runs go straight from Review → Submit PO, writing directly to ActiveOne. There is no save-without-committing workflow, no admin approval gate, and no draft state. The `replenishment_run.status` enum currently supports only `'active'` and `'deleted'`.

## Tier 1 — Highest value

- [ ] **Save as Draft** — "Save as Draft" button alongside "Submit PO" on the Review screen, always visible. Saves the full run snapshot (supplier/manufacturer groups, per-line decisions: qty, pieceQty, period, rounding, sales context) to our `replenishment_run` / `_po` / `_line` tables with `status = 'draft'`. No ActiveOne writes, no PO minting. On success, show confirmation and navigate away (or back to main list). Rationale: enables floor staff to prepare runs for admin review without committing to ActiveOne.

- [ ] **Approve from History** — "Approve" button in the replenishment history run-detail page header. Visible only to users with the `replenishment.approve` RBAC permission. On click: re-executes the PO creation flow (`MySQLPurchaseOrderRepository.createAll()`) using the draft's saved decision context, writing POs to ActiveOne, then flips the run's `status` to `'active'`. Records the approver's name + timestamp in the run snapshot (separate from original creator). Rationale: admin review gate before ActiveOne writes.

- [ ] **Require Approval admin setting** — Toggle in `/admin` Replenishment tab (`replenishment_require_approval`, defaults OFF). When ON: hides the "Submit PO" button on the Review screen; only "Save as Draft" is available. The Submit PO path still works server-side for the approve flow (the setting is a UI gate, not an API gate — approval always writes, regardless of the toggle). Rationale: organizations that require admin sign-off before POs hit ActiveOne.

- [ ] **Approve Replenishment permission** — New `replenishment.approve` key in the permissions catalog, under Supervisor Actions. Gated on both client (hide button) and server (API rejects approval if missing). Marked as sensitive (confirm dialog on grant). Rationale: RBAC-gated approval following the `delivery.approve_discrepancies` pattern.

- [ ] **Draft visibility in history** — Draft runs in the history list are visible only to the creator and users with `module.history` (admins). Non-admin staff see only their own drafts. Draft rows carry a distinct visual indicator (badge, muted tone). List API filters accordingly. Rationale: floor staff shouldn't see each other's drafts.

- [ ] **Draft deletion** — Hard-delete a draft run (rows from `replenishment_run_line` → `_po` → `_run`, cascaded, with no ActiveOne POs to clean up). Separate from existing delete (which soft-deletes active runs by setting `status='deleted'` and cancelling ActiveOne POs). Gated by `history.delete_draft` permission (granted to staff by default). API checks: only draft runs, and only the creator (staff) or any admin. Existing delete button on active runs should also be gated by a `history.delete_run` permission (currently un-gated). Rationale: clean removal of abandoned drafts without polluting ActiveOne with cancelled PO records.

## Tier 2 — Strong, moderate effort

- [ ] **Draft re-open** — Creator can click a draft in history and re-open it on the replenishment Review screen, pre-filled with saved decisions, to adjust and re-save or submit. Rationale: avoids re-entering everything from scratch after a review cycle.

- [ ] **Draft indicator on replenishment home** — Badge or section on the main replenishment screen showing "N drafts pending" for the current user, linking to filtered history. Rationale: surface awareness without hunting through history.

- [ ] **Draft expiry/cleanup** — Auto-delete or flag drafts older than N days (admin-configurable). Rationale: prevent accumulation of stale, abandoned drafts.

## Tier 3 — Convenience / workflow

- [ ] **Approval comments** — Optional text field when approving or rejecting a draft, recorded in the run snapshot. Rationale: communication trail between approver and creator.

- [ ] **Draft status filter in history list** — Filter dropdown (All / Active / Draft / Deleted) on the replenishment history list page. Rationale: faster navigation when drafts pile up.

- [ ] **Batch approve** — Select multiple drafts in the history list and approve them in one action. Rationale: efficiency when many runs queue up.

## Suggested starting point

Start with **Tier 1** as a single coherent feature (Save as Draft → Approve → Require Approval toggle → permissions). The draft save and approve flow are tightly coupled — you need both for the workflow to be usable. The permissions and admin setting are small dependencies of the same flow.
