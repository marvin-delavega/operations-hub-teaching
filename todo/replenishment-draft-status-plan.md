# Implementation Plan: Replenishment Draft Status

Source: `todo/replenishment-draft-status-ideas_todo.md`
Date: 2026-08-06

## Summary

Add a Save-as-Draft workflow to the replenishment Review screen, an Admin Approve action in history run detail, a Require Approval admin toggle that hides Submit PO, and two new RBAC permissions (`replenishment.approve`, `history.delete_draft`). Drafts write only to our `replenishment_run`/`_po`/`_line` tables with `status = 'draft'` — no ActiveOne POs. Approval executes the PO creation flow against ActiveOne, then flips the run to `status = 'active'` and records the approver. Drafts are visible in history only to the creator and admins.

## Affected Areas

### Modules / Layers Touched
- **`app/shared/domain/permissions.ts`** — new `replenishment.approve`, `history.delete_draft`, `history.delete_run` keys; extend `isSensitivePermission`
- **`app/(authenticated)/replenishment/domain/`** — new `DraftRepository` port; extend `PurchaseOrder` type
- **`app/(authenticated)/replenishment/application/`** — new `SaveReplenishmentDraftUseCase`, new `ApproveReplenishmentDraftUseCase`
- **`app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts`** — refactor `persistRunSnapshot` to accept status; add `saveDraft()`; add `createPOsFromDraftData()`
- **`app/(authenticated)/replenishment/page.tsx`** — add Save as Draft button + hide Submit PO when require-approval is ON
- **`app/(authenticated)/replenishment/api/draft/route.ts`** — new POST endpoint
- **`app/(authenticated)/history/domain/`** — extend `ReplenishmentRunSummary`, `ReplenishmentRunDetail`, `ReplenishmentHistoryRepository`
- **`app/(authenticated)/history/application/`** — new `DeleteDraftReplenishmentRunUseCase`
- **`app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts`** — approve draft, hard-delete draft, draft-visibility list filtering, type updates
- **`app/(authenticated)/history/replenishment/[runId]/page.tsx`** — add Approve button, draft-specific delete, draft badge
- **`app/(authenticated)/history/replenishment/api/[runId]/approve/route.ts`** — new POST endpoint
- **`app/(authenticated)/admin/ReplenishmentSettingsCard.tsx`** — Require Approval toggle
- **`app/(authenticated)/admin/api/settings/route.ts`** — add `replenishment_require_approval` key
- **`scripts/create-app-tables.sql`** — extend status enum to include `'draft'`; add `approved_by_*` columns
- **`container.ts`** — new factories for draft save, draft approve, draft delete

### Shared Code Reused
- `app/shared/infrastructure/db.ts` — MySQL pool
- `app/shared/infrastructure/auth.ts` — session for auth gating
- `app/shared/infrastructure/activeoneConstants.ts` — PO status constants
- `app/shared/infrastructure/activeonePoMinting.ts` — `withPoMintRetry`, `poCode()`
- `app/shared/ui/` — `Button`, `Badge`, `Card`, `Switch`, `Label`, `Skeleton`, `Dialog`, `ConfirmDialog`

### DB Changes
- **`replenishment_run`**: extend `status` enum to `('draft','active','deleted')`; add `approved_by_user_id INT NULL`, `approved_by_name TEXT NULL`, `approved_at DATETIME NULL`
- **`app_settings`**: new key `replenishment_require_approval` (boolean, defaults to `"off"`)

### container.ts Changes
- `createSaveReplenishmentDraftUseCase()` — new factory
- `createApproveReplenishmentDraftUseCase()` — new factory
- `createDeleteDraftReplenishmentRunUseCase()` — new factory
- Modify `createCreatePurchaseOrdersUseCase()` — pass refactored repo

## Decisions

### Resolved by AI
- **Draft status as enum value**: Extend existing `status` column (not a new column) — single source of truth.
- **Approver info modeled as `approved_by_*` columns on `replenishment_run`**: Mirrors existing `created_by_*` pattern.
- **Save as Draft reuses PO submission request shape**: Same body as `POST /replenishment/api/po`, different endpoint — DRY, no new validation shape.
- **Approve use case lives in `replenishment/application/`**: The core action is PO creation; the history module is just the trigger. Avoids circular dependency.
- **`persistRunSnapshot` refactored to accept status parameter**: DRY — draft and active save share the same snapshot persistence.
- **`history.delete_run` permission added alongside `history.delete_draft`**: The existing delete is currently un-gated; this gates both paths correctly.
- **`isSensitivePermission` extended**: `replenishment.approve` should trigger a confirm dialog on grant, like other supervisor permissions.
- **Draft visibility via server-side SQL filter**: Pass `currentUserId` + `isAdmin` flag; non-admin staff see only `status != 'draft' OR created_by_user_id = ?`. Avoids broken pagination.

