# Implementation Plan: Replenishment History Printable Report
Source PRD: [PRD-replenishment-history-printable-report.md](PRD-replenishment-history-printable-report.md)
Date: 2026-07-01

## Summary
Add a print-only, landscape, monochrome-safe audit layout to the existing replenishment run-detail page ([app/(authenticated)/history/replenishment/[runId]/page.tsx](../../app/(authenticated)/history/replenishment/%5BrunId%5D/page.tsx)). The on-screen view is unchanged; the report is realized entirely through an `@media print` stylesheet on the same page plus a print-only report DOM block (`hidden print:block`) rendered alongside the screen content (which becomes `print:hidden`). No new routes, endpoints, tables, or persisted fields — all report values (per-PO subtotals, grand totals, override count, printed-on/by, company name) are derived at render time from the already-loaded `ReplenishmentRunDetail` plus client-available session/company-name reads.

## Affected Areas
- **Module/layer:** `history` module, UI adapter only — [app/(authenticated)/history/replenishment/[runId]/page.tsx](../../app/(authenticated)/history/replenishment/%5BrunId%5D/page.tsx). This is a `"use client"` page; all work is presentational. No `domain/`, `application/`, `infrastructure/`, `api/`, or `container.ts` changes.
- **Shared code (one small reuse edit):** [app/shared/ui/AppHeader.tsx](../../app/shared/ui/AppHeader.tsx) — add `print:hidden` so the layout-owned app header (company · Ops Hub + avatar) is hidden in print media (FR-2). The header lives in [app/(authenticated)/layout.tsx](../../app/(authenticated)/layout.tsx), outside the page, so the page's own stylesheet cannot reach it; a `print:hidden` utility on the shared component is the minimal, reusable fix and does not alter screen presentation.
- **Client reads reused (no API changes):**
  - Current user's display name (printed-by) — `getSession()` from `next-auth/react`, the same source already used by [app/shared/ui/SessionGuard.tsx](../../app/shared/ui/SessionGuard.tsx). Read `session.user.name`.
  - Company name — existing **public** GET `/login/api` returning `{ companyName }` ([app/(auth)/login/api/route.ts](../../app/(auth)/login/api/route.ts)); reachable while authenticated because middleware treats any path under `/login` as public. Fallback `"Operations Hub"`.
- **DB tables / SQL:** none. No `create-app-tables.sql` change.
- **container.ts factories:** none added/changed.

## Decisions
- **Resolved by developer (AskUserQuestion):** Page-numbering approach → **"Run-ref footer, drop X of Y."** `position: fixed` running header (title + run ref) and footer (run ref) repeat on every printed page; the literal "Page X of Y" of FR-7 is omitted because browsers cannot compute `counter(page)/counter(pages)` outside unsupported `@page` margin boxes, and paged.js is heavier than the PRD intends. This is a conscious deviation from FR-7's page count.
- **Resolved by AI: separate print-only DOM (not restyled screen DOM).** The screen view uses color badges and tinted override rows (`bg-warning/10`, `text-warning`), while the report must be monochrome with a plain-text path label, asterisk-only override marker, subtotals, grand total, and a document header — different enough that a dedicated print block (`hidden print:block`) beside `print:hidden` screen content is cleaner than conditional restyling (satisfies FR-4/FR-10 and PRD §8 without touching screen markup).
- **Resolved by AI: print CSS lives in a `<style>` element inside the page component.** `@page { size: landscape }`, `break-inside`/`break-before`/`break-after` rules, fixed running header/footer, and monochrome resets are raw CSS that Tailwind utilities can't fully express. Keeping them in a page-scoped `<style>` honors CLAUDE.md's "print stylesheet on the same page" and unmounts when navigating away. Tailwind `print:` variants are used for simple show/hide.
- **Resolved by AI: `printedAt` stamped via a `beforeprint` listener.** A `window.addEventListener("beforeprint", ...)` sets `printedAt = new Date()` so both the Print button and native Ctrl+P produce an accurate client print time (PRD §6 "printed-on = client print time"), formatted in Asia/Manila.
- **Assumptions:**
  - The report reuses the exact override rule already in the page: `finalQty !== suggestedQty` (see `LineRow`), for the asterisk marker, footnote, and overridden-line count.
  - Numeric formatting reuses the existing `fmt(n, decimals=2)` and `toManilaDatetime` / `toManilaDate` helpers already in the file (FR-17 Asia/Manila).
  - Per-PO subtotal and grand total sum `finalQty` as integers (final quantities are whole purchase units); line count and overridden count are integer counts.
  - "Effective Stock" / "Shelf Demand" print `fmt(...)` of `effectiveAvailable` / `sellingAreaDemand`, rendering `—` for null exactly as the screen does. Shelf demand prints the pooled number only — `sellingAreaNames` is intentionally not rendered (FR-13).

