# Implementation Plan: Selling-Area On-Hand Override in Replenishment Review

Source idea capture: [todo/selling-area-onhand-override-ideas_todo.md](selling-area-onhand-override-ideas_todo.md)
(No PRD yet — this plan is written directly from the idea capture.)
Date: 2026-08-25

## Summary

Add a per-line manual **"Selling-area on-hand"** entry to the Replenishment PO
Review step. Entering a counted qty (combined across all mapped selling areas,
in the item's purchase unit) adds it to the line's effective available, so the
suggestion, per-piece split, and DOS recompute live. The entered value persists
through PO submission, drafts, and the run-history snapshot, and renders in the
history detail screen, CSV export, and print report.

## Affected Areas

- `app/(authenticated)/replenishment/page.tsx` — `POLineState`, recompute
  helpers, new line mutator, Review JSX, both POST payloads
- `app/(authenticated)/replenishment/domain/PurchaseOrder.ts` — `PurchaseOrderLine`
- `app/(authenticated)/replenishment/api/po/route.ts`,
  `app/(authenticated)/replenishment/api/draft/route.ts` — validation
- `app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts` —
  draft insert + active-run snapshot insert
- `scripts/create-app-tables.sql` — one idempotent `ALTER TABLE`
- `app/(authenticated)/history/replenishment/…` — repo SELECT/mapper,
  domain type, detail row, CSV, print report
- No `container.ts` changes (no new use cases or adapters)
- No shared-code changes; no ActiveOne writes beyond existing PO lines

## Decisions

**Resolved by developer (brainstorm):**
- Manual entry only — no prefill from `inventory_count` (deferred).
- One combined figure per item, not per selling area.

**Resolved by AI (patterns/conventions):**
- **Separate additive field, not mutation of `effectiveAvailable`.**
  `POLineState.shelfOnHand: number | null` stays distinct from the
  feeder-only `effectiveAvailable`; consumers sum them. Mirrors the additive
  `safetyStockUnits` pattern and preserves the audit distinction between
  system-computed and manually-entered availability.
- **Unit = purchase units, whole numbers ≥ 0, blank = unset.** Everything on
  Review (rate, suggestions, quantities) is already in purchase units, so the
  value adds directly with no conversion.
- **Recompute mirrors `updateLineSafetyStock`** — build `next = {...l,
  shelfOnHand}` and spread `recomputeLineQty(next)`; the per-piece fallback
  (split collapses back to case mode when pieces vanish) comes free via
  `recomputeLineQty`.
- **DOS recomputed on shelf change** (`totalAvail ÷ rate`, `null` when rate is
  0) so the submitted/history-recorded DOS reflects what the user saw.
- **Standard path only** — stockout lines never carry `shelfOnHand` (pooling is
  Standard-only; stockout has no stock concept, `effectiveAvailable: 0`).
- **No new RBAC permission** — consistent with all other Review-step edits
  (period, rounding, qty, safety stock), which any `module.replenishment`
  user may perform.
- **Server advisory echo only** — value validated and stored; no server-side
  recompute gate (client owns the arithmetic, same as safety stock).

**Assumptions:**
- Input renders on all Standard-path Review lines (not conditionally hidden
  when no selling areas are pooled) — leaving it blank is today's behavior;
  avoids wrongly suppressing the field for edge mappings.
- Draft post-hoc editing in History still edits `final_qty` only;
  `shelfOnHand` is not editable after draft save (YAGNI).
- Split lines (cases row + pieces row from `expandOrderLine`) both carry the
  same `shelf_on_hand` value on their physical rows — it is a per-order-line
  fact, duplicated for self-containment, like other decision fields.

## Implementation Steps

Ordered domain → application → infrastructure → api → page → history.

### 1. Schema — `scripts/create-app-tables.sql`

Idempotent `ALTER TABLE replenishment_run_line ADD COLUMN shelf_on_hand
decimal(18,4) NULL AFTER effective_available` following the exact
checked-add pattern used by `safety_stock_percent` (lines ~436–448).

### 2. Domain — `domain/PurchaseOrder.ts`

Extend `PurchaseOrderLine`: `shelfOnHand?: number | null`. Optional, so
stockout senders and old clients stay valid.

### 3. API validation — `api/po/route.ts` + `api/draft/route.ts`

Accept optional `shelfOnHand`: absent/null OK; if present, integer
`0..MAX_LINE_QUANTITY` (reuse the existing quantity-bounds block, draft route
lines ~38–52). Normalize `null` for stockout lines. Fail Fast with 400.

### 4. Infrastructure — `MySQLPurchaseOrderRepository.ts`

Add `shelf_on_hand` to both bulk INSERT column lists + row arrays:
draft save (~L290–297) and active-run snapshot (~L763–771). Value passes
through verbatim; no SQL changes elsewhere.

### 5. Client state + math — `page.tsx`

- `POLineState` (+~L195): `shelfOnHand: number | null` (initialize `null` in
  `handleGeneratePO` standard branch, ~L1327; absent on stockout lines).
- Helper next to the math helpers (~L96): `totalAvailable(l) =
  l.effectiveAvailable + (l.shelfOnHand ?? 0)`.
- Swap `l.effectiveAvailable` → `totalAvailable(l)` at the four recompute
  inputs: `recomputeLineQty` case mode (L202) and split mode (L204–206),
  `updateLinePerPiece` ON/OFF branches (L1481–1496, L1498–1508),
  `updateLineSafetyStock` rawNeed (L1517). `handleGeneratePO` keeps using
  feeder-only `effective` — shelf is always `null` at build time.
- New mutator `updateLineShelfOnHand(sku, raw)` near
  `updateLineSafetyStock` (L1513): parse blank → `null`; clamp to integer ≥ 0;
  build `next`, spread `recomputeLineQty(next)`, then set
  `dos = rate > 0 ? totalAvailable(next)/rate : null`.

### 6. Review JSX — `page.tsx` (~L1848–2251)

- New column header "Selling-area On-hand" (labeled `type-label
  text-muted-foreground` style, matching Period/Rounding headers) in the
  header block (~L1863–1876); bump `reviewColSpan` (+1) at L1850.
- Per-row `<Input type="number">` (standard-path rows only) beside the
  Suggested/Safety cells (~L2060–2086): placeholder "—", `min=0`, wired to
  `updateLineShelfOnHand`. Register `` `shelf:${sku}` `` with
  `useQuantityKeyboardNav` alongside `case:`/`piece:` keys (L2090/L2177).
- Stockout rows and the pieces sub-row do not render it (the value lives on
  the parent line).

### 7. Payloads — `page.tsx`

Add `shelfOnHand` (null for stockout/unset) to both duplicated line builders:
`submitPO` (~L1539–1567) and `handleSaveDraft` (~L1600–1623). They must stay
identical.

### 8. History read/render

- `history/domain/ReplenishmentRunSummary.ts`: `ReplenishmentRunLineDetail
  .shelfOnHand: number | null` (~L54).
- `history/infrastructure/MySQLReplenishmentHistoryRepository.ts`: add
  `shelf_on_hand` to the SELECT (~L264), row interface (~L103–105), mapper
  (~L294–296).
- `history/replenishment/[runId]/page.tsx`: LineRow cell after Effective
  Available (standard branch, ~L112–115); CSV header + value (~L44, L63);
  print report cell (~L367–368). Render blank/"—" when null; monochrome-safe
  (plain dash, no color meaning).

### 9. Verify

`npx tsc --noEmit` + `npm run lint` (per CLAUDE.md: `next build` hangs in this
environment — do not use it as the verification gate). Manually exercise via
`npm run dev`: enter shelf qty on a pooled item → suggestion/split recompute;
toggle per-piece after entry; save draft → inspect `replenishment_run_line`;
submit → check history detail + CSV + print.

## Risks & Open Questions

- **Live-data check:** confirm the idempotent ALTER runs cleanly on the
  production-sized table (pattern proven by prior columns — low risk).
- **UX placement:** column position (beside Suggested) is an assumption;
  verify readability on Android-width screens during dev check — the Review
  table already has many columns.
- **Behavior note:** entering shelf stock can drive suggestion to 0 (or split
  pieces to 0 → auto-revert to case mode with qty 0). This is intended
  ("count shows enough stock"), but confirm purchasing expects a zeroed
  suggestion rather than line removal — removal stays manual via existing
  uncheck/delete affordances.