### Assumptions
- **Approver's employee code used for ActiveOne PO recorder**: The approver is the one executing the final PO creation, and draft creators may not have employee links. The original creator is preserved in the run snapshot for audit.
- **Draft approve and PO creation are separate DB transactions**: PO creation failure leaves the draft intact; status-update failure after successful PO creation creates orphaned POs (extremely rare, and the POs are valid ActiveOne records).
- **No draft editing after save**: Re-open deferred to Tier 2. The user re-enters from scratch.
- **`status` enum string comparison in idempotent ALTER uses `COLUMN_TYPE LIKE '%draft%'`**: Reliable for MySQL enums in this schema; no false positives.

## Implementation Steps

### Step 1: DB Schema — extend `replenishment_run`

In `scripts/create-app-tables.sql`, append two idempotent ALTER blocks at the end:

1. **Extend `status` enum** to include `'draft'` (follows the existing idempotent pattern at line 783):
   ```sql
   -- Idempotent extend status enum to include 'draft'.
   SET @run_has_draft_status := (
     SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run'
       AND COLUMN_NAME = 'status' AND COLUMN_TYPE LIKE '%draft%'
   );
   SET @add_run_draft := IF(
     @run_has_draft_status = 0,
     "ALTER TABLE `replenishment_run` MODIFY COLUMN `status` enum('draft','active','deleted') NOT NULL DEFAULT 'active'",
     'SELECT 1'
   );
   PREPARE add_run_draft_stmt FROM @add_run_draft;
   EXECUTE add_run_draft_stmt;
   DEALLOCATE PREPARE add_run_draft_stmt;
   ```

2. **Add `approved_by_user_id`, `approved_by_name`, `approved_at`** columns:
   ```sql
   -- Idempotent add approved_by columns to replenishment_run.
   SET @run_has_approved_by := (
     SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run' AND COLUMN_NAME = 'approved_by_user_id'
   );
   SET @add_run_approved_by := IF(
     @run_has_approved_by = 0,
     "ALTER TABLE `replenishment_run` ADD COLUMN `approved_by_user_id` int NULL AFTER `created_by_employee_code`, ADD COLUMN `approved_by_name` text NULL AFTER `approved_by_user_id`, ADD COLUMN `approved_at` datetime NULL AFTER `approved_by_name`",
     'SELECT 1'
   );
   PREPARE add_run_approved_by_stmt FROM @add_run_approved_by;
   EXECUTE add_run_approved_by_stmt;
   DEALLOCATE PREPARE add_run_approved_by_stmt;
   ```

### Step 2: Permissions Catalog

In `app/shared/domain/permissions.ts`:

1. Add to `PermissionKey` union (after `counting.adjust_lines`):
   ```ts
   | "replenishment.approve"
   | "history.delete_run"
   | "history.delete_draft"
   ```

2. Add to `PERMISSION_CATALOG`, Supervisor Actions group (after `counting.adjust_lines`):
   ```ts
   { key: "replenishment.approve", label: "Approve Replenishment" },
   ```

3. Add a new group `"History Actions"` after "Supervisor Actions":
   ```ts
   {
     group: "History Actions",
     permissions: [
       { key: "history.delete_run", label: "Delete Replenishment Run" },
       { key: "history.delete_draft", label: "Delete Draft Replenishment Run" },
     ],
   },
   ```

4. Extend `isSensitivePermission` (line 94) to cover `replenishment.` prefix:
   ```ts
   export function isSensitivePermission(key: string): boolean {
     return key.startsWith("admin.") || key.startsWith("delivery.") || key.startsWith("counting.") || key.startsWith("replenishment.");
   }
   ```

### Step 3: Domain Types — ReplenishmentRunSummary & Detail

In `app/(authenticated)/history/domain/ReplenishmentRunSummary.ts`:

1. Extend `ReplenishmentRunSummary`:
   ```ts
   export interface ReplenishmentRunSummary {
     // ... existing fields ...
     status: "draft" | "active" | "deleted";       // was "active" | "deleted"
     approvedByUserName?: string;                   // NEW
     approvedAt?: string;                           // NEW
   }
   ```

