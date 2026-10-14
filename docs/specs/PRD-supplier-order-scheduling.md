# PRD: Supplier Order Scheduling
Date: 2026-06-22

## 1. Overview

A configuration system that assigns repeating order schedules to suppliers, surfacing time-sensitive ordering prompts throughout the replenishment workflow. Admins configure schedules per supplier via a Kanban interface in `/admin`. The supplier selection step in the replenishment flow groups suppliers by due status and annotates their tiles with next order dates. The landing page Replenishment module card shows a badge count of suppliers due for ordering today.

## 2. Goals

- Admins can assign weekly, monthly, or lead-time-based order schedules to all suppliers via a Kanban board
- Users see suppliers due for ordering surfaced prominently and grouped in the replenishment supplier selection step
- The landing page Replenishment module card shows a badge count of suppliers due today
- The system tracks last order date per supplier and updates it automatically on PO submission

## 3. Non-Goals

- No automatic PO generation triggered by a schedule
- No push notifications or email alerts
- No per-user schedule preferences
- No multi-day weekly schedules (strictly one weekday per supplier)
- No onboarding nudge for unconfigured suppliers
- No distinct "Overdue" visual treatment — overdue and due-today are treated identically

## 4. Users & Roles

- **Admin:** full access to the Order Scheduling tab in `/admin`; can create, move, and update supplier schedules
- **Staff:** read-only visibility of due tags, sections, and badge; cannot modify schedules

## 5. Functional Requirements

**Admin — Order Scheduling Kanban**

- FR-1: A new "Order Scheduling" tab appears in `/admin`.
- FR-2: The tab displays a Kanban board with three columns in this order: **Weekly**, **Monthly**, **Lead-time**.
- FR-3: All suppliers are shown in the Kanban. Suppliers without an explicit weekly or monthly schedule appear in the Lead-time column by default.
- FR-4: A search bar at the top of the Kanban filters visible supplier cards across all columns (case-insensitive, partial name match).
- FR-5: Dragging a supplier card to the **Weekly** column opens a prompt requiring selection of a day of the week (no pre-selected default). Confirming saves and moves the card; cancelling snaps it back to its previous column.
- FR-6: Dragging a supplier card to the **Monthly** column opens a prompt requiring entry of a day of the month (1–31). Confirming saves and moves the card; cancelling snaps it back.
- FR-6b: Dragging a supplier card to the **Lead-time** column requires no prompt. It sets `schedule_type = 'lead_time'`, clears `week_day`/`month_day`, and persists immediately.
- FR-7: Each supplier card in the Lead-time column displays the supplier's lead time value (in days) fetched from ActiveOne `Contact.CUSTOM_FIELD3` and the current `last_ordered_at` value if set. Cards with no `CUSTOM_FIELD3` value (or a value ≤ 0) are visually marked **unscheduled — no lead time** to distinguish them from effective lead-time suppliers.
- FR-8: When an admin first assigns **any** schedule (weekly, monthly, or lead-time) to a supplier that has no `last_ordered_at` yet, the system pre-fills `last_ordered_at` with the most recent PO date for that supplier from ActiveOne. The admin can override this value before confirming. If the supplier has no PO history, `last_ordered_at` stays null (see FR-10 / null-anchor edge case).
- FR-9: Kanban changes are persisted immediately on confirmation. There is no save-all button.

**Due Date Calculation**

- FR-10: For **lead-time** suppliers, `next_order_date = last_ordered_at + lead_time_days`. If `last_ordered_at` is null, the anchor defaults to today, making `next_order_date = today + lead_time_days`.
- FR-11: For **weekly** suppliers, `next_order_date` is the most recent occurrence of the configured weekday **on or before today (today itself counts)**. If `last_ordered_at ≥ that date`, the supplier is not yet due; the next due date is the following week's occurrence.
- FR-12: For **monthly** suppliers, the same logic applies using the configured day of the month. The day is clamped to the last day of the month when it exceeds the month's length (e.g., day 31 in February → Feb 28/29).
- FR-13: A supplier is **due today** if its `next_order_date ≤ today` (includes overdue). A supplier is **due tomorrow** if its `next_order_date = tomorrow`. All others are **other**.
- FR-14: Suppliers with no `CUSTOM_FIELD3` value and no weekly/monthly schedule are **unscheduled** — they have no effective schedule and are excluded from due calculations and the badge count.

