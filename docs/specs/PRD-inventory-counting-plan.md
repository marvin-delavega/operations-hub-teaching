# Implementation Plan: Inventory Counting

Source PRD: [PRD-inventory-counting.md](PRD-inventory-counting.md)
Date: 2026-07-03

## Summary

Build the `counting` module as a structural sibling of `delivery`: a location-scoped, scan-driven floor tool (scan = +1, Continuous-Scanning setting, Review step, per-action admin auth, `localStorage` resilience) with **no PO** and therefore **no line statuses / supersede / incoming**. A committed count writes an ActiveOne `inventory_count` (+`inventory_count_items`) document and a self-contained mirror in new app-owned `stock_count` (+`stock_count_items`) tables, inside one atomic transaction. Counting never touches on-hand. Supporting work: a new `/admin` **Counting** settings tab (`counting_continuous_scanning`), and a per-user **ActiveOne login-user** mapping (`users.activeone_user_id`) with a live picker in the Users tab, required (alongside the employee link) to save a count.

The existing `counting/` scaffolding (`CountRecord`, `CountRepository`, `GetCountRecordsUseCase`, `MySQLCountRepository`, stub `api/route.ts`, "Coming soon" `page.tsx`) is an unrelated placeholder and is **replaced** by this work.

## Affected Areas

### New / replaced counting module — [app/(authenticated)/counting/](app/(authenticated)/counting/)
- domain: replace [CountRecord.ts](app/(authenticated)/counting/domain/CountRecord.ts) → `Count.ts`; rewrite [CountRepository.ts](app/(authenticated)/counting/domain/CountRepository.ts).
- application: delete [GetCountRecordsUseCase.ts](app/(authenticated)/counting/application/GetCountRecordsUseCase.ts); add `CommitCountUseCase.ts`, `GetCountableItemsUseCase.ts`.
- infrastructure: rewrite [MySQLCountRepository.ts](app/(authenticated)/counting/infrastructure/MySQLCountRepository.ts).
- adapters: rewrite [api/route.ts](app/(authenticated)/counting/api/route.ts); rewrite [page.tsx](app/(authenticated)/counting/page.tsx) (full scan UI); title in [layout.tsx](app/(authenticated)/counting/layout.tsx).

### Admin — settings tab
- [admin/api/settings/route.ts](app/(authenticated)/admin/api/settings/route.ts) — add `counting_continuous_scanning` to GET + PUT.
- New `admin/CountingSettingsCard.tsx` (mirrors [DeliverySettingsCard.tsx](app/(authenticated)/admin/DeliverySettingsCard.tsx)).
- [admin/page.tsx](app/(authenticated)/admin/page.tsx) — add a **Counting** `TabsTrigger`/`TabsContent`.

### Admin — Users tab (ActiveOne login-user mapping)
- Domain: [User.ts](app/(authenticated)/admin/domain/User.ts), [UserRepository.ts](app/(authenticated)/admin/domain/UserRepository.ts); new `admin/domain/ActiveOneUser.ts`.
- Application: [GetUsersUseCase.ts](app/(authenticated)/admin/application/GetUsersUseCase.ts), [CreateUserUseCase.ts](app/(authenticated)/admin/application/CreateUserUseCase.ts), [UpdateUserUseCase.ts](app/(authenticated)/admin/application/UpdateUserUseCase.ts); new `admin/application/ActiveOneUserDirectory.ts` (port) + `admin/application/SearchActiveOneUsersUseCase.ts`.
- Infrastructure: [MySQLUserRepository.ts](app/(authenticated)/admin/infrastructure/MySQLUserRepository.ts); new `admin/infrastructure/MySQLActiveOneUserDirectory.ts`.
- API: new `admin/api/users/activeone-users/route.ts` (mirrors [employees/route.ts](app/(authenticated)/admin/api/users/employees/route.ts)); [users/route.ts](app/(authenticated)/admin/api/users/route.ts) POST + [users/[id]/route.ts](app/(authenticated)/admin/api/users/[id]/route.ts) PUT.
- UI: [UsersTab.tsx](app/(authenticated)/admin/UsersTab.tsx) — add an `ActiveOneUserPicker` in the sheet + card display.

