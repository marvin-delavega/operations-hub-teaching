# Implementation Plan: App-Owned PO Code Numbering (Start-from-1 / Continue + Display Width)
Source PRD: [PRD-po-code-numbering.md](PRD-po-code-numbering.md)
Date: 2026-09-02

## Summary
Decouple the readable PO CODE number from the ActiveOne PK. Add an app-owned global
counter (`po_code_counter`) minted inside the existing PO-writing transaction, so the CODE
number can start at 1 or continue. Generation stores minimal `{prefix}-{number}` (no
padding). A new display-only `po_code_display_width` app-setting (default 6) pads app PO
codes at render sites via a shared `formatAppPoCode` helper that never reformats
ActiveOne-native codes. ActiveOne PK `ID` minting (`MAX(ID)+10` + `withPoMintRetry`) is
unchanged. Applies to both writers: Replenishment `createAll` (batch) and Delivery `commit`.

## Affected Areas
- **Shared infrastructure**:
  - `app/shared/infrastructure/activeonePoMinting.ts` — `poCode()` no longer takes the
    PK as its number; becomes counter-driven. New `acquireNextPoNumber(conn, prefix)`
    helper (counter read+bump, lazy-init).
  - `app/shared/infrastructure/activeoneConstants.ts` — note about decoupling; keep
    `DEFAULT_PO_CODE_PREFIX`; `PO_CODE_WIDTH` becomes the display default, moved into the
    display helper (not generation).
  - **New** `app/shared/infrastructure/poCodeDisplay.ts` (or add to `activeonePoMinting.ts`)
    — `formatAppPoCode(code, prefix, width): string`.
- **PO writers** (both switch from `poCode(poId, prefix)` to counter number):
  - `app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts`
    (`createAll`, ~line 411-434).
  - `app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts`
    (`commit`, ~line 349-355).
- **Admin** (settings, General tab):
  - `app/(authenticated)/admin/api/settings/route.ts` — GET/PUT `po_code_display_width`;
    new counter-reset action (FR-4).
  - `app/(authenticated)/admin/infrastructure/SeedAppSettingsRepository.ts` — seed
    `po_code_display_width: "6"`.
  - `app/(authenticated)/admin/page.tsx` — display-width input + "Reset numbering to 1"
    control (confirm dialog), alongside the existing PO-prefix field (~line 337-363).
- **DB / schema**: `scripts/create-app-tables.sql` — idempotent `po_code_counter` table.
- **Display surfaces** (apply `formatAppPoCode` where app PO codes render):
  - `app/(authenticated)/replenishment/page.tsx` (`r.poNumber`, ~2133-2148).
  - `app/(authenticated)/history/replenishment/[runId]/page.tsx` (`po.poCode`, 190 + print 371).
  - `app/(authenticated)/history/replenishment/page.tsx` (`run.poCodes`, 420-425).
  - `app/shared/ui/POPrintReport.tsx` (`po.poCode`, 81).
  - `app/(authenticated)/delivery/page.tsx` success PO code (wherever the new PO code shows).
- **container.ts** — only if a use case/adapter is added for the reset action (likely reuse
  `UpdateAppSettingUseCase`; counter reset may be a direct repo method).

## Decisions
- Resolved by developer: **Global counter** (single series across all locations) — matches
  ActiveOne's global CODE space.
- Resolved by developer: **Start-from-1 is a one-time + manual reset**, not a live toggle —
  flipping can never re-seed each run.
- Resolved by developer: **Display-only width** — generation stores minimal `PO-1`; padding
  applied at render (UI + reports).
- Resolved by AI: `po_code_counter` is a dedicated table keyed by `prefix` (PK) rather than an
  `app_settings` row, so the read+bump can be locked (`SELECT … FOR UPDATE`) transactionally
  with the PO insert. One active row (single global prefix).
- Resolved by AI: lazy-init on first PO under a prefix from `max(numeric tail) + 1`
  (Continue, FR-3); explicit reset sets `next_value = 1` (FR-4). Default behavior is Continue.
- Resolved by AI: `formatAppPoCode` only pads codes matching `^{prefix}-(\d+)$`; anything else
  (native numeric, other junk) passes through unchanged — keeps Delivery's native open-PO
  list and history safe.
- Assumptions: replenishment history + delivery history codes stored already stay minimal
  (they are the generated `poCode`); they format at read/print using the current width.

## Implementation Steps

### 1. Schema — `po_code_counter` table
**File**: `scripts/create-app-tables.sql` (idempotent `CREATE TABLE IF NOT EXISTS`, matching the
`stock_count`/`module_location_visibility` pattern).
```sql
CREATE TABLE IF NOT EXISTS po_code_counter (
  prefix      varchar(16) PRIMARY KEY,
  next_value  bigint NOT NULL,
  created_at  datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at  datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```
Plus a one-shot backfill note for deploy (no SQL change needed — lazy-init covers it).

### 2. Shared counter mint — `activeonePoMinting.ts`
**File**: `app/shared/infrastructure/activeonePoMinting.ts`
- Add `acquireNextPoNumber(conn: PoolConnection, ao: string, prefix: string): Promise<number>`:
  1. `SELECT next_value FROM po_code_counter WHERE prefix = ? FOR UPDATE`.
  2. If no row: `SELECT CODE FROM {ao}.purchase_order WHERE CODE LIKE CONCAT(?, '-%')` →
     extract max numeric tail per row where the tail is all digits → seed
     `next_value = maxTail + 1` (or 1). `INSERT INTO po_code_counter …`.
  3. Else use `next_value`.
  4. `UPDATE po_code_counter SET next_value = next_value + 1 WHERE prefix = ?`.
  5. Return the value captured in step 1/2 (the number to embed in the CODE).