**PO Submission Integration**

- FR-15: On successful PO submission through the replenishment module, `last_ordered_at` is updated to today for every supplier included in that submission.
- FR-16: If a PO is submitted for a supplier with no existing `supplier_schedule` record, a record is created with `schedule_type = 'lead_time'` and `last_ordered_at = today`.

**Supplier Selection Step (/supplier)**

- FR-17: The supplier list is displayed in three labeled sections: **Due Today**, **Due Tomorrow**, **Others**.
- FR-18: Within **Due Today**: sorted by most overdue first (earliest `next_order_date` ascending), then alphabetically on ties. Within **Due Tomorrow** and **Others**: sorted alphabetically.
- FR-19: Each supplier tile shows "Next order: [date]" below the supplier name for all scheduled suppliers. Unscheduled suppliers show no next order line.
- FR-20: Selection remains manual — due status does not pre-select suppliers.
- FR-21: Unscheduled suppliers appear in the **Others** section with no next order info.

**Replenishment Screen (/replenishment)**

- FR-22: Supplier group headers for suppliers in **Due Today** or **Due Tomorrow** show a **"Due"** tag next to the supplier name.

**Landing Page Badge**

- FR-23: The Replenishment module card on the landing page shows a badge with the count of suppliers in **Due Today** (next_order_date ≤ today, excluding unscheduled).
- FR-24: The badge count is **computed on read** (no cache). The underlying query is trivial date math over the supplier set, so no caching or invalidation is needed.

## 6. Data Model

**`supplier_schedule` table (our own table, in the ActiveOne MySQL database):**

> It resides in the **same MySQL database as ActiveOne**, so `due_status` resolves in a single query that JOINs `supplier_schedule` against `Contact.CUSTOM_FIELD3` — no second connection or in-app merge.

| Column | Type | Notes |
|---|---|---|
| `supplier_id` | integer PK | ActiveOne Contact ID |
| `schedule_type` | enum('weekly','monthly','lead_time') | default 'lead_time' |
| `week_day` | integer nullable | 0=Sunday … 6=Saturday; only for weekly |
| `month_day` | integer nullable | 1–31; only for monthly |
| `last_ordered_at` | date nullable | Lead-time anchor; updated on every PO submission for all schedule types |
| `created_at` | datetime | |
| `updated_at` | datetime | |

Lead time (days) is **not stored** in this table — always fetched live from ActiveOne `Contact.CUSTOM_FIELD3`.

**Next order date computation (server-side, per supplier):**

> **Timezone:** all date math uses **`Asia/Manila` (UTC+8)**. "today", "tomorrow", and the midnight cache boundary are evaluated in that zone — never server-local or UTC.
> **Single source of truth:** one shared server-side calculator produces `next_order_date` + `due_status`. `/supplier/api`, `/replenishment/api`, and the badge query all call it — no per-route reimplementation.
> **Naming caveat:** `next_order_date` is the supplier's **current effective due date and may be a past date** when overdue. The name reflects the displayed label ("Next order: …"), not a guarantee that the date is in the future.

- **Lead-time:** `last_ordered_at + lead_time_days` (or `today + lead_time_days` if null)
- **Weekly:** most recent occurrence of `week_day` on or before today (today counts); if `last_ordered_at ≥ that date`, next due is the following week
- **Monthly:** most recent occurrence of `month_day` on or before today (clamped, today counts); same overdue logic
- **Unscheduled:** no computation; excluded from badge and due sections

## 7. API Contract

**GET `/admin/order-scheduling/api`**
- Response: array of all suppliers with `{ supplier_id, name, schedule_type, week_day, month_day, last_ordered_at, lead_time_days }`
- `lead_time_days` is fetched from ActiveOne `Contact.CUSTOM_FIELD3`

**PUT `/admin/order-scheduling/api`**
- Request: `{ supplier_id, schedule_type, week_day?, month_day?, last_ordered_at? }`
- Validation (reject at the boundary, Fail Fast): `week_day` ∈ 0–6 required iff `schedule_type = 'weekly'`; `month_day` ∈ 1–31 required iff `schedule_type = 'monthly'`; both must be null/absent for `lead_time`.
- Response: `{ success: true }` or error

**GET `/supplier/api`** (extended from existing)
- Response: existing supplier fields plus `{ next_order_date: string|null, due_status: 'due_today' | 'due_tomorrow' | 'other' | 'unscheduled' }`