2. Extend `ReplenishmentRunDetail`:
   ```ts
   export interface ReplenishmentRunDetail {
     // ... existing fields ...
     approvedByUserName?: string;                   // NEW
     approvedAt?: string;                           // NEW
   }
   ```

### Step 4: Domain Port — ReplenishmentDraftRepository

Create `app/(authenticated)/replenishment/domain/ReplenishmentDraftRepository.ts`:
```ts
import type { PurchaseOrder } from "./PurchaseOrder";

export interface DraftSaveResult {
  success: boolean;
  runId?: number;
  error?: string;
}

export interface ReplenishmentDraftRepository {
  saveDraft(po: PurchaseOrder): Promise<DraftSaveResult>;
}
```

### Step 5: Application — SaveReplenishmentDraftUseCase

Create `app/(authenticated)/replenishment/application/SaveReplenishmentDraftUseCase.ts`:
```ts
import type { ReplenishmentDraftRepository, DraftSaveResult } from "../domain/ReplenishmentDraftRepository";
import type { PurchaseOrder } from "../domain/PurchaseOrder";

export class SaveReplenishmentDraftUseCase {
  constructor(private readonly repository: ReplenishmentDraftRepository) {}

  execute(po: PurchaseOrder): Promise<DraftSaveResult> {
    return this.repository.saveDraft(po);
  }
}
```

### Step 6: Application — ApproveReplenishmentDraftUseCase

Create `app/(authenticated)/replenishment/application/ApproveReplenishmentDraftUseCase.ts`.

This use case orchestrates across two repository ports:
- `ReplenishmentHistoryRepository` (from history domain) — to read the draft, update status + approver
- `PurchaseOrderRepository` (from replenishment domain) — to create ActiveOne POs

```ts
import type { ReplenishmentHistoryRepository } from "@/app/(authenticated)/history/domain/ReplenishmentHistoryRepository";
import type { PurchaseOrderRepository, PurchaseOrderResult } from "../domain/PurchaseOrderRepository";

export interface ApproveDraftResult {
  success: boolean;
  pos?: PurchaseOrderResult[];
  error?: string;
}

export class ApproveReplenishmentDraftUseCase {
  constructor(
    private readonly historyRepo: ReplenishmentHistoryRepository,
    private readonly poRepo: PurchaseOrderRepository,
  ) {}

  async execute(runId: number, approver: { userId: number; name: string }): Promise<ApproveDraftResult> {
    // 1. Load draft + verify it's a draft
    const draft = await this.historyRepo.getById(runId);
    if (!draft) return { success: false, error: "Draft not found." };
    if (draft.status !== "draft") return { success: false, error: "Run is not a draft." };

    // 2. Create POs from draft data (ActiveOne write)
    const pos = await this.poRepo.createPOsFromDraft(draft);

    // 3. Update run status + approver
    await this.historyRepo.approveDraft(runId, approver.userId, approver.name);

    return { success: true, pos };
  }
}
```

### Step 7: Infrastructure — Refactor MySQLPurchaseOrderRepository

Modify `app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts`:

1. **Refactor `persistRunSnapshot`** (line 356): Add a `status` parameter:
   ```ts
   private async persistRunSnapshot(
     conn: import("mysql2/promise").PoolConnection,
     runIds: Map<string, number>,
     poRows: Array<{...}>,
     itemByCode: Map<string, ItemRow>,
     status: "active" | "draft" = "active",  // NEW param
   ): Promise<void> {
   ```
   No other changes needed in the method body — it only writes `replenishment_run_po` + `_line` + updates counts; the status was set on the run INSERT in `createAll()`.

2. **Modify `createAll()` run INSERT** (line 310): Add `status` to the INSERT columns:
   ```ts
   INSERT INTO replenishment_run
     (path, ..., status)
   VALUES (?, ..., ?)
   // pass 'active' as last param
   ```

   Wait — the existing INSERT doesn't include `status`, relying on DEFAULT. We need to add it explicitly so we can set it to 'active'. Actually, the DEFAULT is already 'active', so the existing code works. For the refactor, we can either:
   - Keep the implicit DEFAULT (simpler, no changes needed)
   - Add explicit `status = 'active'` (more explicit)

   Let's keep it explicit. Add `status` to the INSERT columns and VALUES, passing `'active'`.

