# Implementation Plan: Replenishment Per-Piece Ordering
Source PRD: [PRD-replenishment-per-piece-ordering.md](PRD-replenishment-per-piece-ordering.md)
Date: 2026-07-05

## Summary
Add an ad-hoc, per-line **cases ⇄ pieces** toggle to the replenishment Review screen. Toggling a line recomputes its suggestion in base pieces (always round-up), writes that PO line to ActiveOne in the base unit, and records the decision in run history. The main list additionally surfaces sub-case needs (unrounded > 0 but rounds to 0 under round-down) with a **"<1 cs"** badge, default-unchecked, so they can be reached and per-pieced. Purely run-time: no admin config, no persisted per-item flag, **no localStorage** — per-piece is transient React state that resets to cases on every new run and on reload, so a later run never remembers which items were per-pieced. One additive `replenishment_run_line.ordered_per_piece` column; the read query widens to return base-unit symbol + conversion factor so the client can toggle with no extra round-trip.

## Affected Areas

**Read side (expose base unit + factor):**
- [ReplenishmentItem.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentItem.ts) — add `baseUnitSymbol`, `conversionFactor`.
- [StockoutItem.ts](../../app/(authenticated)/replenishment/domain/StockoutItem.ts) — add `baseUnitSymbol`, `conversionFactor`.
- [MySQLReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts) — SQL/select + row mapping.
- [MySQLStockoutRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLStockoutRepository.ts) — SQL/select + row mapping.
- [SeedReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/SeedReplenishmentRepository.ts) — set the two new fields for type/behavior parity (CLAUDE note: MySQL repo mirrors the seed repo).
- Read API routes ([api/route.ts](../../app/(authenticated)/replenishment/api/route.ts), [stockout/api/route.ts](../../app/(authenticated)/replenishment/stockout/api/route.ts)) — **no change**; item objects pass straight through as JSON.

**Write side (per-piece PO line + snapshot):**
- [PurchaseOrder.ts](../../app/(authenticated)/replenishment/domain/PurchaseOrder.ts) — `PurchaseOrderLine.orderedPerPiece?: boolean`.
- [MySQLPurchaseOrderRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts) — per-piece branch in the `purchase_order_items` write + `ordered_per_piece` in the `replenishment_run_line` insert.
- [api/po/route.ts](../../app/(authenticated)/replenishment/api/po/route.ts) — accept/coerce optional `orderedPerPiece` per line (quantity validation unchanged).

**History side (surface the indicator):**
- [ReplenishmentRunSummary.ts](../../app/(authenticated)/history/domain/ReplenishmentRunSummary.ts) — `ReplenishmentRunLineDetail.orderedPerPiece: boolean`.
- [MySQLReplenishmentHistoryRepository.ts](../../app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts) — select + map `ordered_per_piece`.
- [history/replenishment/[runId]/page.tsx](../../app/(authenticated)/history/replenishment/[runId]/page.tsx) — "ordered per piece" indicator on the line row, print report, and CSV.

**Client (toggle + surfacing):**
- [replenishment/page.tsx](../../app/(authenticated)/replenishment/page.tsx) — Review toggle, piece-suggestion recompute, main-list sub-case surfacing. No persistence — per-piece is in-memory `poLines` state only.

**DB:**
- [scripts/create-app-tables.sql](../../scripts/create-app-tables.sql) — `ordered_per_piece` in the `replenishment_run_line` CREATE TABLE + an idempotent ALTER (mirror the existing `item_code` block).

**container.ts:** no factories added or changed — all payload shapes widen within existing use cases (`GetReplenishmentGroups`, `GetStockoutCandidates`, `CreatePurchaseOrders`).

## Decisions

