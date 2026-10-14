# PRD: App-Owned PO Code Numbering (Start-from-1 / Continue + Display Width)

Date: 2026-09-02
Supersedes the "no change to OHPO format/width" deferral in `PRD-po-id-code-minting.md`.

## 1. Overview

Today an app-created purchase order's human-readable CODE is
`{po_code_prefix}-{ActiveOne purchase_order PK ID}` (e.g. `OHPO-009005`, ID left-padded
to width 6). The trailing number is the real ActiveOne `purchase_order.ID`, which the
app must keep co-advancing via `MAX(ID)+10` — so it is locked to the thousands range and
can never "start at 1".

This PRD decouples the **readable CODE number** from the ActiveOne PK. App POs get an
**app-owned, global, monotonic counter** (persisted in our DB) so the number can either
**start at 1** or **continue** from the existing series, independent of the ActiveOne ID.
The leading-zero width becomes a **display-only** concern: generation stores the minimal
form (`PO-1`); a configured width only changes how app PO codes are rendered in the UI
and printed reports (`PO-000001`).

The ActiveOne **PK `ID` minting is unchanged** — it must still follow `MAX(ID)+10` inside
the writing transaction with `withPoMintRetry` dup-key retry. Only the CODE number is ours.

## 2. Goals
- Give app POs a readable CODE whose number is an app-owned global counter, safe to start at 1.
- Keep the CODE in the configured letter-prefix namespace (`PO-`, `OHPO-`, …) so ActiveOne's
  numeric `MAX`-derived next-code logic ignores it and nothing in ActiveOne is perturbed.
- Preserve the guaranteed-unique `UNIQUE(CODE)` invariant across all app POs sharing a prefix.
- Add a display-only leading-zero width config applied to app PO codes in UI and reports.
- Apply identically to both app PO writers: Replenishment Generate PO (multi-supplier batch)
  and Delivery supersede-save (single PO).

## 3. Non-Goals
- Changing ActiveOne PK `ID` minting (`MAX(ID)+10`, `withPoMintRetry`) — untouched.
- A per-location series (counter is global, matching ActiveOne's global CODE space).
- Changing Counting's separate zero-padded 4-digit `inventory_count` CODE.
- Emitting bare-numeric app codes (must stay under a letter prefix).
- Reading/writing `object_type_map` / `object_code_sequence`.

## 4. Users & Roles
- **Admin**: chooses the numbering policy (Continue default) and triggers a confirmed
  "Reset numbering to 1"; sets the display width. Lives with the PO-code prefix in admin General settings.
- **Staff**: unchanged — sees the generated CODE (display-formatted) as today.

## 5. Functional Requirements

FR-1. **App-owned global counter.** A new app-owned table stores the next CODE number for
the active prefix. Generation reads the current value, uses it as the CODE number, and
increments — all inside the same transaction as the PO insert, locked so two concurrent
writers never mint the same number.

FR-2. **CODE = `{prefix}-{number}` (minimal).** `poCode` emits the unpadded form. The
number comes from the app counter, **not** the ActiveOne PK `ID`.

FR-3. **Continue (default).** When the counter row does not exist for the active prefix,
it is initialized to `max(numeric tail of existing purchase_order.CODE under {prefix}-) + 1`
(1 when none), so existing installs keep numbering forward without collisions. Thereafter
each PO simply increments the counter.

FR-4. **Start from 1 (manual, confirmed).** A one-time admin action "Reset numbering to 1"
sets the counter's next value to 1 (confirm dialog). It is not a live toggle that re-seeds
every run. Guarded by a warning that it is only safe when the prefix is disjoint from any
existing app CODE history that a reset would eventually climb into.

FR-5. **Batch POs each get their own number.** Replenishment `createAll` (N supplier/
manufacturer POs in one run) advances the counter once per generated PO; Delivery commits one.

FR-6. **Display-only width.** A new `app_settings` width (`po_code_display_width`, integer
0..N, default 6) governs how app PO codes are padded for display. Generation ignores it and
stores minimal. It is applied at render sites — including printable reports.

FR-7. **Never reformat foreign codes.** Display formatting applies only to codes the app
generated under its prefix (e.g. prefix `PO-` → tail after `PO-`). ActiveOne-native numeric
codes surfaced in Delivery's open-PO list render verbatim.

FR-8. **Atomicity + retry preserved.** Counter read/bump sits inside the same transaction as
the existing `MAX(ID)` reads and inserts, so `withPoMintRetry` dup-key retry rolls back the
counter bump too.

## 6. Data Model

### Our side (new table) — `po_code_counter`
| Column | Type | Notes |
|---|---|---|
| `prefix` | varchar PK | the active `po_code_prefix` value (one series per prefix) |
| `next_value` | bigint | next number to assign |
| `created_at` / `updated_at` | datetime | |

Only one row is ever active at a time (single global `po_code_prefix` setting). The row is
created lazily on first PO under a prefix (FR-3) or by the reset action (FR-4).

### Our side (settings, key-value) — `app_settings`
- `po_code_display_width` — display padding width for app PO codes (default `6`).

### ActiveOne (existing, unchanged)
`purchase_order.CODE` stores the minimal `{prefix}-{number}` string. `purchase_order.ID`
and `purchase_order_items.ID` keep `MAX(ID)+10` minting.

## 7. Edge Cases & Error Handling
- **Two writers race for the same number:** counter row is read/updated under lock in the
  same transaction as the insert; the second writer blocks then observes the bumped value.
- **Prefix change after history exists:** a new prefix has no counter row → fresh series
  starting at 1 (Continue still safe since disjoint). Resetting numbering to 1 under a prefix
  that already has a long history can eventually collide after the counter climbs back up —
  confirm dialog warns; admin accepts (matches their disjoint-prefix check).
- **Retry exhaustion:** unchanged (`PoNumberAssignmentError` surfaced, user retries).
- **Counter row absent at generate time (first PO ever):** lazy-init per FR-3 inside the tx.
- **Display width changed later:** historical stored codes stay minimal; rendering uses the
  current width (may make an old `PO-1` render as `PO-000001`). Accepted for display-only.

## 8. Open Questions
- OQ-1: Exact max render-site inventory for app PO codes (UI screens + printable reports +
  CSV) — to be enumerated during planning so the display helper covers them all.
- OQ-2: Whether history snapshots should store minimal (yes, they store the generated
  `poCode` already) and format at read/print — confirmed display-only.
