# PRD: PO ID & CODE Minting (ActiveOne-faithful)
Date: 2026-06-26

## 1. Overview
The app writes purchase orders directly into ActiveOne's MySQL (`purchase_order` + `purchase_order_items`) from two places: the **replenishment** PO generator and the **delivery** supersede-save. ActiveOne has no API, no `AUTO_INCREMENT` on these tables, and is **not** the sole writer — native ActiveOne PO entry also happens, concurrently.

This PRD specifies how the app mints the primary key `ID` and the human-readable `CODE` so that app-created POs (a) never collide with ActiveOne's own numbering, and (b) never corrupt ActiveOne's ongoing sequence — derived from the **observed runtime behavior** of ActiveOne, not from its persisted sequence-config tables.

It supersedes the interim approach (`MAX(ID)+1` + `OHPO-` prefix, no retry) noted as the deferred open question in `docs/activeone-schema-insights.md` and `app/shared/infrastructure/activeoneConstants.ts`.

## 2. Background — verified against the full-year ActiveOne dump (`greatwall_activeone`)
ActiveOne mints document IDs/codes by **deriving from the existing rows at insert time** (a `MAX`-based rule), **not** by reading its persisted counters. Confirmed:

- **Persisted counters are stale/vestigial for documents.** `object_type_map.NEXT_ID` and `object_code_sequence.NEXT_SEQUENCE` are accurate only for high-volume ledger tables (`account_journal`, `item_inventory`: `NEXT_ID = max(ID)+10`). For `purchase_order` they are far behind reality (`NEXT_ID` 31,771 vs `max(ID)` 709,522; global PO `NEXT_SEQUENCE` 5,861 vs live codes ~159,380). A migration / FS DOC utility broke the counter-sync; the runtime kept self-deriving and never read them again. **Per product owner: ActiveOne still increments correctly on its own and this will not be fixed.**
- **`ID` (both tables): block-of-10 allocation, PO offset `…2`.** Recent IDs all end in `2` and step by 10 (1,400 of the last 2,000 header gaps are exactly 10; the rest are multiples of 10 where other documents consumed blocks). `purchase_order_items.ID` is the same: 100% end in `2`, 98% of gaps are 10. The two tables have **independent** ID spaces (header max ~709K, line max ~4.06M).
- **`CODE`: one global `+1` numeric counter, shared across locations.** Codes interleave across `LOCATION_ID` 39/4 in strict-ish `MAX(numeric)+1` order. It is an **editable free-text varchar** — 99.4% pure numeric, but 0.6% is human junk (`CANCELLED`, `ADMIN 2026-05-03`, `105762J`, `143.263`). The per-location `object_code_sequence` prefix rows (e.g. `3-`, `39-`) exist but are used by <1% of POs.

### 2.1 The CODE/ID asymmetry (key rationale)
Because ActiveOne derives the next value from `MAX` **and writes concurrently**, the app shares one live sequence with the ERP. This forces different strategies per column:

- **`CODE` may use a disjoint namespace (`OHPO-…`).** ActiveOne derives the next code from `MAX` over **numeric** codes; `OHPO-009005` casts to `0`, so ActiveOne ignores app codes entirely. App codes never perturb ActiveOne's numbering.
- **`ID` must stay contiguous (`MAX(ID)+10`).** A reserved high range is **forbidden**: if the app inserted a PO at ID 2,000,000,000, ActiveOne's next `MAX+10` would jump its entire sequence to ~2B. The app must mint inside the shared sequence, which makes rare concurrent collisions possible — handled by retry (FR-5).

## 3. Goals
- Mint `purchase_order.ID` and `purchase_order_items.ID` to match ActiveOne's observed runtime rule (`MAX + 10`, `…2` offset), co-advancing the shared sequence without corrupting it.
- Keep app `CODE` collision-proof and traceable via the `OHPO-` prefix.
- Survive concurrent native PO creation: a duplicate-key race fails cleanly and retries, never corrupts.
- Read/write neither `object_type_map` nor `object_code_sequence`.

## 4. Non-Goals
- Native-looking (bare numeric) CODEs for app POs — explicitly rejected (the CODE space is polluted free-text; `OHPO-` is retained).
- Repairing ActiveOne's stale sequence counters.
- A shared application-level lock or distributed counter (impossible — ActiveOne ignores the only shared counter).
- Changing any other PO field (status, units, RATE, column population) — already done in prior work.

## 5. Functional Requirements

FR-1. **Header ID.** A new `purchase_order.ID` is `MAX(purchase_order.ID) + 10`, read inside the writing transaction. When generating N POs in one batch, IDs are `MAX+10, MAX+20, … MAX+(10N)`.

FR-2. **Line ID.** A new `purchase_order_items.ID` is `MAX(purchase_order_items.ID) + 10`, read inside the same transaction; each subsequent line across the whole batch increments by a further 10.

