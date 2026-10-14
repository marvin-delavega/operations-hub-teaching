# Implementation Plan: Reserved last-digit for ActiveOne PO IDs

Source PRD: [PRD-activeone-id-digit-reservation.md](PRD-activeone-id-digit-reservation.md)
Date: 2026-09-09

## Summary

Stop intermittent duplicate-ID PK errors on PO saves by reserving a disjoint, configurable
last digit per object table (`purchase_order`, `purchase_order_items`). The app still bumps
`object_type_map.NEXT_ID` by `INCREMENT` (so native ActiveOne continues past), but inserts
each row at that next value with its units digit replaced by the table's reserved digit —
putting app rows in a numeric sub-stream native never emits. Two new `app_settings` digits,
editable in the Admin General tab, read server-side at save time by both replenishment and
delivery (the two PO writers). `withPoMintRetry` remains the collision backstop.

## Affected Areas

- `app/shared/infrastructure/activeonePoMinting.ts` — change `acquireNextObjectId` to apply
  a reserved digit to the returned ID (the core of the fix); both PO writers call it for
  header + lines.
- Writers (no logic change beyond the reserved digit reaching `acquireNextObjectId`):
  - `app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts`
    (`createAll`, Standard + Stockout paths, ~L427/L445 and ~L626/L662).
  - `app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts` (`commit`,
    ~L353 and ~L371/L416).
- Settings plumbing (mirror the `po_code_prefix` path end-to-end):
  - Seed: `app/(authenticated)/admin/infrastructure/SeedAppSettingsRepository.ts` (+ the real
    seed used at install, referenced from `create-app-tables.sql` if PO settings are seeded
    there) — add `po_header_id_reserved_digit: "1"`, `po_line_id_reserved_digit: "1"`.
  - Read/validate/store: `app/(authenticated)/admin/api/settings/route.ts` (GET + PUT) — add
    two fields gated under `admin.general_settings` with digit-only validation.
  - UI: `app/(authenticated)/admin/PoCodeSettingsCard.tsx` — add two small number inputs
    (the reserved digits) + a live collision probe; this card already owns PO-id concerns.
- `docs/activeone-schema-insights.md` / `PRD-po-id-code-minting.md` — add a pointer noting
  the PK scheme is superseded by this PRD for PO/PO-lines (CODE minting unchanged).

## Decisions

