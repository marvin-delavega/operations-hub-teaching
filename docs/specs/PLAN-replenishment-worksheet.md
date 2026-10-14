# Implementation Plan: Replenishment Worksheet

Source PRD: `docs/specs/PRD-replenishment-worksheet.md`

Two workstreams: **(A)** a server `worksheet=true` full-catalog fetch mode, and **(B)** a client print worksheet on the Standard run. Reuse the History print pattern in `app/(authenticated)/history/replenishment/[runId]/page.tsx`.

---

## Part A — Server: `worksheet=true` full-catalog mode

Thread a **trailing optional `worksheet` boolean** through the exact same path as `showAllItems`.

### A1 — `domain/ReplenishmentItem.ts`
- Change `daysOfSupply: number` → **`daysOfSupply: number | null`** (null = no sales rate ⇒ DOS undefined). Consistent with the existing `POLineState.dos: number | null` and history `fmt(n: number | null)`.

### A2 — `domain/ReplenishmentRepository.ts`
- Add trailing optional param **`worksheet?: boolean`** to `getGroups(...)` (after `manufacturerPairs`).

### A3 — `application/GetReplenishmentGroupsUseCase.ts`
- Add **`worksheet = false`** param to `execute(...)` (after `manufacturerPairs`); forward to `repository.getGroups(from, to, locationId, supplierIds, sellingAreaIds, showAllItems, manufacturerPairs, worksheet)`.

### A4 — `infrastructure/MySQLReplenishmentRepository.ts`
- `getGroups(...)` — add **`worksheet = false`** param.
- **`buildCandidatesSQL`** — add a `worksheet` arg; when true, **drop the `COALESCE(sd.units_sold, 0) > 0` predicate** from the final `WHERE` (keep the manufacturer clause). Effective WHERE becomes the manufacturer clause alone (or `1=1` when absent). This is the change that admits zero-sales items.
- Row loop (currently lines ~210–261):
  - `if (dailySalesRate === 0) continue;` → **`if (!worksheet && dailySalesRate === 0) continue;`**
  - `if (!showAllItems) { rawOrder … }` → **`if (!showAllItems && !worksheet) { rawOrder … }`**
  - DOS: **`const daysOfSupply = dailySalesRate > 0 ? Math.round((effectiveAvailable / dailySalesRate) * 10) / 10 : null;`**
  - Critical: **`isCritical: daysOfSupply !== null && daysOfSupply < leadTime,`** (prevents `null < leadTime` → coerced `0 < leadTime` false-positive).
- Alphabetical description sort already present — unchanged.

### A5 — `infrastructure/SeedReplenishmentRepository.ts`
- Mirror A4: add `worksheet = false`; skip the zero-rate + rawOrder exclusions when `worksheet`; `daysOfSupply` null + `isCritical` guard for zero-rate rows. (Keeps the seed path type-parity even if seed data has no zero-sales rows.)

### A6 — `api/route.ts`
- Parse **`const worksheet = searchParams.get("worksheet") === "true";`**
- Pass as the new trailing arg to `createGetReplenishmentGroupsUseCase().execute(…, manufacturerPairs, worksheet)`.
- Due-status / min-order enrichment (lines 59–71) unchanged.

### A7 — `page.tsx` main-list DOS cell (line ~2161)
- Null-safe render: **`{item.daysOfSupply ?? "—"}`** (normal path never yields null; satisfies the widened type).

---

## Part B — Client: Print Worksheet on the Standard run (`replenishment/page.tsx`)

### B1 — State (inside `ReplenishmentContent`)
- `worksheetGroups: SupplierGroup[] | null` (transient full-catalog result — **separate** from `groups`; never overwrites the live list).
- `worksheetLoading: boolean`, `worksheetError: string | null`, `worksheetPrintedAt: Date | null`, `pendingPrint: boolean`.
- `companyName` (default `"Operations Hub"`), `printedByName` (default `""`).

### B2 — Mount effects (mirror History detail page)
- `useEffect` → `fetch("/login/api")` → set `companyName` from `data.companyName`.
- `useEffect` → `getSession()` (import from `next-auth/react`) → set `printedByName` from `session.user.name`.

