# ActiveOne Schema Insights

Generated from `activeone_no_data.sql` — a **structure-only** MySQL dump (180 tables, no rows).

> ⚠️ Because the dump has no data, every `*_type_map` / `*_status_map` lookup table
> is **empty here**. The actual meaning of integer codes (e.g. PO `STATUS = 0` = open,
> `contact.TYPE = 3` = supplier) **cannot be confirmed from this file** and must be
> verified against the live database. Items flagged "VERIFY" below depend on this.

---

## 1. The big picture

- **~180 tables**, full ActiveOne ERP (accounting, POS, inventory, payroll-ish HR fields).
- Engine **InnoDB**, mostly `latin1`, but newer tables (`inventory_count*`, `items`, `item_rate_method`) are `utf8mb4`. **Connection charset matters** — set the pool's charset explicitly or you'll get mojibake on mixed tables.
- Primary keys on document tables are `int unsigned NOT NULL` **without `AUTO_INCREMENT`**. IDs and document codes are issued by the app via `object_code_sequence` / `object_type_map`. This is the single most important fact for **writing data back** (see §6).
- Document tables follow a consistent shape: `ID, RECORDED_ON, CODE, DATE, LOCATION_ID, …, AMOUNT, STATUS, STATUS_DATE, CUSTOM_FIELD1..5`, with a `_items`/`_lines` child table FK'd back with `ON DELETE CASCADE`.
- Almost every document is indexed on `(DATE, LOCATION_ID)` (`IX_*_LOCATION_RANGE`) — date-range + location queries are cheap, which is exactly what `sales-rate` needs.

---

## 2. Tables that matter per planned module

| Module | Read from | Write to |
|---|---|---|
| `sales-rate` | `item`, `item_inventory`, `purchase_order(_items)`, `invoice(_items)`, `sales_receipt(_items)`, `contact` (vendor + lead-time custom field), `location`, `unit_of_measure`, `item_units` | `purchase_order(_items)` + `object_code_sequence` |
| `delivery` | `item_receive(_lines)`, `purchase_order(_items)` | `item_receive(_lines)` |
| `counting` | `inventory_count(_items)`, `item_inventory` | `inventory_count(_items)` |
| `invoice` | `invoice(_items)`, `contact`, `item` | `invoice(_items)` |
| `transfer` | `stock_transfer(_items)`, `stock_transfer_receive(_items)` | same |
| `location` (shared) | `location` | our own `module_location_visibility` |
| `supplier` (shared) | `contact` (vendors) | — |

---

## 3. `item` vs `items` — don't confuse them

- **`item`** (singular) is the real master table: PK `ID`, unique `CODE`, `DESCRIPTION`, `PREFERRED_VENDOR_ID → contact`, `BASE_UNIT_ID`, `PURCHASES_UNIT_ID`, `SALES_UNIT_ID`, `COST`, `RATE`, `INACTIVE`, etc. **Use this.**
- **`items`** (plural) is a **denormalized flat report/export** — no PK, no FKs, all `varchar` names instead of IDs (`PREFERRED_VENDOR`, `STOCK_TYPE`, `LOCATION` as text), plus `ORDER_POINT/ORDER_QTY/ORDER_LEADTIME`. Looks like a reporting view materialized to a table. **Do not join against it.** Treat it as legacy/export.
- **`old_item4`** is a leftover migration table — ignore.

---

## 4. `sales-rate` deep dive — how the formula maps to real columns

### On-hand is a *ledger*, not a column
There is **no `on_hand` field**. `item_inventory` is an append-only running-balance ledger keyed by `(ITEM_ID, LOCATION_ID, BATCH_ID, SEQUENCE_NO)` with `ENDING_QUANTITY` per row. On-hand for an item at a location = sum over batches of the **latest** row (max `SEQUENCE_NO`, or follow the `PREVIOUS_ID` chain) per batch. Index `IX_ITEM_INVENTORY_TRANS_REF (ITEM_ID, LOCATION_ID, BATCH_ID, SEQUENCE_NO, SOURCE_REF_DATE)` supports this. **Budget real effort for the "current on-hand" query — it's the trickiest part of the module.**

> This ledger cost is exactly **why the module forces a supplier-selection step first** (per PRD §sales-rate scoping): narrowing to the chosen suppliers' items before touching `item_inventory` keeps the on-hand computation from scanning the whole ledger.

### Incoming (open PO qty)
Undelivered qty for lines that aren't `CLOSED` on a parent PO with `STATUS = 2` (Open — verified). **`RECEIVED_QTY` is in base units** and `UNIT_BASE_QUANTITY` is the per-unit factor, so undelivered base = `QUANTITY × UNIT_BASE_QUANTITY − RECEIVED_QTY` (not `QUANTITY − RECEIVED_QTY`). Index `IX_PURCHASE_ORDER_STATUS_VENDOR (VENDOR_ID, STATUS)` is purpose-built for this.