- Change `poCode(number: number, prefix?)` to **stop padding** → `${p}-${number}` (no
  `padStart`). Number now comes from `acquireNextPoNumber`, not the PK.
- Because `acquireNextPoNumber` reads ActiveOne `purchase_order` for the lazy-init, it must run
  inside the existing transaction where `MAX(ID)` is already read.

### 3. Display helper
**File**: add `formatAppPoCode` to `app/shared/infrastructure/poCodeDisplay.ts` (or into
`activeonePoMinting.ts` to avoid a new file):
```ts
export function formatAppPoCode(code: string, prefix: string, width: number): string {
  const m = code.match(new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`));
  return m ? `${prefix}-${m[1].padStart(width, "0")}` : code;
}
```
`escapeRegExp` guards prefix chars (prefix is alnum-only by validation, so trivial). Width
`0` → `padStart(0)` is a no-op (returns number as-is).

### 4. Replenishment writer — `MySQLPurchaseOrderRepository.ts`
**File**: `app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts`
(`createAll`, ~line 409-434)
- Inside the transaction, after reading `poMaxRows`/`lineMaxRows`, call
  `acquireNextPoNumber(conn, ao, poCodePrefix)` **once per PO in the batch** (before each
  group's `poCode(...)`). Replace `const code = poCode(poId, poCodePrefix)` with
  `const code = poCode(await acquireNextPoNumber(conn, ao, poCodePrefix), poCodePrefix)`.
  The PK `poId` stays from `MAX(ID)+10`; only the CODE number differs now.
- `results[].poNumber` and snapshot `poCode` already use `code` → stay minimal (correct).

### 5. Delivery writer — `MySQLDeliveryRepository.ts`
**File**: `app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts` (`commit`,
~line 349-355)
- After `newPoId = … + PO_ID_INCREMENT`, add
  `const newNumber = await acquireNextPoNumber(conn, ao, poCodePrefix);`
  then `const newCode = poCode(newNumber, poCodePrefix);`. PK `newPoId` unchanged.

### 6. Settings API — `admin/api/settings/route.ts`
**File**: `app/(authenticated)/admin/api/settings/route.ts`
- GET: add `po_code_display_width` (parse via `parseSettingNumber`, default 6, clamp 0..9).
- PUT: accept `po_code_display_width`; validate integer 0..9 (or 0..N as agreed); persist
  under `admin.general_settings` permission alongside `po_code_prefix` (~line 125, 169-183).
- New reset endpoint or body flag `reset_po_numbering: true` → a method that sets
  `po_code_counter.next_value = 1` for the current prefix (needs a repo/use case; see
  container step). Reject if the caller lacks `admin.general_settings`.

### 7. Admin UI — `admin/page.tsx`
**File**: `app/(authenticated)/admin/page.tsx` (PO-code-prefix block, ~line 337-363)
- Add a numeric `po_code_display_width` input (mirror the prefix field's load/save pattern,
  maxLength small, number-only).
- Add a "Reset numbering to 1" secondary button with a confirm `Dialog` (matches existing
  confirm-dialog pattern); on confirm POST to the reset endpoint, then refresh.
- Load both values from GET settings; include both on save.

### 8. Seed — `SeedAppSettingsRepository.ts`
**File**: `app/(authenticated)/admin/infrastructure/SeedAppSettingsRepository.ts`
- Add `po_code_display_width: "6"` to the `store` object.

### 9. Display surfaces — apply `formatAppPoCode`
In each surface below, resolve `prefix` (`po_code_prefix`) and `width`
(`po_code_display_width`) once per view, then format app codes (a small shared client hook or
pass-through is acceptable). Enumerate:
- `replenishment/page.tsx` `r.poNumber` (~2137) and the `printPo` param (~2148).
- `history/replenishment/[runId]/page.tsx` `po.poCode` screen (190) + print (371).
- `history/replenishment/page.tsx` `run.poCodes` (420-425).
- `app/shared/ui/POPrintReport.tsx` `po.poCode` (81).
- `delivery/page.tsx` success/PO-code displays for app-created POs.
Print surfaces (`@media print`) and the on-screen UI both call the helper so they agree.

### 10. Container wiring (if a reset use case is introduced)
**File**: `container.ts`
- If a dedicated `resetPoCodeCounter` use case is added (rather than folding into the settings
  route), add the factory; otherwise the settings route calls a repo method directly via the
  existing DB pool. Prefer reusing the existing settings route + a direct
  `po_code_counter` update to avoid a new use case (YAGNI).

## Risks & Open Questions
- **Collision after reset under a prefix with history**: starting at 1 when old app codes under
  the same prefix are already high can collide once the counter climbs back to them. Mitigated
  by the confirm dialog warning; admin uses a fresh/disjoint prefix (they verified `PO-` is free).
- **Native codes must never be padded**: `formatAppPoCode`'s prefix regex is the guard — verify
  Delivery's open-PO list (mixed native + app codes) stays verbatim for non-prefix codes.
- **History codes render under a changed width**: stored minimal, formatted at read — a width
  change retroactively affects history display. Accepted (display-only).
- **Lazy-init scans existing codes**: the `LIKE 'prefix-%'` numeric-tail MAX scan runs once per
  new prefix; fine on the first PO, negligible after the row exists.
- **Verify**: `npx tsc --noEmit` + `npm run lint` (build hangs in this env — see CLAUDE.md).
- **Confirm against live data**: that `purchase_order.CODE` has no rows starting with the
  default/`PO-` prefix is already checked by the developer; re-verify before enabling a reset.
