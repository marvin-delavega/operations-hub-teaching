# Implementation Plan: Configurable PO Code Prefix
Source PRD: (requirements from user: configurable PO prefix with OHPO default, required, max 8 chars, no special chars, always capital)
Date: 2026-08-29

## Summary
Make the PO code prefix (`OHPO`) configurable via `app_settings` table with validation. The prefix is used in PO code generation (`OHPO-000001` format) for both replenishment and delivery modules. Default remains "OHPO". Validation: required, max 8 characters, alphanumeric only, stored uppercase.

## Affected Areas
- **Shared infrastructure**: `app/shared/infrastructure/activeoneConstants.ts`, `app/shared/infrastructure/activeonePoMinting.ts`
- **Admin domain**: `app/(authenticated)/admin/domain/AppSettingsRepository.ts` (interface unchanged)
- **Admin application**: `app/(authenticated)/admin/application/GetAppSettingUseCase.ts`, `UpdateAppSettingUseCase.ts` (reuse existing)
- **Admin infrastructure**: `app/(authenticated)/admin/infrastructure/SeedAppSettingsRepository.ts`, `MySQLAppSettingsRepository.ts` (reuse existing)
- **Admin API**: `app/(authenticated)/admin/api/settings/route.ts` (add validation + persistence)
- **Admin UI**: `app/(authenticated)/admin/page.tsx` (add input in General tab), `app/(authenticated)/admin/CompanyNameCard.tsx` pattern
- **Container**: `container.ts` (existing factories reused)

## Decisions
- **Resolved by AI**: Store prefix in `app_settings` with key `po_code_prefix` — follows existing pattern for `company_name`, `delivery_continuous_scanning`, etc.
- **Resolved by AI**: Validate on server in API route (required, max 8, alphanumeric, uppercase) — matches `company_name` validation pattern.
- **Resolved by AI**: `activeoneConstants.ts` exports a function `getPoCodePrefix()` that reads from settings via `GetAppSettingUseCase` (with default fallback) — avoids importing infrastructure in shared constants; `poCode()` in `activeonePoMinting.ts` calls this function.
- **Resolved by AI**: UI in General settings tab alongside Company Name — same permission (`admin.general_settings`).
- **Assumptions**: `PO_CODE_WIDTH` (6) stays constant; no migration needed for existing POs (prefix only affects new POs).

## Implementation Steps

### 1. Add seed default
**File**: `app/(authenticated)/admin/infrastructure/SeedAppSettingsRepository.ts`
- Add `po_code_prefix: "OHPO"` to the `store` object.

### 2. Create getter for prefix in shared constants
**File**: `app/shared/infrastructure/activeoneConstants.ts`
- Remove `export const PO_CODE_PREFIX = "OHPO";`
- Add async function `getPoCodePrefix(): Promise<string>` that uses `createGetAppSettingUseCase()` to fetch `po_code_prefix`, falls back to `"OHPO"` if null/empty.
- Keep `PO_CODE_WIDTH = 6`.

### 3. Update PO code minting to use dynamic prefix
**File**: `app/shared/infrastructure/activeonePoMinting.ts`
- Change `poCode(id: number)` to `async poCode(id: number): Promise<string>` — await `getPoCodePrefix()` then format.
- Update callers: `MySQLPurchaseOrderRepository.ts`, `MySQLDeliveryRepository.ts` — await `poCode(poId)`.

### 4. Add validation + persistence in admin API
**File**: `app/(authenticated)/admin/api/settings/route.ts`
- In GET: fetch `po_code_prefix` via `createGetAppSettingUseCase()`, include in response.
- In PUT: validate `po_code_prefix` if provided:
  - Required string, trim, non-empty
  - Max 8 chars
  - Alphanumeric only (`/^[A-Za-z0-9]+$/`)
  - Convert to uppercase
  - Permission: `admin.general_settings` (same as `company_name`)
  - Persist via `createUpdateAppSettingUseCase().execute("po_code_prefix", value)`

### 5. Add UI in admin General tab
**File**: `app/(authenticated)/admin/page.tsx`
- Add state for `poCodePrefix`, loading, saving, message.
- In `useEffect`, fetch `/admin/api/settings` and set `poCodePrefix` from response.
- In General tab section, add input field (maxLength=8, uppercase transform on change) + Save button, mirroring `CompanyNameCard` pattern.
- Reuse `CompanyNameCard` pattern or create inline component.

### 6. Verify callers handle async poCode
**Files**: `app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts`, `app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts`
- `poCode(poId)` is now async — update call sites to `await poCode(poId)`.
- Both are already inside async transaction functions.

## Risks & Open Questions
- **Risk**: `poCode` becomes async — verify no sync callers remain (grep shows only the two repos above).
- **Risk**: Concurrent PO creation reads prefix per call — acceptable (settings change rare, cache not needed).
- **Open**: Should prefix change apply immediately to in-progress sessions? Current design: yes (reads live), matches `delivery_blind_delivery` behavior.