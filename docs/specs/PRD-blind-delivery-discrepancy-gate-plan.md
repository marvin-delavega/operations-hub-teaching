# Implementation Plan: Blind Delivery Discrepancy Gate
Source PRD: [PRD-blind-delivery-discrepancy-gate.md](PRD-blind-delivery-discrepancy-gate.md)
Date: 2026-07-02

## Summary
Add a blind-mode-only gate to the Delivery module: Over/Not-Ordered lines are detected only on the Review screen, block Save behind a neutral message, and require a **session-scoped admin unlock** to reveal, resolve (Return Excess / edit / allow), and **Approve**. Approval is minted as a **server-signed HMAC proof** bound to the flagged lines' received quantities, persisted in `localStorage`, and **re-verified at commit** so an over-delivery can never be committed anonymously. Audit fields (approving admin, timestamp) and Return-Excess events are captured on the delivery record and surfaced (filterably) in Delivery History. No new tables for the core mechanic beyond one child table for return events; no new admin toggle.

## Affected Areas

### Delivery module — `app/(authenticated)/delivery/`
- **domain** [Delivery.ts](../../app/(authenticated)/delivery/domain/Delivery.ts): extend `DeliveryCommit`; add approval/return-excess types; add pure `isApprovalCovering()` + `flaggedLines()` helpers; add `DiscrepancyApprovalRequiredError`.
- **domain** [DeliveryRepository.ts](../../app/(authenticated)/delivery/domain/DeliveryRepository.ts): commit contract already covers commit — payload grows (no method signature change beyond the `DeliveryCommit` fields).
- **application**:
  - [AdminVerifier.ts](../../app/(authenticated)/delivery/application/AdminVerifier.ts): change `verify()` to return `AdminIdentity | null` (`{ userId, name }`) instead of `boolean`.
  - [VerifyAdminUseCase.ts](../../app/(authenticated)/delivery/application/VerifyAdminUseCase.ts): keep boolean contract for the existing per-action gate (`return !!identity`).
  - **new** `AuthorizeDeliveryUnlockUseCase.ts`: validate admin creds (via `AdminVerifier`), enforce throttle, mint a short-lived **window token**.
  - **new** `MintDeliveryApprovalUseCase.ts`: verify window token, mint the **approval proof** bound to the current flagged snapshot.
  - [CommitDeliveryUseCase.ts](../../app/(authenticated)/delivery/application/CommitDeliveryUseCase.ts): thread the new commit fields through to the repository.
- **infrastructure**:
  - [MySQLAdminVerifier.ts](../../app/(authenticated)/delivery/infrastructure/MySQLAdminVerifier.ts): return `{ userId, name }` on success.
  - **new** `deliveryApprovalProof.ts`: HMAC mint/verify for the window token and approval proof (uses `AUTH_SECRET`); `canonicalSnapshot()`.
  - [MySQLDeliveryRepository.ts](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts): server-side approval enforcement inside the commit txn; persist approval fields + return-excess rows; carve out returned-to-0 Not-Ordered lines from the ActiveOne write.
- **api**:
  - [api/route.ts](../../app/(authenticated)/delivery/api/route.ts): extend the commit `POST` body (approval, returnExcessEvents); map new domain error → HTTP.
  - **new** `api/admin-unlock/route.ts`: open the unlock window (throttled).
  - **new** `api/approve/route.ts`: mint the approval proof.
  - [api/verify-admin/route.ts](../../app/(authenticated)/delivery/api/verify-admin/route.ts): unchanged (per-action non-blind gate).
- **page** [page.tsx](../../app/(authenticated)/delivery/page.tsx): Review-screen gate, neutral block message, admin unlock/re-lock window, blind-OFF reveal, Return Excess button + confirm, Approve, client-side invalidation, approval `localStorage` persistence, idle auto-relock.

### History module — `app/(authenticated)/history/`
- [domain/DeliverySessionSummary.ts](../../app/(authenticated)/history/domain/DeliverySessionSummary.ts): add `discrepancyApproved` to summary; add approver + return-excess fields to detail.
- [domain/HistoryFilters.ts](../../app/(authenticated)/history/domain/HistoryFilters.ts): add `approvedOnly?: boolean`.
- [infrastructure/MySQLDeliveryHistoryRepository.ts](../../app/(authenticated)/history/infrastructure/MySQLDeliveryHistoryRepository.ts): select new columns, join `delivery_return_excess`, apply the `approvedOnly` filter.
- [delivery/api/route.ts](../../app/(authenticated)/history/delivery/api/route.ts): parse `approvedOnly`.
- [delivery/page.tsx](../../app/(authenticated)/history/delivery/page.tsx): "Approved discrepancies only" filter + per-row indicator.
- [delivery/[deliveryId]/page.tsx](../../app/(authenticated)/history/delivery/[deliveryId]/page.tsx): approving-admin block, Return-Excess table, print + CSV inclusion.