### Shared / cross-cutting
- [container.ts](container.ts) — swap the counting factories; add `createSearchActiveOneUsersUseCase`; update `createGetUsersUseCase`.
- Home launcher [app/(authenticated)/page.tsx](app/(authenticated)/page.tsx) — activate the Counting card and point it at the location chain.
- Reused as-is: shared `/location` module (`module=counting`), `useScanner` ([useScanner.ts](app/shared/ui/useScanner.ts)), `VerifyAdminUseCase` via the existing `/delivery/api/verify-admin` endpoint, `withPoMintRetry` ([activeonePoMinting.ts](app/shared/infrastructure/activeonePoMinting.ts)), Manila date helpers ([dates.ts](app/(authenticated)/replenishment/infrastructure/dates.ts)), `EMPLOYEE_CONTACT_TYPE` ([activeoneConstants.ts](app/shared/infrastructure/activeoneConstants.ts)), shared UI primitives (`Switch`, `Dialog`, `Sheet`, `Card`, `Input`, `Button`, `Badge`, `Skeleton`).

### DB — [scripts/create-app-tables.sql](scripts/create-app-tables.sql)
- Idempotent ALTER: `users.activeone_user_id int NULL`.
- New `CREATE TABLE IF NOT EXISTS stock_count` and `stock_count_items`.

### ActiveOne tables written (existing): `inventory_count`, `inventory_count_items`. Read: `item`, `item_location_units`, `item_units`, `unit_of_measure`, `contact` (TYPE 2), `user`, `location`.

## Decisions

- **Resolved by AI — Counter identity resolution (the key non-obvious fact).** `inventory_count` FKs require **`COUNTED_BY_ID` = `contact.ID`** and **`RECORDED_BY_ID` = `user.ID`** (verified in `activeone_no_data.sql`). But `users.employee_code` stores the contact's **`ACCOUNT_NO`**, not its PK (see memory *Employee Code = ACCOUNT_NO*). So at commit the server must resolve `users.employee_code` → `contact.ID WHERE ACCOUNT_NO = ? AND TYPE = 2`, and read `users.activeone_user_id` directly for `RECORDED_BY_ID`. Delivery never needed this (it only stores the code in its own table); counting does because it writes real FKs.
- **Resolved by AI — new users column `activeone_user_id`** (PRD-proposed name), nullable `int`, added via the idempotent ALTER pattern. Stores the ActiveOne `user.ID`.
- **Resolved by AI — unit/factor resolved entirely server-side at commit** (PRD §10 leaning), single source of truth. The client index carries only the display **symbol**; the write-time `UNIT_ID`/`UNIT_BASE_QUANTITY` are recomputed server-side per FR-9.
- **Resolved by AI — client loads a location-scoped scannable item index at screen entry** (`GET /counting/api?locationId=`), mirroring Delivery's deliberate full-masterlist client load (memory *Delivery Masterlist Client Load*). Scans resolve locally (fast, no per-scan round trip, FR-6); unknown codes are rejected client-side (FR-5). Not the `item_master_cache` (it lacks item id + unit).
- **Resolved by AI — `counting_continuous_scanning` is client-sent for the mirror, not a server gate.** Unlike Delivery's blind mode (a security gate resolved server-side), continuous scanning is purely informational, so the page reads it live from `/admin/api/settings` at load and sends it in the commit body — matching how Delivery sends `continuousScanning`.
- **Resolved by AI — per-action admin auth reuses `/delivery/api/verify-admin`** (PRD §7 says reuse the existing endpoint/use case). No new counting auth route.
- **Resolved by AI — ID/CODE minting reuses `withPoMintRetry`.** `inventory_count.ID`/`inventory_count_items.ID` have no AUTO_INCREMENT; mint `MAX(ID)+1` and `CODE = LPAD(MAX(CAST(CODE AS UNSIGNED))+1, 4, '0')` inside the transaction. `withPoMintRetry` is a generic transaction + dup-key retry wrapper (PO naming is cosmetic); its `PoNumberAssignmentError` maps to a generic 409 "could not save, retry."
- **Resolved by AI — no optimistic-concurrency re-read** (FR-19): every Save mints a fresh independent document.
- **Assumptions:** ERP `user` picker searches `NAME LIKE`, `LIMIT 20`, no `STATUS`/`TYPE` filter (dev dump has mixed values — see Open Questions). Quantities stored as whole integers in our mirror (`int`), written to ERP `QUANTITY decimal(16,6)` as whole values. Counting reuses no PO/blind machinery.