FR-3. **CODE.** Unchanged: `OHPO-{ID}` via the existing `PO_CODE_PREFIX` / `PO_CODE_WIDTH` (`poCode(id)`). The `UNIQUE(CODE)` constraint plus PK uniqueness are the integrity backstop.

FR-4. **Both `MAX` reads happen at the start of each transaction attempt** (not cached across retries), so a retry observes any ID inserted by ActiveOne in the meantime.

FR-5. **Retry on duplicate-key.** If the transaction fails with a duplicate-key error (`ER_DUP_ENTRY`, errno 1062 — PK or `UNIQUE(CODE)`), the entire transaction is rolled back and retried from FR-4 up to **3** times. On exhaustion, throw a clear, surfaced error (the user retries). Non-duplicate errors propagate immediately.

FR-6. **No config-table access.** The writers must not read or write `object_type_map` or `object_code_sequence`. (`activeoneConstants.ts` comments updated to state IDs are minted by `MAX+10`, codes by `OHPO-` prefix, both verified runtime-faithful.)

FR-7. **Applies to both writers** identically: `MySQLPurchaseOrderRepository.createAll` (replenishment, multi-supplier) and `MySQLDeliveryRepository.commit` (delivery, single superseding PO).

FR-8. **No behavior change** to any already-correct field: STATUS=2, STATUS_DATE, DATE_EXPECTED, PAYMENT_TERMS_ID, UNIT_BASE_QUANTITY (=factor), RATE (=COST×factor), AMOUNT (=QTY×RATE), CUSTOM_FIELD1/2 (delivery audit refs).

## 6. Algorithm (reference)

```
MAX_RETRIES = 3
for attempt in 1..MAX_RETRIES:
  begin transaction
  try:
    poBase   = SELECT MAX(ID) FROM purchase_order        // NULL -> 0
    lineBase = SELECT MAX(ID) FROM purchase_order_items   // NULL -> 0
    nextPoId   = poBase   + 10
    nextLineId = lineBase + 10
    for each supplier-PO in batch:
      poId = nextPoId; nextPoId += 10
      insert purchase_order(ID=poId, CODE=poCode(poId), STATUS=2, ...)
      for each line:
        insert purchase_order_items(ID=nextLineId, PO_ID=poId, ...)
        nextLineId += 10
    commit
    return results
  catch err:
    rollback
    if err is ER_DUP_ENTRY and attempt < MAX_RETRIES: continue
    else: throw
```

Delivery's `commit` is the single-PO case of the same loop, preserving its existing `SELECT … FOR UPDATE` re-validation of the original PO inside each attempt.

## 7. Data touched
- **Read:** `MAX(ID)` of `purchase_order` and `purchase_order_items` (per attempt).
- **Write:** `purchase_order`, `purchase_order_items` (and the app-side `delivery` / `delivery_new_items` for the delivery path — unchanged).
- **Never:** `object_type_map`, `object_code_sequence`.

## 8. Edge Cases & Error Handling
- **Concurrent native PO grabs the slot** (app and ActiveOne both compute the same `MAX+10` in the µs window): one insert wins on the PK; the loser hits `ER_DUP_ENTRY`, rolls back, re-reads `MAX` (now higher), re-mints, succeeds. This is the expected, designed-for case.
- **Retry exhaustion** (sustained contention): throw a user-facing "Could not assign a PO number, please retry" error after 3 attempts. No partial writes (single transaction).
- **Empty table** (dev only — `MAX` is `NULL`): base 0 → first ID = 10 (ends in `0`, not `2`). Acceptable; the `…2` invariant resumes once any `…2` row exists. Not a production concern.
- **Multi-supplier batch atomicity:** all POs in one `createAll` share one transaction; any failure (including dup-key) rolls back the whole batch, preserving the existing all-or-nothing guarantee.
- **`MAX(ID)+10` filling a gap ActiveOne skipped** (a `…2` slot left unused when a non-PO doc took the intervening block): harmless — the ID is still unique and PO-offset-correct; ActiveOne doesn't depend on contiguity.

## 9. Open Questions
- OQ-1: `MAX_RETRIES = 3` and the absence of backoff are assumptions for low expected contention (app POs come from periodic replenishment runs, not a hot loop). Revisit if production shows dup-key retries occurring at all.
- OQ-2 (optional, deferred): one **live** ActiveOne observation (create a PO natively; diff the row + counters) would confirm the `MAX+10`/offset-2 rule beyond the snapshot's strong evidence. Not required to implement, but the cheapest way to fully close the gap.

## 10. Out of Scope / Deferred
- `TAXABLE_AMOUNT` / `NONTAXABLE_AMOUNT` tax split on app POs (needs item-taxability + VAT design; left NULL for now).
- Repairing or back-filling ActiveOne's `object_type_map` / `object_code_sequence` counters.
- Any change to the `OHPO-` code format or width.
