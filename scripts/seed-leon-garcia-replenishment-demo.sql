-- ============================================================================
-- Demo seed: surface replenishment alerts for the Leon Garcia Warehouse
-- (location ID 39) in the home-screen Replenishment widget.
--
-- The loaded ActiveOne dump (greatwall_activeone) ends ~Feb 2026, so there is no
-- current-month off-take anywhere — the widget shows "All clear". This script adds
-- one invoice of this-month sales at Leon Garcia Warehouse for seven REAL items
-- (each with an active preferred vendor and only 1 unit on hand), then drives the
-- same two-stage pipeline the app uses on a widget refresh:
--
--   1. invoice + invoice_items          ← the "invoice sales data" itself
--   2. item_sales_daily (off-take rollup) for loc 39  ← mirrors the read-time self-heal
--   3. replenishment_summary             ← mirrors RecomputeReplenishmentSummaryUseCase
--
-- After this runs the widget lists "Leon Garcia Warehouse" with one alert row per
-- supplier (SONIC, CSC, Coca-Cola, Prime Choice, Jakkar, Rosabaya). A later real
-- refresh reproduces the same result from the invoice rows (steps 2-3 are idempotent).
--
-- Window/period constants mirror MySQLReplenishmentSummaryRepository:
--   SALES_WINDOW_DAYS = 31 (today-30 .. today), BADGE_ORDER_PERIOD_DAYS = 7,
--   PO_OPEN_STATUS = 2, VENDOR_CONTACT_TYPE = 0, LEAD_TIME_FIELD = CUSTOM_FIELD4.
--
-- Idempotent: safe to re-run. Invoice DATE is fixed mid-month so it stays inside the
-- rolling 31-day window for any "today" in the back half of June 2026.
-- Run against the local dev greatwall_activeone DB only.
-- ============================================================================

START TRANSACTION;

-- --- 1. Invoice sales data (location 39, this month) ------------------------
-- Cleanup prior runs first (child before parent).
DELETE FROM invoice_items WHERE INVOICE_ID = 9000001;
DELETE FROM invoice       WHERE ID = 9000001;

-- IDs chosen well above live maxima (invoice 1,088,552 / invoice_items 8,144,642).
-- CUSTOMER_ID 736 is a real customer contact. STATUS 11 (Paid) is not excluded by
-- the off-take filter (STATUS NOT IN (0,6,7)). DATE 2026-06-15 = "this month".
INSERT INTO invoice (ID, RECORDED_ON, CODE, DATE, CUSTOMER_ID, LOCATION_ID, AMOUNT, IS_FC, STATUS)
VALUES (9000001, NOW(), 'INV-LGDEMO-01', '2026-06-15', 736, 39, 0, 0, 11);

-- Seven real items stocked at Leon Garcia Warehouse, each on_hand = 1, lead 7 days.
-- QUANTITY = base units sold this month; UNIT_ID = item base unit; UNIT_BASE_QUANTITY = 1
-- (base total = QUANTITY × UNIT_BASE_QUANTITY). Quantities dwarf on-hand+incoming so
-- every item's suggested order qty > 0 (and DOS < lead time → critical).
INSERT INTO invoice_items (ID, INVOICE_ID, LINE_NO, ITEM_ID, QUANTITY, UNIT_ID, UNIT_BASE_QUANTITY, RATE, AMOUNT) VALUES
  (9000001, 9000001, 1, 143591, 150, 35, 1, 0, 0),  -- Sonic Sales & Distribution
  (9000002, 9000001, 2,  40576, 120, 37, 1, 0, 0),  -- CSC Warehousing & Marketing
  (9000003, 9000001, 3, 283201, 200, 17, 1, 0, 0),  -- Coca-Cola Europacific
  (9000004, 9000001, 4, 388702, 130, 37, 1, 0, 0),  -- Prime Choice Marketing
  (9000005, 9000001, 5, 143841, 160, 35, 1, 0, 0),  -- Sonic Sales & Distribution
  (9000006, 9000001, 6,  90431, 180, 17, 1, 0, 0),  -- Jakkar Marketing
  (9000007, 9000001, 7, 342862, 110, 37, 1, 0, 0);  -- Rosabaya Distributors

-- --- 2. Off-take rollup for loc 39 (mirrors read-time self-heal) -------------
-- Recompute item_sales_daily for Leon Garcia Warehouse over the rolling window from
-- the raw invoice/sales_receipt source (this is exactly what ensureDaysExist does for
-- any missing day). Idempotent via ON DUPLICATE KEY UPDATE.
INSERT INTO item_sales_daily (location_id, item_id, sale_date, units_sold, updated_at)
SELECT s.location_id, s.item_id, s.sale_date, SUM(s.qty_base), NOW()
FROM (
  SELECT i.LOCATION_ID AS location_id, ii.ITEM_ID AS item_id, i.DATE AS sale_date,
         ii.QUANTITY * COALESCE(ii.UNIT_BASE_QUANTITY, 1) AS qty_base
  FROM invoice_items ii
  JOIN invoice i ON i.ID = ii.INVOICE_ID
  WHERE i.LOCATION_ID = 39 AND i.DATE BETWEEN CURDATE() - INTERVAL 30 DAY AND CURDATE()
    AND i.STATUS NOT IN (0, 6, 7)
  UNION ALL
  SELECT sr.LOCATION_ID, sri.ITEM_ID, sr.DATE,
         sri.QUANTITY * COALESCE(sri.UNIT_BASE_QUANTITY, 1)
  FROM sales_receipt_items sri
  JOIN sales_receipt sr ON sr.ID = sri.SALES_RECEIPT_ID
  WHERE sr.LOCATION_ID = 39 AND sr.DATE BETWEEN CURDATE() - INTERVAL 30 DAY AND CURDATE()
    AND sr.STATUS NOT IN (0, 6, 7)
    AND COALESCE(sr.RETURN_TRX, 0) = 0 AND sr.VOID_REFERENCE_NO IS NULL
) s
GROUP BY s.location_id, s.item_id, s.sale_date
HAVING SUM(s.qty_base) > 0
ON DUPLICATE KEY UPDATE units_sold = VALUES(units_sold), updated_at = VALUES(updated_at);