- **Resolved by developer:** adopt the last-digit-reservation scheme (replace the units digit
  of the counter's next value), bumping `object_type_map` by `INCREMENT` unchanged so native
  continues past app rows. This walks back PRD-po-id-code-minting's "no reserved range".
- **Resolved by AI — one digit per table, two keys.** Header and lines are distinct tables
  with distinct `object_type_map` rows, so two settings (`po_header_id_reserved_digit`,
  `po_line_id_reserved_digit`), default `1`. Rationale: PRD "for now its purchase order and
  purchase order items each".
- **Resolved by AI — reserved digit applied by `acquireNextObjectId`, not by callers.** Every
  PO ID today funnels through this one shared function; changing it there covers both writers
  and both line/header without touching repository call sites. Rationale: DRY + the single
  authoritative minting point.
- **Resolved by AI — Admin General tab.** `po_code_prefix` (the direct analog) is edited there
  under `admin.general_settings`, and PO-id integrity is already surfaced on
  `PoCodeSettingsCard`. Rationale: consistency; no new tab/permission.
- **Assumptions:** (1) the observed native ending digit for both PO tables is not `1`
  (default); if the live probe disagrees, default to a digit not present in the current
  ceiling. (2) `withPoMintRetry` remains the safety net, so an imperfect digit costs an
  occasional retry, never data loss.

## Implementation Steps

Layered top-down for clarity; the setting read is the entry point.

### 1. Core minting — `acquireNextObjectId` applies the reserved digit
File: `app/shared/infrastructure/activeonePoMinting.ts`

Add an optional param and digit substitution:
```ts
export async function acquireNextObjectId(
  conn: PoolConnection,
  ao: string,
  objectTableName: string,
  reservedDigit?: number,   // 0-9; undefined => current behavior (no substitution)
): Promise<number> {
  // existing atomic UPDATE bump by INCREMENT (unchanged) ...
  const next = Number(rows[0]?.v ?? 0);      // pre-bump value native would take
  if (reservedDigit === undefined) return next;
  return Math.floor(next / 10) * 10 + reservedDigit;
}
```
Behavior: the counter is still bumped to `next + INCREMENT`; only the *returned* ID (what the
repo INSERTs as the PK) has its units digit forced to `reservedDigit`. The app row is always
`< next + INCREMENT`, i.e. below what native will next allocate, so native never re-issues it.
Do **not** substitute when `reservedDigit` equals the value's existing units digit (no-op).

### 2. Resolve + thread the reserved digits into both PO writers
Each writer already resolves `po_code_prefix` from `app_settings` inside its transaction via
`createGetAppSettingUseCase().execute(...)`. Do the same for the two digits, then pass them:
- `MySQLPurchaseOrderRepository.ts`: read
  `createGetAppSettingUseCase().execute("po_header_id_reserved_digit")` and
  `"..._items_reserved_digit"` (default `"1"`, coerce `Number`) near the existing prefix read
  (L388 and L614); call `acquireNextObjectId(conn, ao, OBJECT_TYPE_PO, headerDigit)` (L427,
  L626) and `acquireNextObjectId(conn, ao, OBJECT_TYPE_PO_LINES, lineDigit)` (L445, L662).
- `MySQLDeliveryRepository.ts`: same two reads near L230's prefix read; pass `headerDigit`
  (L353) and `lineDigit` (L371, L416).

The existing `ensurePoIdCountersLive(conn, ao)` call before minting is unchanged — it still
raises a stale counter above real `MAX(ID)` so the app's reserved-digit row never lands on an
existing ID.

### 3. Settings plumbing
- `SeedAppSettingsRepository.ts`: add both keys = `"1"` to `store`. Confirm whether the
  install-time seed in `create-app-tables.sql` (or a `seed` script) also populates
  `app_settings` defaults; add `1` rows there too if it does. (Missing keys default to `"1"`
  at read time, so seeding is belt-and-suspenders.)
- `admin/api/settings/route.ts` GET: read both keys (L94-95 block), return
  `po_header_id_reserved_digit` / `po_line_id_reserved_digit` as numbers (default `1`). PUT:
  add both to the destructure + type (L145-163) and to the `admin.general_settings` guard
  (L166); validate each is an integer 0-9 before `createUpdateAppSettingUseCase().execute`.

### 4. Validation probe for the chosen digits (server + UI hint)
Admin must not pick a digit that collides with the current native ceiling. Add a small helper
(in `admin/api/settings/route.ts` or a new `admin/api/po-id-digit/…`) that, for a table, counts
existing rows whose units digit equals the candidate **within the allocator's active window**
— minimal correct probe: count rows `WHERE ID % 10 = d` that are `> (SELECT MAX(ID) FROM t) - 100`
(a window of recent native IDs). Non-zero ⇒ warn "native PO rows already end in `d`; app rows
would retry past them." Guarded by `withPoMintRetry`, this is advisory, not blocking.

### 5. Admin General tab UI
`PoCodeSettingsCard.tsx`: add two labeled `<Input type="number" min={0} max={9} step={1}>`
(Header last digit, Line last digit) next to the existing fields; extend `validationError`,
`save({...})`, `dirty`, and `refreshRead()`; show the probe warning under the fields; update
the explanatory caption to describe the digit-reservation scheme (replacing the units digit of
ActiveOne's next PO ID so native never collides). Reuse `type-data`, existing tokens — no new
primitives.

### 6. Docs
Add a short "superseded by" note in `docs/activeone-schema-insights.md` and
`docs/specs/PRD-po-id-code-minting.md` pointing to this PRD for the PK-ID scheme, stating CODE
(`OHPO-`, `po_code_counter`) minting is unchanged.

## Verification

- `npx tsc --noEmit` and `npm run lint` (per CLAUDE.md; `npm run build` hangs in this env).
- **Live allocator probe (step 0 — do before relying on the scheme):** record
  `object_type_map.NEXT_ID` and `MAX(ID)` for `PURCHASE_ORDER`/`PURCHASE_ORDER_LINES`, create
  one native PO in ActiveOne, re-read, and confirm native consumed `NEXT_ID` (bump `INCREMENT`)
  rather than `MAX(ID)+10`. Adjust the reserved-digit default/validation to the confirmed model
  if needed.
- Save a replenishment PO and a delivery supersede; confirm header/line IDs end in the reserved
  digit, `object_type_map.NEXT_ID` advanced past them, and no native re-issue.

## Risks & Open Questions

- **Allocator model unconfirmed** — the dominant risk. The scheme's collision-free proof holds
  under "native reads `object_type_map`"; under "native self-derives `MAX(ID)+10`" the reserved
  digit must differ from the *current* `MAX(ID)` units digit and can drift. The live probe is
  mandatory before rollout.
- **Digit reuse across installs**: each ActiveOne install's native last digit may differ; the
  Admin probe + editable digit covers this. `1` is a default, not a guarantee.
- **Gap accumulation**: app rows sit one-above-the-block less than native's stream, leaving a
  few unused IDs per app save. Harmless (IDs need only be unique, not contiguous) but worth
  noting for auditors.
