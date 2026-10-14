# PRD: Delivery Settings — Continuous Scanning & Blind Delivery
Date: 2026-06-30

## 1. Overview
Two global, admin-controlled policy toggles that change how the Delivery floor tool behaves during receiving. **Continuous Scanning** controls whether each scan auto-adds +1 (current behavior) or prompts the staffer to type a quantity to add. **Blind Delivery** hides the PO's ordered quantities and the Exact/Over/Under variance from the receiving staff so they cannot reverse-engineer "what they're supposed to scan" and manipulate a delivery to match the order. Both settings live in a new **Delivery** tab in `/admin`, are stored as keys in `app_settings`, and default to the app's current behavior.

## 2. Goals
- Let admins switch the floor between fast +1 scanning and deliberate prompt-for-quantity receiving.
- Let admins run "blind" deliveries where staff record what physically arrived without seeing the order, preserving the true variance for later reconciliation.
- Preserve today's exact behavior when neither setting is changed (zero-surprise defaults).
- Keep the underlying supersede-PO save (data written to ActiveOne) unchanged regardless of either setting — these are **view/interaction** policies, not data-model changes.

## 3. Non-Goals
- No per-location, per-user, or per-role scoping — both settings are global.
- No mid-session live switching — a change does not alter a receiving session already in progress.
- No change to the supersede-PO write logic, line-cost rules, status classification rules, or what gets persisted to ActiveOne.
- No admin-facing variance/reconciliation screen (relies on existing data: superseded original PO + new PO; a future Delivery History module).
- No audit trail of who changed the settings (explicitly rejected this round).
- No tracking of "blind vs non-blind" on the saved delivery record — no special tag on the resulting PO.

## 4. Users & Roles
- **Admins** — configure both toggles in the new `/admin` Delivery tab. `/admin/*` is already admin-only via middleware.
- **Staff (and admins) on the floor** — experience the resulting behavior in the Delivery module. Staff cannot view or change the settings.
- Existing Delivery authorization is unchanged: pure scanning + undo-last-scan need no auth; other manual edits (arbitrary qty edit, delete line, arbitrary decrement) still require an admin password per action; Save is still blocked unless the receiver is linked to an ActiveOne type-2 contact.

## 5. Functional Requirements

### Settings storage & admin UI
- **FR-1** Two new `app_settings` keys store the toggles globally (boolean-style values), following the existing key-value pattern (same as `company_name`).
- **FR-2** A new **Delivery** tab is added to `/admin`, containing two labeled switches with short helper text explaining each.
- **FR-3** Default values when a key is absent: **Continuous Scanning = ON**, **Blind Delivery = OFF** — i.e. the app behaves exactly as it does today.
- **FR-4** Changing a toggle persists immediately to `app_settings` and applies to the **next** receiving session; it does **not** alter any session already in progress.

### Session binding
- **FR-5** When a receiving session starts (a PO is opened), the app reads the current values of both settings and binds them to that session.
- **FR-6** The session's bound modes are snapshotted into the per-PO `localStorage` state, so a resumed in-progress session keeps the modes it began with even if the global settings changed in the meantime.

### Continuous Scanning
- **FR-7** When **ON** (default), each scan adds **+1** in the PO's purchase unit to the matching line — current behavior, unchanged, including rapid Eyoyo batch dumps processed without dropping any scan.
- **FR-8** When **OFF**, each scan opens a quantity modal. The entered number is **added** to the running line quantity for that SKU (e.g. line at 0 → scan → "12" → line at 12 → scan again → "6" → line at 18).
- **FR-9** The OFF-mode quantity modal opens with an **empty, auto-focused** number input and submits on Enter.
- **FR-10** The OFF-mode quantity modal accepts **positive whole numbers only**; it rejects empty, zero, negative, and decimal input.
- **FR-11** Cancelling/dismissing the OFF-mode modal is a **no-op** — nothing is added and the line is left untouched.
- **FR-12** While an OFF-mode quantity modal is open, **further scans are swallowed** (ignored) until the modal is resolved — one scan in flight at a time.
- **FR-13** Entering a quantity in OFF mode requires **no auth** — it is part of the scanning flow, not a gated manual edit. The admin-password gate still applies to the other manual edits (editing an existing line to an arbitrary value, deleting a line, arbitrary decrement).
- **FR-14** **Undo-last-scan** in OFF mode reverses the **entire last entry** (the full quantity just added), not −1. It remains no-auth. In ON mode, undo-last-scan is unchanged (−1).

### Blind Delivery
- **FR-15** When **OFF** (default), the receiving screen behaves as today: it **pre-lists all of the PO's ordered lines**, shows ordered quantities, and shows all five statuses (Exact, Over Served, Under Served, Not Ordered, New Item).
- **FR-16** When **ON**, the receiving screen **starts empty** — no ordered lines are pre-listed. Lines appear **only as they are scanned**.
- **FR-17** In Blind mode, an on-PO line (would-be Exact/Over/Under) appears as a **plain scanned line** showing SKU, description, and the running scanned count — **no status chip and no ordered quantity**.
- **FR-18** In Blind mode, **Not Ordered** (in masterlist, not on this PO) and **New Item** (not in masterlist) lines **still display their flag**, exactly as today.
- **FR-19** In Blind mode, the blindness **carries through the entire flow** — the Review screen and the post-save success summary also hide ordered quantities and Exact/Over/Under status, showing only scanned totals. The staffer never learns the variance at any point.
- **FR-20** In Blind mode, the receiving screen shows a clear **"Blind Delivery" banner/badge** indicating the mode is active.
- **FR-21** In Blind mode, the receiving screen shows a **running tally** of units/lines scanned, with **no reference** to ordered quantities.
- **FR-22** The underlying supersede-PO save is **unchanged** by Blind mode: ordered-but-unscanned lines are still written with `QUANTITY = 0`, the original PO is still closed, and the new PO carries the same audit fields. Only the staff-facing view is blind; the true variance is preserved in the data.