### Daily sales rate (off-take)
Two **separate, non-overlapping** sales sources — they are designed not to merge, so summing both is safe (no de-dup needed):
- `invoice` + `invoice_items` → **wholesale** sales.
- `sales_receipt` + `sales_receipt_items` → **retail** (POS) sales. Still exclude voids/returns via `RETURN_TRX`, `VOID_REFERENCE_NO`, `STATUS`.
- Both line tables carry `QUANTITY`, `UNIT_ID`, and **`UNIT_BASE_QUANTITY`** (the per-unit factor, verified). Base units sold = **`QUANTITY × UNIT_BASE_QUANTITY`** — summing `UNIT_BASE_QUANTITY` alone undercounts by the unit size.

### Lead time is per supplier, in a `contact` custom field
`supplier_lead_time_days` lives on the supplier (vendor) record in **`contact`**, in one of `CUSTOM_FIELD1..5` (exact column TBD — confirm against live data). So lead time joins cleanly: `item.PREFERRED_VENDOR_ID → contact.ID → contact.CUSTOM_FIELD4` (verified). The PRD's per-supplier model is correct; `item_preference.ORDER_LEADTIME` is ActiveOne's own per-item field and is **not** what this app uses.

### Item → supplier grouping
`item.PREFERRED_VENDOR_ID → contact.ID`. This is how `sales-rate` groups items under a supplier. Note an item has exactly one preferred vendor; if real sourcing is multi-vendor, that's another gap to confirm.

---

## 5. Scanning / barcodes

A scanned barcode is **`item.CODE`** (varchar(20), unique, indexed) → resolves directly to `item.ID`. One barcode per item.
- `item_units` also has a per-unit `BARCODE` column, but this app does **not** use it — resolve scans against `item.CODE` only.
- `unit_of_measure (NAME, SYMBOL)` is the unit dictionary; `item_units` still provides unit conversion factors (`QUANTITY`) for quantity math even though it isn't the barcode source.
- `item.BASE_UNIT_ID / PURCHASES_UNIT_ID / SALES_UNIT_ID` define default units per context; `item_location_units` overrides them per location.

---

## 6. Writing data back (POs, counts, receipts) — read before you INSERT

ActiveOne has **no API**; you write rows directly. Two hard requirements:

1. **ID & CODE generation.** Document PKs are not auto-increment. `object_type_map` (per object type: `TABLE_NAME`, `NEXT_ID`, `IS_DOCUMENT`, `DOCUMENT_TYPE`) and `object_code_sequence` (per `OBJECT_TYPE` + `LOCATION_ID`: `PREFIX`, `POSTFIX`, `WIDTH`, `NEXT_SEQUENCE`, `INCREMENT`) are how ActiveOne mints the next ID and the human-readable `CODE` (e.g. `PO-00042`). To create a PO you must atomically read+bump these counters the same way ActiveOne does. **Get the exact algorithm from live data / ActiveOne behavior before writing — guessing risks duplicate keys or codes that collide with the ERP's own.**
2. **Atomicity.** `sales-rate`'s "one PO per supplier, all-or-nothing" maps to a single transaction inserting `purchase_order` + N `purchase_order_items`, bumping sequences inside the same transaction. Children cascade-delete, so rollback is clean.

Inventory side effects: posting documents in ActiveOne normally writes `item_inventory` ledger rows too. A raw PO insert does **not** move stock (correct — POs are just orders), but if you ever write receipts/counts/transfers, confirm whether ActiveOne expects *you* to also append `item_inventory` rows or whether a trigger/posting step does it. **VERIFY against live behavior.**

---

## 7. Contacts are one table for everyone

`contact.TYPE` distinguishes customer / vendor / employee / sales-rep — all share the `contact` table (decoded via empty `contact_type_map`). Referenced as `VENDOR_ID` (PO, item_receive), `CUSTOMER_ID` (invoice, sales_receipt), `SALES_REP_ID`, `COUNTED_BY_ID`, etc.
- `supplier` module: filter `contact` to vendors = **`TYPE = 0`** (verified; `TYPE = 3` is Tax Agency).
- `contact.INACTIVE` exists — filter it out in selection lists.

---

## 8. Misc gotchas

- `inventory_count.COUNTED_BY_ID → contact` but `RECORDED_BY_ID → user` (two different identity tables — `user` for app logins, `contact` for people/orgs).
- `location` is simple (`ID, NAME, INACTIVE, GROUP_ID, TAG`) — maps cleanly to the `location` module. `TAG`/`GROUP_ID` may help filter which locations a module shows.
- Lots of `CUSTOM_FIELD1..5 varchar(512)` on every document — ActiveOne's user-defined fields, all indexed. Available if you need to stash a back-reference (e.g. mark a PO this app created), but coordinate with ERP usage first.
- `item_inventory_staging` and `account_journal_staging` are transient posting scratch tables — don't read them as truth.

---

## Verified against full-year data (2026-06-26)

Loaded a full-year ActiveOne dump as MySQL db `greatwall_activeone` and checked the structure-only guesses against real rows. **Several were wrong** — fixed in `app/shared/infrastructure/activeoneConstants.ts` and the replenishment/delivery repositories.