## Implementation Steps

### 1. DB — [scripts/create-app-tables.sql](scripts/create-app-tables.sql)
- Add an idempotent `information_schema.COLUMNS` guard + `ALTER TABLE users ADD COLUMN activeone_user_id int NULL AFTER employee_code` (copy the `employee_code` ALTER block).
- Add `CREATE TABLE IF NOT EXISTS stock_count`:
  `id` PK auto; `inventory_count_id int NOT NULL`, `inventory_count_code varchar(50) NOT NULL`; `location_id int NOT NULL`, `location_name varchar(255) NULL`; `counted_by_user_id int NOT NULL`, `counter_name varchar(255) NULL`, `counted_by_contact_id int NOT NULL`; `recorded_by_activeone_user_id int NOT NULL`, `recorder_name varchar(255) NULL`; `continuous_scanning tinyint(1) NOT NULL DEFAULT 1`; `note varchar(255) NULL`; `created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP`. No FK into ActiveOne (ID columns are plain ints), matching the `delivery` table convention.
- Add `CREATE TABLE IF NOT EXISTS stock_count_items`:
  `id` PK auto; `stock_count_id int unsigned NOT NULL` (FK → `stock_count(id)` ON DELETE CASCADE); `item_id int NOT NULL`, `item_code varchar(50) NULL`, `item_description text NOT NULL`; `unit_id int NULL`, `unit_symbol varchar(50) NOT NULL`, `unit_base_quantity decimal(16,4) NOT NULL`; `quantity int NOT NULL`. Index on `stock_count_id`.
- (Optional) no `app_settings` seed needed — a missing `counting_continuous_scanning` defaults to ON in code.