### Shared / composition
- [container.ts](../../container.ts): update `createVerifyAdminUseCase` wiring (unchanged shape); add `createAuthorizeDeliveryUnlockUseCase()` and `createMintDeliveryApprovalUseCase()`.

### DB — [scripts/create-app-tables.sql](../../scripts/create-app-tables.sql)
- Idempotent `ALTER` additions to `delivery`: `discrepancy_approved`, `approved_by_user_id`, `approved_at`, `approver_name` (mirrors the existing `receiver_name`/`blind_delivery` ALTER pattern at lines 273–350).
- **new** child table `delivery_return_excess` (FK cascade to `delivery`), following the `delivery_line` pattern (lines 433–446).
- **No** `saved_blind_mode` column — the existing `delivery.blind_delivery` column already stores the mode the session was saved under (see Decisions).

### ActiveOne tables (read/write, unchanged shape)
- `purchase_order` / `purchase_order_items` (supersede write), `users` (admin verify + approver name), `item` / `item_master_cache` (returned-line description resolution).

## Decisions

**Resolved by developer (AskUserQuestion):**
- **Commit gate rule** → *Blind-mode-at-commit only*. The server requires a valid approval only when `input.blindDelivery` is true AND the committed set contains Over/Not-Ordered lines. Non-blind commits are unchanged (PRD Non-Goal §3). Accepts the mid-run blind-OFF bypass (an admin is already involved in flipping the global switch).