| Open question | Verdict | Correct value (evidence) |
|---|---|---|
| 1. PO `STATUS` for "open" | ❌ guess `0` was wrong | **`2` = Open** (`document_status_map`: 0=Draft,1=Pending,2=Open,3=Closed,6=Canceled,7=Void,12=Received in full). Real POs use only 2/3/12. Closed = **3**. |
| 2. `contact.TYPE` for vendor | ❌ guess `3` was wrong | **`0` = Vendor** (`contact_type_map`: 0=Vendor,1=Customer,2=Employee,3=Tax Agency,4=Other). All 33,914 POs reference type-0. Employee = 2 (correct). |
| 3. Lead-time custom field | ❌ guess `CUSTOM_FIELD3` was wrong | **`CUSTOM_FIELD4`** (zero vendors have numeric CF3; CF4 = days, e.g. "7"; CF1 = unrelated large numbers). |
| 4. `object_type_map`/`object_code_sequence` bump | ⚠️ mechanism known, PO counter unusable from dump | **Mechanism:** ID = `object_type_map.NEXT_ID`, then bump by `INCREMENT` (10). Confirmed live where `NEXT_ID = max(ID)+10` — `account_journal`, `item_inventory` (exact), `sales_receipt` (~). **But the `purchase_order` and `invoice` counters are STALE in this dump** (`PURCHASE_ORDER` NEXT_ID=31,771 vs max 709,522): reading them would mint an existing ID → duplicate-key. CODE is a **per-location** sequence (each `LOCATION_ID` has its own range; `object_code_sequence` row per OBJECT_TYPE+LOCATION_ID, e.g. `39-` prefix). PO IDs mostly step by 10 ending in `2`. **Conclusion (resolved — see PRD-po-id-code-minting.md):** ActiveOne self-derives `ID = MAX(ID)+10` at insert time (PO offset `…2`) and never reads its stale counters; the app mirrors that rule inside the writing transaction with duplicate-key retry, and keeps the collision-safe `OHPO-` CODE namespace (which ActiveOne ignores because it casts to 0). The `object_type_map` / `object_code_sequence` counters are **never** read. A single live observation (PRD OQ-2) would further confirm the offset rule but is not required to implement. |
| 5. Inventory ledger on write | ✅ resolved for POs | POs are orders → **no `account_journal`/`item_inventory` fan-out** (verified). Ledger/journal posting happens at Enter Bill, which stays manual. `item_receive` is empty (0 rows). |

**Unit convention (verified, all line tables — POs, invoices, sales_receipts):** `UNIT_BASE_QUANTITY` is the **per-unit factor** (base units per 1 transaction unit); base total = `QUANTITY × UNIT_BASE_QUANTITY`; `RECEIVED_QTY` is in **base units**. The app previously stored/read it as total-base — fixed in both writers and all four incoming/sold CTEs.

⚠️ **The dev seed (`scripts/seed-replenishment-dev.sql`) encodes the OLD convention** and must be regenerated (or dev pointed at `greatwall_activeone`) or its replenishment numbers will be wrong.

**Cost/RATE (verified, fixed):** `item.COST` is **per BASE unit**; line `RATE` is **per PURCHASE unit** = `COST × factor` (ratio exactly 1.000 across all lines), and `AMOUNT = QUANTITY × RATE`. The writers previously used `RATE = COST` / `AMOUNT = qty × COST` — undercounted by the factor; now fixed (replenishment + delivery not-ordered lines). Dev seed COST switched to per-base-unit to match.

**PO column population (verified, fixed):** native POs set `STATUS_DATE = DATE`, `DATE_EXPECTED = DATE + lead_time` (modal +7), and `PAYMENT_TERMS_ID` copied from the vendor (`contact.PAYMENT_TERMS_ID`). Both writers now populate these. **Deferred (needs tax design, like ID/CODE):** `TAXABLE_AMOUNT`/`NONTAXABLE_AMOUNT` split (line-`TAXABLE`-driven, ~87% taxable) — left NULL for now.

**Sales voids (verified, fixed):** exclude `STATUS IN (0,6,7)` = Draft/Canceled/Void on **both** `invoice` (uses 11=Paid, 2=Open, 7=Void) and `sales_receipt` (3=Closed normal), plus `RETURN_TRX`/`VOID_REFERENCE_NO`. Both sold CTEs now filter status (previously voids were counted as sales).

**Other verified:** header `AMOUNT = Σ line AMOUNT` (VAT-inclusive). Stored datetimes are **Asia/Manila local** (not UTC). Lead-time `CUSTOM_FIELD4` corroborated by `DATE_EXPECTED − DATE` modal = 7 (= modal CF4), though couldn't be cross-checked against `item_preference.ORDER_LEADTIME` (no overlap).

## Resolved (confirmed with product owner)

- ✅ On-hand is a ledger; the supplier-selection step exists to cap ledger query cost.
- ✅ Use `item` (singular) as the item master.
- ✅ Barcode = `item.CODE` (not `item_units.BARCODE`).
- ✅ Lead time is per-supplier, stored in a `contact` custom field (PRD model is correct; column = `CUSTOM_FIELD4`, see above).
- ✅ `invoice` (wholesale) and `sales_receipt` (retail) are separate by design and never merge — sum both, no de-dup.
