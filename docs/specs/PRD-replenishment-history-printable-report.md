# PRD: Replenishment History Printable Report
Date: 2026-07-01

## 1. Overview
The replenishment history run-detail page (`/history/replenishment/[runId]`) currently prints by calling `window.print()` on the live screen, so the app header, avatar, nav link, action buttons, and screen-tinted rows all bleed onto paper — a screenshot, not a document. This feature replaces that with a proper, print-only layout, driven by a print stylesheet on the same page, that produces a clean landscape audit document of an immutable replenishment run snapshot.

## 2. Goals
- Produce a filable, self-explanatory audit document from an existing run snapshot — no new data captured.
- Prove *why* the run's quantities were chosen: keep the decision columns (sales rate, DOS, effective stock, suggested vs final, overrides).
- Print reliably on mono/laser printers and photocopies — never depend on color to convey meaning.
- Keep the on-screen page unchanged; the report is realized entirely through a print stylesheet.
- Support both Standard and Stockout runs with their respective column sets.

## 3. Non-Goals
- No dedicated print route or second layout to maintain — same page, print stylesheet only.
- No changes to the on-screen (screen-media) presentation of the detail page.
- No changes to the CSV export.
- No purchasing-worksheet variant; this report is audit/recordkeeping oriented.
- No sign-off/signature block.
- No re-computation or display of the critical flag (lead time isn't in the snapshot) beyond the DOS value already stored.
- No printing from the history *list* page — detail page only.
- No new persisted fields, tables, or API changes.

## 4. Users & Roles
- **Admin only.** The `history` module is admin-gated (`role === "admin"`, enforced in `middleware.ts`). The printable report inherits that gate — no separate permission.
- The person printing is the currently authenticated admin; their identity is stamped on the report as the "printed by" party.

## 5. Functional Requirements
- **FR-1** — Tapping "Print" on `/history/replenishment/[runId]` opens the browser print dialog rendering the print-only report layout (via `@media print`), not the screen layout.
- **FR-2** — In print media, all interactive/app chrome is hidden: the app header (company·Ops Hub, avatar), the "← Replenishment History" nav link, and the "Print" / "Export CSV" buttons.
- **FR-3** — The report uses **landscape** orientation (`@page { size: landscape }`).
- **FR-4** — The report renders in **monochrome-safe** styling: black text on white, no background tints/fills, no reliance on color to convey status. The Standard/Stockout path is shown as a **plain text label**, not a colored badge.
- **FR-5** — **Document header (page one)** contains, in order:
  - Report title: "Replenishment Run Report" with the path in plain text (e.g. "Replenishment Run Report — Stockout").
  - Company name (from `app_settings.company_name`, same source as page titles; fallback "Operations Hub").
  - Run reference / run ID, printed prominently for filing.
  - Existing run metadata: location name, run timestamp, created-by, rounding, sales range (Standard only), PO count.
  - A "Printed on {date/time} by {current user}" line, distinct from the run timestamp.
- **FR-6** — **Running header (every page)** repeats the report title and the run reference at the top of each printed page.
- **FR-7** — **Footer (every page)** shows "Page X of Y" and the run reference.
- **FR-8** — Each PO renders as a section with its PO code, supplier name, and manufacturer name (or "No Brand"), followed by its line table.
- **FR-9** — **Standard** line columns: Item, Unit, Sales Rate, Shelf Demand, Effective Stock, DOS, Suggested, Final Qty. **Stockout** line columns: Item, Unit, Last Sold, 30d Rate, Window Units, Suggested, Final Qty.
- **FR-10** — An **overridden line** (final ≠ suggested) is signaled **typographically only**: the Final Qty is bold and carries an asterisk marker; no color/fill. A footnote explains the marker ("* overridden from system suggestion").
- **FR-11** — **Per-PO subtotal**: the foot of each PO table shows the total Final-Qty units for that PO.
- **FR-12** — **Run grand total**: at the end of the report, show total line count, total Final-Qty units across all POs, and count of overridden lines.
- **FR-13** — **Shelf demand** (Standard) prints as the pooled number only; contributing selling-area names are **not** shown on the report (the on-screen tooltip is intentionally dropped in print).
- **FR-14** — **No row is split** across a page break, and **column headers repeat** at the top of each continuation of a table.
- **FR-15** — **PO block-break control**: a PO's section header is never stranded alone at the bottom of a page (kept with at least its first data row), and a PO's subtotal row is never stranded alone at the top of a fresh page.
- **FR-16** — **Empty run**: a run with zero lines still produces a valid one-page report (full header + a "No lines in this run" statement + footer).
- **FR-17** — All timestamps and dates on the report render in **Asia/Manila**, consistent with the rest of the history module.

## 6. Data Model
No changes. The report is a pure presentation of the existing `ReplenishmentRunDetail` snapshot (`app/(authenticated)/history/domain/ReplenishmentRunSummary.ts`):
- Run-level: `id`, `path`, `locationName`, `createdByName`, `createdAt`, `rounding`, `salesRangeFrom/To`, `pos[]`.
- PO-level: `poCode`, `supplierName`, `manufacturerName`, `lines[]`.
- Line-level: `itemDescription`, `unitSymbol`, `orderPeriodDays`, `salesRate`, `sellingAreaDemand`, `effectiveAvailable`, `dos`, `suggestedQty`, `finalQty`, `lastSoldDate`, `stockoutDailyRate`, `stockoutWindowUnits`.

New values are **derived at render time**, not stored:
- Per-PO subtotal = sum of `finalQty` over the PO's lines.
- Grand totals = line count, sum of `finalQty`, count of lines where `finalQty !== suggestedQty` across all POs.
- Company name = existing `app_settings.company_name` read already available to the layout.
- Printed-by = the current session user's display name; printed-on = client print time (Asia/Manila).

## 7. API Contract
No new endpoints and no changes to existing ones. The run snapshot continues to load from the existing `GET /history/replenishment/api/[runId]` returning `ReplenishmentRunDetail`. Company name and current-user identity come from context already available to the authenticated page/layout.

## 8. UI/UX Flow
1. Admin opens a run at `/history/replenishment/[runId]`; the screen view is unchanged.
2. Admin taps **Print** (screen-only button).
3. The browser print dialog opens; the preview shows the print-only report (landscape, monochrome, chrome hidden).
4. **Page one** leads with the document header (title + path, company name, prominent run reference, run metadata, printed-on/by line), then the PO sections.
5. Each **PO section**: PO code · supplier · manufacturer, a line table with the path-appropriate columns, and a per-PO Final-Qty subtotal at its foot.
6. Content flows across pages in landscape; table headers repeat on continuation, rows never split, PO headers/subtotals never strand.
7. Every page carries a running header (title + run ref) and a footer (Page X of Y + run ref).
8. After the last PO, a **run grand total** (lines, total units, overridden-line count) and the override footnote appear.
9. Admin prints or saves to PDF via the browser dialog; the on-screen page returns to normal afterward.

## 9. Edge Cases & Error Handling
- **Empty run (0 lines / 0 POs)** — still print a valid one-page report: full header, "No lines in this run", footer (FR-16).
- **Company name missing** — fall back to "Operations Hub" (existing convention).
- **Stockout run** — use the stockout column set; omit the Standard-only sales-range line in the header.
- **Very wide content on narrow paper** — landscape plus mono column set is the mitigation; columns may compress but rows must not split (FR-14).
- **Long item descriptions** — wrap within the cell; the row still must not split across pages (FR-14).
- **Print invoked while page is still loading or errored** — Print is only meaningful once the run is loaded; if data isn't present there's nothing to render (the screen already shows loading/error states).
- **PO with a single line near a page boundary** — block-break control keeps the header + that line together (FR-15).

## 10. Open Questions
- None outstanding. (Critical-flag rendering is explicitly out of scope because lead time isn't in the snapshot; DOS is shown as-is.)

## 11. Out of Scope / Deferred
- Purchasing-worksheet layout variant (order-first, reasoning hidden).
- Sign-off / signature block.
- A top-of-report per-PO summary block (only inline subtotals + grand total are included).
- Contributing selling-area names on the printed report.
- Printing directly from the history list, or batch-printing multiple runs.
- Applying the same print treatment to the delivery-history detail page (could reuse the pattern later).
- A dedicated print route or server-rendered PDF.