3. **Add `saveDraft()` method** (implements `ReplenishmentDraftRepository`):
   Mirrors `createAll()` but without ActiveOne PO writes:
   - Validate lines (same as createAll lines 125-128)
   - Resolve items (same as lines 131-151)
   - Resolve suppliers + location name (same as 153-167)
   - Resolve recorder's employee code + ActiveOne user id (same as 169-179)
   - Group by supplier+manufacturer (same as 182-195)
   - **No** PO ID minting, **no** ActiveOne inserts
   - Insert `replenishment_run` with `status = 'draft'` (NO `po_id` on `replenishment_run_po`, or `po_id = NULL`)
   - Insert `replenishment_run_po` rows (with `po_id = NULL`, `po_code = 'DRAFT-{runId}'` placeholder)
   - Insert `replenishment_run_line` rows (same as persistRunSnapshot)
   - Update run counts
   - Run inside a single transaction (no retry needed — no duplicate-key risk)
   - Return `DraftSaveResult`

4. **Add `createPOsFromDraft()` method** (implements `PurchaseOrderRepository` port extension):
   Takes a `ReplenishmentRunDetail` and creates ActiveOne POs for all its constituent lines:
   - Resolve items by code (lines may reference items that have changed — re-resolve fresh)
   - Mint PO IDs + insert ActiveOne `purchase_order` + `purchase_order_items`
   - Return `PurchaseOrderResult[]` + a mapping of `run_po_id → new_po_id` for the history repo to use
   - Run inside `withPoMintRetry`
   - **No** run snapshot writes (draft already exists)

### Step 8: Infrastructure — Extend MySQLReplenishmentHistoryRepository

Modify `app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts`:

1. **Update row types** (lines 40, 54): Change `status: "active" | "deleted"` to `status: "active" | "deleted" | "draft"` and add `approved_by_user_id`, `approved_by_name`, `approved_at` fields.

2. **Update `list()`** (line 114): Add draft-visibility filtering:
   - New optional filter params: `excludeOtherUsersDrafts?: boolean` + `draftOwnerUserId?: number`
   - When `excludeOtherUsersDrafts` is true: add condition `AND (r.status != 'draft' OR r.created_by_user_id = ?)`
   - Also add optional `status` filter param on `HistoryFilters` for future use

3. **Update `getById()`** (line 193): Include `approved_by_user_id`, `approved_by_name`, `approved_at` in the SELECT. Map to domain types.

4. **Add `approveDraft()` method** on the repository interface + implementation:
   ```ts
   async approveDraft(runId: number, approvedByUserId: number, approvedByName: string): Promise<void> {
     await pool.execute(
       `UPDATE replenishment_run
        SET status = 'active', approved_by_user_id = ?, approved_by_name = ?, approved_at = NOW()
        WHERE id = ? AND status = 'draft'`,
       [approvedByUserId, approvedByName, runId],
     );
   }
   ```

5. **Add `hardDeleteDraft()` method** on the repository interface + implementation:
   ```ts
   async hardDeleteDraft(runId: number): Promise<DeleteReplenishmentRunResult> {
     const conn = await pool.getConnection();
     try {
       await conn.beginTransaction();
       const [runRows] = await conn.query<RowDataPacket[]>(
         "SELECT id, status FROM replenishment_run WHERE id = ? FOR UPDATE", [runId]
       );
       const run = runRows[0] as { id: number; status: string } | undefined;
       if (!run) {
         await conn.rollback();
         return { success: false, reason: "Draft not found." };
       }
       if (run.status !== "draft") {
         await conn.rollback();
         return { success: false, reason: "Only drafts can be permanently deleted." };
       }
       // Cascade: run_line → run_po → run (FKs are ON DELETE CASCADE)
       await conn.execute("DELETE FROM replenishment_run WHERE id = ?", [runId]);
       await conn.commit();
       return { success: true };
     } catch (err) {
       await conn.rollback();
       throw err;
     } finally {
       conn.release();
     }
   }
   ```

6. **Update `ReplenishmentHistoryRepository` domain interface** — add:
   ```ts
   approveDraft(runId: number, approvedByUserId: number, approvedByName: string): Promise<void>;
   hardDeleteDraft(runId: number): Promise<DeleteReplenishmentRunResult>;
   ```

### Step 9: Application — DeleteDraftReplenishmentRunUseCase

