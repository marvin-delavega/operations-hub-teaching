# PRD: Replenishment Worksheet (Printable Pre-Order Review)
Date: 2026-07-19

## 1. Overview

A printable **Replenishment Worksheet** generated from the **live Standard replenishment run, before any PO is created**. It lists **every active item** for the selected suppliers — including items the system suggests **0** for and items with **no recent sales** — so an admin can review the full picture on paper, handwrite order-quantity decisions (notably ordering a case or two for 0-qty items), and hand it back to staff. Staff then adjust the on-screen quantities and submit the PO as usual. **Standard tab only.** The worksheet is an **ephemeral client-side print artifact**: it is not persisted and creates no history record — the history record is still written later, when the PO is submitted.

This closes the workflow gap: printing today only exists in the History module (populated *after* a PO commits), but this process needs a printout *before* ordering, showing the 0-qty candidates the admin decides on.

## 2. Goals

- From the live Standard run (pre-PO), let staff print a worksheet covering **all active items** for the selected suppliers, grouped **supplier → manufacturer**.
- Surface **0-qty items** (adequate stock, rounded-to-zero) **and zero-sales/dormant items inline**, with a clear marker on every row suggesting 0, so the admin sees exactly where a manual decision is needed.
- Provide a blank **"Order Qty"** column for handwriting decisions.
- Reuse the existing print conventions (monochrome-safe, repeating running header/footer, hidden app chrome) adapted to **portrait**, **new-page-per-supplier**.
- No new permission — available to anyone already on the Standard run.

## 3. Non-Goals

- **Not** for the Stockout tab.
- **No persistence** — no history record, no audit log of worksheet prints.
- **No digital capture** of the admin's handwritten decisions — staff transcribes them manually into the run.
- **No change** to the live on-screen list behavior or to the global "show all items" (`ordering_show_zero_qty_items`) setting.
- **No CSV export** of the worksheet (print only).
- **No sign-off / signature block.**
- **No selection-state cue** (checked vs unchecked) on the printout.

## 4. Users & Roles

- Any authenticated user holding **`module.replenishment`** (already required to reach the Standard run) can print the worksheet — typically floor staff. **No additional RBAC gate.**
- The annotating admin acts off-system (on paper); no app role is involved in annotation.

## 5. Functional Requirements

- **FR-1** — A **"Print Worksheet"** button appears in the Standard run action row (near Expand All / Select All), **Standard tab only**, secondary style. Absent on the Stockout tab.
- **FR-2** — Clicking it **always** performs a dedicated **full-catalog fetch** for the current location + selected suppliers + selected manufacturers, returning **all active items** regardless of sales, need, or rounding outcome. (It cannot reuse the on-screen rows, which never include zero-sales items — see §7.)
- **FR-3** — While fetching, the button shows a loading state; on success the browser **print dialog opens automatically**. On fetch failure, show an inline error and do **not** open the print dialog.
- **FR-4** — The worksheet includes **every returned item — checked and unchecked alike** (selection state is ignored).
- **FR-5** — Items are grouped **supplier → manufacturer sub-group**, matching the on-screen structure. Within a sub-group, items sort **alphabetically by description**; the **"No Brand"** (null manufacturer) sub-group is pinned first, then manufacturers alphabetically.
- **FR-6** — Each item row shows, in order: **Description · Unit · On-Hand · Incoming · Sales Rate (daily) · DOS · Suggested · [blank Order Qty]**.
- **FR-7** — The **Suggested** value is the **rounded integer** suggestion, computed with the sub-group's **currently selected order period** and the run's **global rounding**. Partial cases round to **1** under round-up and to **0** under round-down; no raw fractional value is shown.
- **FR-8** — Any row whose **Suggested is 0** (adequate stock, rounded-to-zero, or zero-sales) carries a **monochrome typographic marker**, explained in a legend/footnote.
- **FR-9** — **Zero-sales / dormant items appear inline** with Sales Rate **0**, DOS shown as **"—"**, Suggested **0**, and the 0-qty marker.
- **FR-10** — **Each supplier section starts on a new page.** Each **manufacturer sub-group header** shows that sub-group's **order period**. Table column headers **repeat on page breaks**; avoid splitting a row across a page break where feasible.
- **FR-11** — The **document header** shows: worksheet title, **company name**, **location**, **selected suppliers**, **sales date range (From → To)**, **global order period** (the default), **rounding**, **printed-by** (current user), **printed-at** (Asia/Manila).
- **FR-12** — Orientation is **portrait**; output is **monochrome-safe** (no meaning conveyed by color alone).
- **FR-13** — Printing has **no side effects** on app state or ActiveOne; the worksheet is not saved.
- **FR-14** — App chrome (nav/header/buttons) is **hidden** in the print output; only the worksheet prints.

