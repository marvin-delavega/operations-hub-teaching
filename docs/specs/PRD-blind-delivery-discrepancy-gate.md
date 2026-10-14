# PRD: Blind Delivery Discrepancy Gate
Date: 2026-07-02

## 1. Overview

Blind delivery (the client's preferred receiving mode) hides ordered quantities so scan counts stay honest — but it also hides the one thing staff genuinely need to act on: over-delivery. This feature lets a blind session **detect over-delivery without ever revealing the ordered quantity**, then routes discrepancies through a **temporary admin unlock** on the Review screen: an admin authenticates once, sees the full picture, returns excess or deliberately allows it, approves, and hands control back to staff. The save is **blocked and server-enforced** until an admin signs off, so an over-delivery can never be committed anonymously.

## 2. Goals

- Preserve blindness on **every** line, including over-delivered ones — the crossing point must never leak the ordered quantity.
- Prevent an Over or Not-Ordered delivery from being committed without an attributable admin approval, enforced on the server.
- Give admins a fast, low-math way to return excess (one-tap "snap to balance").
- Keep a durable, attributable audit trail of who approved which discrepancies and what was returned.
- Change nothing about non-blind delivery — this is a blind-mode-only behavior.

## 3. Non-Goals

- Does **not** apply when blind mode is OFF (today's non-blind behavior is unchanged).
- Does **not** alert staff at scan time to Over/Not-Ordered lines (deferred to Review by design).
- Does **not** block save on Under-delivery or on accepted New Items.
- Does **not** introduce a new admin setting/toggle — it is inherent to `delivery_blind_delivery = ON`.
- Does **not** add a separate per-session-level unlock outside blind delivery (the existing per-action rule stays for non-blind flows).
- Does **not** write returned/zeroed Not-Ordered lines to the ActiveOne PO table.

## 4. Users & Roles

- **Staff** — runs the blind receiving session (scans, reaches Review). Cannot see discrepancies, cannot edit quantities, cannot approve. Can trigger Save once the gate is clear.
- **Admin** — authenticates over the staff's shoulder to open the unlock window; sees full blind-OFF detail; edits/deletes lines, returns excess, and approves. Any account with `role = admin` and `is_active = 1` qualifies (including the protected system admin).

## 5. Functional Requirements

**Classification & visibility (blind ON)**

- FR-1: Over-delivered lines and Not-Ordered lines (in masterlist, not on PO) are **not tagged or surfaced to staff** at scan time. Scanning a Not-Ordered item shows the same neutral "+1" feedback as any ordered item.
- FR-2: New Items (unknown SKUs, not in masterlist) remain **visible at scan** so staff can reject them at the door — unchanged from today.
- FR-3: Over and Not-Ordered detection is computed and evaluated **only on the Review screen**, never live during scanning.

**The save-block gate**

- FR-4: On the Review screen, if the delivery contains at least one Over or Not-Ordered line, `HasDiscrepancy = true` and **Save is blocked**.
- FR-5: While blocked, Review shows a **neutral, quantity-free message** indicating admin review is required. It reveals no item, no quantity, and **not even the count** of discrepant lines.
- FR-6: Under-delivered lines and accepted New Items do **not** contribute to `HasDiscrepancy` and never block save.
- FR-7: Save is permitted when `HasDiscrepancy = false` **OR** a valid admin `Approved` state exists. (`CanSave = !HasDiscrepancy || Approved`.)

**Admin unlock window**

- FR-8: The Review screen exposes an **admin lock** control. Activating it prompts for an admin's **username + password**, validated **server-side**.
- FR-9: A successful unlock opens a **session-scoped window**: the screen switches to the full blind-OFF view (ordered quantities, Over/Under/Not-Ordered tags) and enables all admin controls (edit, delete, Return Excess, Approve) **without re-entering the password per action**. This supersedes the per-action password rule for the duration of the blind session.
- FR-10: The unlock window stays open until the admin **manually re-locks** (handing control back to staff). It does not auto-close after a single action.
- FR-11: The unlock window also **auto-relocks** when the admin navigates away from the Review screen or after an idle period, so staff cannot inherit an abandoned unlocked session.
- FR-12: Repeated failed admin-unlock attempts are **throttled / locked out** after a threshold, using the same generic error throughout (no distinction between wrong password and unknown user).

**Return Excess**

- FR-13: The line **edit modal** carries a **secondary "Return Excess" button**, shown only on **Over and Not-Ordered** lines (hidden/disabled on Exact and Under). Primary action in the modal remains manual edit.
- FR-14: Return Excess **snaps the received quantity down to the ordered quantity** (the overage becomes 0). For a Not-Ordered line (ordered qty = 0), it snaps received to **0**.
- FR-15: Return Excess prompts a **confirm dialog** before applying, since it discards a scanned count. The action is reversible via manual edit.

**Approve semantics & invalidation**

- FR-16: **Approve** means "an admin accepts the remaining Over/Not-Ordered lines as delivered." Balancing discrepancies away is optional — an admin may deliberately allow an over-delivery.
- FR-17: When all Over/Not-Ordered lines are balanced away (via Return Excess / edits), `HasDiscrepancy` becomes false and Save unblocks **with no Approve required**.
- FR-18: A granted approval is **bound to the exact received quantities of the flagged Over/Not-Ordered lines** at approval time.
- FR-19: After approval, any **new** Over/Not-Ordered line, or any **increase** to an already-approved line's quantity, **invalidates** the approval and re-blocks Save. Decreases (undo/edit-down) never invalidate.
- FR-20: Invalidation is evaluated **only on the Review screen** and never surfaced live at scan — the re-block must not let staff correlate a specific scan to a line crossing into Over.

**Re-lock & hand-off**

- FR-21: Re-locking returns the screen to the blind (staff) view. If approval is intact, Save remains enabled for staff.
- FR-22: Re-locking while the session is **still blocked and unapproved** is allowed but **warns the admin first** (warning names no quantities).

**Server-side enforcement**

- FR-23: A commit for a delivery carrying Over/Not-Ordered lines is **rejected by the API** unless the request proves a valid, admin-attributable approval matching **those exact discrepant lines**. The approval is minted by the same server-side admin credential check that opens the unlock.
- FR-24: Server enforcement runs **alongside** the existing optimistic-concurrency check (original PO re-read and verified still open). If the discrepant line set changed after approval, the proof no longer matches and the commit fails.

**Persistence & reload**

- FR-25: **Blind mode is live from settings**, evaluated at PO load — when the user opens PO selection and again when entering a specific PO. It is **not** snapshotted into `localStorage`. The only durable record of the mode is on the **saved delivery record** (the mode it was saved under).
- FR-26: **Scan progress persists** across reload as today.
- FR-27: **The unlock window does not persist** — a reload **re-locks** the session and requires fresh admin authentication to reopen.
- FR-28: **A granted approval persists** in `localStorage` across reload until invalidated by scan state changes (FR-19). It is still re-verified server-side at commit (FR-23).

**Audit / History**

- FR-29: The committed delivery record captures the **approving admin's identity** (who) and **timestamp** (when), separate from the receiver.
- FR-30: The record captures each **Return-Excess event** — line, received qty, and returned-to qty — preserving the "over-delivery happened and was refused" story.
- FR-31: A returned/zeroed Not-Ordered line is **kept as a `QUANTITY = 0` record in our delivery tables** for audit, but **excluded from the superseding ActiveOne PO** (never written to the ERP). This is a deliberate carve-out from the "ordered-but-unscanned lines are written as QUANTITY = 0 to ActiveOne" rule, which still holds for genuine ordered lines.
- FR-32: Delivery History marks sessions where an admin **approved** an Over/Not-Ordered discrepancy with a **distinct, filterable indicator**, so auditors can find "over-delivery allowed" cases.

## 6. Data Model

*No new tables. Additive fields to existing delivery persistence.*

**Delivery record (existing `delivery` table) — added fields**

| Field | Type | Notes |
|---|---|---|
| `saved_blind_mode` | boolean | The blind mode the session was **saved** under (source of truth for the mode; not snapshotted from session start). |
| `discrepancy_approved` | boolean | Whether the committed delivery carried admin-approved Over/Not-Ordered lines. Powers the History filter (FR-32). |
| `approved_by_user_id` | nullable ref → `users.id` | Approving admin (FR-29). Null when no approval was needed. |
| `approved_at` | nullable datetime | Approval timestamp, Asia/Manila (FR-29). |

**Return-Excess events (child of delivery line)**

| Field | Type | Notes |
|---|---|---|
| `delivery_id` | ref → delivery | Parent session. |
| `line_ref` | item/line identifier | The line the return applied to. |
| `received_qty` | integer | Scanned quantity before the return. |
| `returned_to_qty` | integer | Quantity after snap (ordered qty, or 0 for Not-Ordered). |

**Approval proof (transient, not a persisted business table)**

- Minted server-side on admin unlock/approve; bound to `(delivery/PO reference, approving admin id, snapshot of the flagged lines' received quantities)`. Stored client-side in `localStorage` for reload survival (FR-28); authoritative validation happens on the server at commit (FR-23). Never trusted as a bare client flag.

**Zeroed Not-Ordered line**

- Persisted in our delivery tables with `QUANTITY = 0` (FR-31); **omitted** from the ActiveOne superseding PO write.

## 7. API Contract

**Admin unlock (open window / validate credentials)**

- **Method/Endpoint:** `POST /delivery/api` (unlock action) — resolves an authenticate-admin use case.
- **Request:** admin `username`, `password`, delivery/PO reference.
- **Response (success):** confirmation that an admin window is authorized; an approval-proof context tied to the current flagged-line snapshot. Generic error on failure.
- **Errors:** invalid credentials → generic error (no user/password distinction, FR-12); throttled → generic cooldown error; not an active admin → generic error.

**Commit delivery (existing save, extended)**

- **Method/Endpoint:** `POST /delivery/api` (commit action) — existing `CommitDeliveryUseCase`, extended.
- **Request:** the delivery lines + received quantities (existing), plus — when Over/Not-Ordered lines are present — the **approval proof** (approving admin + flagged-line snapshot), Return-Excess events, and the saved blind mode.
- **Response (success):** existing success summary (new superseding PO ref, etc.).
- **Errors:**
  - Missing/invalid approval proof while Over/Not-Ordered lines present → **rejected** (FR-23).
  - Approval snapshot does not match the committed flagged lines → **rejected** (invalidation enforced server-side, FR-24).
  - Original PO no longer open → existing concurrency rejection (FR-24).

*Command-Query Separation preserved: GET reads are unaffected; unlock and commit are POST state-changing actions returning minimal confirmation.*

## 8. UI/UX Flow

**Happy path — no discrepancy**

1. Staff selects PO (blind mode re-checked at load) → enters PO (blind mode re-checked) → scans blind.
2. Review screen: only scanned lines + quantities, no ordered targets, no Over/Under tags. New Items flagged.
3. No Over/Not-Ordered → Save enabled → staff saves → existing success summary. (Saved under blind mode.)

**Discrepancy path — admin intervention**

1. Staff scans blind; an Over and/or Not-Ordered line exists (staff unaware).
2. Review screen: Save is **blocked**; a neutral message states admin review is required — no counts, items, or quantities.
3. Staff summons an admin, who taps the **admin lock** and enters username + password (server-validated, throttled).
4. **Unlock window opens:** screen flips to full blind-OFF detail (ordered qtys, Over/Under/Not-Ordered tags). Admin controls enabled: edit, delete, **Return Excess**, **Approve**.
5. Admin resolves, per line:
   - Opens the line edit modal → taps **Return Excess** (secondary button) → **confirm** → line snaps to ordered qty (Not-Ordered → 0); or edits manually; or
   - Leaves the overage in place to **allow** it.
6. Admin either (a) balances all discrepancies away → block self-clears, or (b) taps **Approve** to accept the remaining discrepancies as delivered.
7. Admin **re-locks** → screen returns to staff blind view. (If re-locking while still blocked and unapproved, a warning appears first.)
8. Staff (or admin) taps **Save**. Server re-verifies approval + PO-open. Success summary. The approving admin, approval time, and Return-Excess events are recorded; the session is flagged as an approved-discrepancy delivery in History.

**Reload mid-flow**

- Scan progress restored; blind mode re-read from settings; session **re-locked** (admin must re-auth to edit). A **granted approval survives** and keeps Save enabled — unless later scans invalidated it.

## 9. Edge Cases & Error Handling

- **Crossing-point leak:** Detection and invalidation are Review-only (FR-3, FR-20). Staff never see per-scan Over feedback, so they can't infer the ordered qty from a re-block.
- **Approval outrun by scanning:** Staff scan more after approval → new Over/Not-Ordered line or an increase to an approved one → approval invalidated, Save re-blocked (FR-19). Enforced client-side (re-block) and server-side (snapshot mismatch, FR-24).
- **Client tampering:** Staff hand-set an "approved" flag in `localStorage` → server rejects the commit for lacking a valid admin-attributable proof (FR-23).
- **Abandoned unlock:** Admin walks away without re-locking → window auto-relocks on navigate-away/idle (FR-11); a reload also re-locks (FR-27).
- **Re-lock while unresolved:** Allowed, but warns the admin first; staff is handed a blocked Save with only the neutral message until an admin returns (FR-22).
- **Not-Ordered fully returned:** Snapped to 0; kept as `QUANTITY = 0` in our tables, suppressed from the ActiveOne PO (FR-31).
- **Brute-force unlock:** Repeated failures throttle/lock out with a generic error (FR-12).
- **Under-only / New-Item-only sessions:** Never block save (FR-6).
- **Protected system admin approving:** Allowed — qualifies as any active admin; approval is attributed to it.

## 10. Open Questions

- **Blind-OFF mid-run bypass:** Because blind mode is live from settings (FR-25), an admin globally toggling `delivery_blind_delivery` **OFF** mid-run means the staff's next PO reload drops the gate, allowing a discrepant delivery to save without the per-session approval. An admin is already involved in flipping the global switch, so this may be acceptable — but should the commit still require approval if any Over/Not-Ordered line is present regardless of current mode, or is the mode-at-commit rule (blind-only gate) the intended final word?
- **Idle auto-relock threshold:** exact idle duration before FR-11 auto-relocks is unspecified.
- **Unlock throttle policy:** attempt threshold and cooldown length for FR-12 are unspecified.

## 11. Out of Scope / Deferred

- Non-blind delivery behavior (unchanged).
- Live scan-time alerting of Over/Not-Ordered (deliberately deferred to Review).
- Any new admin setting/toggle to enable the gate (inherent to blind mode).
- A separate stockout/other-module analog of the gate.
- Correcting/editing a committed delivery's approval after save (History remains read-only).