Create `app/(authenticated)/history/application/DeleteDraftReplenishmentRunUseCase.ts`:
```ts
import type { ReplenishmentHistoryRepository, DeleteReplenishmentRunResult } from "../domain/ReplenishmentHistoryRepository";

export class DeleteDraftReplenishmentRunUseCase {
  constructor(private readonly repository: ReplenishmentHistoryRepository) {}

  execute(runId: number): Promise<DeleteReplenishmentRunResult> {
    return this.repository.hardDeleteDraft(runId);
  }
}
```

### Step 10: container.ts — New Factories

In `container.ts`:

1. New imports (add near existing replenishment/history imports):
   ```ts
   import { SaveReplenishmentDraftUseCase } from "@/app/(authenticated)/replenishment/application/SaveReplenishmentDraftUseCase";
   import { ApproveReplenishmentDraftUseCase } from "@/app/(authenticated)/replenishment/application/ApproveReplenishmentDraftUseCase";
   import { DeleteDraftReplenishmentRunUseCase } from "@/app/(authenticated)/history/application/DeleteDraftReplenishmentRunUseCase";
   ```

2. New factories:
   ```ts
   export function createSaveReplenishmentDraftUseCase(): SaveReplenishmentDraftUseCase {
     return new SaveReplenishmentDraftUseCase(new MySQLPurchaseOrderRepository());
   }

   export function createApproveReplenishmentDraftUseCase(): ApproveReplenishmentDraftUseCase {
     return new ApproveReplenishmentDraftUseCase(
       new MySQLReplenishmentHistoryRepository(),
       new MySQLPurchaseOrderRepository(),
     );
   }

   export function createDeleteDraftReplenishmentRunUseCase(): DeleteDraftReplenishmentRunUseCase {
     return new DeleteDraftReplenishmentRunUseCase(new MySQLReplenishmentHistoryRepository());
   }
   ```

3. Modify `createCreatePurchaseOrdersUseCase` to use the same repo instance (no change needed — it already creates `new MySQLPurchaseOrderRepository()`).

### Step 11: API Route — POST /replenishment/api/draft

Create `app/(authenticated)/replenishment/api/draft/route.ts`:

Mirror `app/(authenticated)/replenishment/api/po/route.ts` pattern:
- `POST`: auth → validate body (same validation as `/api/po` — skus, suppliers, quantities, etc.) → enrich with `createdByUserId` + `createdByName` + `createdByEmployeeCode` from session → call `createSaveReplenishmentDraftUseCase().execute(body)` → return `{ success: true, runId }` (201) or error.

Validation mirrors the PO route's `Zod`-style manual checks (lines 42-72 of `po/route.ts`). Reuse by extracting validation into a shared function, or duplicate for now (YAGNI — only two call sites).

### Step 12: API Route — POST /history/replenishment/api/{runId}/approve

Create `app/(authenticated)/history/replenishment/api/[runId]/approve/route.ts`:

- `POST`: auth → check `replenishment.approve` permission → get `runId` from params → call `createApproveReplenishmentDraftUseCase().execute(runId, { userId: session.user.id, name: session.user.name })` → return POs on success (200), error on failure.

Post-approve (non-transactional, same pattern as `po/route.ts` lines 110-119): call `createMarkSuppliersOrderedUseCase` + `createRecomputeReplenishmentSummaryUseCase`.

### Step 13: API Route — DELETE draft in history detail

Modify `app/(authenticated)/history/replenishment/api/[runId]/route.ts` DELETE handler:

The existing DELETE handler (line 24) calls `createDeleteReplenishmentRunUseCase().execute(runId)` which soft-deletes active runs. We need to:
1. Check if the run is a draft: call `createGetReplenishmentRunDetailUseCase().execute(runId)` first
2. If draft: require `history.delete_draft` permission (or `history.delete_run`), call `createDeleteDraftReplenishmentRunUseCase().execute(runId)`
3. If active: require `history.delete_run` permission, call existing `createDeleteReplenishmentRunUseCase().execute(runId)`

Alternatively, keep the DELETE handler simple and have the client decide which endpoint to call. But server-enforcing the permission is critical.

**Preferred approach**: Extend the existing DELETE handler to:
- Resolve the run (cheap query)
- If status is 'draft': enforce `history.delete_draft`, call `hardDeleteDraft`
- If status is not 'draft': enforce `history.delete_run`, call existing `delete` (soft-delete)

