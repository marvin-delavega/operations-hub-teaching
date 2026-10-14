# Implementation Plan: Delivery Settings — Continuous Scanning & Blind Delivery
Source PRD: [PRD-delivery-settings-continuous-scanning-blind-delivery.md](PRD-delivery-settings-continuous-scanning-blind-delivery.md)
Date: 2026-06-30

## Summary
Two global, admin-controlled policy toggles change how the Delivery floor tool behaves during receiving: **Continuous Scanning** (ON = current +1-per-scan; OFF = prompt-for-quantity modal that *adds* to the line) and **Blind Delivery** (ON = hide ordered quantities and Exact/Over/Under variance from staff). Both are stored as `app_settings` keys, configured in a new **Delivery** tab in `/admin`, read at receiving-session start, and snapshotted into the per-PO `localStorage` so in-progress sessions keep the mode they began with.

The work is **client-side + admin-settings only**. The supersede-PO save is untouched: the server's `commit()` already re-reads the original PO's lines and writes `QUANTITY = 0` for every unscanned ordered line ([MySQLDeliveryRepository.ts:234-252](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts#L234-L252)), so blind mode (which starts the visible list empty) preserves the true variance with no domain/application/infrastructure/container change.

## Affected Areas
- **Admin module**
  - [admin/api/settings/route.ts](../../app/(authenticated)/admin/api/settings/route.ts) — extend `GET` to return the two booleans; extend `PUT` to accept/validate/persist them.
  - [admin/page.tsx](../../app/(authenticated)/admin/page.tsx) — add a **Delivery** tab (two switches, persist-on-toggle).
- **Delivery module**
  - [delivery/page.tsx](../../app/(authenticated)/delivery/page.tsx) — settings read & session binding, OFF-mode quantity modal, blind-mode rendering across Receiving / Review / Success. **All changes are in this one client file.**
- **Shared UI**
  - New `app/shared/ui/switch.tsx` — shadcn Switch primitive (`npx shadcn@latest add switch`), used by the Delivery tab.
- **DB**: none. `app_settings` is key-value; the two new keys (`delivery_continuous_scanning`, `delivery_blind_delivery`) need no schema change and no `create-app-tables.sql` edit. No change to `delivery`, `delivery_new_items`, `item_master_cache`, or `purchase_order(_items)`.
- **container.ts**: no change. The existing `createGetAppSettingUseCase()` / `createUpdateAppSettingUseCase()` factories already cover both new keys.
- **Domain/application/infrastructure (delivery & admin)**: no change. `AppSettingsRepository.get/set` and the commit path are reused as-is.

## Decisions
- **No server-side change to the save** — Resolved by AI. `MySQLDeliveryRepository.commit()` iterates the original PO's lines server-side and defaults received to 0 by code, so ordered-but-unscanned lines are written `QUANTITY = 0` whether or not the client lists them (FR-22). Blind mode only changes what the staff *sees*.
- **Store values as `"on"`/`"off"` strings** — Resolved by AI. Matches the PRD §6 data-model table; the existing key-value store holds strings (`MySQLAppSettingsRepository`). GET resolves absent → default (continuous `on`→true, blind `off`→false) and returns booleans to clients.
- **Reuse `/admin/api/settings` for both read paths** — Resolved by AI. The delivery page already fetches this endpoint on mount (for `scan_batch_delay_ms`); adding the two booleans there means session binding reads from the same response with no new route. The admin tab reads/writes the same endpoint.
- **Persist each Delivery-tab toggle immediately (no Save button)** — Resolved by AI. PRD §8 step 3 ("Toggling a switch persists immediately"). Each switch fires a partial `PUT` and shows a brief confirmation, unlike the General tab's batched Save.
- **Add a shadcn Switch primitive** — Resolved by AI. PRD calls for "two labeled switches"; CLAUDE.md says prefer shadcn primitives in `app/shared/ui/`. Pulls in `@radix-ui/react-switch`.
- **Blind mode keeps `po.lines` in memory for *code* classification, not display** — Resolved by AI. FR-17 (on-PO line = plain, no chip) vs FR-18 (Not-Ordered / New Item still flagged) requires distinguishing on-PO codes from not-ordered codes. Knowing the *set of ordered codes* (and seeding a revealed line's real `orderedQuantity`) reveals no *variance* to staff as long as the UI suppresses the ordered quantity and the Exact/Over/Under chip. This is the only reading that satisfies both FRs.
- **Assumptions for the implementer**:
  - The settings fetch is async on mount; if a PO is opened before it resolves, fall back to defaults (continuous ON, blind OFF) — identical to the absent-key resolution, so no user-visible difference.
  - Success-screen blind suppression is client-side: the server still returns the true `statusBreakdown` in the response, but a blind session simply does not render it (shows scanned totals instead). No server response shape change.

## Implementation Steps

### 1. Settings API — read & write the two keys
File: [admin/api/settings/route.ts](../../app/(authenticated)/admin/api/settings/route.ts)
- `GET`: add two more `createGetAppSettingUseCase().execute(...)` calls (parallel in the existing `Promise.all`) for `"delivery_continuous_scanning"` and `"delivery_blind_delivery"`. Resolve to booleans with defaults: `continuous = raw === null ? true : raw === "on"`, `blind = raw === null ? false : raw === "on"`. Return them under `settings` alongside `company_name` / `scan_batch_delay_ms`.
- `PUT`: accept optional `delivery_continuous_scanning?: unknown` and `delivery_blind_delivery?: unknown`. For each, validate `typeof === "boolean"` (else `400`), then `createUpdateAppSettingUseCase().execute(key, value ? "on" : "off")`. Keep the existing admin-role guard and partial-update shape (each key independent). `revalidateTag("app-settings")` already runs at the end — fine to leave.
- Mirrors the existing `scan_batch_delay_ms` handling in the same file.

### 2. Shared Switch primitive
File: `app/shared/ui/switch.tsx` (new) — run `npx shadcn@latest add switch` (installs to `app/shared/ui/` per `components.json` aliases). Token-based; no manual color. Used only by the admin Delivery tab.

### 3. Admin — Delivery tab
File: [admin/page.tsx](../../app/(authenticated)/admin/page.tsx)
- Add state: `continuousScanning: boolean`, `blindDelivery: boolean`, plus a small per-toggle saving/confirmation indicator (e.g. `deliverySettingsMessage`).
- Hydrate both from the existing mount `fetch("/admin/api/settings")` (extend the parsed `settings` type to include the two booleans).
- Add `<TabsTrigger value="delivery">Delivery</TabsTrigger>` to the `TabsList` and a matching `<TabsContent value="delivery">` with two `Card`s, each holding a `Label` + helper `<p className="type-caption">` + `Switch`:
  - **Continuous Scanning** — helper: "On: each scan adds +1. Off: each scan prompts for a quantity to add."
  - **Blind Delivery** — helper: "On: hide ordered quantities and Exact/Over/Under status from receiving staff."
- On toggle: optimistically set local state, `PUT` the single changed key (`{ delivery_continuous_scanning: next }` etc.), show "Saved." on success / revert + error on failure. Mirrors the immediate-persist style; reuses the `cn()` success/destructive message pattern already in this file.

### 4. Delivery page — settings read & session binding
File: [delivery/page.tsx](../../app/(authenticated)/delivery/page.tsx)
- Extend the mount settings `fetch` (currently sets `scanBatchDelayMs`) to also read `delivery_continuous_scanning` / `delivery_blind_delivery` into new page state `continuousDefault` / `blindDefault` (defaults `true` / `false`).
- Extend `SavedSession` to `{ lines, lastScannedKey, continuousScanning, blindDelivery }`; update `restoreSession`.
- In `SelectScreen.openPo`: when a saved session exists, take the modes from it; otherwise snapshot the current defaults. For a **fresh blind** session, build `baseLines = []` (visible list empty) instead of mapping `poRes.lines`; for a fresh non-blind session keep today's mapping. Pass the two modes up through `onOpen`.
- Thread `continuousScanning` / `blindDelivery` into `Page` state and down into `ReceivingScreen` and `SuccessScreen`.
- In `ReceivingScreen`'s persistence `useEffect`, include both modes in the `localStorage` payload (FR-6) so a resumed session keeps them.
- Keep `activePo.lines` (the real ordered lines, with `orderedQuantity`) available in blind mode for code classification — it is already in `PurchaseOrderForReceiving`; do not display those quantities.

### 5. Delivery page — Continuous Scanning OFF (quantity modal)
File: [delivery/page.tsx](../../app/(authenticated)/delivery/page.tsx), inside `ReceivingScreen`
- Branch `handleScan` on `continuousScanning`:
  - **ON**: current batch-buffer/flush path, unchanged (FR-7).
  - **OFF**: if an OFF quantity modal is already open, **return** (swallow — FR-12). Otherwise capture the scanned `code` and open a modal bound to it. Do **not** route OFF scans through `pendingRef`/flush.
- Keep `useScanner` enabled while the modal is open (so swallowed scans are absorbed, not leaked to the page); the swallow is the early-return in `handleScan`. Continue to disable scanning during `adminGate` / inline edit as today.
- New `QuantityModal` component (mirror `AdminAuthModal`/`InlineQtyEditor` structure: `Card` overlay, `autoFocus` empty number `Input`, submit on Enter):
  - Accept positive whole numbers only; reject empty / 0 / negative / decimal (FR-10) — disable confirm until valid.
  - Confirm → add N to the line for `code`: reuse the `applyScans(prev, Array(n).fill(code), masterlistRef.current)` fold (it already increments an existing line or appends a classified new/not-ordered line). Record `lastOffEntry = { key, amount: n }`.
  - Cancel/dismiss → no-op (FR-11).
- **Undo-last-scan** branch on mode: OFF → subtract `lastOffEntry.amount` from that line (clamp ≥0, drop the line if it falls to `orderedQuantity === 0 && receivedQuantity === 0`), clear `lastOffEntry` (FR-14). ON → unchanged −1 path. No auth either way (FR-13).
- When OFF, the buffering/"queued" indicator and the batch flush are not used; "Review" needs no `flushScans()` (no pending buffer).

### 6. Delivery page — Blind Delivery rendering
File: [delivery/page.tsx](../../app/(authenticated)/delivery/page.tsx)
- Thread a `blind` flag into `ReceivingScreen` and `SuccessScreen`.
- **Blind reveal of on-PO lines**: when a scanned code is not yet in the visible `lines`, classify it against the PO's ordered set:
  - on `activePo.lines` by code → append a line seeded with the real `orderedQuantity`, `itemId`, `description`, `unitSymbol`, `inMasterlist:true` (so the save sends the right code/qty and the line is *internally* exact/over/under), **but** the UI suppresses its ordered qty and status chip.
  - in masterlist, not on PO → Not Ordered (chip shown, FR-18).
  - not in masterlist → New Item (chip shown, FR-18).
  - Implement by extending `applyScans` to also accept a `poLineByCode` map (built once from `activePo.lines`); harmless in non-blind mode where those codes are already present. Used by both the OFF add-path and the ON flush in blind mode.
- **Receiving screen (blind)**: render the "Blind Delivery" banner/badge (FR-20); keep the running tally (`{lines.length} items` / `{totalQuantity} received`, FR-21); **hide** the aggregate Exact/Over/Under/Not-Ordered/New badge row (reveals variance counts). Per line: **hide** `Ordered {orderedQuantity}`; render the status `Badge` **only** when status is `not_ordered` or `new_item`, otherwise plain (FR-17/18). Admin-gated manual edits still allowed but never surface ordered qty/status (FR — edge case).
- **Review screen (blind)**: same suppression — scanned lines and totals only, no ordered qty, no variance (FR-19).
- **Success screen (blind)**: do not render `result.statusBreakdown` badges; instead show scanned totals (pass a `{ lines, units }` snapshot captured at save time into the success state). Non-blind success unchanged (FR-19).
- `restart()` in blind mode resets to an **empty** visible list (not the re-listed ordered lines); non-blind `restart()` unchanged.

### 7. Independence & defaults check
- All four mode combinations must render correctly (FR-23): ON/OFF × blind/non-blind. The OFF modal and blind rendering are orthogonal branches; verify Continuous-OFF + Blind-ON (manual blind count) end-to-end.
- Absent/corrupt setting keys resolve to defaults (continuous ON, blind OFF) and never block receiving (PRD §9) — handled by the GET default resolution and the page's fallback state.

## Risks & Open Questions
- **Blind-mode classification correctness** — the on-PO-vs-not-ordered distinction depends on `activePo.lines` being loaded even in blind mode (it is, via the existing `GET /delivery/api?poId=`). Verify a scanned on-PO item shows *no* chip while a genuinely not-ordered masterlist item shows the "Not Ordered" chip, with neither revealing an ordered quantity.
- **OFF-mode swallow vs scanner buffer** — confirm that keeping `useScanner` enabled while the quantity modal is open reliably swallows burst scans (the early-return in `handleScan`) and that no keystrokes leak into the modal's number `Input`. The Eyoyo "Enter" terminator should not submit the modal unexpectedly; bind submit to the modal form only.
- **Resumed-session mode persistence** — a session started in one mode then resumed after an admin flip must keep its snapshotted mode (FR-6); verify the `localStorage` payload round-trips both booleans and that `restart()` honors the *session's* blind flag, not the current global setting.
- **shadcn Switch dependency** — `npx shadcn@latest add switch` adds `@radix-ui/react-switch`; confirm it installs cleanly and the primitive uses design-system tokens (no raw Tailwind colors) per CLAUDE.md.