- **Resolved by developer:** **No persistence — per-piece is fresh every run.** Per-piece choices live **only** in React `poLines` state; they are **not** written to `localStorage`. Every Generate PO rebuilds `poLines` with all lines in their purchase unit (cases), and a page reload wipes them — so a later run for the same location/suppliers **never** resurrects which items were per-pieced. This is what the codebase already does for quantity overrides (nothing on the Review screen is persisted today) and matches PRD §3 ("chosen fresh each run; not remembered across runs"). It deliberately **overrides FR-6's localStorage draft**, which would have leaked per-piece state across runs via a run-scoped key.
- **Resolved by AI:** Sub-case surfacing (FR-7/8/9) is computed **client-side**, not via a server flag. The candidate SQL already filters at `MAX_ORDER_PERIOD` (`rawOrder > 0`), so every sub-case item is already in the payload; the client has `dailySalesRate`, `effectiveAvailable`, `supplierLeadTime`, period, and rounding to derive "unrounded > 0 but rounds to 0." This avoids widening the read API (YAGNI) and keeps the PRD's API "flag" as the optional path it is.
- **Resolved by AI:** `baseUnitSymbol` + `conversionFactor` **must** come from the server read query (FR-3/FR-5/FR-13 — client never derives unit/factor). Both repos already `LEFT JOIN unit_of_measure uom_b` and select `conversion_factor`; only add `uom_b.SYMBOL` to the select and thread both to the item — no new joins.
- **Resolved by AI:** Per-piece PO write mirrors the PRD verbatim (FR-11): `UNIT_ID = BASE_UNIT_ID`, `UNIT_BASE_QUANTITY = 1`, `RATE = COST` (per base), `AMOUNT = QUANTITY × RATE`. This reuses the exact cost/factor the repo already resolves per line (`item.COST`, `conversion_factor`); case lines are untouched.
- **Resolved by AI:** `unitSymbol`/`suggestedQty`/`finalQty` in the snapshot are already carried per line; for a per-piece line the client sends the **base** symbol and **piece** quantities, so the snapshot is honest with only the added `ordered_per_piece` flag (FR-14). The toggle updates `line.suggestedQty` (in pieces) so history override-highlighting compares piece-to-piece.
- **Assumptions:**
  - FR-14's "Delivery/Replenishment history" means the **replenishment** run detail (per-piece is a replenishment concept); no Delivery-module change.
  - Per-piece is **run-scoped in-memory state.** Within one live page session, toggling between the Review screen and the main list (Back→Generate PO) resets per-piece to cases because `handleGeneratePO` rebuilds `poLines` from scratch — this is the existing behavior for quantity overrides and is accepted (a run = one Generate→Review→Submit cycle). A hard reload likewise starts fresh in cases. No screen/draft state is persisted.
  - Base-unit symbol fallback: when `uom_b.SYMBOL` is empty the read query already returns `''`; the Review unit cell falls back to the label `"pc"` for display only (never affects the write, which uses `BASE_UNIT_ID`). (Resolves PRD Open Question "Base-unit symbol source.")

## Implementation Steps

### 1. DB column — [scripts/create-app-tables.sql](../../scripts/create-app-tables.sql)
- Add `ordered_per_piece tinyint(1) NOT NULL DEFAULT 0` to the `replenishment_run_line` CREATE TABLE, positioned `AFTER final_qty`.
- Add an idempotent `information_schema.COLUMNS` guard + `ALTER TABLE … ADD COLUMN` block, copying the existing `@rrl_has_item_code` / `PREPARE … EXECUTE … DEALLOCATE` pattern at lines 378–390.

### 2. Domain type additions
- [ReplenishmentItem.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentItem.ts): add `baseUnitSymbol: string;` and `conversionFactor: number;` (base pieces per purchase unit).
- [StockoutItem.ts](../../app/(authenticated)/replenishment/domain/StockoutItem.ts): same two fields.
- [PurchaseOrder.ts](../../app/(authenticated)/replenishment/domain/PurchaseOrder.ts): add `orderedPerPiece?: boolean;` to `PurchaseOrderLine` (default false; already an optional decision-context line, `unitSymbol` sits right above it).
- [ReplenishmentRunSummary.ts](../../app/(authenticated)/history/domain/ReplenishmentRunSummary.ts): add `orderedPerPiece: boolean;` to `ReplenishmentRunLineDetail`.

### 3. Read repositories — expose base symbol + factor
- [MySQLReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts):
  - In `buildCandidatesSQL`, add `COALESCE(uom_b.SYMBOL, '') AS base_unit_symbol` to the SELECT (the `uom_b` join already exists at line 136; `conversion_factor` is already selected).
  - Add `base_unit_symbol: string` to `CandidateRow`.
  - In `getGroups`, set `conversionFactor` (reuse the already-computed `conversionFactor = Math.max(1, Number(row.conversion_factor))`) and `baseUnitSymbol: row.base_unit_symbol` on the mapped `ReplenishmentItem`.