**Resolved by AI (from PRD / CLAUDE.md / existing patterns):**
- **Reuse `delivery.blind_delivery` as the saved-mode source of truth** instead of adding `saved_blind_mode` — `persistDeliveryRecord` already writes `input.blindDelivery` there ([MySQLDeliveryRepository.ts:406](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts#L406)), and CLAUDE.md states the saved record durably stores the mode. Avoids a duplicate column (DRY / Single Source of Truth).
- **Approval proof = HMAC-SHA256 over `poId | adminUserId | canonicalSnapshot`, keyed by `AUTH_SECRET`.** `AUTH_SECRET` is already required env (used by NextAuth). The signed proof carries the *approved snapshot as data*; the server recomputes the HMAC to prove authenticity, then does a domain coverage check for invalidation. This satisfies "never trusted as a bare client flag" (§6) and lets the proof survive reload in `localStorage` (FR-28) while staying tamper-proof.
- **Two-step unlock→approve** (window token in memory, proof in `localStorage`): unlock mints a short-lived **window token** (memory only → naturally lost on reload, satisfying FR-27 re-lock); Approve exchanges the window token for the persisted **approval proof** (FR-28). The proof must be minted server-side *before* commit so it can persist across reload — hence a mint step distinct from commit.
- **Server enforcement lives in `MySQLDeliveryRepository.commit`** (throwing a domain error), mirroring the existing `PurchaseOrderAlreadyReceivedError` placement — it is the only place holding the authoritative re-read lines inside the atomic supersede transaction. The invalidation/coverage rule is a **pure domain function** in `Delivery.ts`; only the HMAC verify (needs `AUTH_SECRET`) is in infrastructure.
- **Unlock throttle (FR-12):** module-level in-memory counter keyed by lowercased username — **5 failed attempts → 5-minute lockout**, one generic error throughout. In-memory is acceptable given the single-host Windows runtime (same assumption as the Task Scheduler integration). *(PRD Open Question — defaulted.)*
- **Idle auto-relock (FR-11):** **3-minute** inactivity timer on the Review screen (reset on pointer/key/scan), plus relock on unmount/navigate. *(PRD Open Question — defaulted.)*
- **Flagged set = `over_served` ∪ `not_ordered`** with `received > 0` (Under-served and New Items never contribute — FR-6), computed with the existing `classifyLine()` on both client and server.
- **Approve endpoint is blind-only and additive**; the existing `verify-admin` per-action route is untouched so non-blind flows keep the per-action password rule (§3 Non-Goal).

**Assumptions the implementer should know:**
- The `AdminVerifier` return-type change ripples only to `VerifyAdminUseCase` (mapped back to boolean) — no other caller.
- Returned-to-0 **Not-Ordered** lines are reconstructed for the `delivery_line` snapshot from `returnExcessEvents` (their description resolved via `item`/`item_master_cache`), since the client drops zero-qty Not-Ordered lines from `lines`.
- Over-served lines returned down to ordered qty become ordinary Exact lines at commit and flow to ActiveOne normally; only the audit event is extra.

## Implementation Steps

### 1. DB schema — [create-app-tables.sql](../../scripts/create-app-tables.sql)
- After the existing `delivery` idempotent ALTERs (~line 350), add four columns with the same `information_schema.COLUMNS` guard pattern:
  - `discrepancy_approved tinyint(1) NOT NULL DEFAULT 0`
  - `approved_by_user_id int NULL`
  - `approved_at datetime NULL`
  - `approver_name varchar(255) NULL`
- Add index `ix_delivery_discrepancy_approved (discrepancy_approved)` (guarded, for the History filter), mirroring the `ix_delivery_*` blocks.
- Add child table (after `delivery_line`, mirroring lines 433–446):
  ```sql
  CREATE TABLE IF NOT EXISTS `delivery_return_excess` (
    `id`             int unsigned NOT NULL AUTO_INCREMENT,
    `delivery_id`    int unsigned NOT NULL,
    `item_code`      varchar(50)  NOT NULL,
    `received_qty`   int          NOT NULL,
    `returned_to_qty` int         NOT NULL,
    PRIMARY KEY (`id`),
    KEY `ix_delivery_return_excess_delivery` (`delivery_id`),
    CONSTRAINT `fk_delivery_return_excess_delivery`
      FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`id`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  ```

### 2. Domain — [Delivery.ts](../../app/(authenticated)/delivery/domain/Delivery.ts)
- Add types:
  - `FlaggedLine = { code: string; receivedQuantity: number }`
  - `ApprovalClaim = { proof: string; approvedByUserId: number; flaggedLines: FlaggedLine[] }`
  - `ReturnExcessEvent = { code: string; receivedQuantity: number; returnedToQuantity: number }`
- Extend `DeliveryCommit` with: `approval: ApprovalClaim | null`, `returnExcessEvents: ReturnExcessEvent[]`. (`blindDelivery` already present.)
- Add pure helpers:
  - `flaggedFrom(lines): FlaggedLine[]` — filters `over_served`/`not_ordered` via `classifyLine` (received > 0).
  - `isApprovalCovering(approvedSnapshot: FlaggedLine[], actualFlagged: FlaggedLine[]): boolean` — every actual line exists in the snapshot with `actual.qty <= approved.qty` and no actual line is absent from the snapshot (decreases pass; increases/new fail — FR-18/19).
- Add `class DiscrepancyApprovalRequiredError extends Error` (mirrors `PurchaseOrderAlreadyReceivedError`).

### 3. Infrastructure — new `deliveryApprovalProof.ts`
- `canonicalSnapshot(flagged: FlaggedLine[]): string` — sort by code, join `code:qty` (stable, order-independent).
- `mintWindowToken(poId, adminUserId): { token, expiresAt }` — HMAC over `poId|adminUserId|issuedAt`, TTL ~10 min (bridges unlock→approve within a session).
- `verifyWindowToken(token, poId): { adminUserId } | null`.
- `mintApprovalProof(poId, adminUserId, flagged): string` — HMAC over `poId|adminUserId|canonicalSnapshot`.
- `verifyApprovalProof(poId, claim: ApprovalClaim): boolean` — recompute HMAC over the *claimed* snapshot and compare (timing-safe).
- Key: `process.env.AUTH_SECRET` (throw if missing, fail-fast).

### 4. Admin verifier identity — [AdminVerifier.ts](../../app/(authenticated)/delivery/application/AdminVerifier.ts) + [MySQLAdminVerifier.ts](../../app/(authenticated)/delivery/infrastructure/MySQLAdminVerifier.ts)
- `AdminIdentity = { userId: number; name: string }`; `verify(username, password): Promise<AdminIdentity | null>`.
- SQL selects `id, name, password_hash`; return `{ userId: id, name }` on bcrypt match, else `null`.
- [VerifyAdminUseCase.ts](../../app/(authenticated)/delivery/application/VerifyAdminUseCase.ts): `return (await this.verifier.verify(...)) !== null`.

### 5. Application — unlock + mint use cases
- **`AuthorizeDeliveryUnlockUseCase`** (`execute(username, password, poId)`):
  - Module-level `attempts: Map<string, { count; until }>`; if locked out → return `{ ok: false }` (generic).
  - `verify` → on `null`, bump attempts, return `{ ok: false }`.
  - On success: clear attempts, `mintWindowToken(poId, identity.userId)` → return `{ ok: true, adminUserId, adminName: identity.name, windowToken, expiresAt }`.
- **`MintDeliveryApprovalUseCase`** (`execute(windowToken, poId, flaggedLines)`):
  - `verifyWindowToken` → `null` ⇒ `{ ok: false }`.
  - `mintApprovalProof(poId, adminUserId, flaggedLines)` → `{ ok: true, proof, approvedByUserId, approvedAt: nowManilaISO }`. (Approver name is re-resolved server-side at commit from `users`, not trusted from the client.)

### 6. API routes
- **new** `api/admin-unlock/route.ts` — `POST { username, password, poId }` → `createAuthorizeDeliveryUnlockUseCase()`. 200 with token on success; **generic** 401 otherwise (no user/password distinction); 429-style generic error when throttled. Mirror the request-parsing shape of [verify-admin/route.ts](../../app/(authenticated)/delivery/api/verify-admin/route.ts).
- **new** `api/approve/route.ts` — `POST { windowToken, poId, flaggedLines }` → `createMintDeliveryApprovalUseCase()` → `{ proof, approvedByUserId, approvedAt }` or generic 401.
- **commit** [api/route.ts](../../app/(authenticated)/delivery/api/route.ts) `POST`:
  - Parse/validate `approval` (`{ proof: string, approvedByUserId: int>0, flaggedLines: {code,receivedQuantity}[] }` or absent) and `returnExcessEvents` (`{code, receivedQuantity, returnedToQuantity}[]`), same defensive filtering as `lines`.
  - Pass through to `CommitDeliveryUseCase.execute`.
  - Add `catch (DiscrepancyApprovalRequiredError) → 422`.

### 7. Commit use case + repository enforcement
- [CommitDeliveryUseCase.ts](../../app/(authenticated)/delivery/application/CommitDeliveryUseCase.ts): add `approval`, `returnExcessEvents` to `CommitDeliveryInput`; forward into `repository.commit`.
- [MySQLDeliveryRepository.ts](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts) `commit` (inside `withPoMintRetry`, after building `snapshotLines`):
  1. Compute `actualFlagged` from the authoritative classified lines (`over_served` where `received > ordered`; `not_ordered` where `received > 0`).
  2. **Gate:** if `input.blindDelivery && actualFlagged.length > 0`:
     - require `input.approval` non-null;
     - `verifyApprovalProof(input.poId, input.approval)` must pass;
     - `input.approval.approvedByUserId` must resolve to an **active admin** (`SELECT ... WHERE id=? AND is_active=1 AND role='admin'`);
     - `isApprovalCovering(input.approval.flaggedLines, actualFlagged)` must be true;
     - else `throw new DiscrepancyApprovalRequiredError()`.
  3. **ActiveOne carve-out (FR-31):** for Not-Ordered codes present in `returnExcessEvents` with `returnedToQuantity === 0`, do **not** push to `lineValues` (ActiveOne), but **do** emit a `snapshotLines` row (`status: "not_ordered"`, `receivedQty: 0`), resolving description via `item`/`item_master_cache` by code.
  4. In `persistDeliveryRecord`: when the gate applied, set `discrepancy_approved = 1`, `approved_by_user_id`, `approved_at`, and `approver_name` (resolve from `users.name` by `approvedByUserId`, like `receiver_name`). Insert `delivery_return_excess` rows from `returnExcessEvents`.
- This runs **alongside** the existing original-PO-still-open `FOR UPDATE` check (FR-24) already at [lines 182–194](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts#L182).

### 8. container.ts
- Add `createAuthorizeDeliveryUnlockUseCase()` and `createMintDeliveryApprovalUseCase()` (both wire `new MySQLAdminVerifier()`); leave `createVerifyAdminUseCase()` factory shape unchanged.

### 9. Client — [page.tsx](../../app/(authenticated)/delivery/page.tsx) `ReceivingScreen`
- **State:** `adminWindow: { adminUserId; adminName; windowToken; expiresAt } | null` (memory only); `approval: { proof; approvedByUserId; approverName; approvedAt; snapshot: FlaggedLine[] } | null` (mirrored to `localStorage` key `delivery:po:{id}:approval`).
- **Derived (Review only):** `flagged = flaggedFrom(lines)`; `hasDiscrepancy = blind && flagged.length > 0`; `approvalValid = approval && isApprovalCovering(approval.snapshot, flagged)`; `canSave = !hasDiscrepancy || !!approvalValid`.
- **Invalidation (FR-19/20):** in a `useEffect` on `lines` (Review only) drop `approval` (state + `localStorage`) when `approval && !isApprovalCovering(...)`. Never surfaced at scan (guarded by `reviewMode`).
- **Blocked view (staff, no window):** neutral card "Admin review required" (no counts/items/qty) + "Admin unlock" button → `AdminUnlockModal` (username+password) → `POST /delivery/api/admin-unlock` → set `adminWindow`; on generic error show one message. Reuse `AdminAuthModal` styling.
- **Unlocked view:** render full blind-OFF detail (ordered qty, status chips via `STATUS_META`, Edit/Delete already gated-free while window open — bypass `adminGate` when `adminWindow` set). Add **Approve** and **Re-lock** buttons; Re-lock while blocked+unapproved shows a warning first (quantity-free).
- **Approve:** `POST /delivery/api/approve { windowToken, poId, flaggedLines: flagged }` → store `approval` (+`localStorage`, `approverName = adminWindow.adminName`).
- **Return Excess:** in the line edit modal, secondary button visible only for `over_served`/`not_ordered` → confirm dialog → snap `receivedQuantity` to `orderedQuantity` (0 for Not-Ordered) and append a `ReturnExcessEvent`. Keep the returned Not-Ordered line's event even though the line drops from `lines`.
- **Idle auto-relock:** 3-min timer (reset on interaction/scan) clears `adminWindow`; also clear on unmount.
- **Save:** include `blindDelivery: blind`; when `hasDiscrepancy` include `approval: { proof, approvedByUserId, flaggedLines: approval.snapshot }`; always include `returnExcessEvents`.
- **Cleanup:** on `onSaved`, also `localStorage.removeItem(delivery:po:{id}:approval)`.

### 10. History — surface audit (FR-29/30/32)
- [DeliverySessionSummary.ts](../../app/(authenticated)/history/domain/DeliverySessionSummary.ts): `DeliverySessionSummary` += `discrepancyApproved: boolean`; `DeliverySessionDetail` += `discrepancyApproved`, `approvedByUserId: number | null`, `approverName: string | null`, `approvedAt: string | null`, `returnExcess: { itemCode; receivedQty; returnedToQty }[]`.
- [HistoryFilters.ts](../../app/(authenticated)/history/domain/HistoryFilters.ts): `approvedOnly?: boolean`.
- [MySQLDeliveryHistoryRepository.ts](../../app/(authenticated)/history/infrastructure/MySQLDeliveryHistoryRepository.ts):
  - `list`: select `d.discrepancy_approved`; when `filters.approvedOnly` add `d.discrepancy_approved = 1`.
  - `getById`: select approver columns; second query `SELECT item_code, received_qty, returned_to_qty FROM delivery_return_excess WHERE delivery_id = ? ORDER BY id`.
- [history/delivery/api/route.ts](../../app/(authenticated)/history/delivery/api/route.ts): parse `approvedOnly=1`.
- [history/delivery/page.tsx](../../app/(authenticated)/history/delivery/page.tsx): add a toggle "Approved discrepancies only" (semantic-token styled, matching the filter bar); render an "Approved" `Badge` on rows where `discrepancyApproved`.
- [history/delivery/[deliveryId]/page.tsx](../../app/(authenticated)/history/delivery/[deliveryId]/page.tsx): add an "Approved by {approverName} · {toManilaDatetime(approvedAt)}" line + a Return-Excess table (item, received → returned-to); include both in the CSV export and the `PrintReport` (monochrome-safe, typographic markers per the print pattern).

## Risks & Open Questions
- **In-memory throttle** resets on server restart and is per-process — acceptable for the single-host runtime but revisit if the app ever runs multi-instance.
- **`AUTH_SECRET` presence** — the proof helpers must fail-fast if unset; verify `.env.local` has it in every environment before shipping.
- **Returned Not-Ordered snapshot description** — resolving a dropped line's description at commit relies on `item`/`item_master_cache` still containing the code; fall back to the literal code if unresolved.
- **Window-token TTL vs idle relock** — the 10-min token TTL must be ≥ the 3-min idle relock so a legitimately-open window never fails Approve; confirm during testing.
- **Coverage semantics on mixed edits** — verify against live data that decreasing an approved over-line while adding a *new* over-line correctly invalidates (new line absent from snapshot ⇒ `isApprovalCovering` false).
- **Existing `restoreSession`/blind reload paths** already have subtle mode-handling ([page.tsx:324–392](../../app/(authenticated)/delivery/page.tsx#L324)); ensure the approval-invalidation effect doesn't fire spuriously during restore before `lines` settle.