## Implementation Steps

### 1. Hide the app header in print — [app/shared/ui/AppHeader.tsx](../../app/shared/ui/AppHeader.tsx)
Add `print:hidden` to the `<header>` element's className. One-line change; affects only print media across all pages (intended — app chrome should never print). Fulfills the header half of FR-2.

### 2. Add client reads for company name + current user + print time — [app/(authenticated)/history/replenishment/[runId]/page.tsx](../../app/(authenticated)/history/replenishment/%5BrunId%5D/page.tsx)
In the page component add three pieces of state and effects:
- `companyName` (default `"Operations Hub"`): in a `useEffect`, `fetch("/login/api")` → `{ companyName }`; set to the trimmed value or keep the fallback. Failure keeps the fallback (FR-5 / edge case "company name missing").
- `printedByName` (default `""`): in a `useEffect`, `getSession()` from `next-auth/react`; set `session?.user?.name`.
- `printedAt` (`Date | null`): register `beforeprint`/(optionally `afterprint`) listeners in a `useEffect` that set `printedAt = new Date()` before the dialog opens; clean up on unmount. Also set it in the existing Print button handler as a belt-and-suspenders default.
Import `getSession` from `next-auth/react` (mirrors SessionGuard).

### 3. Add derived report totals (render-time helpers) — same file
Add small pure helpers/inline computations (no new module needed, YAGNI):
- `poSubtotal(po)` = sum of `line.finalQty` over `po.lines` (FR-11).
- Grand totals over `run.pos`: `totalLines` (count of all lines), `totalFinalQty` (sum of `finalQty`), `overriddenCount` (count where `finalQty !== suggestedQty`) (FR-12).
- Reuse existing `run.pos.some(... l.finalQty !== l.suggestedQty)` to decide whether to show the override footnote (FR-10).

### 4. Wrap existing screen content as `print:hidden` — same file
- Add `print:hidden` to the top nav `<div>` containing the "← Replenishment History" `Link` (FR-2).
- Add `print:hidden` to the two `<Button>`s ("Print", "Export CSV") — or their wrapping `<div className="flex gap-2">` (FR-2).
- Add `print:hidden` to the outer `<main>`'s screen render branch, OR wrap the entire screen output (`loading` / `error` / the `run` block) so the whole existing tree disappears in print. Simplest: put `print:hidden` on the `<main>` and render the print report as a **sibling** top-level element (see step 5) so it isn't nested under the hidden main. Keep on-screen markup otherwise untouched (Non-Goal: no screen changes).

### 5. Build the print-only report block — same file, new `PrintReport` component
Render a dedicated report tree, hidden on screen and shown only in print: root `<div className="print-report hidden print:block">`. Render it only when `run` is loaded (Print is only meaningful once loaded — PRD §9). Structure, in order:

- **Running header** (`.print-running-header`, `position: fixed` top via the step-6 stylesheet): report title `"Replenishment Run Report — {Standard|Stockout}"` + run reference (`run.id`, e.g. `Run #{id}`), repeated on every page (FR-6).
- **Document header** (page-one flow content) (FR-5), in order:
  1. Title line: `Replenishment Run Report — {path label}` where path label is the plain text `Standard` / `Stockout` (FR-4 — no badge).
  2. Company name (`companyName`).
  3. Prominent run reference (`Run #{run.id}` / run ID) styled large for filing.
  4. Run metadata: location name (`run.locationName`), run timestamp (`toManilaDatetime(run.createdAt)`), created-by (`run.createdByName`), rounding (`Round up`/`Round down`), sales range (`toManilaDate(from) → toManilaDate(to)`) **Standard only** (omit for stockout, FR-9/§9), PO count (`run.pos.length`).
  5. `Printed on {toManilaDatetime(printedAt)} by {printedByName}` — distinct line (FR-5).
