# Supplier Purchase Order Print Report -- Feature Ideas

Captured 2026-08-29. Not yet scoped -- each Tier 1 item likely warrants its own
PRD before implementation.

Context: The replenishment module creates Purchase Orders in ActiveOne (one PO per supplier+manufacturer combo). Currently users can print an audit report from History that shows the full decision context (sales rate, DOS, suggested vs final qty, overrides). What's missing is a clean, supplier-facing Purchase Order document showing only SKU, description, unit of measure, and quantity — formatted as a formal PO to send to the supplier.

## Tier 1 -- Highest value
- [ ] **Per-PO printable document in History** — Each PO in a replenishment run (grouped by supplier+manufacturer) should have a "Print PO" button that renders a clean, landscape document with company header, PO number, supplier info, and line items (SKU, description, UoM, qty only) — no internal decision columns. This replaces the need to manually recreate POs in Word/Excel.
- [ ] **Per-PO printable document on Summary screen** — After submitting/approving a run, the "Purchase Orders Created" screen shows PO numbers per supplier+manufacturer. Add a "Print PO" button per row so users can immediately print the supplier-facing PO without navigating to History.

## Tier 2 -- Strong, moderate effort
- [ ] **Supplier address/contact on PO** — Pull supplier name/address from ActiveOne Contact table and include on the PO document (requires joining Contact data in the history API or adding to the snapshot).
- [ ] **Company details header** — Include company name, address, phone, email from app_settings (already has company_name; may need additional fields).
- [ ] **Terms & conditions footer** — Configurable standard terms (payment terms, delivery instructions) printed at bottom of each PO.

## Tier 3 -- Convenience / workflow
- [ ] **Batch print all POs for a run** — Single button to open print dialog with all supplier POs concatenated (with page breaks between).
- [ ] **Email PO directly** — Future: integrate with email to send PO PDF to supplier contact email from ActiveOne.

## Suggested starting point
Start with **Tier 1 item 1 (History per-PO print)** — it reuses the existing `PrintReport` pattern already implemented for the audit report, just with a different column set (SKU, Description, UoM, Qty) and supplier-facing layout. The data is already in `ReplenishmentRunDetail.pos[n].lines` with `itemCode`, `itemDescription`, `unitSymbol`, `finalQty`. Then replicate the same component on the Summary screen (Tier 1 item 2) by extracting the print logic into a shared component.