- [MySQLStockoutRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLStockoutRepository.ts): same — add `base_unit_symbol` to the SELECT (join `uom_b` at line 118 already present) and `CandidateRow`, then set `baseUnitSymbol` + `conversionFactor` on the mapped `StockoutItem`.
- [SeedReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/SeedReplenishmentRepository.ts): populate `baseUnitSymbol` and `conversionFactor` on its seeded items (e.g. base symbol `"pc"`, a small factor like 12) so the type compiles and dev toggling works.

### 4. PO write path — [MySQLPurchaseOrderRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts)
- In `createAll`, inside the `lines.forEach` line loop (currently lines 149–177), branch per line:
  - **Per-piece** (`line.orderedPerPiece === true` **and** `item.BASE_UNIT_ID != null` **and** `conversionFactor > 1`): `unitId = item.BASE_UNIT_ID`, `unitBaseQuantity = 1`, `rate = cost` (per base), `amount = line.quantity * cost`, `QUANTITY = line.quantity` (pieces). (FR-11.)
  - **Otherwise** (case, or per-piece requested but base unit unresolved / factor 1 → safe fallback per FR-2/FR-13/edge in §9): keep the existing `unitId = PURCHASES_UNIT_ID ?? BASE_UNIT_ID`, `unitBaseQuantity = conversionFactor`, `rate = cost * conversionFactor`.
  - This runs per line inside the same supplier+manufacturer group, so one PO already mixes case and piece lines (FR-12) with no grouping change.
- In `persistRunSnapshot` (lines 293–330): add `ordered_per_piece` to the `replenishment_run_line` INSERT column list and push `line.orderedPerPiece ? 1 : 0` into each `resolvedLineValues` row. `unit_symbol` already comes from the client-sent `line.unitSymbol` (base symbol for per-piece lines — see §7); `suggested_qty`/`final_qty` are already the client's chosen-unit quantities.