**GET `/replenishment/api`** (extended from existing)
- Response: existing fields plus per-supplier `{ due_status: 'due_today' | 'due_tomorrow' | 'other' | 'unscheduled' }`

**Badge count (landing page)**
- Computed on read (no cache): count of suppliers whose computed `next_order_date ≤ today` and whose schedule is effective (not unscheduled)

## 8. UI/UX Flow

**Admin — Order Scheduling Tab:**
1. Admin navigates to `/admin` → taps "Order Scheduling" tab.
2. Kanban board loads: Weekly | Monthly | Lead-time columns. All suppliers appear; unscheduled ones default to the Lead-time column.
3. Admin uses the search bar to locate a specific supplier by name.
4. Admin drags a supplier card to the **Weekly** column → a prompt appears with a day-of-week selector (no default pre-selected). Admin picks a day → confirms → card moves; or cancels → card snaps back.
5. Admin drags a supplier card to the **Monthly** column → a prompt appears with a day-of-month input (1–31) → confirms → moves; or cancels → snaps back.
6. For lead-time suppliers, each card shows the ActiveOne lead time value and `last_ordered_at`. Admin can edit `last_ordered_at` inline (pre-filled from ActiveOne last PO on first setup).
7. All changes persist immediately on confirm.

**Supplier Selection Step (`/supplier`):**
1. Page loads showing three sections: **Due Today**, **Due Tomorrow**, **Others**.
2. Each supplier tile shows the supplier name and, for scheduled suppliers, "Next order: [date]" below the name.
3. Due Today and Due Tomorrow tiles are ordered per FR-18; Others alphabetically.
4. User taps tiles to toggle selection. "Continue (N selected)" enables at N ≥ 1.

**Replenishment Screen (`/replenishment`):**
1. Supplier group headers for due-today or due-tomorrow suppliers show a **"Due"** tag beside the supplier name.

**Landing Page (`/`):**
1. Replenishment module card displays a badge with the count of suppliers due today (computed on read).

## 9. Edge Cases & Error Handling

- **Supplier with no CUSTOM_FIELD3 in Lead-time column:** No effective schedule. Treated as unscheduled — no "Next order" shown on tile, excluded from badge count, placed in Others section.
- **Monthly day > month length:** Clamp to last day of month (e.g., day 31 → Feb 28 or 29, Apr 30, etc.).
- **`last_ordered_at` null for lead-time supplier:** Anchor defaults to today; `next_order_date = today + lead_time_days`.
- **"Next order" date is in the past (overdue):** Tile still shows "Next order: [past date]". The section heading (Due Today) provides the urgency context. No separate "Overdue" label.
- **PO submitted for supplier with no schedule record:** Create a record with `schedule_type = 'lead_time'`, `last_ordered_at = today`. Does not assign the supplier to any specific column — they remain in the default Lead-time column.
- **ActiveOne last PO fetch fails during setup:** Admin can enter `last_ordered_at` manually. The field is not required to save the schedule.
- **Drag cancelled mid-animation:** Card snaps back to its original column; no data is written.
- **Supplier has lead time of 0 or negative in CUSTOM_FIELD3:** Treat as unscheduled (no effective schedule).

## 10. Open Questions

None remaining. Resolved during review:
- **Due-on-the-day:** the configured weekday/month-day counts as due **today** (FR-11, FR-12, §6).
- **Null anchor on first assignment:** prefill `last_ordered_at` from the most recent ActiveOne PO for any schedule type (FR-8).
- **Table location:** `supplier_schedule` lives in the same MySQL database as ActiveOne, JOINable in one query (§6).
- **Badge:** computed on read, no cache (FR-24, §7).

## 11. Out of Scope / Deferred

- Multi-day weekly schedules (one weekday per supplier only, by design)
- Distinct "Overdue" visual treatment separate from "Due Today"
- Onboarding prompt for admins to configure unconfigured suppliers
- Push/email/SMS notifications for due suppliers
- A "due soon" lookahead beyond one day (only tomorrow is surfaced)
- Overdue badge count beyond today (badge counts due-today only)
- PO edit/list module (separate planned module, unrelated)
- **`last_ordered_at` resync from ActiveOne** — it advances only on POs submitted through this app (FR-15). Orders placed directly in ActiveOne do not update it, so it can drift stale and produce false "due" signals. Periodic resync from ActiveOne PO history is deferred.
