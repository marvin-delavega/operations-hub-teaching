# Operations Hub — Cross-Cutting Feature Ideas

Captured 2026-07-22. Not yet scoped — each Tier 1 item likely warrants its own PRD before implementation.

Context: Operations Hub is in early scaffolding phase with four functional modules (Delivery, Counting, Replenishment, History) and two stubs (Invoice, Transfer). Core infrastructure — auth/RBAC, DB connection management, design tokens, scanner hook — is in place. The biggest gaps are the unimplemented stubs, lack of testing, no offline resilience beyond `localStorage`, and no operational visibility (dashboards, notifications, audit). These ideas span the full product surface.

## Tier 1 — Highest value

- [ ] **Invoice Releasing module** — The last major unimplemented module from the requirements. Scans items against an ActiveOne invoice, validates line quantities (must balance), saves as a Warehouse Release. Completes the core floor-tool trifecta (Delivery, Counting, Invoice).

- [ ] **Inventory Transfer & Bad Orders module** — The other major stub. Multi-location transfers (Selling Area, Stockrooms, BO Room), on-hand validation, admin review-and-approve workflow before ERP write-back. Bad Order tagging with reason codes. Unlocks the full stock-movement lifecycle.

- [ ] **Automated test suite** — Currently "no tests yet." A deliberate testing strategy (Playwright e2e for scan flows, Vitest for use cases and domain logic) is the single highest-ROI investment for a warehouse floor tool where bugs mean inventory discrepancies.

- [ ] **Offline / batch-scan resilience** — Requirements call for Eyoyo internal-memory bulk-storage mode for zero-Wi-Fi areas. Current `localStorage` draft survives page reload but not a device crash or browser clear. A structured offline queue (IndexedDB + sync-on-reconnect) would bridge the gap between "floor tool" and "reliable floor tool."

- [ ] **Print infrastructure (shared)** — History module has per-module print support, but there's no shared print utility. A reusable `<PrintableReport>` wrapper, shared `@media print` stylesheet, and a print-preview dialog would prevent drift across Delivery, Counting, and Replenishment reports.

## Tier 2 — Strong, moderate effort

- [ ] **Audit log** — Multiple deferred references in specs (admin actions, delivery overrides, return-excess events, RBAC changes). An append-only `audit_log` table (actor, action, target, payload, timestamp) with a dedicated History tab would satisfy compliance and debugging needs in one pass.

- [ ] **Dashboard / operations snapshot** — The landing page is a module launcher with no data. A configurable dashboard (due deliveries today, overdue POs, recent counts, replenishment run summary) would give supervisors and admins at-a-glance awareness without drilling into each module. Keep it permission-scoped and lightweight (no drag-drop widgets in v1).

- [ ] **PWA / installable mobile app** — Currently a browser-only web app. A manifest + service worker would let floor staff install Ops Hub to their Android home screen, get a full-screen experience, and potentially enable background sync for the offline mode above. Low-effort, high-perception value for mobile-first users.

- [ ] **Bulk item master import / refresh UI** — Delivery's `item_master_cache` is refreshed via a bare `/admin` button with no progress, no diff, no error reporting. A richer import UI (last-refreshed timestamp, row count, new/removed items, failure details) would make admin more confident in cache health.

- [ ] **Location-level settings (per-location overrides)** — `delivery_continuous_scanning` and `counting_continuous_scanning` are global. Some locations may warrant different defaults (e.g., a high-volume dock wants continuous ON; a slow stockroom wants modal entry). A per-location override table with fallback to global would match real workflows.

- [ ] **Replenishment: what-if / scenario mode** — A non-destructive sandbox where the buyer can tweak order periods, lead times, or safety stock and see the impact on suggested quantities without committing. Reuses all existing computation; just wraps it in a compare view.

- [ ] **Replenishment: batch PO print / export from run summary** — After a run is submitted, the summary screen could offer "Print all POs" (one `.pdf` per PO or a combined document) and "Export to CSV" for the buyer's records. Currently the buyer must screenshot or re-enter.

- [ ] **Delivery: smart PO sorting / priority** — Open PO grid is unsorted. Sort by urgency (expected delivery date ascending), by supplier, or by overdue status. A "Receiving today" pinned section for POs whose expected date is today or yesterday would speed selection.

- [ ] **Replenishment: "Show all items" toggle (Standard only)** — A toggleable setting in a new **Ordering** admin tab that makes the Standard replenishment run display every item for the selected suppliers, not just those with `rawNeed > 0`. When enabled, items with `suggestedQty == 0` appear grayed out/unchecked so the buyer can see zero-order items and optionally override the quantity to place a manual order. Does not affect the Stockout tab. New setting stored in `app_settings` (e.g. `ordering_show_zero_qty_items`); new `admin.ordering` permission gates the tab.

## Tier 3 — Convenience / workflow

- [ ] **Scanner-triggered module switching** — A dedicated "scan a PO code" input on the landing page that jumps directly into the Delivery receiving screen for that PO. Saves two taps on a high-volume day.

- [ ] **Counting: multi-location batch counts** — Currently one location per count document. A supervisor might want to batch-count multiple stockrooms in one session. A "select locations" step before counting (modeling delivery's flow) would cover this.

- [ ] **Global search (find any PO, count, run)** — A Cmd/Ctrl-K search palette that indexes POs (original + app-created), stock count documents, and replenishment runs. Quick navigation for admins who jump between modules.

- [ ] **History: diff view between runs** — A side-by-side or overlay compare between two replenishment runs for the same location/supplier. Useful when a buyer wants to see what changed between last week's order and this week's.

- [ ] **Role cloning in Admin** — Creating a new role that's "like Staff but with X extra permission" requires manually checking every box. A "Clone from existing" action on the role creation sheet would save time and reduce misconfiguration.

- [ ] **Setup wizard: skip / defer steps** — The first-run wizard is strictly linear. A supervisor setting up the system might want to skip Location Visibility or Delivery settings and come back later. Adding a "Skip this step (set up later in Admin)" action would reduce setup friction.

- [ ] **Theme persistence indicator in account menu** — A subtle hint showing the current theme mode (Light/Dark/System) next to the theme toggle, so the user knows what's active without tapping in.

## Suggested starting point

**Build Invoice and Transfer modules first** — they are the two remaining major requirements from the original proposal, the scaffolding pattern (clean-architecture layers, `container.ts` wiring, scanner hook, RBAC gates) is fully established, and completing them lets the client run the full floor workflow without workarounds. Follow each with its own PRD referencing the canonical patterns from Delivery and Counting. 

If reliability is the priority instead, **invest in the test suite + offline resilience together** — tests make offline refactoring safe, and offline mode is the feature most likely to fail on the warehouse floor if neglected.