-- --- 3. Replenishment summary (mirrors RecomputeReplenishmentSummaryUseCase) -
-- Full delete + reinsert, exactly like the use case. Only rows whose suggested order
-- qty > 0 for a 7-day order period (+ supplier lead time) are kept.
DELETE FROM replenishment_summary;

INSERT INTO replenishment_summary
  (location_id, location_name, supplier_id, supplier_name, items_to_order, computed_at)
WITH item_info AS (
  SELECT it.ID AS item_id, it.PREFERRED_VENDOR_ID AS supplier_id,
         COALESCE(CAST(NULLIF(c.CUSTOM_FIELD4, '') AS UNSIGNED), 0) AS lead_time_days
  FROM item it
  JOIN contact c ON c.ID = it.PREFERRED_VENDOR_ID AND c.INACTIVE = 0 AND c.TYPE = 0
  WHERE it.INACTIVE = 0 AND it.PREFERRED_VENDOR_ID IS NOT NULL
),
on_hand AS (
  SELECT inv.ITEM_ID AS item_id, inv.LOCATION_ID AS location_id,
         SUM(inv.ENDING_QUANTITY) AS on_hand
  FROM item_inventory inv
  JOIN (
    SELECT ITEM_ID, LOCATION_ID, BATCH_ID, MAX(SEQUENCE_NO) AS max_seq
    FROM item_inventory
    WHERE ITEM_ID IN (SELECT item_id FROM item_info)
    GROUP BY ITEM_ID, LOCATION_ID, BATCH_ID
  ) latest
    ON latest.ITEM_ID = inv.ITEM_ID AND latest.LOCATION_ID = inv.LOCATION_ID
   AND latest.BATCH_ID = inv.BATCH_ID AND latest.max_seq = inv.SEQUENCE_NO
  GROUP BY inv.ITEM_ID, inv.LOCATION_ID
),
incoming AS (
  SELECT poi.ITEM_ID AS item_id, po.LOCATION_ID AS location_id,
         SUM(poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1) - COALESCE(poi.RECEIVED_QTY, 0)) AS incoming
  FROM purchase_order_items poi
  JOIN purchase_order po ON po.ID = poi.PO_ID AND po.STATUS = 2
  WHERE COALESCE(poi.CLOSED, 0) = 0
    AND (poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1) - COALESCE(poi.RECEIVED_QTY, 0)) > 0
    AND poi.ITEM_ID IN (SELECT item_id FROM item_info)
  GROUP BY poi.ITEM_ID, po.LOCATION_ID
),
sold_30d AS (
  SELECT isd.item_id, isd.location_id, SUM(isd.units_sold) AS units_sold
  FROM item_sales_daily isd
  WHERE isd.sale_date BETWEEN CURDATE() - INTERVAL 30 DAY AND CURDATE()
    AND isd.item_id IN (SELECT item_id FROM item_info)
  GROUP BY isd.item_id, isd.location_id
),
item_need AS (
  SELECT s.location_id, ii.supplier_id,
         (s.units_sold / 31.0) * (7 + ii.lead_time_days)
           - (COALESCE(oh.on_hand, 0) + COALESCE(inc.incoming, 0)) AS suggested_base
  FROM sold_30d s
  JOIN item_info ii ON ii.item_id = s.item_id
  LEFT JOIN on_hand  oh  ON oh.item_id  = s.item_id AND oh.location_id  = s.location_id
  LEFT JOIN incoming inc ON inc.item_id = s.item_id AND inc.location_id = s.location_id
  WHERE s.units_sold > 0
),
order_counts AS (
  SELECT n.location_id, n.supplier_id, COUNT(*) AS items_to_order
  FROM item_need n
  WHERE n.suggested_base > 0
  GROUP BY n.location_id, n.supplier_id
  HAVING COUNT(*) > 0
)
SELECT oc.location_id, l.NAME, oc.supplier_id, c.NAME, oc.items_to_order, NOW()
FROM order_counts oc
JOIN location l ON l.ID = oc.location_id
JOIN contact  c ON c.ID = oc.supplier_id
ORDER BY l.NAME, c.NAME;

COMMIT;

-- --- Verification ------------------------------------------------------------
SELECT location_name, supplier_name, items_to_order FROM replenishment_summary ORDER BY location_name, supplier_name;