### Independence
- **FR-23** The two settings are fully independent — all four combinations are valid (e.g. Continuous OFF + Blind ON = a careful, manual, blind count).

## 6. Data Model

### `app_settings` (existing table — two new keys)
| Key | Meaning | Default when absent |
|---|---|---|
| `delivery_continuous_scanning` | Whether each scan auto-adds +1 (`on`) or prompts for a quantity (`off`) | `on` |
| `delivery_blind_delivery` | Whether ordered quantities and Exact/Over/Under status are hidden from receiving staff | `off` |

- Stored using the existing key-value convention; no schema change.
- No new columns for "changed by / changed at" (rejected).

### Per-PO `localStorage` (existing in-progress state — extended)
- The session's bound mode values (continuous scanning + blind delivery) are added to the persisted per-PO state so a resumed session keeps its original modes. Cleared on save, same as today.

### No change to: `delivery`, `delivery_new_items`, `item_master_cache`, or the superseded/new `purchase_order(_items)` rows. No blind/continuous flag is written to the saved delivery or PO.

## 7. API Contract

### Read settings (consumed at session start + admin tab load)
- The Delivery module and admin tab read both keys via the existing `app_settings` access path.
- Absent key → resolved to the default (continuous = on, blind = off).

### Update settings (admin Delivery tab)
- **Method/intent:** a state-changing request (POST/PUT) restricted to admins, updating one or both keys in `app_settings`.
- **Request shape (conceptual):** the key(s) being set and their new boolean value(s).
- **Response shape:** minimal confirmation of success (command — returns no business data beyond acknowledgement), consistent with Command-Query Separation.
- **Authorization:** admin-only, enforced by existing middleware on `/admin/*` and the route's admin guard.

### Delivery save endpoint
- **Unchanged.** Receives the same input and performs the same supersede-PO transaction regardless of either setting. No new fields.

## 8. UI/UX Flow

### Admin — Delivery tab
1. Admin opens `/admin` → selects the new **Delivery** tab.
2. Two switches with helper text: **Continuous Scanning** (on/off) and **Blind Delivery** (on/off), each reflecting the current stored value.
3. Toggling a switch persists immediately; a brief confirmation indicates the saved state.
4. The change takes effect for the **next** receiving session; sessions already in progress are unaffected.

### Floor — Continuous Scanning ON (default)
- Unchanged: scan → line +1 in purchase unit; rapid batch dumps all counted.

### Floor — Continuous Scanning OFF
1. Staff scans a SKU → an empty, focused quantity modal appears.
2. Staff types a positive whole number → Enter (or confirm) → that number is **added** to the line.
3. Cancel → nothing happens.
4. Any scans arriving while the modal is open are ignored.
5. Undo-last-scan removes the entire last entry.

### Floor — Blind Delivery OFF (default)
- Unchanged: PO grid → receiving screen pre-listing all ordered lines with quantities and full statuses → Review → save → success summary.

### Floor — Blind Delivery ON
1. PO grid → staff selects a PO → receiving screen opens **empty**, with a **"Blind Delivery" banner** and a running scanned tally.
2. Staff scans physical goods; each scanned line appears showing SKU, description, scanned count — **no status, no ordered qty** for on-PO items; **Not Ordered / New Item** flags still shown for those cases.
3. Review screen shows the scanned lines and totals only — **no ordered quantities, no variance**.
4. Save → success summary recaps scanned totals only — still blind.
5. The true variance is preserved in the saved data for later admin reconciliation in ActiveOne / a future history view.

## 9. Edge Cases & Error Handling
- **Invalid OFF-mode quantity** (empty, 0, negative, decimal) → modal rejects, no line change until a valid positive whole number is entered or the modal is cancelled.
- **OFF-mode cancel** → no line change; the just-scanned SKU records nothing.
- **Batch scan during open OFF-mode modal** → extra scans swallowed; only resolved one at a time. (OFF mode is deliberately manual; batch dumping is not supported there.)
- **Undo-last-scan in OFF mode** → reverses the full last entry, not −1.
- **Admin flips a setting mid-session** → no effect on the open session; applies on next session start.
- **Resumed in-progress session after a settings change** → keeps the modes snapshotted in its per-PO `localStorage` state.
- **Blind mode, scanning a Not-Ordered or New Item** → flag still shown (these don't reveal ordered quantities); behavior otherwise as today.
- **Blind mode + a permitted manual edit** (admin-password gated) → allowed, but no ordered qty / status is revealed in the edit UI.
- **Setting key missing/corrupt in `app_settings`** → resolve to default (continuous = on, blind = off); never block receiving.
- **Save authorization unchanged** → still blocked if receiver isn't linked to an ActiveOne type-2 contact, in both modes.

## 10. Open Questions
- None blocking. (Reconciliation of blind-delivery variance currently relies on existing data — superseded original PO vs. new PO — and any future Delivery History module; no dedicated screen is in scope here.)

## 11. Out of Scope / Deferred
- Per-location / per-user / per-role scoping of either setting.
- Mid-session live application of a changed setting.
- Audit trail of who changed the settings and when.
- Tagging saved deliveries/POs as blind vs. non-blind.
- A dedicated admin variance/reconciliation view for blind deliveries.
- Pre-filling the OFF-mode quantity modal (decided: empty field).
- Any change to the supersede-PO save, status classification, or unit-conversion logic.