### B3 — `handlePrintWorksheet()`
- Guard: `locationId && supplierIdsParam && !worksheetLoading`.
- Build `URLSearchParams` exactly like `fetchGroups` (`from: appliedFrom`, `to: appliedTo`, `locationId`, `supplierIds`, `manufacturerIds` if present) **plus `worksheet=true`**. (Always fetch — final decision; do not reuse `groups`.)
- `setWorksheetLoading(true)`, clear error → `fetch("/replenishment/api?…")` → on ok: `setWorksheetGroups(data.groups ?? [])`, `setWorksheetPrintedAt(new Date())`, `setPendingPrint(true)`; on error: `setWorksheetError(…)`. `finally` → `setWorksheetLoading(false)`.
- `useEffect([worksheetGroups, pendingPrint])`: when `pendingPrint && worksheetGroups !== null` → `requestAnimationFrame(() => { window.print(); setPendingPrint(false); })` (guarantees the hidden print DOM is painted first).

### B4 — "Print Worksheet" button
- In the Standard action row (block at ~1838–1851, gated `!loading && groups.length > 0`): add a right-aligned **secondary** `Button` "Print Worksheet" (Standard tab only). Disabled while `worksheetLoading` or `groups.length === 0`; show a spinner/label while loading. Render `worksheetError` as an inline `type-label text-warning` line when set.

### B5 — `WorksheetReport` print component (in-file, like `PrintReport`)
- Root `<div className="hidden print:block worksheet-report">`.
- **Doc header:** title "Replenishment Worksheet" · `companyName` · location (`locationName`) · suppliers (names from `worksheetGroups`) · sales range `appliedFrom → appliedTo` · global order period (`globalPeriod`) · rounding (`globalRoundUp`) · "Printed on {printedAt} by {printedByName}".
- **Per supplier** (`worksheetGroups`, skip empty): a `<section className="worksheet-supplier">` (new page each). Supplier header: name · `leadTimeDays`d lead time.
  - `groupByMfg(group.items)` → per manufacturer sub-group: header `name ?? "No Brand"` · item count · **`getMfgPeriod(supplierId, manufacturerId)`** period label. Sub-groups not previously on screen fall back to `globalPeriod` automatically.
  - Table columns: **Description · Unit · On-Hand · Incoming · Sales Rate · DOS · Suggested · Order Qty (blank)**.
  - Per row: `effective = availableStock + incoming`; `suggested = computeSuggestion(dailySalesRate, period, supplierLeadTime, effective, globalRoundUp)`; `isZero = suggested === 0`; DOS display `dailySalesRate > 0 ? daysOfSupply?.toFixed(1) : "—"`. Mark `isZero` rows with a typographic marker (e.g. a leading `●`/`†`); empty Order Qty cell with a light underline sized for handwriting.
- **0-qty legend** footnote; overall "No items" note when everything is empty.

### B6 — Print `<style>` block (adapt History's, portrait)
- `@page { size: portrait; margin: 16mm 10mm; }`
- Hide chrome: `body > * { display: none !important; } body > *:has(.worksheet-report) { display: block !important; } .worksheet-report { display: block !important; }`
- Monochrome: `.worksheet-report * { color:#000 !important; background:transparent !important; }`
- Per-supplier page break: `.worksheet-supplier { break-before: page; } .worksheet-supplier:first-of-type { break-before: auto; }`
- `thead { display: table-header-group; } tr { break-inside: avoid; }`
- Fixed table layout + colgroup so the blank Order Qty column has consistent width; marker + legend styling monochrome.
- (Inline `<style>` @media-print CSS is exempt from the className palette/font-mono lint — History uses the same approach.)

---

## Verification
- `npx tsc --noEmit` + `npm run lint` (authoritative — `next build` hangs in this Windows env per CLAUDE.md; do **not** wait on it).
- Manual (dev server): open a Standard run → **Print Worksheet** → confirm print preview shows **all** items incl. 0-qty and zero-sales rows, portrait, one supplier per page, blank Order Qty column, 0-qty marker + legend, correct header metadata. Confirm the live on-screen list is **unchanged** (no zero-rate rows leak in).

## Notes / risks
- `daysOfSupply` widening is contained to A1/A4/A5/A7; the po-review `dos` path is already `number | null`.
- Worksheet fetch uses its **own** state — zero-rate items never enter `groups`/the main list.
- Always-fetch-on-print (no dynamic reuse) is intentional: the on-screen list can never contain zero-sales items.