### Step 14: UI — Review Screen Bottom Bar (Save as Draft)

In `app/(authenticated)/replenishment/page.tsx`:

1. **Add state**: `draftSaving` boolean, `draftSaveMessage` for feedback.

2. **Add `handleSaveDraft()` function** (near `submitPO`, line 1430):
   - POSTs to `/replenishment/api/draft` with the same body shape as `submitPO` (minus `belowMinAck`)
   - On success: show toast/confirmation ("Draft saved"), optionally navigate away or stay
   - On error: show error message

3. **Fetch `replenishment_require_approval` setting**: In the main data-fetching effect (or a new `useEffect`), fetch from `/admin/api/settings` and store `requireApproval` boolean. Since the review screen is a sub-screen of the replenishment page, this can be fetched once on mount.

4. **Modify the Review bottom bar** (lines 2012-2024):
   ```tsx
   <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4">
     <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-3 px-4">
       <div className="type-body">
         <span className="text-muted-foreground">Estimated total (pre-tax): </span>
         <span className="font-semibold text-foreground">
           {formatPeso(computeSupplierRunning(poLines).runningValue)}
         </span>
       </div>
       <div className="flex gap-2">
         <Button variant="secondary" onClick={handleSaveDraft} disabled={submitting || draftSaving}>
           {draftSaving ? "Saving…" : "Save as Draft"}
         </Button>
         {!requireApproval && (
           <Button onClick={handleSubmitPO} disabled={submitting}>
             {submitting ? "Submitting…" : "Submit PO"}
           </Button>
         )}
       </div>
     </div>
   </div>
   ```

