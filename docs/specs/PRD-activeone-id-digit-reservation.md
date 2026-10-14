# PRD: App-owned reserved last-digit for ActiveOne PO IDs

**Status:** Supersedes the "reserved range forbidden / stay contiguous `MAX(ID)+10`"
ruling in `PRD-po-id-code-minting.md` and `docs/activeone-schema-insights.md`, **only for the
integer PK allocation scheme described here.** CODE minting (`OHPO-`, `po_code_counter`) is
unaffected.

## Problem

Saving a PO (replenishment run or delivery supersede) intermittently throws a **duplicate
`purchase_order.ID` / `purchase_order_items.ID` PK error** against ActiveOne's concurrent
native writer. Both this app and native ActiveOne reach for the same next ID because they
both advance from the same allocator — `object_type_map.NEXT_ID` (bumped by `INCREMENT`, 10)
per `PRD`'s current `acquireNextObjectId` — or, per older schema insights, native may
self-derive `MAX(ID)+10`. Either way the app currently mints a value that a native save can
also claim, so the shared numeric space is the source of conflict.

## Proposed fix (per product owner)

Reserve a **disjoint app-owned sub-stream inside ActiveOne's own sequence** by choosing a
single reserved **last digit** per object table.

Mechanics, modeled on native reading `object_type_map.NEXT_ID` and bumping by `INCREMENT`:

1. The app advances `object_type_map.NEXT_ID` exactly as native does (bump by the row's
   `INCREMENT`) so ActiveOne **continues from the advanced counter** and never re-issues a
   value at or below it.
2. Instead of inserting the row at the pre-bump counter value (which native could also
   claim), the app inserts at that value **with its last digit replaced by the configured
   reserved digit**.
3. Because the app row is *below* the advanced counter, native's subsequent allocations
   never coincide with it; because native's own stream keeps its natural last digit, native
   never emits the reserved digit. The two writers therefore occupy disjoint ID values in
   the same table with no shared slot.

Example (`INCREMENT = 10`, reserved digit `1`, counter about to hand out `198852`): the app
bumps the counter to `198862` and writes its row at `198851`. ActiveOne's next allocation is
`198862` — no collision.

This deliberately **replaces** (not subtracts) the final digit: `198851` is not "`198852 − 1`"
semantically; it is the counter's next value with the units digit forced to `1`.

## Scope

- **Now:** two object tables — `purchase_order` (PO header) and `purchase_order_items`
  (PO lines) — each with its **own reserved-digit setting**. Both are consumed by
  replenishment and delivery (shared minting). Both writers (replenishment Standard/Stockout
  `createAll`, delivery `commit`) adopt the scheme.
- **Later (out of scope):** other modules/tables (counting `inventory_count`/`_items`, etc.)
  adopt the same pattern with their own settings.

## Settings

Two `app_settings` keys, each a single digit `0-9`, seeded with a default, editable in
Admin **General** tab (`admin.general_settings`), mirroring `po_code_prefix`:

| key | table | default | meaning |
|---|---|---|---|
| `po_header_id_reserved_digit` | `purchase_order` | `1` | units digit forced onto every app-minted header ID |
| `po_line_id_reserved_digit` | `purchase_order_items` | `1` | units digit forced onto every app-minted line ID |

- **Per-module semantics:** the *pattern* is per object-table. Header and line are two
  tables, so two settings; a future table gets its own key. The reserved digit for a table
  should differ from that table's native last digit (see Verification).

## Verification / risks

- **Confirm the allocator model.** The one fact the scheme's proof rests on is that native
  ActiveOne allocates `purchase_order.ID` from `object_type_map.NEXT_ID` (bump `INCREMENT`)
  and does **not** self-derive `MAX(ID)+10`. The current codebase docs claim native
  self-derives and the counters are stale; the observed duplicate-key error suggests native
  is *not* cleanly sharing `acquireNextObjectId`'s atomic counter. **A single live
  observation is required before rollout**: note `object_type_map.NEXT_ID` and `MAX(ID)` for
  both PO tables, create one native PO, re-read — confirm which value native consumed. If
  native self-derives `MAX(ID)+10`, the bump/reserve logic below still keeps app rows below
  the native stream only if the reserved digit differs from the current `MAX(ID)` units digit
  — the plan's digit rule must be validated against both models.
- **`withPoMintRetry` remains the backstop.** Any residual collision rolls the transaction
  back and re-mints on the next counter block; sustained contention still surfaces
  `PoNumberAssignmentError`. This PRD's change makes collisions structurally rare rather than
  merely retried.
- **Historical rows.** If any pre-existing `purchase_order(.items).ID` already ends in the
  chosen reserved digit within the allocator's ceiling, the first app insert there collides
  (retried, then skipped). The Admin save validates this and warns.
