# Selling-Area On-Hand Override -- Feature Ideas

Captured 2026-08-25. Not yet scoped -- each Tier 1 item likely warrants its own
PRD before implementation.

Context: Selling-area on-hand counts are unreliable, so replenishment for those
areas is not run directly; their demand (sales rate) is pooled into the feeder
(Leon Garcia) via `selling_area_feeder_map`, and `effective_available` uses only
the feeder's stock. When purchasing does an on-demand inventory count at a
selling area, there is no way to feed that fresh count into the pooled
calculation. Proposal: let users manually enter a combined selling-area on-hand
per item during the Replenishment **Review** step so suggestions reflect actual
shelf stock.

## Tier 1 -- Highest value

- [ ] **Review-step shelf on-hand entry** -- Per-item editable field (combined
      figure across all mapped selling areas) on Review lines; blank = today's
      behavior; entering a number adds it to
      `effective_available = availableStock + incoming + shelfOnHand` and
      recomputes suggested qty, DOS, and critical flags live.
- [ ] **Per-piece interplay** -- Added on-hand can push need below one case;
      must flow through the same sub-case logic as round-down `<1 cs`
      surfacing and auto per-piece ("split") mode so case/piece splitting stays
      consistent with the new availability.
- [ ] **History snapshot field** -- Record the manually entered shelf on-hand
      (and that it was manual) on `replenishment_run_line` inside the existing
      atomic snapshot write, so audit shows why effective-available differs from
      the feeder-only default.

## Tier 2 -- Strong, moderate effort

- [ ] **Draft persistence** -- Entered on-hand values survive save/draft
      round-trips (`/replenishment/api/draft`) like other line overrides.
- [ ] **Main-list affordance** -- Indicator/badge on items whose Review carries
      an entered shelf on-hand, plus a clear/reset control; possibly allow
      entry from the main list too (decision point for PRD).
- [ ] **Submit payload + server echo** -- Thread `shelfOnHand` through PO
      submit payload and store it server-side (advisory, mirroring the
      minimum-order advisory pattern).

## Tier 3 -- Convenience / workflow

- [ ] **Prefill from counting module** -- Later enhancement: prefill the entry
      from the latest finalized `inventory_count` for item+area instead of pure
      typing (explicitly deferred this iteration).

## Suggested starting point

Tier 1 as one PRD: the Review-step entry with live recompute is the core; the
per-piece interplay and history column are small riders on mechanics that
already exist (`recomputeLineQty`, `computeSplitOrder`,
`persistRunSnapshot`). Keep scope Standard-path only (pooling is Standard-only)
and manual-entry-only to avoid touching counting or the rollup.
