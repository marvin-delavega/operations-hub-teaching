# PO Code Numbering (app-owned counter + display width) -- Feature Ideas

Captured 2026-09-02. Not yet scoped -- needs a PRD + plan before implementation.
Topic /flow gate reached Brainstorm; all three architecture questions below were
answered by the developer in this session.

Context: App POs written to ActiveOne `purchase_order` today derive their readable
CODE = `{po_code_prefix}-{ActiveOne PK ID}` (`OHPO-009005`, padStart to 6). The prefix
is already configurable (live from `app_settings.po_code_prefix`), but the *number* is
the real ActiveOne purchase_order ID, forced to keep *continuing* in the thousands+ and
shared/locked to `MAX(ID)+10`. `PRD-po-id-code-minting.md` explicitly defers any change
to this code format/width. The developer wants to change that: give app POs an
**app-owned, per-prefix monotonic counter** (stored in our DB) so the number can either
**start at 1** or **continue**, independent of ActiveOne's PK. Leading zeros become a
**display-only** width, not part of generation.

## Confirmed decisions (from developer)
- **App-owned counter**: yes. The readable CODE number is decoupled from the ActiveOne
  `purchase_order` PK ID and driven by a counter we own/persist. Rationale given by dev:
  with a required letter prefix, `PO-` collides with nothing in ActiveOne (dev checked:
  no existing PO CODE carries the `PO-` prefix), so starting the app counter at 1 is safe.
- **Scope**: `purchase_order` CODE only -- Replenishment Generate PO + Delivery supersede.
  Counting keeps its separate zero-padded 4-digit `inventory_count` CODE untouched.
- **Leading zeros = display only**, not generation. e.g. generate/store `PO-1` as the
  first code; the configured leading-zero width only changes how it is rendered in the
  UI and in printed reports (`PO-000001`). Stored DB value stays minimal.

## Constraints carried over from PRD-po-id-code-minting.md (MUST NOT regress)
- The ActiveOne **PK `ID` minting is unchanged**: `purchase_order.ID` and
  `purchase_order_items.ID` must still co-advance the shared sequence via `MAX(ID)+10`
  inside the writing transaction, with `withPoMintRetry` dup-key retry. Only the
  *readable CODE number* becomes ours.
- App CODE stays in a **letter-prefix namespace** so ActiveOne's numeric `MAX`-derived
  next-code logic ignores it (`PO-…` casts to 0). Never emit bare-numeric app codes.
- `UNIQUE(CODE)` remains the integrity backstop; the app-owned counter must stay
  unique across every app PO that shares the prefix (single monotonic counter).
- Two writers share this: `MySQLPurchaseOrderRepository.createAll` (replenishment,
  multi-supplier batch) and `MySQLDeliveryRepository.commit` (delivery, single PO).

## Tier 1 -- Core (do these; the rest scaffold around them)
- [ ] **App-owned monotonic counter table** -- a new small table (e.g. `po_code_counter`,
  one row per prefix: `prefix` PK + `next_value`) persisted in our DB, incremented
  atomically. Both replenishment and delivery read + bump it inside the same
  transaction as the PO insert (via `SELECT … FOR UPDATE`/atomic update) so concurrent
  runs can't mint the same number; a dup-key retry also reverts the counter (rollback).
- [ ] **Start-from-1 vs Continue choice** -- a setting controlling the initial seed:
  "Continue" seeds the counter from the current state (max app-number already used /
  existing counter row) so visible behavior is unchanged for existing installs;
  "Start from 1" forces the counter to 1. Change is effectively a one-time reseed
  the admin triggers (see Tier 2 for the UI). Rationale: recommended option is
  "Continue" as the default/migration behavior; "Start from 1" is opt-in.
- [ ] **Generation emits minimal number** -- `poCode(number)` no longer embeds the PK ID
  and no longer pads; it writes `{prefix}-{number}` (e.g. `PO-1`). Number source switches
  from `poId` to the app counter value.

## Tier 2 -- Strong, moderate effort
- [ ] **Admin setting(s) + UI** -- alongside the existing PO-code-prefix field: a
  numbering mode picker ("Start from 1" / "Continue") and a leading-zero width control
  (0 = no padding … N). New `app_settings` keys mirroring `po_code_prefix`; server-side
  validation + persistence, matching the existing prefix pattern. Placed in the admin
  General (or PO-specific) settings area.
- [ ] **Display-only width formatter** -- a shared util `formatAppPoCode(code, width)`
  (or `formatAppPoCode(prefix, number, width)`) applied ONLY at render surfaces for
  **app-generated codes**: replenishment screens/summaries, delivery success/summary,
  history snapshots that carry app PO codes, and the printable reports. Must NOT blindly
  pad native ActiveOne codes shown in delivery's open-PO list (those are the ERP's
  codes). Whether to store a padded canonical value vs minimal is decided above:
  minimal storage, format at render.

## Tier 3 -- Convenience / hardening
- [ ] **Prefix/counter interplay guard** -- when the admin changes the prefix (or flips
  to Start-from-1) after POs already exist under that prefix, warn/guard against a
  counter that would eventually climb into already-used numbers (only matters if the
  counter is reset under a prefix that already has history). Edge worth a confirm.
- [ ] **`PRD-po-id-code-minting.md` reversal note** -- update the deferred line to reflect
  the new decoupled design so the two docs don't contradict.

## Suggested starting point
Tackle the **app-owned counter table + generation switch** first, with Continue as the
default seed so nothing changes for current installs, then layer Start-from-1 and the
display-width formatter. The counter table + atomic-increment-in-transaction is the
highest-risk piece (concurrency + the shared replenishment/delivery writers), so pin it
down before any UI.

## Open questions (for the PRD/plan gate)
- OQ-1: Is the counter **per-prefix** (one row per prefix, survives a prefix change as a
  fresh series) or **global single**? Default leaning: per-prefix keyed by prefix.
- OQ-2: "Continue" seed source -- from the max numeric tail of existing app codes under
  the prefix, or simply from whatever the counter row already holds (i.e. Continue is
  really "don't reseed to 1")?
- OQ-3: Display width global or per-surface? Default: one global width setting.
- OQ-4: Multi-location: should each location have its own series (PO-1 per location) or
  is the counter global across locations? Today ActiveOne CODE is global across
  locations (per PRD-po-id-code-minting §2), so default = global; but the developer
  should confirm since a per-location series would re-introduce per-location state.
- OQ-5: Does the stored CODE in ActiveOne/history stay minimal (`PO-1`) or must the
  *written* value be padded for legacy/report compat? Dev said display-only, so minimal
  write -- but confirm history snapshots can render retroactively under a changed width.
