# Sales-Rate — Production Cutover TODO

Deferred work needed before pointing `sales-rate` at the **real ActiveOne DB**.
None of this blocks development against the seeded dev DB. Deferred because we
**cannot validate these against live ActiveOne data yet** — each needs a real
ActiveOne instance to confirm.

Status as of this writing: sales-rate is fully live against the seeded dev DB
(read path + PO write-back), plus location, supplier, auth, and app settings.

---

## 1. Verify the 5 guessed ActiveOne constants
All live in one file: `app/(authenticated)/sales-rate/infrastructure/activeoneConstants.ts`.

- [ ] `PO_OPEN_STATUS` (= 0) — confirm `purchase_order.STATUS` value that means "open".
- [ ] `VENDOR_CONTACT_TYPE` (= 3) — confirm `contact.TYPE` value for supplier/vendor.
- [ ] `LEAD_TIME_FIELD` (= `CUSTOM_FIELD3`) — confirm which `contact.CUSTOM_FIELDn` holds supplier lead-time days.
- [ ] Invoice void status — confirm `invoice.STATUS` value(s) to exclude, then uncomment that filter in `MySQLSalesRateRepository` (Query C, wholesale branch).
- [ ] Sales-receipt void status — confirm `sales_receipt.STATUS` value(s) to exclude, then uncomment that filter (Query C, retail branch).

## 2. Real PO ID / code minting (concurrency-safe)
Currently `MAX(ID)+1` + app-side `OHPO-` codes in `MySQLPurchaseOrderRepository`.
NOT safe against ActiveOne's own writer grabbing the same ID concurrently
(collision fails loudly + rolls back, but that's a mitigation, not a fix).

- [ ] Confirm how ActiveOne mints PO `ID` + `CODE` via `object_code_sequence` / `object_type_map` (object type value, bump algorithm, code format).
- [ ] Replace the `MAX(ID)+1` / `poCode()` logic with the read+bump inside the transaction.
- [ ] Decide PO code prefix: keep app-distinct (`OHPO-`) for traceability, or match ActiveOne's native numbering.

(See docs/activeone-schema-insights.md, open question #4.)

## 3. Minor hardening
- [ ] Guard PO write so a PO can only be created against a `contact.TYPE = 3` (vendor) — reject non-vendor supplier ids.
- [ ] Remove the `dev` / `dev` auth backdoor in `app/shared/infrastructure/auth.ts` (gated to `NODE_ENV=development`, but remove before shipping).
- [ ] Decide whether writing receipts/counts must append `item_inventory` ledger rows or whether an ActiveOne posting step/trigger handles it (insights doc, open question #5).

## 4. Inventory ledger sanity (validate, don't assume)
- [ ] Confirm the "latest row per (item, batch)" on-hand collapse matches ActiveOne's own on-hand figure on real data (the `SEQUENCE_NO` / `PREVIOUS_ID` chain behaves as assumed).