## 6. Data Model

**No new tables or columns.** The worksheet renders from a transient full-catalog fetch, reusing the existing `ReplenishmentItem` / `SupplierGroup` shapes.

New consideration for **zero-rate items** (no sales in range): `dailySalesRate = 0`; `daysOfSupply` is undefined (division by zero) and must be represented as a **sentinel (e.g., `null`)** rendered as **"—"**, never `Infinity`/`NaN`; `isCritical` is `false`. (Settle the exact type change during planning — see §10.)

All period / due-date math remains **Asia/Manila**, unchanged.

## 7. API Contract

**Reuse** `GET /replenishment/api` — **no new endpoint.**

- Add an optional query param **`worksheet=true`** (full-catalog mode).
- When present, the repository **relaxes all three exclusions**:
  1. the final `WHERE COALESCE(sd.units_sold, 0) > 0` (zero-sales items),
  2. the `if (dailySalesRate === 0) continue;` guard,
  3. the `if (rawOrder <= 0) continue;` guard (already relaxed by `showZeroQty`).
  It returns **every active item** for the selected suppliers, still honoring the existing **manufacturer-pair filter**, **location**, and **selling-area pooling**.
- When absent, behavior is **identical to today** (backward-compatible).
- Response: `{ groups: SupplierGroup[] }`, same shape; zero-rate items carry rate `0` and DOS `null`.
- Threaded through: `api/route.ts` → `GetReplenishmentGroupsUseCase` → `ReplenishmentRepository.getGroups` (+ `SeedReplenishmentRepository` mirror + `ReplenishmentRepository` interface).

## 8. UI/UX Flow

1. Staff is on the Standard run with items loaded (any state of the "show all items" setting).
2. Staff taps **"Print Worksheet."**
3. App fetches the **full catalog** (`worksheet=true`) for the current location / suppliers / manufacturers; button shows a loading state.
4. On success, a hidden **print-only worksheet** is populated and `window.print()` opens the dialog.
5. Staff prints (**portrait, one supplier per page**) and hands the paper to the admin.
6. Admin reviews and **handwrites quantities** in the Order Qty column (especially on 0-marked rows), then returns the sheet.
7. Staff **transcribes** the decisions into the on-screen run (checking 0-qty items, editing qty on the Review screen as today) and **submits the PO** — which creates the normal history record.

**Print layout (per page):** repeating running header/footer · document header (page 1) · supplier section header (name · lead time) · manufacturer sub-group header (name · item count · **this sub-group's order period**) · item table (columns per FR-6) · 0-qty legend/footnote.

## 9. Edge Cases & Error Handling

| Case | Behavior |
|---|---|
| Full-catalog fetch fails / network error | Inline error message; **no** print dialog. |
| Whole run has no active items | Print an overall "No items" note. |
| A supplier has no active items | Section omitted (empty supplier contributes nothing). |
| Zero-rate item DOS | Render **"—"** — never `Infinity`/`NaN`. |
| Mfg sub-group in full catalog but not on screen (no period selected) | Use the **global** order period for its suggestion. |
| Rounding = up | Sub-case items suggest **1** (not marked); expected. |
| Rounding = down | Sub-case items suggest **0** (marked); expected. |
| Run not loaded / missing location or suppliers | "Print Worksheet" button disabled (selection chain already guards the route). |
| Very large catalog (thousands of rows) | Accepted for v1; brief load + per-supplier page breaks. No pagination. |

## 10. Open Questions

- Exact **0-qty marker glyph** and legend wording (design-time, minor).
- Domain representation of `daysOfSupply` for zero-rate items — `null` vs sentinel — to settle in planning (touches the `ReplenishmentItem` type and its renderers).
- Confirm empty-supplier sections are simply omitted (assumed above).

## 11. Out of Scope / Deferred

- Stockout worksheet.
- Persisting/logging worksheet prints; capturing annotations digitally.
- CSV export of the worksheet.
- Sign-off/signature block.
- Per-run "show all items" control (remains a global admin setting).