### 5. PO submit API — [api/po/route.ts](../../app/(authenticated)/replenishment/api/po/route.ts)
- No new validation required (quantity stays whole `0..MAX_LINE_QUANTITY`, interpreted in the line's chosen unit). Optionally coerce `orderedPerPiece` to a strict boolean when building the line objects so a tampered value can't reach the repo as a truthy non-boolean. Existing `UnknownSkuError` / `CreatorNotLinkedError` / atomic rollback are unchanged (FR-13, §9).

### 6. History read + render
- [MySQLReplenishmentHistoryRepository.ts](../../app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts): add `ordered_per_piece` to the `getById` line SELECT (line 196), add `ordered_per_piece: number` to `RunLineRow`, and map `orderedPerPiece: Boolean(l.ordered_per_piece)` in the `ReplenishmentRunLineDetail` build.
- [history/replenishment/[runId]/page.tsx](../../app/(authenticated)/history/replenishment/[runId]/page.tsx):
  - `LineRow`: when `line.orderedPerPiece`, render a small distinct indicator next to the unit (e.g. a `Badge` "per pc" — token-based, no raw palette) so the deliberate unit switch is visible (FR-14). `suggestedQty`/`finalQty` already display in pieces; override highlight already compares the two.
  - `PrintReport` line row + `exportCsv`: add an "ordered per piece" marker/column (monochrome-safe typographic marker for print per the print rules — no color reliance).

### 7. Client Review screen — [replenishment/page.tsx](../../app/(authenticated)/replenishment/page.tsx)
- **Helpers:** add `computePieceSuggestion(dailySalesRate, periodDays, leadTime, effectiveAvailable, conversionFactor)` = `Math.max(0, Math.ceil((dailySalesRate*(periodDays+leadTime) - effectiveAvailable) * conversionFactor))` (always round-up, FR-3). Reuse the existing `computeSuggestion` for case lines.
- **`POLineState`:** add `orderedPerPiece: boolean`, `baseUnitSymbol: string`, `conversionFactor: number`. Keep `unitSymbol` as the **purchase** symbol; derive the displayed symbol from `orderedPerPiece`.
- **`handleGeneratePO`:** on each built line set `baseUnitSymbol` and `conversionFactor` (from the item) and initialize `orderedPerPiece: false` — **every run starts in cases.** No draft is read; keep today's case suggestion/quantity behavior. (Because this function already rebuilds `poLines` from scratch, per-piece naturally resets on every Generate and on reload — the persistence the developer explicitly does **not** want.)
- **Toggle handler `updateLinePerPiece(sku, orderedPerPiece)`:** recompute that line in place on `poLines` — to pieces: `suggestedQty = quantity = computePieceSuggestion(...)`; back to cases: `suggestedQty = quantity = computeSuggestion(..., roundUp)`. Pure React state; no persistence.
- **Review render (screen === "po-review"):**
  - Unit cell: show `line.orderedPerPiece ? (line.baseUnitSymbol || "pc") : line.unitSymbol`.
  - Add a cases⇄pieces segmented control (reuse `SEG_TRACK` + `seg()`), rendered only when `line.conversionFactor > 1` (FR-2 hides it otherwise), beside the quantity input.
  - "Suggested" cell: use `computePieceSuggestion` when per-piece, else the existing `computeSuggestion`.
  - Quantity `<Input type=number min={1} step={1}>` unchanged (whole positive, interpreted in the current unit).
- **Submit payload (`handleSubmitPO`):** add `orderedPerPiece: l.orderedPerPiece` and send `unitSymbol: l.orderedPerPiece ? (l.baseUnitSymbol || "pc") : l.unitSymbol` so the snapshot records the base symbol for per-piece lines.

### 8. Main-list sub-case surfacing (FR-7/8/9) — [replenishment/page.tsx](../../app/(authenticated)/replenishment/page.tsx)
- Add predicates: `rawNeed(item, period) = item.dailySalesRate*(period+item.supplierLeadTime) - effective`; `isVisible = rawNeed > 0`; `isSubCase = isVisible && computeSuggestion(...) === 0` (only under round-down). Standard uses `effective = availableStock + incoming`; Stockout uses `effective = 0`.
- Replace the current `computeSuggestion(...) > 0` visible-filter everywhere it gates row/group visibility and select-all math (`standardAllVisibleSkus`, `toggleStandardGroup`, `mfgGroupsWithVisible`, and the Stockout equivalents) with `isVisible`, so sub-case rows appear and participate consistently in group/mfg tri-state + counts.
- **Default unchecked (FR-9):** in `fetchGroups`, seed `selectedStandard` with only the **non-sub-case** visible skus (all other rows keep default-checked). Stockout is already opt-in (default unchecked) — no change to its default, just surface the rows.
- **Render (FR-8):** in the Suggested-Order cell, when `isSubCase` render a `Badge` **"<1 cs"** instead of the numeric `0`. Rows keep the existing DOS-ascending sort within their mfg sub-group.
- A sub-case line left in cases carries qty 0 and is dropped on submit (existing `quantity > 0` filter, FR-10) — to order it the admin checks it, Generates, and per-pieces it on Review.

### 9. No persistence (per developer decision) — [replenishment/page.tsx](../../app/(authenticated)/replenishment/page.tsx)
- **Do not add any `localStorage` draft for per-piece.** Per-piece is transient in-memory `poLines` state only.
- Every Generate PO rebuilds `poLines` with `orderedPerPiece: false` on all lines (§7), so a new run — including a later run for the same location + supplier set — always starts in cases and never remembers which items were per-pieced. A page reload wipes `poLines` for the same reason.
- This mirrors the existing Review screen, which persists nothing (quantity overrides already reset on reload). No cleanup/read/write code is needed.

## Risks & Open Questions
- **ActiveOne mixed-unit PO validity (PRD Open Q / §9):** confirm against real ActiveOne data that a single `purchase_order` holding both case-unit and piece-unit lines bills/displays correctly before trusting the write — a build precondition, consistent with the memory note that app "constants" (PO status, factor) have been wrong before. Verify `BASE_UNIT_ID`, `item.COST` (per base), and the per-piece `RATE = COST` on real lines.
- **`suggestedQty` staleness on period/rounding change** is pre-existing (the snapshot captures `suggestedQty` at Generate while the Review "Suggested" cell recomputes live). This plan makes the per-piece toggle update `suggestedQty`; it deliberately does **not** change the existing period/rounding behavior (out of scope).
- **Select-all / tri-state math** touches many call sites that currently share the `computeSuggestion(...) > 0` filter — the `isVisible`/`isSubCase` swap must be applied uniformly (list render, group/mfg toggles, counts, `handleGeneratePO`) or counts and checkboxes will drift. Highest-risk edit; verify group/mfg indeterminate states with a mix of orderable + sub-case rows.
- **Draft key stability:** `supplierIdsParam` is the raw query string; if the same suppliers can arrive in different orders the key won't match. Low risk (the supplier chain preserves order), but normalize (sort) if needed.
- **Lint:** any new badge/indicator must use semantic tokens (no raw palette/hex), and any tap animation must be `motion-safe:` gated — the build fails otherwise.
