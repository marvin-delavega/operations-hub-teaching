# Implementation Plan: Replenishment Continuous Ordering
Source PRD: [PRD-replenishment-continuous-ordering.md](PRD-replenishment-continuous-ordering.md)
Date: 2026-08-26

## Summary

Pure client-side navigation wiring in `app/(authenticated)/replenishment/page.tsx`.
Two changes: (1) an "Order for different suppliers" secondary button on the
post-submit summary screen; (2) "Change suppliers" / "Change location" links on
the main run screen header. No domain/application/infrastructure/API/DB work.

## Affected Areas

- **Module UI only:** `app/(authenticated)/replenishment/page.tsx`
  - Summary screen render block (~line 1838–1875)
  - Main run screen header (~line 2510–2548)
  - Handlers near `handleDone` (line 1740) and `handlePlanAnotherRun` (line 1672)
- **Reused patterns (no new shared code):**
  - `handlePlanAnotherRun` (page.tsx:1672) — chain re-entry via encoded `returnTo`
  - Manufacturers "Change" link (page.tsx:2556–2563) — link styling + param passing
- **Shared selection modules consumed, not modified:** `/supplier`, `/location`
- **DB / container / API:** none touched

## Decisions

- Resolved by AI: **summary keeps Done unchanged** — Done already behaves as
  "new run, same selection" (resets screen + refetches), so only one new action
  is added; relabeling would churn muscle memory.
- Resolved by AI: **links only on the main run screen** (`screen === "replenishment"`),
  never Review/Summary — prevents navigation from discarding in-review PO lines.
  PRD FR-2 mandates this.
- Resolved by AI: **"Change location" preserves `supplierIds` but drops
  `manufacturerIds`** — supplier choice is location-independent per existing
  convention; dropping the manufacturer filter (absent = all) is the minimal,
  safe default.
- Assumption: URL encoding style copies `handlePlanAnotherRun` exactly
  (nested `encodeURIComponent` calls).

## Implementation Steps

1. **Add handler `handleOrderForDifferentSuppliers`** in `page.tsx` near
   `handleDone` (line ~1740):
   ```ts
   function handleOrderForDifferentSuppliers() {
     router.push(
       `/supplier?returnTo=${encodeURIComponent(`/replenishment?locationId=${locationId}`)}`
     );
   }
   ```
   Contract check: `/supplier` appends `&supplierIds=...` to the decoded
   `returnTo`; `manufacturerIds` omitted → all manufacturers (existing rule).
   Requires `locationId` non-null — it always is on the summary screen (the
   early-return redirect at line 732 guards otherwise).

2. **Render the secondary action on the summary screen** (block at line
   1872–1874): change `<div className="flex justify-end">` to a flex row with
   `gap` and `justify-between`:
   - Left: secondary `Button variant="outline"` labeled **"Order for different suppliers"**
     → `onClick={handleOrderForDifferentSuppliers}`
   - Right: existing **Done** `Button` (unchanged behavior).

3. **Add header switch links on the main run screen** in the title row
   (line ~2517–2522), under/near the `{locationName}` span — a small inline
   flex of two `Link`s styled like the Manufacturers Change link
   (`type-label text-primary hover:underline`, 48px touch target via padding):
   - **Change suppliers:**
     `href={`/supplier?returnTo=${encodeURIComponent(`/replenishment?locationId=${locationId}`)}`}`
   - **Change location:** reuse the exact nested-encoding shape of
     `handlePlanAnotherRun` but with a supplier-preserving returnTo:
     ```ts
     const replenishmentReturnTo = encodeURIComponent(
       `/replenishment?supplierIds=${encodeURIComponent(supplierIdsParam ?? "")}`
     );
     href={`/location?module=replenishment&returnTo=${replenishmentReturnTo}`}
     ```
     `/location` appends `?locationId={id}` → lands back on a fully-parameted run URL.

4. **Gate rendering** so both links appear only when
   `screen === "replenishment"` and `locationId && supplierIdsParam` are truthy
   (same guard shape as the Manufacturers indicator at line 2551). The header
   block is inside the main-screen render branch already — verify no leakage
   into the review/summary branches (they are separate `return` blocks, so a
   simple placement inside the correct branch suffices).

5. **Verify no regression** in the three existing entry/re-entry paths:
   first entry via full chain, draft-modal `handlePlanAnotherRun`,
   Manufacturers Change link. All untouched — confirm by reading final diff.

## Verification

Per CLAUDE.md build guidance: `npx tsc --noEmit` + `npm run lint`
(`npm run build` hangs in this environment — do not wait on it). Manual check
in `npm run dev`: submit a PO, exercise both new actions end-to-end through
the selection modules, confirm returned URLs carry the expected params.

## Risks & Open Questions

- Low risk overall — no data flow changes. The only subtlety is double-encoded
  `returnTo` values; copy `handlePlanAnotherRun` verbatim in shape.
- Note: navigating away mid-run discards unsaved review-stage state (existing
  behavior for Home too); draft save remains the durability mechanism. Deferred
  "resume draft?" prompting is out of scope per PRD non-goals.