### 2. Counting domain — replace [CountRecord.ts](app/(authenticated)/counting/domain/CountRecord.ts) with `Count.ts`
- `interface CountableItem { code: string; itemId: number; description: string; unitSymbol: string }` — one scannable row per active item at the location.
- `interface CountLine { itemId: number; quantity: number }` — commit line.
- `interface CountCommit { locationId: number; counterUserId: number; note: string | null; continuousScanning: boolean; lines: CountLine[] }`.
- `interface CountResult { code: string; inventoryCountId: number; itemCount: number; totalUnits: number }`.
- `interface CounterGate { countedByContactId: number | null; recordedByUserId: number | null; counterName: string | null; recorderName: string | null }` — resolved identity for the gate.
- `class CounterNotLinkedError extends Error` (message names what's missing: employee link and/or ActiveOne login user) and `class EmptyCountError extends Error`. Mirror Delivery's `ReceiverNotLinkedError` shape.

### 3. Counting domain — rewrite [CountRepository.ts](app/(authenticated)/counting/domain/CountRepository.ts)
Port:
- `getCountableItems(locationId: number): Promise<CountableItem[]>`
- `getCounterGate(userId: number): Promise<CounterGate>` — resolves the two ERP identities + display names for the session user.
- `commit(input: CountCommit & { countedByContactId: number; recordedByUserId: number; counterName: string | null; recorderName: string | null; locationName: string | null }): Promise<CountResult>` — atomic ERP + mirror write.

### 4. Counting application
- Delete [GetCountRecordsUseCase.ts](app/(authenticated)/counting/application/GetCountRecordsUseCase.ts).
- `GetCountableItemsUseCase` — `execute(locationId)` → `repository.getCountableItems(locationId)`.
- `CommitCountUseCase` (mirrors [CommitDeliveryUseCase.ts](app/(authenticated)/delivery/application/CommitDeliveryUseCase.ts)):
  1. `gate = await repository.getCounterGate(input.counterUserId)`; if `countedByContactId == null || recordedByUserId == null` → throw `CounterNotLinkedError` (message reflects which is missing).
  2. If `input.lines.length === 0` → throw `EmptyCountError`.
  3. Delegate to `repository.commit({ ...input, countedByContactId, recordedByUserId, counterName, recorderName, locationName: gate?... })`. (Location name resolved in the repo alongside the transaction; pass through or resolve inside `commit`.)

### 5. Counting infrastructure — rewrite [MySQLCountRepository.ts](app/(authenticated)/counting/infrastructure/MySQLCountRepository.ts)
- `getCountableItems(locationId)` — one enriched query (mirror the unit-resolution join in [MySQLReplenishmentRepository.ts](app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts:120-136), extended for the per-location table):
  ```sql
  SELECT it.ID AS itemId, it.CODE AS code, it.DESCRIPTION AS description,
         COALESCE(uom_loc.SYMBOL, uom_pur.SYMBOL, uom_base.SYMBOL, '') AS unitSymbol
  FROM item it
  LEFT JOIN item_location_units ilu ON ilu.ITEM_ID = it.ID AND ilu.LOCATION_ID = ?
  LEFT JOIN unit_of_measure uom_loc  ON uom_loc.ID  = ilu.PURCHASES_UNIT_ID
  LEFT JOIN unit_of_measure uom_pur  ON uom_pur.ID  = it.PURCHASES_UNIT_ID
  LEFT JOIN unit_of_measure uom_base ON uom_base.ID = it.BASE_UNIT_ID
  WHERE it.INACTIVE = 0
  ORDER BY it.CODE
  ```
- `getCounterGate(userId)`:
  ```sql
  SELECT u.name AS counterName, u.activeone_user_id AS recordedByUserId,
         c.ID AS countedByContactId, au.NAME AS recorderName
  FROM users u
  LEFT JOIN contact c ON c.ACCOUNT_NO = u.employee_code AND c.TYPE = 2
  LEFT JOIN `user` au ON au.ID = u.activeone_user_id
  WHERE u.id = ? AND u.is_active = 1 LIMIT 1
  ```
  Return nulls where unresolved (stale employee link → `countedByContactId` null → gate fails, per FR/§9).
- `commit(input)` — wrap in `withPoMintRetry(async (conn) => { … })`:
  1. Resolve display unit + factor **per line** (server-authoritative, FR-9): for each `itemId`, join `item_location_units` (this location) → `PURCHASES_UNIT_ID`; factor from `item_units.QUANTITY` for `(itemId, that unit)` else 1; if no `item_location_units` row, use `item.PURCHASES_UNIT_ID ?? item.BASE_UNIT_ID`, factor 1. Do it as a single `WHERE it.ID IN (?)` batch query, not per line.
  2. Validate every `itemId` resolved to a real item (else reject — fail-fast).
  3. Mint header id: `SELECT MAX(ID) AS m FROM inventory_count` → `+1`; mint code: `SELECT MAX(CAST(CODE AS UNSIGNED)) AS m FROM inventory_count` → `LPAD(m+1, 4, '0')`.
  4. `INSERT INTO inventory_count (ID, CODE, DATE, RECORDED_ON, LOCATION_ID, COUNTED_BY_ID, RECORDED_BY_ID, NOTES, STATUS, STATUS_DATE, ADJUSTED)` with `DATE`/`STATUS_DATE = CURDATE()` (Manila — server runs UTC+8; see [dates.ts](app/(authenticated)/replenishment/infrastructure/dates.ts)), `RECORDED_ON = NOW()`, `STATUS = 3`, `ADJUSTED = 0`, `CUSTOM_FIELD1..5` left null (default). `NOTES` from trimmed note or null.
  5. Mint line ids `MAX(ID)+1` sequential from `inventory_count_items`; bulk `INSERT INTO inventory_count_items (ID, INVENTORY_COUNT_ID, LINE_NO, ITEM_ID, DESCRIPTION, QUANTITY, UNIT_ID, UNIT_BASE_QUANTITY, CLOSED)` — `DESCRIPTION` null, `CLOSED = 1`, `INVENTORY_ADJUSTMENT_ITEMS_ID`/`BATCH_ID`/`CUSTOM_FIELD*` null, `LINE_NO` sequential.
  6. Insert `stock_count` (header, with resolved names + `continuous_scanning` + minted `inventory_count_id`/`code`) and bulk `stock_count_items` (item code/description, unit id/symbol/factor, quantity) — the immutable mirror.
  7. Return `{ code, inventoryCountId, itemCount, totalUnits }`.

### 6. Counting API — rewrite [api/route.ts](app/(authenticated)/counting/api/route.ts)
- Remove PUT/DELETE.
- `GET(req)` — require session; parse `locationId` (positive int, else 400); return `{ items, canSave, gateReason }` where `items = GetCountableItemsUseCase.execute(locationId)` and `canSave`/`gateReason` come from the counter gate for the session user (so the UI can block Save + show the specific missing-link message before commit, FR-15). Side-effect-free.
- `POST(req)` — require session (`userId`); parse `{ locationId, note?, continuousScanning?, lines: [{itemId, quantity}] }`; sanitize lines (integer `itemId > 0`, `quantity` positive whole via `Math.trunc`, drop invalid); call `CommitCountUseCase.execute({ locationId, counterUserId: userId, note, continuousScanning: continuousScanning !== false, lines })`. Map errors: `CounterNotLinkedError`/`EmptyCountError` → 422; `PoNumberAssignmentError` → 409; else 500. Mirror [delivery/api/route.ts](app/(authenticated)/delivery/api/route.ts:60-148).

### 7. Counting page — rewrite [page.tsx](app/(authenticated)/counting/page.tsx) (`"use client"`)
Mirror the Delivery `ReceivingScreen`/Review/Success structure, stripped of PO/status/blind. Read `locationId` from the URL (redirect to `/location?module=counting&returnTo=%2Fcounting` if absent/invalid).
- On load: `GET /counting/api?locationId=` (items + `canSave`/`gateReason`); `GET /admin/api/settings` for `counting_continuous_scanning` (live, not snapshotted — FR-8/§5). Build a `Map<code, CountableItem>`.
- Screens `"counting" | "review" | "success"`. Per-location `localStorage` draft (key by `locationId`) restored on load, cleared on success (mirror Delivery's `storageKey`/`restoreSession`).
- Scanning via `useScanner` (disabled while review/modal/admin-gate open): resolve code in the map → +1 line (Continuous ON) or open the `QuantityModal` (Continuous OFF: empty focused whole-number field that **adds**, swallows scans while open, cancel = no-op). Unknown code → rejected with visual/audible feedback, nothing added. **Undo last scan** (no auth) reverses the last +1 or the whole last OFF entry.
- Review: list `item · unit symbol · quantity` (unit through `type-data`, never raw `font-mono` — lint rule); optional **note** field; **Edit qty / Delete line** each require an admin password per action via the reused `AdminAuthModal` posting to `/delivery/api/verify-admin`.
- Save: disabled unless `≥1 line` **and** `canSave` (else show `gateReason`); POST commit; on success show summary (minted `CODE` + per-line summary) and clear the draft.
- Reuse Delivery's visual patterns (Card rows, `Dialog`, `motion-safe:active:scale-*`); semantic tokens only.

### 8. Admin settings — [admin/api/settings/route.ts](app/(authenticated)/admin/api/settings/route.ts)
- GET: add `createGetAppSettingUseCase().execute("counting_continuous_scanning")` to the `Promise.all`; return `counting_continuous_scanning: raw === null ? true : raw === "on"`.
- PUT: accept a boolean `counting_continuous_scanning`; validate + `UpdateAppSettingUseCase.execute("counting_continuous_scanning", v ? "on" : "off")`; keep the `revalidateTag("app-settings")`.

### 9. Admin Counting settings card + tab
- New `admin/CountingSettingsCard.tsx` — copy [DeliverySettingsCard.tsx](app/(authenticated)/admin/DeliverySettingsCard.tsx) reduced to the single **Continuous Scanning** `Switch` bound to `counting_continuous_scanning`.
- [admin/page.tsx](app/(authenticated)/admin/page.tsx) — add `<TabsTrigger value="counting">Counting</TabsTrigger>` and a `<TabsContent value="counting">` section rendering `<CountingSettingsCard />` (copy the Delivery tab block/copy).

### 10. Admin Users — ActiveOne login-user mapping
- **Domain:** add `activeOneUserId: string | null` to [User.ts](app/(authenticated)/admin/domain/User.ts); add `activeOneUserId` to `CreateUserInput`/`UpdateUserInput` in [UserRepository.ts](app/(authenticated)/admin/domain/UserRepository.ts); new `admin/domain/ActiveOneUser.ts` `{ id: string; name: string }`.
- **Application:** new port `admin/application/ActiveOneUserDirectory.ts` (`search(query)`, `resolveNames(ids)`); new `SearchActiveOneUsersUseCase`; extend `CreateUserCommand`/`UpdateUserCommand` + both use cases to pass `activeOneUserId` through; extend `GetUsersUseCase` to inject `ActiveOneUserDirectory` and resolve `activeOneUserName` (mirror the `employeeName` resolution).
- **Infrastructure:** new `admin/infrastructure/MySQLActiveOneUserDirectory.ts` over the ActiveOne `user` table (`SELECT ID AS id, NAME AS name FROM user WHERE NAME LIKE ? ORDER BY NAME LIMIT 20`; `resolveNames` via `WHERE ID IN (?)`); extend [MySQLUserRepository.ts](app/(authenticated)/admin/infrastructure/MySQLUserRepository.ts) `COLUMNS`, `toUser`, `create`, `update` for `activeone_user_id`.
- **API:** new `admin/api/users/activeone-users/route.ts` (admin-gated, mirrors [employees/route.ts](app/(authenticated)/admin/api/users/employees/route.ts)); pass `activeOneUserId` through [users/route.ts](app/(authenticated)/admin/api/users/route.ts) POST and [users/[id]/route.ts](app/(authenticated)/admin/api/users/[id]/route.ts) PUT.
- **UI:** [UsersTab.tsx](app/(authenticated)/admin/UsersTab.tsx) — add an `ActiveOneUserPicker` (copy `EmployeePicker`, hitting `/admin/api/users/activeone-users`, storing id + name) in the sheet; include `activeOneUserId` in the create/update body; surface the mapping on the card (a line like the employee link).

### 11. Composition root — [container.ts](container.ts)
- Remove `createGetCountRecordsUseCase` (and its imports of `GetCountRecordsUseCase`). Add:
  - `createGetCountableItemsUseCase()` → `new GetCountableItemsUseCase(new MySQLCountRepository())`.
  - `createCommitCountUseCase()` → `new CommitCountUseCase(new MySQLCountRepository())`.
  - `createSearchActiveOneUsersUseCase()` → `new SearchActiveOneUsersUseCase(new MySQLActiveOneUserDirectory())`.
- Update `createGetUsersUseCase()` → `new GetUsersUseCase(new MySQLUserRepository(), new MySQLEmployeeDirectory(), new MySQLActiveOneUserDirectory())`.

### 12. Home launcher — [app/(authenticated)/page.tsx](app/(authenticated)/page.tsx)
- Counting module entry: `active: true`, `route: "/location?module=counting&returnTo=%2Fcounting"` (routes through location selection, which appends `?locationId=`).

### 13. Page title — [counting/layout.tsx](app/(authenticated)/counting/layout.tsx)
- Follow the `{Company} · Ops Hub · Counting` convention if the other modules set it via layout metadata (match Delivery's approach); otherwise leave the simple `title: "Counting"`.

## Risks & Open Questions

- **ERP `user` picker filtering** (PRD §10): defaulting to no `STATUS`/`TYPE` filter (dev dump is mixed). Confirm against live ERP whether inactive/system logins should be excluded; adjust `MySQLActiveOneUserDirectory.search` if so.
- **Stale employee link → no `contact.ID`.** If `users.employee_code` no longer matches a TYPE-2 contact, the gate fails and Save is blocked (correct per §9, but surfaces as "not linked"). The message should distinguish "employee link unresolved" from "never set" if practical.
- **Client index size/perf.** The location-scoped scannable query returns all active items (tens of thousands). This mirrors Delivery's deliberate client-side masterlist load (memory *Delivery Masterlist Client Load*) — acceptable, but validate payload/scan latency on device; consider server-side gzip if heavy. Do **not** move classification server-side.
- **Concurrent `MAX(ID)+1` minting** on `inventory_count`/`inventory_count_items` against ActiveOne's native writer — handled by `withPoMintRetry` dup-key retry; verify the retry surfaces cleanly under real contention.
- **Manila dates** rely on the server running UTC+8 (`CURDATE()`/`NOW()`); consistent with the rest of the app but worth confirming on the production host (memory *mysql2 DATE Column Shift*).
- **`QUANTITY decimal(16,6)` vs whole-unit mirror `int`** — counting is whole numbers only (FR-11); ensure no fractional values slip through the API sanitizer.