- **PO sections** (`run.pos.map`) (FR-8): each `<section className="print-po">` with a header line `{poCode} · {supplierName} · {manufacturerName ?? "No Brand"}`, then a `<table>`:
  - `<thead>` with path-appropriate columns (FR-9):
    - **Standard:** Item, Unit, Sales Rate, Shelf Demand, Effective Stock, DOS, Suggested, Final Qty.
    - **Stockout:** Item, Unit, Last Sold, 30d Rate, Window Units, Suggested, Final Qty.
  - `<tbody>` one `<tr>` per line, values via `fmt(...)` / `toManilaDate(lastSoldDate)`; Final Qty cell is **bold + `*`** only when overridden (FR-10) — no color/tint classes on the print rows.
  - `<tfoot>` per-PO subtotal row: label + `poSubtotal(po)` in the Final Qty column (FR-11).
- **Empty run** (`run.pos.length === 0`): render the document header + `"No lines in this run"` statement + footer, still a valid one-page report (FR-16).
- **Grand total block** (after the last PO): `Total lines: {totalLines}`, `Total final qty: {totalFinalQty}`, `Overridden lines: {overriddenCount}` (FR-12), followed by the override footnote `"* overridden from system suggestion"` when `overriddenCount > 0` (FR-10).
- **Running footer** (`.print-running-footer`, `position: fixed` bottom): run reference (FR-7, per the developer decision — no "Page X of Y").

### 6. Add the print stylesheet — same file, a `<style>` element in the component
Emit raw CSS gated by `@media print` (rendered once while this route is mounted):
- `@page { size: landscape; margin: <e.g. 14mm 12mm>; }` (FR-3). Reserve top/bottom margin room for the fixed running header/footer.
- Monochrome resets (FR-4): force `color: #000; background: #fff;` on the report; `.print-report *` no background fills; remove borders' color reliance (use black hairline borders). Ensure `print-color-adjust: exact` is **not** needed since we avoid fills.
- `body > *:not(.print-report) { display: none !important; }` **or** rely on the `print:hidden` utilities from steps 1/4 — pick one mechanism (utilities preferred for clarity; the stylesheet then only needs `@page`, running header/footer, and break rules). Keep the app header hidden via step 1.
- Running header/footer: `.print-running-header { position: fixed; top: 0; left: 0; right: 0; }` and `.print-running-footer { position: fixed; bottom: 0; left: 0; right: 0; }` so they repeat on every printed page (FR-6/FR-7).
- Table pagination (FR-14): `table { break-inside: auto; } thead { display: table-header-group; } tr, tfoot { break-inside: avoid; }` — repeats column headers on continuation and never splits a row.
- Block-break control (FR-15): on each `.print-po` header, `break-after: avoid;` (keeps header with first row); on the subtotal `tfoot` row, `break-before: avoid;` (never stranded at page top). Optionally `.print-po { break-inside: auto; }` so long POs may span pages while headers/subtotals stay attached.
- Typography: use the mono font for PO codes / numeric columns consistent with screen (`font-mono` on those cells is fine; it's typographic, not color).

### 7. Verify
- Run `npm run lint` (the config forbids raw palette colors / ungated tap animations; the print block uses no palette colors and no tap animation, so it should pass — but confirm no `bg-blue-*`/hex slipped in).
- Manual print preview (Chrome): Standard run and Stockout run — confirm landscape, chrome hidden, correct column sets, override asterisk+bold (no color), per-PO subtotals, grand total + footnote, running header/footer on multi-page runs, no split rows, headers repeat, empty-run one-pager.

## Risks & Open Questions
- **"Page X of Y" not rendered (accepted deviation).** Per the developer decision, the footer shows the run reference only; true page counting is not achievable with browser print CSS without paged.js. If auditors later require literal page counts, revisit with paged.js or the browser's native footer.
- **`position: fixed` running header/footer overlap.** Fixed elements repeat per page but can overlap flowing content if `@page` margins don't reserve enough space; tune `@page margin` + header/footer heights during the manual print check.
- **`beforeprint` timing.** If a user prints extremely fast after load, `printedAt` may be null on the very first native Ctrl+P; the button handler pre-sets it and the listener covers Ctrl+P, so render `printedAt` defensively (fall back to `new Date()` at render if still null).
- **Company-name read latency.** The `/login/api` fetch resolves after mount; if a user prints in the first moment, the fallback `"Operations Hub"` may briefly show. Acceptable and matches the documented fallback; the fetch is fast and local.
- **Cross-browser break support.** `break-inside/before/after` and `display: table-header-group` are well supported in Chromium (the Android/target runtime) but verify on the actual print target; Firefox honors most but `break-after: avoid` on non-block elements can be flaky.
