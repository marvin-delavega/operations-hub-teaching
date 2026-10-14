# Implementation Plan: Supplier Purchase Order Print Report
Source PRD: docs/specs/PRD-supplier-po-print.md
Date: 2026-08-29

## Summary
Add a supplier-facing printable Purchase Order document to two locations: (1) the History run detail page (`/history/replenishment/[runId]`) with a "Print PO" button per PO section, and (2) the Replenishment summary screen ("Purchase Orders Created") with a "Print PO" button per PO row. The print layout uses a `@media print` stylesheet on the same page (no new routes), showing only PO header (company, PO number, date, supplier, manufacturer), line table (SKU, Description, UoM, Qty with split-line support), and footer (terms + page numbers). Reuses the existing `PrintReport` pattern from the replenishment history audit report.

## Affected Areas

### Modules / layers touched
| Layer | Files to modify |
|-------|-----------------|
| **History page (client)** | `app/(authenticated)/history/replenishment/[runId]/page.tsx` — add per-PO print button + print stylesheet + PO-specific print component |
| **Replenishment page (client)** | `app/(authenticated)/replenishment/page.tsx` — add per-PO print button on summary screen + shared print component |
| **Shared UI (new)** | `app/shared/ui/POPrintReport.tsx` — reusable print-only component for supplier-facing PO |

### Shared code reused
- `app/(authenticated)/history/replenishment/[runId]/page.tsx` — existing `PrintReport` component, `toManilaDatetime`, `formatManilaDatetime`, print stylesheet pattern, `companyName`/`printedByName` fetch logic.
- `app/(authenticated)/replenishment/page.tsx` — existing `today()`, `formatPeso`, PO result grouping logic on summary screen.
- `app/shared/ui/utils.ts` — `cn()` for class composition.
- `app/shared/ui/button.tsx` — `Button` component for print buttons.

### DB tables / columns
**No changes.** Uses existing `ReplenishmentRunDetail` snapshot from `GET /history/replenishment/api/[runId]`:
- `ReplenishmentRunPoDetail`: `poCode`, `supplierName`, `manufacturerName`, `lines[]`
- `ReplenishmentRunLineDetail`: `itemCode`, `itemDescription`, `unitSymbol`, `finalQty`, `pieceQty`, `orderedPerPiece`
- Run-level: `createdAt` (PO date), `locationName`

Summary screen uses `PurchaseOrderResult` from `POST /replenishment/api/po` response:
- `poNumber`, `supplierName`, `manufacturerName`, `itemCount`

### container.ts factories
**None** — no new server-side logic needed. Print is purely client-side rendering of already-fetched data.

## Decisions

### Resolved by AI
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Print component location | New shared component `app/shared/ui/POPrintReport.tsx` | Avoids duplication between History and Replenishment pages; follows "reuse-first" principle from CLAUDE.md |
| Split line display | Combined: "X cs + Y pc" in Qty column | Single row per line item matches supplier expectation; avoids confusing double-rows |
| Print trigger | `window.print()` via `beforeprint` listener (same as History audit report) | Proven pattern; ensures `printedAt` timestamp is current |
| PO date source | `run.createdAt` (run timestamp) | Already in snapshot; matches PO creation time |
| Terms & conditions | Hardcoded string for v1 | PRD defers configurable terms; minimal scope |
| Supplier address | Deferred (supplier name only) | PRD defers ActiveOne Contact join; no API change needed |
| Company details | `company_name` only (from `/login/api`) | PRD defers additional app_settings fields; matches existing pattern |

### Assumptions
- The `PurchaseOrderResult` on the summary screen has all data needed for PO header (poNumber, supplierName, manufacturerName). Line items are NOT available on summary screen — print from summary will need to fetch the run detail or use a different approach. **Correction**: The summary screen only has `itemCount`, not line details. Printing from summary requires either: (a) navigating to History, or (b) storing line data in the draft/snapshot. For v1, **Print PO on summary screen will navigate to History run detail and trigger print there** — simplest, no data duplication. Or we can add a new API to fetch PO lines by poCode. Let me reconsider...

Actually, looking at the code: the summary screen groups `poResults` by supplier, showing manufacturer + poNumber + itemCount. It does NOT have line items. The run detail in History HAS all line items. 

**Decision**: For the summary screen "Print PO" button, we'll open the History run detail page in a new tab with a `print=po&poCode=X` parameter that auto-triggers print. This reuses the full line data from History. Simpler than new API or localStorage transfer.

Wait, but the summary screen doesn't know the `runId` — it only has `poResults` with `poNumber`. The `runId` is not in `PurchaseOrderResult`. 

Looking at `ReplenishmentRunPoDetail` in History: it has `poCode` (which is the PO number). So we can match by `poCode` = `poNumber`.

**Revised approach for Summary screen**: When user clicks "Print PO" on summary, we need to find which run this PO belongs to. Options:
1. Add `runId` to `PurchaseOrderResult` (API change)
2. Search history for the PO code (new API)
3. Store the runId in localStorage when submitting

Option 1 is cleanest — add `runId` to `PurchaseOrderResult` in the use case + API response. Minimal change.

Actually, let me check the use case output...

