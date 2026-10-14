# PRD: Supplier Purchase Order Print Report
Date: 2026-08-29

## 1. Overview
The replenishment module creates Purchase Orders in ActiveOne (one PO per supplier+manufacturer combination). Users need a clean, supplier-facing printable PO document showing only the essential line details: SKU, description, unit of measure, and quantity. This document is sent to suppliers via email or printed and mailed. Currently users manually recreate POs in Word/Excel from the audit report — a time-consuming, error-prone process.

## 2. Goals
- Produce a formal, supplier-ready Purchase Order document per PO (supplier+manufacturer).
- Show only: PO header (company, PO number, date, supplier), line items (SKU, description, UoM, qty), and footer (terms).
- Hide all internal decision data (sales rate, DOS, suggested vs final, overrides, safety stock, etc.).
- Print reliably on mono/laser printers — no color dependency.
- Available in two places:
  1. **History module** — "Print PO" button per PO on the run detail page.
  2. **Replenishment summary screen** — "Print PO" button per PO on the "Purchase Orders Created" screen after submit/approve.
- Reuse the existing print-stylesheet pattern from the replenishment history audit report.

## 3. Non-Goals
- No dedicated print route or second layout — same page, print stylesheet only (`@media print`).
- No changes to the on-screen presentation.
- No PDF generation server-side — browser print-to-PDF only.
- No email integration (future).
- No supplier address/contact from ActiveOne yet (deferred — PO document uses supplier name only for v1).
- No company address/phone/email from app_settings yet (uses existing `company_name` only for v1).

## 4. Users & Roles
- **Admin only** (History module is admin-gated via `role === "admin"` in middleware).
- **Staff with `module.replenishment` permission** can access the summary screen after submit/approve.
- The person printing is the currently authenticated user; their identity is stamped as "Printed by" on the PO.

## 5. Functional Requirements

### FR-1: Per-PO printable document in History
- On `/history/replenishment/[runId]`, each PO section (supplier+manufacturer) gets a "Print PO" button.
- Clicking opens browser print dialog rendering the print-only PO layout.
- One PO per document (not the whole run).

### FR-2: Per-PO printable document on Summary screen
- On the "Purchase Orders Created" screen (after submit/approve), each PO row gets a "Print PO" button.
- Same print layout as History.

### FR-3: Print layout — Document header (page one)
- Company name (from `app_settings.company_name`, fallback "Operations Hub").
- "Purchase Order" title with PO number prominent.
- PO date (Asia/Manila).
- Supplier name.
- Manufacturer name (or "No Brand").
- "Printed on {date/time} by {current user}" line.

### FR-4: Print layout — Line table
Columns: **SKU**, **Description**, **UoM**, **Qty**.
- SKU = `itemCode` (barcode).
- Description = `itemDescription`.
- UoM = `unitSymbol` (purchase unit symbol, e.g., "cs", "pk", "pc").
- Qty = `finalQty` (for split/per-piece lines: cases + pieces shown as "X cs + Y pc" or two rows? — v1: show combined as "X cs + Y pc" in Qty column).

### FR-5: Print layout — Footer
- Standard terms: "Payment Terms: Net 30. Please confirm receipt." (hardcoded for v1, configurable later).
- Page numbering: "Page X of Y" + PO number.

### FR-6: Technical — Print stylesheet
- Landscape orientation (`@page { size: landscape }`).
- Monochrome: black text on white, no backgrounds/fills.
- Hide all app chrome (header, nav, buttons) in print media.
- Table headers repeat on page break (`thead { display: table-header-group }`).
- No row splitting across pages (`tr { break-inside: avoid }`).

### FR-7: Split/per-piece lines
- Lines with `orderedPerPiece = true` and `pieceQty > 0` display as: `{quantity} cs + {pieceQty} pc` in the Qty column.
- Lines with `orderedPerPiece = true` and `pieceQty = 0` display as `{quantity} cs`.

## 6. Data Model
No new tables/columns. Uses existing `ReplenishmentRunDetail` snapshot:
- `run.pos[n].poCode` — PO number.
- `run.pos[n].supplierName` — Supplier.
- `run.pos[n].manufacturerName` — Manufacturer (nullable → "No Brand").
- `run.pos[n].lines[m].itemCode` — SKU.
- `run.pos[n].lines[m].itemDescription` — Description.
- `run.pos[n].lines[m].unitSymbol` — Purchase unit symbol.
- `run.pos[n].lines[m].finalQty` — Final ordered quantity (cases).
- `run.pos[n].lines[m].pieceQty` — Remainder pieces (for per-piece lines).
- `run.pos[n].lines[m].orderedPerPiece` — Boolean.
- `run.createdAt` — Run timestamp (used as PO date).
- Company name from existing `/login/api` call.
- Printed-by from session user name.

## 7. API Contract
No new endpoints. The run snapshot continues to load from existing `GET /history/replenishment/api/[runId]`. The summary screen already has PO results from `POST /replenishment/api/po` response.

## 8. UI/UX Flow

### History (run detail)
1. Admin opens a run at `/history/replenishment/[runId]`.
2. Each PO section shows a "Print PO" button (screen-only).
3. Click → sets `printedAt` → `window.print()` → print dialog shows PO document.
4. Print/save to PDF → returns to screen.

### Summary screen (after submit/approve)
1. User submits/approves run → lands on "Purchase Orders Created" screen.
2. Each PO row (grouped by supplier+manufacturer) shows a "Print PO" button.
3. Same flow as above.

## 9. Edge Cases & Error Handling
- **PO with zero lines** — still prints valid header + "No items" row.
- **Company name missing** — fallback "Operations Hub".
- **Print invoked while loading** — button disabled until data loaded.
- **Very long descriptions** — wrap within cell; row must not split.
- **Stockout runs** — same PO layout (POs created from stockout path also need supplier-facing docs).

## 10. Open Questions
- None — v1 scope is clear and minimal.

## 11. Out of Scope / Deferred
- Supplier address/contact from ActiveOne Contact table.
- Company address/phone/email from app_settings.
- Configurable terms & conditions.
- Batch print all POs for a run.
- Email integration.
- Server-side PDF generation.