5. **Draft-save confirmation**: Show a toast or inline success message after draft save, then optionally navigate back to the main list. Use the existing message pattern (like the admin settings card's success/error state).

### Step 15: UI — History Detail Page (Approve + Draft Delete)

In `app/(authenticated)/history/replenishment/[runId]/page.tsx`:

1. **Fetch user session** to check permissions (if not already fetched). Use `getSession()` or extend existing session fetch.

2. **Add Approve button** in the header action buttons area (lines 674-682):
   ```tsx
   {run.status === "draft" && hasPermission("replenishment.approve") && (
     <Button size="sm" onClick={handleApprove} disabled={approving}>
       {approving ? "Approving…" : "Approve"}
     </Button>
   )}
   ```

3. **Add `handleApprove()` function**:
   - POST to `/history/replenishment/api/${runId}/approve`
   - On success: reload run detail (now `status = 'active'`)
   - On error: show error message

4. **Add "Draft" badge** next to the run title (line 662-668 area):
   ```tsx
   {run.status === "draft" && <Badge variant="neutral">Draft</Badge>}
   ```

5. **Modify Delete button** (lines 675-679):
   - For draft runs: show "Delete Draft" button, gated by `history.delete_draft` permission. Confirm dialog says "Permanently delete this draft? This cannot be undone." → calls `handleDeleteDraft()`.
   - For active runs: show existing "Delete" button, gated by `history.delete_run` permission.
   - Both hidden when `status === "deleted"`.

6. **Add `handleDeleteDraft()` function**:
   - DELETE to `/history/replenishment/api/${runId}` (existing endpoint, which detects draft status server-side)
   - On success: navigate back to history list
   - On error: show error

### Step 16: UI — Admin Settings Toggle

In `app/(authenticated)/admin/ReplenishmentSettingsCard.tsx`:

1. Add `requireApproval` state + fetch from settings (alongside `showAllItems`):
   ```ts
   const [requireApproval, setRequireApproval] = useState(false);
   // In useEffect fetch:
   setRequireApproval(data.settings.replenishment_require_approval ?? false);
   ```

2. Add a second toggle row (after the existing "Show all items" row):
   ```tsx
   <div className="flex items-center justify-between gap-4">
     <div className="space-y-1">
       <Label htmlFor="require-approval" className="text-foreground">Require Approval</Label>
       <p className="type-caption">
         On: the Submit PO button is hidden — replenishment runs must be saved as drafts
         and approved by a user with the Approve Replenishment permission.
       </p>
     </div>
     <Switch
       id="require-approval"
       checked={requireApproval}
       onCheckedChange={(next) => toggle("replenishment_require_approval", next)}
     />
   </div>
   ```

3. Refactor the `toggle` function to accept a key parameter (or use a keyed approach):
   ```ts
   async function toggle(key: string, next: boolean) {
     // Update the right state var
     if (key === "replenishment_show_all_items") setShowAllItems(next);
     else if (key === "replenishment_require_approval") setRequireApproval(next);
     // PUT to API
     try {
       const res = await fetch("/admin/api/settings", {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ [key]: next }),
       });
       // ... error handling + success message
     } catch { /* revert */ }
   }
   ```

### Step 17: UI — Admin Settings API

In `app/(authenticated)/admin/api/settings/route.ts`:

1. **GET** (line 10): Add `replenishment_require_approval` to the `Promise.all` + response:
   ```ts
   const requireApprovalRaw = await createGetAppSettingUseCase().execute("replenishment_require_approval");
   // in response:
   replenishment_require_approval: requireApprovalRaw === null ? false : requireApprovalRaw === "on",
   ```

2. **PUT** (line 43): Add `replenishment_require_approval` to body destructuring, and add permission check + write block:
   ```ts
   if (replenishment_require_approval !== undefined && !(await requirePermission("admin.replenishment_settings"))) {
     return FORBIDDEN;
   }
   // ... later in per-key writes:
   if (replenishment_require_approval !== undefined) {
     if (typeof replenishment_require_approval !== "boolean") {
       return NextResponse.json({ error: "replenishment_require_approval must be a boolean" }, { status: 400 });
     }
     await createUpdateAppSettingUseCase().execute("replenishment_require_approval", replenishment_require_approval ? "on" : "off");
   }
   ```

### Step 18: UI — History List (Draft visibility + badge)

In `app/(authenticated)/history/replenishment/page.tsx`:

1. Accept `currentUserId` and permissions from session.
2. Pass `excludeOtherUsersDrafts` + `draftOwnerUserId` to the list API when user is not an admin.
3. Add a "Draft" badge (`<Badge variant="neutral">Draft</Badge>`) on draft rows alongside the existing path badge (line 158-163 area).

In the list API route (`/history/replenishment/api/route.ts`):
- Read `currentUserId` from session
- Check if user has `module.history` (admin) via `permissionsSatisfy(session.user.permissions, "module.history")` — actually admins have `module.history`, but so might non-admin viewers. We need to check admin status differently.
- Better approach: pass `filterDrafts` boolean param from client. The client knows if the user is admin (has any `admin.*` permission). The API handler takes that param and passes it to the repository.

In `MySQLReplenishmentHistoryRepository.list()`:
- Add optional `filterDraftsByUserId?: number` param
- When set: add `AND (r.status != 'draft' OR r.created_by_user_id = ?)` with the user ID

### Step 19: Post-approve hooks

In the approve API route (Step 12), after successful PO creation + status update:
1. Call `createMarkSuppliersOrderedUseCase().execute(supplierIds, today())` — updates `last_ordered_at`
2. Call `createRecomputeReplenishmentSummaryUseCase().execute()` — refreshes cached summary
   - These already exist and are used in `POST /replenishment/api/po` (lines 110-119)
   - Same non-transactional, failure-non-fatal pattern

## Risks & Open Questions

- **Orphaned POs on partial failure**: If PO creation succeeds but the status-update `UPDATE replenishment_run SET status = 'active'` fails, ActiveOne POs exist without a linked active run. Risk is low (two sequential writes to same DB), but worth noting. Mitigation: the approve handler catches errors and logs; the admin can manually track POs by their OHPO codes in ActiveOne.
- **Draft data staleness**: Items may change between draft save and approval (e.g. SKU removed from masterlist, vendor changed). The `createPOsFromDraft` method re-resolves items fresh from ActiveOne, so this is handled — but if an item is deleted, the approval will fail with `UnknownSkuError` and the draft stays a draft.
- **`MODIFY COLUMN` on large `replenishment_run` table**: The idempotent ALTER to extend the status enum uses `MODIFY COLUMN`, which can be slow on tables with millions of rows. In practice, `replenishment_run` will be small (one row per run, not per line). Acceptable.
- **`status` enum ordering**: MySQL enums store the index, not the string. Changing `('active','deleted')` to `('draft','active','deleted')` renumbers existing rows (0→active becomes 1→active). This is transparent to apps reading by string, but worth being aware of for direct DB inspection.
- **No re-validation of supplier/manufacturer mapping at approve time**: The approve flow re-resolves items and re-groups by the item's current manufacturer, not the one stored in the draft. This could produce different PO groupings than what the creator saw. Acceptable — the current state is authoritative.
