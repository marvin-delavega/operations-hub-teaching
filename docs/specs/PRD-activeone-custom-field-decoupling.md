# PRD: Decouple App Metadata from ActiveOne `purchase_order` Custom Fields
Date: 2026-07-02

## 1. Overview
The app currently writes its own metadata into ActiveOne's `purchase_order.CUSTOM_FIELD1/2/3` columns:

- **Delivery** supersede PO → `CUSTOM_FIELD1` = original PO code, `CUSTOM_FIELD2` = receiver employee code.
- **Replenishment** PO → `CUSTOM_FIELD3` = manufacturer name.

But ActiveOne **owns and heavily populates these columns for its own PO entry**. Verified against the full-year `greatwall_activeone` dump (33,921 POs):

| Field | Populated by ActiveOne | App writes | Real sample values |
|---|---|---|---|
| `CUSTOM_FIELD1` | **99.6%** (33,784) | original PO code | `5/20/2024` (dates) |
| `CUSTOM_FIELD2` | **99.3%** (33,668) | receiver code | `1742`, `3`, `1` (ids) |
| `CUSTOM_FIELD3` | **47%** (15,984) | manufacturer name | `132`, `928` (ids) |

This mirrors the `contact` table, where the app already learned the hard way that `CUSTOM_FIELD1` holds "unrelated large numbers" and lead-time actually lives in `CUSTOM_FIELD4` ([activeoneConstants.ts:58-64](../../app/shared/infrastructure/activeoneConstants.ts#L58-L64)).

Two problems follow:
1. **Data collision** — app writes clobber / entangle with ActiveOne's own PO data, and vice versa.
2. **A latent production-breaking bug** — the Delivery PO-selection grid excludes app-created POs with `WHERE po.CUSTOM_FIELD1 IS NULL OR CUSTOM_FIELD1 = ''` ([MySQLDeliveryRepository.ts:106](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts#L106)). Against real ActiveOne data, **99.6% of legitimate open POs carry a `CUSTOM_FIELD1` value**, so the receiving screen would hide almost every real PO. It only appears to work because the dev seed leaves the column empty.

The fix is small and mostly subtractive: **stop writing to ActiveOne custom fields entirely, and source the two pieces of load-bearing logic from app-owned tables that already store this exact data.** No ActiveOne schema is read for app metadata anymore; nothing new is invented where an app table already holds the fact.

## 2. Goals
- Stop the app from writing to any ActiveOne `purchase_order` custom field.
- Fix the Delivery PO-grid / receiving-guard so it correctly distinguishes app-created supersede POs from real ActiveOne POs, independent of ActiveOne's own custom-field data.
- Source delivery supersede metadata (original PO ref, receiver code) from the app-owned `delivery` table, which already stores it.
- Source replenishment PO manufacturer labels from the app-owned `replenishment_run_po` table, which already stores it — keeping the manufacturer name durably queryable for the planned PO-list module without touching ActiveOne.
- Preserve every current user-visible behavior (exclusion of supersede POs, audit completeness, history snapshots).

## 3. Non-Goals
- **Does not** add any new app table — both facts already live in existing app tables (`delivery`, `replenishment_run_po`).
- **Does not** change the lead-time read from `contact.CUSTOM_FIELD4` — that is ActiveOne's own data, read-only, and stays.
- **Does not** change PO ID/CODE minting, the supersede transaction shape, incoming/on-hand math, or history snapshot contents.
- **Does not** migrate or clean historical ActiveOne rows — the app has never written to production ActiveOne, so there is no prior app-written custom-field data to unwind. (If any shared/staging env has app-created POs, see §8.)
- **Does not** build the future PO-list/edit module; it only makes sure the manufacturer label remains available to it.

## 4. Users & Roles
- **Delivery users (admin + staff):** the PO-selection grid now correctly shows all real open POs across locations and correctly hides app-created supersede POs. No new interaction.
- **Replenishment users:** no visible change. Generated POs no longer carry a manufacturer value in `CUSTOM_FIELD3`; the label continues to live in history and drive PO splitting/summary.
- **ActiveOne (as system of record):** its `purchase_order` custom fields are left untouched by the app — no collisions.

## 5. Functional Requirements

**Stop writing ActiveOne custom fields**
- **FR-1:** The Delivery supersede-PO INSERT ([MySQLDeliveryRepository.ts:329-336](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts#L329-L336)) **must not** write `CUSTOM_FIELD1` or `CUSTOM_FIELD2`. Remove both columns and their bound values from the statement; all other columns (ID, CODE, DATE, VENDOR_ID, LOCATION_ID, PAYMENT_TERMS_ID, AMOUNT, STATUS, STATUS_DATE) are unchanged.
- **FR-2:** The Replenishment PO INSERT ([MySQLPurchaseOrderRepository.ts:162-169](../../app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts#L162-L169)) **must not** write `CUSTOM_FIELD3`. Remove the column and its bound `manufacturerName` value; everything else is unchanged.
- **FR-3:** After this change, a repo-wide sweep must confirm the app writes **zero** ActiveOne custom fields on any table. (Current sweep: `purchase_order` is the only write target; `contact.CUSTOM_FIELD4` lead-time is read-only and out of scope.)

**Delivery: identify app-created supersede POs from `delivery`, not `CUSTOM_FIELD1`**
- **FR-4:** A PO is an app-created delivery supersede PO **iff** its `purchase_order.ID` appears as `delivery.new_po_id`. This row is written inside the same atomic transaction as the supersede PO ([persistDeliveryRecord](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts#L362)), so the mapping is always consistent with committed POs.
- **FR-5:** The open-PO grid query (`getOpenPurchaseOrders`) replaces `AND (po.CUSTOM_FIELD1 IS NULL OR po.CUSTOM_FIELD1 = '')` with an exclusion of POs present in `delivery.new_po_id`, e.g. `AND NOT EXISTS (SELECT 1 FROM delivery d WHERE d.new_po_id = po.ID)`.
- **FR-6:** The receiving-eligibility guard (`getPurchaseOrderForReceiving`, currently `if (header.CUSTOM_FIELD1) return null` at [line 135](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts#L135)) rejects a PO **iff** it is present in `delivery.new_po_id`. Drop `CUSTOM_FIELD1` from that SELECT.
- **FR-7:** The supersede optimistic-concurrency guard (currently reads `original.CUSTOM_FIELD1` at [line 182/190](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts#L182)) rejects superseding a PO that is itself an app-created supersede PO by the same `delivery.new_po_id` membership test (in addition to the existing `STATUS = open` check). Drop `CUSTOM_FIELD1` from that SELECT.
- **FR-8:** Real ActiveOne POs that happen to have a non-empty `CUSTOM_FIELD1` (i.e. essentially all of them) **must appear** in the grid and be receivable — this is the bug fix.

**Replenishment: manufacturer label sourced from `replenishment_run_po`**
- **FR-9:** The manufacturer name for a minted replenishment PO continues to be persisted in `replenishment_run_po` (`po_code`, `manufacturer_id`, `manufacturer_name`), written in the same transaction ([MySQLPurchaseOrderRepository.ts:259-264](../../app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts#L259-L264)). This is the app-owned home for the label; no new table is added.
- **FR-10:** History (run detail, printable report) and PO split/summary continue to read the manufacturer from run snapshots exactly as today — they never read `purchase_order.CUSTOM_FIELD3`. Confirm no reader of `CUSTOM_FIELD3` exists before removing the write.
- **FR-11 (join key):** `replenishment_run_po` also stores the minted ActiveOne `po_id` so a future PO-list module can join a live PO row to its manufacturer by primary key, not just by `po_code`. The minted `poId` is already in scope at insert time and is threaded into the run-PO snapshot. (See Open Decision O1 — this is the one genuinely additive change.)

## 6. Data / Schema Changes
Applied via the existing idempotent ALTER pattern in [`scripts/create-app-tables.sql`](../../scripts/create-app-tables.sql):

- **Index on `delivery.new_po_id`** — the exclusion/guard tests (FR-5..7) match on `new_po_id`; add `ix_delivery_new_po_id` so the `NOT EXISTS` stays cheap on the all-locations grid query. (An `ix_delivery_new_po_code` already exists but the join key is the int ID.)
- **`replenishment_run_po.po_id` (int, nullable)** — added for FR-11 as the ActiveOne join key. Nullable so existing rows remain valid; new rows populate it. *(Only if O1 is accepted.)*

No ActiveOne schema is altered. No data migration.

## 7. Risks & Mitigations
- **R1 — Grid perf regression from `NOT EXISTS`.** `delivery` is small (one row per received session) and indexed on `new_po_id` (§6); the anti-join is negligible versus the existing PO/contact/items joins.
- **R2 — Stale exclusion during the transaction window.** None: the `delivery` row and the supersede PO are inserted in the same transaction, so no committed supersede PO can be missing its `delivery` mapping.
- **R3 — A hidden reader of `CUSTOM_FIELD3`/`CUSTOM_FIELD1` elsewhere.** Mitigated by FR-3/FR-10 pre-removal sweeps. Current grep shows the only readers are Delivery's own `CUSTOM_FIELD1` gate (being rewired) and the lead-time `CUSTOM_FIELD4` read (out of scope).
- **R4 — Loss of an in-ActiveOne audit trail on the PO itself.** Accepted: the audit facts (original ref, receiver, manufacturer) are fully preserved in the app-owned `delivery` and `replenishment_run_po`/history tables, which are the system of record for app actions. ActiveOne PO custom fields were never a reliable audit home given ActiveOne overwrites them.

## 8. Rollout
- Ship as one change set touching two `infrastructure/` files, the SQL migration, and (for FR-11) the run-PO snapshot wiring. No `container.ts` change (no new ports).
- **Pre-existing app POs:** if any non-production/shared environment already contains app-created POs whose supersede exclusion relied on `CUSTOM_FIELD1`, backfill is unnecessary — those POs still have their `delivery.new_po_id` mapping, which is what the new gate uses. Real ActiveOne POs simply become visible again (the intended fix).
- **Verification:** on the full-year dump, confirm (a) the Delivery grid returns real open POs that previously vanished, (b) an app-created supersede PO is still excluded and non-receivable, and (c) a generated replenishment PO row has `CUSTOM_FIELD3 = NULL` while its manufacturer still renders in history and the PO summary.

## 9. Open Decisions
- **O1 — Add `replenishment_run_po.po_id`?** *Recommended: yes.* The whole point of "keep the manufacturer in a side table" is future queryability; a primary-key join to the live PO is more robust than matching on `po_code`, and the minted `poId` is already available at insert time (near-zero cost). The alternative is to rely on `po_code` matching and defer `po_id` under YAGNI until the PO-list module is actually built.
