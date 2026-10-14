# PRD: Replenishment "Show All Items" Toggle (Standard Only)

**Status:** Draft  
**Author:** AI-assisted  
**Date:** 2026-07-22  
**Priority:** Tier 2 (Convenience / workflow)  
**Depends on:** `admin.ordering` permission key creation, `OrderingTab` admin component creation

---

## 1. Problem Statement

The Standard replenishment run currently displays **only** items whose projected demand exceeds available stock (`rawNeed > 0`). Buyers cannot see what items they are **not** ordering — i.e., items with adequate stock or items that happen to have zero demand in the selected window. This creates a blind spot:

- A buyer cannot distinguish "this item has adequate stock (correctly not ordered)" from "this item was accidentally excluded because of a stale daily rate, a data error, or a date-range misconfiguration."
- During manual override (the buyer unchecks an item they don't want to order), there is no way to confirm which items would have been zero-qty anyway.
- Supervisors who want to review the full catalog position for a supplier cannot see the complete picture in one view.

**Without this feature,** the buyer must guess or cross-reference external reports to understand what was excluded.

---

## 2. Goals & Non-Goals

### Goals

- Allow a buyer to toggle (via a global setting) between the current **need-only view** (`rawNeed > 0`) and a **full-catalog view** showing all items for the selected suppliers.
- In full-catalog view, items with `suggestedQty === 0` appear **grayed out and unchecked** so the buyer can visually distinguish zero-order items from orderable ones.
- The toggle **applies only to the Standard tab** — Stockout is unaffected.
- The setting is persisted in `app_settings` so it survives page reloads and is consistent across buyers (unless overridden per-role in the future).

### Non-Goals

- **Not per-supplier or per-run** — the toggle is a global admin setting for all Standard runs. A per-run opt-in would require UI in the control bar and is deferred as a future enhancement.
- **Not affecting the server-side SQL query for `rawOrder <= 0`** — we will **not** remove the DB filter that excludes items with truly zero sales. Instead, the toggle relaxes the `rawNeed > 0` client-side visibility filter and adds a **separate, less-restrictive API query** to fetch zero-demand items that are active for the supplier. This keeps the default query lean.
- **No "overwrite quantity on zero-qty items" in the main list** — the buyer edits quantities on the Review screen, as they do today for normal items. The toggle merely *surfaces* the zero-qty items so they can be checked and will then appear on the Review screen with quantity 0 (which the buyer can override).
- **No change to bulk selection behavior** — "Select All" selects only items with `suggestedQty > 0` even in full-catalog mode. Zero-qty items must be individually checked.

---

## 3. User Stories

| ID | Story | Priority |
|---|---|---|
| US-1 | As a **buyer**, I want to toggle the Standard replenishment list to show **every item** for the selected suppliers — not just items that need ordering — so I can see the complete catalog picture. | P0 |
| US-2 | As a **buyer**, I want zero-quantity items to appear **grayed out and unchecked** so I can easily distinguish them from orderable items at a glance. | P0 |
| US-3 | As a **buyer**, I want to **individually check** a zero-qty item and have it appear on the Review screen (with quantity = 0, editable) so I can manually place an order for an item that the system decided not to suggest. | P1 |
| US-4 | As an **admin**, I want to configure this toggle via the Admin panel so the setting is persistent and applies globally to all Standard runs. | P1 |
| US-5 | As an **admin**, I want a dedicated **Ordering** admin tab to hold this setting (and future ordering-related settings) so admin settings are logically grouped. | P2 |

---

## 4. Design & Architecture

### 4.1 Setting Storage

A new key in the existing `app_settings` table:

```
Key: ordering_show_zero_qty_items
Type: BOOLEAN (stored as "on" / "off")
Default: "off" (false) — existing behavior preserved.
```

### 4.2 New Permission Key

Add `"admin.ordering"` to the `PermissionKey` type in `app/shared/domain/permissions.ts`.

**Permission catalog entry:**
```typescript
{ key: "admin.ordering", label: "Ordering Settings" }
```

This permissions string will gate:
- The **Ordering tab** in the Admin page (`admin.ordering`)
- The **PUT endpoint** for updating the `ordering_show_zero_qty_items` setting

### 4.3 New Admin Tab: `OrderingTab.tsx`

A new component at `app/(authenticated)/admin/OrderingTab.tsx` with:

- A **Switch** (shadcn/ui `Switch`) labeled *"Show all items in Standard replenishment"*
- A helper description explaining the behavior
- The switch state is loaded from the settings API on mount and saved immediately on toggle (or via a "Save" button, following the existing pattern in `DeliverySettingsCard`)
- Gated by `admin.ordering` permission

### 4.4 Integration Points

#### 4.4.1 Admin Page (`admin/page.tsx`)

- Import and render `<OrderingTab />` in a new `TabsContent value="ordering"` section
- Add `has("admin.ordering") && <TabsTrigger value="ordering">Ordering</TabsTrigger>` to the `TabsList`
- Add `has("admin.ordering") && "ordering"` to the `visibleTabs` array

#### 4.4.2 Settings API (`admin/api/settings/route.ts`)

- **GET**: Read and return `ordering_show_zero_qty_items` in the response
- **PUT**: Accept `ordering_show_zero_qty_items` (boolean), validate, gate with `requirePermission("admin.ordering")`, store as `"on"`/`"off"`
- Existing per-key authorization pattern accommodates this cleanly

#### 4.4.3 Replenishment Page (`replenishment/page.tsx`)

Two changes are needed:

**A. Fetch the setting on mount**

When the component mounts (in `fetchGroups` or a new `useEffect`), fetch `ordering_show_zero_qty_items` from the settings API. Store it as state, e.g. `showZeroQtyItems`. Alternatively, inline it in the `fetchGroups` call by passing it as a query param to the API. But the simpler approach: add a parallel fetch.

**B. Relax the client-side visibility filter**

Currently, `mfgGroupsWithVisible` and `standardAllVisibleSkus` filter with:

```typescript
item.dailySalesRate * (period + item.supplierLeadTime) - effective > 0
```

When `showZeroQtyItems` is `true`, this predicate should become:

```typescript
true  // show all items regardless of rawNeed
```

However, the **server-side API** already filters out items with `rawOrder <= 0` (at `MAX_ORDER_PERIOD` in the repo). To surface those items, we need the server to return them too.

**Approach: Server-side flag + client-side filter relaxation**

- The API route `/replenishment/api` accepts a new optional query param `showZeroQty=true`
- When set, the `MySQLReplenishmentRepository` skips the `if (rawOrder <= 0) continue;` filter
- The page client passes this param when the setting is enabled
- On the client, the visibility filter is also relaxed (since items with `rawNeed <= 0` may now exist in the payload)

**Alternative (simpler) approach:** Always fetch all items from the server (remove the `rawOrder <= 0` filter), and gate visibility purely client-side based on the setting. This avoids changing the API contract but increases payload size.

**Decision:** Use the **API query param approach** for the following reasons:

1. Without the server filter, every Standard run would fetch the entire supplier catalog — potentially thousands of items for large suppliers — even when the setting is off. This wastes bandwidth and DB resources.
2. The API contract remains backward-compatible: when the param is absent/false, behavior is identical to today.
3. The server-side change is minimal: one `if` guard in `MySQLReplenishmentRepository.getGroups()`.

**C. Visual treatment for zero-qty items**

When `showZeroQtyItems` is enabled and an item has `suggestedQty === 0`:

- The row should render with **reduced opacity** (`opacity-50`) or a **grayed-out background**
- The checkbox should be **unchecked** by default (cannot be part of "Select All")
- A subtle visual indicator like a dash `—` or a badge "Zero" in the Suggested column
- The row should remain clickable — checking it adds it to the selection and triggers a normal quantity input on the Review screen

**D. Select All behavior**

When `showZeroQty` is enabled, "Select All" selects **only** items with `suggestedQty > 0`. Zero-qty items remain unchecked. This prevents accidentally submitting a PO with dozens of zero-qty placeholder lines.

#### 4.4.4 PO Review Screen

When a zero-qty item is checked in full-catalog mode and "Generate PO" is clicked:

- It arrives in `poLines` with `quantity: 0`, `suggestedQty: 0`
- On the Review screen, it renders with a quantity input showing `0`, which the buyer can edit up to any positive integer
- The line is included in the PO submission normally

This is already supported by the existing Review/submit code path — it does not validate `quantity > 0` server-side. No additional changes needed for PO write-back.

---

## 5. Data Flow

```
Admin UI (OrderingTab)
  │  PUT /admin/api/settings { ordering_show_zero_qty_items: true }
  ▼
app_settings table (key="ordering_show_zero_qty_items", value="on")

Replenishment page mount
  │  GET /admin/api/settings  →  { ordering_show_zero_qty_items: "on" }
  ▼
set showZeroQtyItems = true

User clicks Refresh / page loads data
  │  GET /replenishment/api?from=...&to=...&locationId=...&supplierIds=...&showZeroQty=true
  ▼
MySQLReplenishmentRepository.getGroups()
  │  rawOrder check skipped when showZeroQty=true
  ▼
Returns ALL active items for suppliers (including zero-need items)

Client page.tsx
  │  mfgGroupsWithVisible: rawNeed > 0 check relaxed
  │  standardAllVisibleSkus: rawNeed > 0 check relaxed
  ▼
Zero-qty items rendered with opacity-50, unchecked, "—" in Suggested col

User checks a zero-qty item → Generate PO
  ▼
poLines includes the item with quantity=0
  → Review screen shows editable quantity field
  → Buyer adjusts quantity → Submit PO
```

---

## 6. Detailed Implementation Plan

### Step 1: Register permission key

**File:** `app/shared/domain/permissions.ts`

- Add `| "admin.ordering"` to the `PermissionKey` union type
- Add catalog entry:
  ```typescript
  { key: "admin.ordering", label: "Ordering Settings" }
  ```

### Step 2: Create `OrderingTab.tsx`

**File:** `app/(authenticated)/admin/OrderingTab.tsx` (new)

- Card with a Switch component
- Fetches setting from `GET /admin/api/settings` on mount
- Saves via `PUT /admin/api/settings`
- Follows the same patterns as `DeliverySettingsCard`

### Step 3: Wire into Admin page

**File:** `app/(authenticated)/admin/page.tsx`

- Import `OrderingTab`
- Add `has("admin.ordering") && "ordering"` to `visibleTabs`
- Add tab trigger and content JSX

### Step 4: Update settings API

**File:** `app/(authenticated)/admin/api/settings/route.ts`

- **GET**: return `ordering_show_zero_qty_items` (cast from `"on"`/`"off"` to boolean)
- **PUT**: accept `ordering_show_zero_qty_items: boolean`, gate with `requirePermission("admin.ordering")`, store as `"on"`/`"off"`

### Step 5: Update repository

**File:** `app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts`

- Modify `getGroups()` signature to accept an optional `showZeroQty?: boolean` parameter
- Guard the `if (rawOrder <= 0) continue;` filter: skip only when `!showZeroQty`

**File:** `app/(authenticated)/replenishment/domain/ReplenishmentRepository.ts`

- Update the interface to include the optional parameter

**File:** `app/(authenticated)/replenishment/application/GetReplenishmentGroupsUseCase.ts`

- Pass through the `showZeroQty` flag from the API layer

### Step 6: Update API route

**File:** `app/(authenticated)/replenishment/api/route.ts`

- Parse `showZeroQty` query param (`"true"` → `true`)
- Pass to use case

### Step 7: Update client page

**File:** `app/(authenticated)/replenishment/page.tsx`

- Add state: `const [showZeroQtyItems, setShowZeroQtyItems] = useState(false);`
- On mount (alongside `fetchGroups`), fetch setting from `GET /admin/api/settings`
- Pass `showZeroQtyItems` to the `fetchGroups` URL param
- Relax visibility predicates when `showZeroQtyItems` is true:
  - `mfgGroupsWithVisible` filter
  - `standardAllVisibleSkus` filter
  - `toggleStandardGroup` accumulation
  - `defaultCheckedSkus` logic (zero-qty items excluded from default-check)
- Add visual treatment for zero-suggested items:
  - `opacity-50` class and/or muted text colors
  - Show `—` in Suggested column instead of suggested number
  - Disable the checkbox or show it unchecked with reduced opacity (but clickable)

### Step 8: Update SeedReplenishmentRepository

**File:** `app/(authenticated)/replenishment/infrastructure/SeedReplenishmentRepository.ts`

- Mirror the same `showZeroQty` guard for the seed data path (used in dev/test)

---

## 7. UI Mockups (Textual)

### Admin → Ordering Tab

```
┌─────────────────────────────────────────────────────────────┐
│  Ordering Settings                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ○ Show all items in Standard replenishment          │   │
│  │                                                     │   │
│  │  When enabled, the Standard tab displays every item │   │
│  │  for the selected suppliers, including items with   │   │
│  │  zero suggested quantity. Zero-qty items appear     │   │
│  │  grayed out and unchecked. The Stockout tab is      │   │
│  │  unaffected.                                        │   │
│  │                                                     │   │
│  │  [Toggle: ON]  (saves immediately)                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Standard Tab — Full Catalog View

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [Expand All] · [Select All]   [Search items by name or SKU…]             │
│                                                                           │
│  ┌──┬────────┬────────────┬────┬────────┬────────┬────────┬──────┬──────┐ │
│  │  │ SKU    │ Description│Unit│On-Hand │Incoming│Daily   │DOS   │Sugg. │ │
│  │  │        │            │    │        │        │Rate    │      │      │ │
│  ├──┼────────┼────────────┼────┼────────┼────────┼────────┼──────┼──────┤ │
│  │✓ │ Acme Corp                                · 24d lead time            │ │
│  ├──┼────────┼────────────┼────┼────────┼────────┼────────┼──────┼──────┤ │
│  │  │  No Brand                     [ 7d | 14d | 30d ]                   │ │
│  ├──┼────────┼────────────┼────┼────────┼────────┼────────┼──────┼──────┤ │
│  │✓ │ SKU-001 │ Item A     │ cs │ 12.00  │ +3.00  │ 0.50   │ 30.0 │  14  │ │
│  ├──┼────────┼────────────┼────┼────────┼────────┼────────┼──────┼──────┤ │
│  │☐ │ SKU-002 │ Item B     │ cs │ 48.00  │ —      │ 0.05   │ 960  │  —   │ │  ← grayed, opacity-50
│  ├──┼────────┼────────────┼────┼────────┼────────┼────────┼──────┼──────┤ │
│  │✓ │ SKU-003 │ Item C     │ cs │ 3.00   │ +10.00 │ 1.20   │ 10.8 │  18  │ │
│  └──┴────────┴────────────┴────┴────────┴────────┴────────┴──────┴──────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Testing Considerations

| Test | Expected Result |
|------|----------------|
| Toggle ON, run Standard for a supplier with some well-stocked items | All items appear. Zero-qty items grayed out, unchecked. "Select All" skips them. |
| Toggle OFF, run same supplier | Only `rawNeed > 0` items appear. Behavior identical to before feature. |
| Check a zero-qty item, Generate PO | Item appears on Review with qty=0. Buyer can edit qty upward. |
| Check a zero-qty item, leave qty=0, Submit PO | PO line is submitted with quantity 0. Server should handle gracefully (skip zero-qty lines or write them). |
| Toggle ON, switch to Stockout tab | Stockout behavior unchanged — only stockout candidates shown. |
| Admin toggles setting on/off, two buyers open replenishment | Both see the updated setting on next page load/refresh. |
| Permission without `admin.ordering` | Ordering tab not visible. Setting cannot be changed via API. |

---

## 9. Edge Cases & Decisions

| Edge Case | Decision |
|-----------|----------|
| Item has zero sales in date range but is active for supplier | Included when toggle is ON. The server SQL currently filters `COALESCE(sd.units_sold, 0) > 0`, which excludes zero-sale items. This filter is **not changed** — the toggle only affects the `rawOrder` filter. Zero-sale items remain excluded because they have no daily rate, and we lack a sensible quantity to suggest. |
| Zero-qty item is checked but buyer doesn't edit qty on Review | PO submits with qty=0. The server-side PO write-back (in `MySQLPurchaseOrderRepository`) should be checked — if it rejects zero-qty lines, we need to skip them in `handleSubmitPO`. **Likely acceptable** — the existing code does not validate `quantity > 0` at the API level. |
| Toggle ON with many suppliers and large catalogs | The API payload increases because zero-need items are now included. If performance becomes an issue, consider server-side pagination. For v1, accept the larger payload. |
| Item is both zero-qty AND sub-case (rawNeed > 0 but rounds to 0) | These already appear in the current view (sub-case surfacing). The toggle does not change their behavior. |
| Toggle ON with Rounding = Down | More items may have `suggestedQty === 0` under round-down. The toggle surfaces them all, which is the intended behavior. |

---

## 10. Future Work (Deferred)

- **Per-run opt-in:** A checkbox in the control bar so the buyer can toggle on/off per run without going to Admin. This is the natural next step if buyers find the Admin setting too coarse.
- **Per-supplier threshold:** Show only items below a configurable DOS threshold rather than every single item in the catalog.
- **Stockout tab extension:** Apply a similar toggle to show non-stockout items in the Stockout view (lower priority — Stockout is already opt-in).
- **Server-side pagination:** For very large supplier catalogs (1000+ items), the API response may need pagination.

---

## 11. Appendix: File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `app/shared/domain/permissions.ts` | Edit | Add `admin.ordering` permission key and catalog entry |
| `app/(authenticated)/admin/OrderingTab.tsx` | **Create** | New admin tab with toggle switch |
| `app/(authenticated)/admin/page.tsx` | Edit | Wire in Ordering tab |
| `app/(authenticated)/admin/api/settings/route.ts` | Edit | Accept `ordering_show_zero_qty_items` in GET/PUT |
| `app/(authenticated)/replenishment/domain/ReplenishmentRepository.ts` | Edit | Add optional `showZeroQty` to `getGroups()` |
| `app/(authenticated)/replenishment/application/GetReplenishmentGroupsUseCase.ts` | Edit | Pass through `showZeroQty` |
| `app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts` | Edit | Guard `rawOrder <= 0` filter |
| `app/(authenticated)/replenishment/infrastructure/SeedReplenishmentRepository.ts` | Edit | Mirror the guard |
| `app/(authenticated)/replenishment/api/route.ts` | Edit | Parse `showZeroQty` query param |
| `app/(authenticated)/replenishment/page.tsx` | Edit | Fetch setting, relax visibility, add grayed-out styling |