Looking at `CreatePurchaseOrdersUseCase` output → `PurchaseOrderResult` interface in `domain/PurchaseOrder.ts` — it has `supplierId`, `supplierName`, `poNumber`, `itemCount`, `manufacturerName`. No `runId`.

The run is created in `CommitDeliveryUseCase` or similar? No, for replenishment the run is created when the draft is saved/approved. The `CreatePurchaseOrdersUseCase` creates POs and returns results. The run is created separately (when saving draft or approving).

Actually, looking at the replenishment page: `submitPO()` calls `CreatePurchaseOrdersUseCase`, gets `pos` (PurchaseOrderResult[]), then shows summary. The run is created when the draft is saved (`SaveReplenishmentDraftUseCase`) or when approved (`ApproveReplenishmentDraftUseCase`). The run ID exists before PO creation.

So we CAN pass the runId to the use case and include it in the result. This is a small, clean change.

**Final decision**: Add `runId` to `PurchaseOrderResult` and include it in the summary screen so "Print PO" can navigate to `/history/replenishment/${runId}?printPo=${poCode}`.

## Implementation Steps

### Step 1: Add `runId` to PurchaseOrderResult (domain + application)
- **File**: `app/(authenticated)/replenishment/domain/PurchaseOrder.ts`
- **Change**: Add `runId?: number` to `PurchaseOrderResult` interface.
- **File**: `app/(authenticated)/replenishment/application/CreatePurchaseOrdersUseCase.ts`
- **Change**: Accept `runId` in `execute()` input, include in returned `PurchaseOrderResult[]`.
- **File**: `app/(authenticated)/replenishment/api/po/route.ts`
- **Change**: Pass `runId` from request body (added by page) to use case.
- **File**: `app/(authenticated)/replenishment/page.tsx`
- **Change**: Include `runId` in POST body (from draft save response or URL param).

### Step 2: Create shared PO print component
- **File**: `app/shared/ui/POPrintReport.tsx` (new)
- **Props**: `{ poCode, supplierName, manufacturerName, lines[], companyName, printedByName, printedAt, poDate }`
- **Lines**: Array of `{ itemCode, itemDescription, unitSymbol, finalQty, pieceQty, orderedPerPiece }`
- **Render**: Print-only (`hidden print:block`) component with:
  - Document header: company name, "Purchase Order", PO code, PO date, supplier, manufacturer, printed-by line.
  - Table: SKU | Description | UoM | Qty (with "X cs + Y pc" for split lines).
  - Footer: Terms + "Page X of Y" + PO code.
  - Print stylesheet: landscape, monochrome, repeating headers, no row splits.
- **Pattern**: Mirrors `PrintReport` in `history/replenishment/[runId]/page.tsx` but simplified columns.

### Step 3: Add PO print to History run detail page
- **File**: `app/(authenticated)/history/replenishment/[runId]/page.tsx`
- **Changes**:
  1. Add `printPoCode` state (string | null) — which PO to print.
  2. Add `handlePrintPo(poCode)` — sets `printPoCode`, `printedAt`, calls `window.print()`.
  3. Add URL param handling: if `searchParams.get('printPo')` on mount, auto-trigger print for that PO.
  4. In `RunLinesTable` PO header row: add "Print PO" button (screen-only) per PO section.
  5. Import and render `<POPrintReport>` conditionally when `printPoCode` matches a PO.
  6. Add print stylesheet for PO (can share most CSS with existing audit report; just different column widths).

### Step 4: Add PO print to Replenishment summary screen
- **File**: `app/(authenticated)/replenishment/page.tsx`
- **Changes**:
  1. In summary screen render (`screen === "summary"`), add "Print PO" button per PO row in the results table.
  2. Button onClick: `router.push(\`/history/replenishment/${runId}?printPo=${poNumber}\`)` (opens in new tab via `target="_blank"` or `window.open`).
  3. Need `runId` available — passed via props or state from submit/save draft response.

### Step 5: Verify and lint
- Run `npm run lint` — ensure no raw Tailwind colors, semantic tokens only.
- Run `npx tsc --noEmit` — type check passes.
- Test in browser: History print, Summary print navigation, print preview renders correctly.

## Risks & Open Questions

1. **Summary screen runId availability** — The summary screen receives `poResults` from `submitPO()` / `saveDraft()`. Need to ensure `runId` is captured and passed. The draft save returns success but not runId; approve returns refreshed run. May need to fetch runId from URL or store in state after draft save.

2. **Print stylesheet isolation** — The PO print stylesheet must not interfere with the existing audit report print stylesheet on the same page. Use distinct class prefixes (`.po-print-` vs `.print-`) and ensure `@media print` rules don't conflict.

3. **Split line qty display** — "X cs + Y pc" format: need to confirm `unitSymbol` is the case symbol (e.g., "cs") and base unit is "pc". The `baseUnitSymbol` field exists on lines but may be empty. Default to "pc" if missing.

4. **Manufacturer "No Brand" display** — Use "No Brand" when `manufacturerName` is null (consistent with existing UI).

5. **PO date timezone** — `run.createdAt` is UTC ISO string; display in Asia/Manila via `toManilaDatetime` (already used in History).