-- ============================================================================
-- Dev seed for replenishment demonstration.
--
-- Prerequisites: activeone_no_data.sql + create-app-tables.sql already applied.
--
-- Uses ActiveOne's REAL conventions (verified 2026-06-26 against greatwall_activeone):
--   * vendor contact.TYPE = 0 (0=Vendor, 1=Customer, 2=Employee, 3=Tax Agency)
--   * supplier lead-time days in contact.CUSTOM_FIELD4
--   * open PO STATUS = 2 (2=Open, 3=Closed, 12=Received in full)
--   * UNIT_BASE_QUANTITY = per-unit factor (base units per 1 transaction unit);
--     base total = QUANTITY × UNIT_BASE_QUANTITY; PO RECEIVED_QTY is in base units.
--
-- Seeds 5 suppliers, 25 items, 4 open POs, 31 days of sales data, and
-- supplier_schedule rows that produce a realistic due-status mix:
--   Due Today   : Procter & Gamble (weekly Mon), Nestle Philippines (weekly Wed, overdue),
--                 Universal Robina Corp (weekly Fri, overdue)
--   Due Tomorrow: San Miguel Corporation (monthly 24th)
--   Others      : Unilever Philippines (lead-time 10d, ordered 5d ago)
--
-- Location scoping: all inventory at Main Warehouse (location 2).
-- module_location_visibility hides other locations from replenishment so only
-- Main Warehouse appears in the location picker.
--
-- DOS summary (purchase units, default 30-day window, divisor = 31):
--   P&G (lead 7d)       : Colgate 3 CRIT, Tide 3 CRIT, Ariel 20, Safeguard 17
--   Nestle (lead 5d)    : Bear Brand 2 CRIT, Milo 2 CRIT, Eden Cheese 1.5 CRIT, Coffee Mate 15, Alaska Evap 18
--   SMC (lead 3d)       : Lucky Me 2 CRIT, SMC Beer 3, Marlboro 5, C2 Green Tea 10, Energizer 3, Champion 10
--   Unilever (lead 10d) : Surf 4 CRIT, Cream Silk 5 CRIT, Knorr 7 CRIT, Breeze 30, Dove 20
--   URC (lead 4d)       : Piattos 3 CRIT, Nova 4, Payless 3 CRIT, Great Taste 10, Cloud 9 10
--
-- Sales split: one invoice at -15d and one sales receipt at -3d, each carrying
-- half the 31-day total. Shrink the date window to <15 days and only the SR is
-- captured, making rates appear lower (demonstrates date-range sensitivity).
--
-- Idempotent: safe to re-run. Run against the dev `activeone` DB only — it issues
-- unguarded DELETE FROM purchase_order(_items).
-- ============================================================================

START TRANSACTION;

-- --- Cleanup (children before parents) --------------------------------------
DELETE FROM invoice_items             WHERE INVOICE_ID = 9001;
DELETE FROM invoice                   WHERE ID = 9001;
DELETE FROM sales_receipt_items       WHERE SALES_RECEIPT_ID = 9001;
DELETE FROM sales_receipt             WHERE ID = 9001;
DELETE FROM purchase_order_items;
DELETE FROM purchase_order;
DELETE FROM item_inventory            WHERE ID BETWEEN 9001 AND 9099;
DELETE FROM item_units                WHERE ITEM_ID BETWEEN 1001 AND 1025;
DELETE FROM item                      WHERE ID BETWEEN 1001 AND 1025;
DELETE FROM contact                   WHERE ID IN (1, 2, 3, 4, 5, 100);
DELETE FROM supplier_schedule         WHERE supplier_id IN (1, 2, 3, 4, 5);
DELETE FROM module_location_visibility WHERE module = 'replenishment';

-- --- Lookup-map rows (INSERT IGNORE: safe if already present) ---------------
INSERT IGNORE INTO unit_of_measure (ID, NAME, SYMBOL, INACTIVE) VALUES
  (1, 'Piece', 'pc', 0),
  (2, 'Case',  'cs', 0),
  (3, 'Pack',  'pk', 0),
  (4, 'Box',   'bx', 0);

-- Real ActiveOne contact_type_map.
INSERT IGNORE INTO contact_type_map (ID, DESCRIPTION) VALUES
  (0, 'Vendor'),
  (1, 'Customer'),
  (2, 'Employee'),
  (3, 'Tax Agency'),
  (4, 'Other Contacts');

INSERT IGNORE INTO item_type_map (ID, DESCRIPTION) VALUES
  (1, 'Inventory');

INSERT IGNORE INTO document_type_map (ID, DESCRIPTION) VALUES
  (1, 'Opening Balance');

INSERT IGNORE INTO location (ID, NAME, INACTIVE) VALUES
  (1, 'Cold Storage',     0),
  (2, 'Main Warehouse',   0),
  (3, 'Overflow Storage', 0),
  (4, 'Selling Area',     0);

-- --- Contacts: 5 vendors (TYPE=0, lead time in CUSTOM_FIELD4) + 1 customer --
INSERT INTO contact (ID, TYPE, NAME, INACTIVE, CUSTOM_FIELD4) VALUES
  (1, 0, 'Procter and Gamble',     0, '7'),
  (2, 0, 'Nestle Philippines',     0, '5'),
  (3, 0, 'San Miguel Corporation', 0, '3'),
  (4, 0, 'Unilever Philippines',   0, '10'),
  (5, 0, 'Universal Robina Corp',  0, '4');

INSERT INTO contact (ID, TYPE, NAME, INACTIVE) VALUES
  (100, 1, 'Walk-in Customer', 0);

-- --- Supplier schedules ------------------------------------------------------
-- week_day encoding: 0=Sunday ... 6=Saturday. Today = Monday 2026-06-23.
--
--   P&G (1):      weekly Mon,  last 2026-06-16 → next 2026-06-23 = Due Today
--   Nestle (2):   weekly Wed,  last 2026-06-11 → next 2026-06-18 = Due Today (overdue)
--   SMC (3):      monthly 24th, last 2026-05-24 → next 2026-06-24 = Due Tomorrow
--   Unilever (4): lead_time,   last 2026-06-18 → next 2026-06-28 = Others
--   URC (5):      weekly Fri,  last 2026-06-13 → next 2026-06-20 = Due Today (overdue)
INSERT INTO supplier_schedule (supplier_id, schedule_type, week_day, month_day, last_ordered_at) VALUES
  (1, 'weekly',    1,    NULL, '2026-06-16'),
  (2, 'weekly',    3,    NULL, '2026-06-11'),
  (3, 'monthly', NULL,     24, '2026-05-24'),
  (4, 'lead_time', NULL, NULL, '2026-06-18'),
  (5, 'weekly',    5,    NULL, '2026-06-13');

-- --- Location visibility: show only Main Warehouse for replenishment ---------
INSERT INTO module_location_visibility (module, location_id, hidden) VALUES
  ('replenishment', 1, 1),
  ('replenishment', 3, 1),
  ('replenishment', 4, 1);

-- --- Items -------------------------------------------------------------------
-- COST is per BASE unit (ActiveOne convention). The PO writer computes
-- RATE = COST × factor (per purchase unit) and AMOUNT = QUANTITY × RATE.
-- Item 1007 (Eden Cheese) has PURCHASES_UNIT_ID set but NO item_units row → factor=1 fallback.
INSERT INTO item (ID, CODE, DESCRIPTION, TYPE, INACTIVE, BASE_UNIT_ID, PURCHASES_UNIT_ID, PREFERRED_VENDOR_ID, COST) VALUES
  -- Procter and Gamble (contact 1, lead 7d)
  (1001, 'GW-001', 'Colgate Toothpaste 150g',         1, 0, 1, 2, 1,  45),  -- cs of 12 (45×12=540/cs)
  (1002, 'GW-002', 'Tide Powder Detergent 1kg',       1, 0, 1, 3, 1,  85),  -- pk of  6 (85×6=510/pk)
  (1003, 'GW-003', 'Ariel Liquid Detergent 1L',       1, 0, 1, 2, 1, 120),  -- cs of 12 (120×12=1440/cs)
  (1004, 'GW-004', 'Safeguard Bar Soap 135g',         1, 0, 1, 4, 1,  28),  -- bx of 24 (28×24=672/bx)
  -- Nestle Philippines (contact 2, lead 5d)
  (1005, 'GW-005', 'Bear Brand Milk 300g',            1, 0, 1, 2, 2,  95),  -- cs of 12
  (1006, 'GW-006', 'Milo 3-in-1 Sachet x10',         1, 0, 1, 3, 2,  75),  -- pk of  6
  (1007, 'GW-007', 'Eden Cheese 165g',                1, 0, 1, 2, 2,  78),  -- factor=1 fallback (per base = per purchase)
  (1008, 'GW-008', 'Coffee Mate Creamer 450g',        1, 0, 1, 2, 2, 110),  -- cs of 12
  (1009, 'GW-009', 'Alaska Evaporated Milk 370ml',    1, 0, 1, 2, 2,  22),  -- cs of 24
  -- San Miguel Corporation (contact 3, lead 3d)
  (1010, 'GW-010', 'Lucky Me Pancit Canton 60g x24',  1, 0, 1, 4, 3, 280),  -- bx of 24
  (1011, 'GW-011', 'San Miguel Beer 330ml x12',       1, 0, 1, 2, 3, 480),  -- cs of 12
  (1012, 'GW-012', 'Marlboro Red Box x10',            1, 0, 1, 2, 3,  95),  -- cs of 10
  (1013, 'GW-013', 'C2 Green Tea 500ml x6',           1, 0, 1, 2, 3, 180),  -- cs of  6
  (1014, 'GW-014', 'Energizer AA Battery x4',         1, 0, 1, 2, 3,  55),  -- cs of 12
  (1015, 'GW-015', 'Champion Detergent Bar 370g',     1, 0, 1, 2, 3,  18),  -- cs of 12
  -- Unilever Philippines (contact 4, lead 10d)
  (1016, 'GW-016', 'Surf Powder Detergent 1kg',       1, 0, 1, 3, 4,  80),  -- pk of  6
  (1017, 'GW-017', 'Cream Silk Conditioner 180ml',    1, 0, 1, 2, 4,  80),  -- cs of 12
  (1018, 'GW-018', 'Knorr Sinigang Mix 22g x10',     1, 0, 1, 3, 4,  40),  -- pk of  6
  (1019, 'GW-019', 'Breeze Liquid Detergent 500ml',   1, 0, 1, 2, 4,  60),  -- cs of 12
  (1020, 'GW-020', 'Dove Bar Soap 135g',              1, 0, 1, 4, 4,  60),  -- bx of 24
  -- Universal Robina Corp (contact 5, lead 4d)
  (1021, 'GW-021', 'Jack n Jill Piattos 85g',         1, 0, 1, 2, 5,  50),  -- cs of 12
  (1022, 'GW-022', 'Nova Country Cheddar 78g',        1, 0, 1, 2, 5,  20),  -- cs of 24
  (1023, 'GW-023', 'Payless Spaghetti 400g',          1, 0, 1, 3, 5,  50),  -- pk of  6
  (1024, 'GW-024', 'Great Taste Coffee 3-in-1 x10',   1, 0, 1, 3, 5,  60),  -- pk of  6
  (1025, 'GW-025', 'Cloud 9 Chocolate Bar',           1, 0, 1, 4, 5,  30);  -- bx of 24

-- --- UOM conversions: QUANTITY = base units per 1 purchase unit -------------
-- Item 1007 (Eden Cheese) intentionally has no row → exercises FR-1b fallback.
INSERT INTO item_units (ID, ITEM_ID, UNIT_ID, QUANTITY) VALUES
  ( 1, 1001, 2, 12),   -- Colgate:     1 cs = 12 pc
  ( 2, 1002, 3,  6),   -- Tide:        1 pk =  6 pc
  ( 3, 1003, 2, 12),   -- Ariel:       1 cs = 12 pc
  ( 4, 1004, 4, 24),   -- Safeguard:   1 bx = 24 pc
  ( 5, 1005, 2, 12),   -- Bear Brand:  1 cs = 12 pc
  ( 6, 1006, 3,  6),   -- Milo:        1 pk =  6 pc
  -- no row for 1007 (Eden Cheese) — fallback path
  ( 7, 1008, 2, 12),   -- Coffee Mate: 1 cs = 12 pc
  ( 8, 1009, 2, 24),   -- Alaska Evap: 1 cs = 24 pc
  ( 9, 1010, 4, 24),   -- Lucky Me:    1 bx = 24 pc
  (10, 1011, 2, 12),   -- SMC Beer:    1 cs = 12 pc
  (11, 1012, 2, 10),   -- Marlboro:    1 cs = 10 pc
  (12, 1013, 2,  6),   -- C2 Green:    1 cs =  6 pc
  (13, 1014, 2, 12),   -- Energizer:   1 cs = 12 pc
  (14, 1015, 2, 12),   -- Champion:    1 cs = 12 pc
  (15, 1016, 3,  6),   -- Surf:        1 pk =  6 pc
  (16, 1017, 2, 12),   -- Cream Silk:  1 cs = 12 pc
  (17, 1018, 3,  6),   -- Knorr:       1 pk =  6 pc
  (18, 1019, 2, 12),   -- Breeze:      1 cs = 12 pc
  (19, 1020, 4, 24),   -- Dove:        1 bx = 24 pc
  (20, 1021, 2, 12),   -- Piattos:     1 cs = 12 pc
  (21, 1022, 2, 24),   -- Nova:        1 cs = 24 pc
  (22, 1023, 3,  6),   -- Payless:     1 pk =  6 pc
  (23, 1024, 3,  6),   -- Great Taste: 1 pk =  6 pc
  (24, 1025, 4, 24);   -- Cloud 9:     1 bx = 24 pc

-- --- On-hand inventory (base units at location 2 = Main Warehouse) ----------
-- on_hand_base = on_hand_purchase_units × factor
--   P&G     : Colgate 15cs, Tide 9pk, Ariel 40cs, Safeguard 60bx
--   Nestle  : Bear Brand 10cs, Milo 8pk, Eden Cheese 15pc, Coffee Mate 15cs, Alaska 30cs
--   SMC     : Lucky Me 10bx, Beer 9cs, Marlboro 20cs, C2 20cs, Energizer 3cs, Champion 20cs
--   Unilever: Surf 16pk, Cream Silk 15cs, Knorr 14pk, Breeze 30cs, Dove 40bx
--   URC     : Piattos 8cs, Nova 12cs, Payless 6pk, Great Taste 40pk, Cloud 9 30bx
INSERT INTO item_inventory
  (ID, SEQUENCE_NO, ITEM_ID, LOCATION_ID, BATCH_ID, SOURCE_REF_TYPE, SOURCE_REF_ID, SOURCE_REF_DATE,
   ENDING_QUANTITY, ENDING_UNIT_COST, ENDING_COST) VALUES
  (9001, 1, 1001, 2, 0, 1, 9001, CURDATE() - INTERVAL 2 DAY,  180, 0, 0),
  (9002, 1, 1002, 2, 0, 1, 9002, CURDATE() - INTERVAL 2 DAY,   54, 0, 0),
  (9003, 1, 1003, 2, 0, 1, 9003, CURDATE() - INTERVAL 2 DAY,  480, 0, 0),
  (9004, 1, 1004, 2, 0, 1, 9004, CURDATE() - INTERVAL 2 DAY, 1440, 0, 0),
  (9005, 1, 1005, 2, 0, 1, 9005, CURDATE() - INTERVAL 2 DAY,  120, 0, 0),
  (9006, 1, 1006, 2, 0, 1, 9006, CURDATE() - INTERVAL 2 DAY,   48, 0, 0),
  (9007, 1, 1007, 2, 0, 1, 9007, CURDATE() - INTERVAL 2 DAY,   15, 0, 0),
  (9008, 1, 1008, 2, 0, 1, 9008, CURDATE() - INTERVAL 2 DAY,  180, 0, 0),
  (9009, 1, 1009, 2, 0, 1, 9009, CURDATE() - INTERVAL 2 DAY,  720, 0, 0),
  (9010, 1, 1010, 2, 0, 1, 9010, CURDATE() - INTERVAL 2 DAY,  240, 0, 0),
  (9011, 1, 1011, 2, 0, 1, 9011, CURDATE() - INTERVAL 2 DAY,  108, 0, 0),
  (9012, 1, 1012, 2, 0, 1, 9012, CURDATE() - INTERVAL 2 DAY,  200, 0, 0),
  (9013, 1, 1013, 2, 0, 1, 9013, CURDATE() - INTERVAL 2 DAY,  120, 0, 0),
  (9014, 1, 1014, 2, 0, 1, 9014, CURDATE() - INTERVAL 2 DAY,   36, 0, 0),
  (9015, 1, 1015, 2, 0, 1, 9015, CURDATE() - INTERVAL 2 DAY,  240, 0, 0),
  (9016, 1, 1016, 2, 0, 1, 9016, CURDATE() - INTERVAL 2 DAY,   96, 0, 0),
  (9017, 1, 1017, 2, 0, 1, 9017, CURDATE() - INTERVAL 2 DAY,  180, 0, 0),
  (9018, 1, 1018, 2, 0, 1, 9018, CURDATE() - INTERVAL 2 DAY,   84, 0, 0),
  (9019, 1, 1019, 2, 0, 1, 9019, CURDATE() - INTERVAL 2 DAY,  360, 0, 0),
  (9020, 1, 1020, 2, 0, 1, 9020, CURDATE() - INTERVAL 2 DAY,  960, 0, 0),
  (9021, 1, 1021, 2, 0, 1, 9021, CURDATE() - INTERVAL 2 DAY,   96, 0, 0),
  (9022, 1, 1022, 2, 0, 1, 9022, CURDATE() - INTERVAL 2 DAY,  288, 0, 0),
  (9023, 1, 1023, 2, 0, 1, 9023, CURDATE() - INTERVAL 2 DAY,   36, 0, 0),
  (9024, 1, 1024, 2, 0, 1, 9024, CURDATE() - INTERVAL 2 DAY,  240, 0, 0),
  (9025, 1, 1025, 2, 0, 1, 9025, CURDATE() - INTERVAL 2 DAY,  720, 0, 0);

-- --- Open POs (STATUS=2 Open, one per vendor that has undelivered stock) ------
-- Unilever has no open PO — nothing on the way, reinforcing the CRITICAL items.
-- PO dates match supplier_schedule.last_ordered_at so the schedule is coherent.
INSERT INTO purchase_order (ID, RECORDED_ON, CODE, DATE, VENDOR_ID, LOCATION_ID, AMOUNT, STATUS) VALUES
  (9001, NOW(), 'PO-SEED-0001', '2026-06-16', 1, 2, 0, 2),  -- P&G
  (9002, NOW(), 'PO-SEED-0002', '2026-06-11', 2, 2, 0, 2),  -- Nestle
  (9003, NOW(), 'PO-SEED-0003', '2026-05-24', 3, 2, 0, 2),  -- SMC
  (9004, NOW(), 'PO-SEED-0004', '2026-06-13', 5, 2, 0, 2);  -- URC

-- QUANTITY in purchase units; UNIT_BASE_QUANTITY = per-unit factor (base/purchase unit).
-- Undelivered base = QUANTITY × UNIT_BASE_QUANTITY − RECEIVED_QTY (all RECEIVED_QTY=0).
INSERT INTO purchase_order_items
  (ID, PO_ID, LINE_NO, ITEM_ID, QUANTITY, UNIT_ID, UNIT_BASE_QUANTITY, RECEIVED_QTY, CLOSED) VALUES
  (9001, 9001, 1, 1004,  8, 4, 24, 0, 0),   -- Safeguard:   8 bx × 24 =  192 base → +8pu incoming
  (9002, 9002, 1, 1009,  6, 2, 24, 0, 0),   -- Alaska Evap: 6 cs × 24 =  144 base → +6pu incoming
  (9003, 9003, 1, 1012,  5, 2, 10, 0, 0),   -- Marlboro:    5 cs × 10 =   50 base → +5pu incoming
  (9004, 9004, 1, 1021,  4, 2, 12, 0, 0),   -- Piattos:     4 cs × 12 =   48 base → +4pu incoming
  (9005, 9004, 2, 1024, 10, 3,  6, 0, 0);   -- Great Taste: 10 pk × 6 =   60 base → +10pu incoming

-- --- Sales data (sold in base units at location 2, factor 1) -----------------
-- QUANTITY = base units sold; UNIT_BASE_QUANTITY = 1 (base unit, per-unit factor).
-- Base units sold = QUANTITY × UNIT_BASE_QUANTITY. Each document carries exactly half
-- the 31-day total per item so the default 30-day window (capturing both) yields the
-- target daily rate. invoice_qty = sales_receipt_qty = daily_rate_pu × 31 × factor / 2.
--
-- Effective DOS (with incoming) by item:
--   1001 Colgate     5cs/d  on 15cs  +0   = 15cs  → DOS  3.0  CRITICAL  (lead 7)
--   1002 Tide        3pk/d  on  9pk  +0   =  9pk  → DOS  3.0  CRITICAL  (lead 7)
--   1003 Ariel       2cs/d  on 40cs  +0   = 40cs  → DOS 20.0            (lead 7)
--   1004 Safeguard   4bx/d  on 60bx  +8bx = 68bx  → DOS 17.0            (lead 7)
--   1005 Bear Brand  5cs/d  on 10cs  +0   = 10cs  → DOS  2.0  CRITICAL  (lead 5)
--   1006 Milo        4pk/d  on  8pk  +0   =  8pk  → DOS  2.0  CRITICAL  (lead 5)
--   1007 Eden Cheese 10pc/d on 15pc  +0   = 15pc  → DOS  1.5  CRITICAL  (lead 5)
--   1008 Coffee Mate  1cs/d on 15cs  +0   = 15cs  → DOS 15.0            (lead 5)
--   1009 Alaska Evap  2cs/d on 30cs  +6cs = 36cs  → DOS 18.0            (lead 5)
--   1010 Lucky Me     5bx/d on 10bx  +0   = 10bx  → DOS  2.0  CRITICAL  (lead 3)
--   1011 SMC Beer     3cs/d on  9cs  +0   =  9cs  → DOS  3.0            (lead 3)
--   1012 Marlboro     5cs/d on 20cs  +5cs = 25cs  → DOS  5.0            (lead 3)
--   1013 C2 Green Tea 2cs/d on 20cs  +0   = 20cs  → DOS 10.0            (lead 3)
--   1014 Energizer    1cs/d on  3cs  +0   =  3cs  → DOS  3.0            (lead 3)
--   1015 Champion     2cs/d on 20cs  +0   = 20cs  → DOS 10.0            (lead 3)
--   1016 Surf         4pk/d on 16pk  +0   = 16pk  → DOS  4.0  CRITICAL  (lead 10)
--   1017 Cream Silk   3cs/d on 15cs  +0   = 15cs  → DOS  5.0  CRITICAL  (lead 10)
--   1018 Knorr        2pk/d on 14pk  +0   = 14pk  → DOS  7.0  CRITICAL  (lead 10)
--   1019 Breeze       1cs/d on 30cs  +0   = 30cs  → DOS 30.0            (lead 10)
--   1020 Dove         2bx/d on 40bx  +0   = 40bx  → DOS 20.0            (lead 10)
--   1021 Piattos      4cs/d on  8cs  +4cs = 12cs  → DOS  3.0  CRITICAL  (lead 4)
--   1022 Nova         3cs/d on 12cs  +0   = 12cs  → DOS  4.0            (lead 4)
--   1023 Payless      2pk/d on  6pk  +0   =  6pk  → DOS  3.0  CRITICAL  (lead 4)
--   1024 Great Taste  5pk/d on 40pk  +10pk= 50pk  → DOS 10.0            (lead 4)
--   1025 Cloud 9      3bx/d on 30bx  +0   = 30bx  → DOS 10.0            (lead 4)

INSERT INTO invoice (ID, RECORDED_ON, CODE, DATE, CUSTOMER_ID, LOCATION_ID, AMOUNT, STATUS) VALUES
  (9001, NOW(), 'INV-SEED-0001', CURDATE() - INTERVAL 15 DAY, 100, 2, 0, 3);

INSERT INTO invoice_items (ID, INVOICE_ID, LINE_NO, ITEM_ID, QUANTITY, UNIT_ID, UNIT_BASE_QUANTITY) VALUES
  ( 1, 9001,  1, 1001,  930, 1, 1),  -- 5×31×12/2
  ( 2, 9001,  2, 1002,  279, 1, 1),  -- 3×31× 6/2
  ( 3, 9001,  3, 1003,  372, 1, 1),  -- 2×31×12/2
  ( 4, 9001,  4, 1004, 1488, 1, 1),  -- 4×31×24/2
  ( 5, 9001,  5, 1005,  930, 1, 1),  -- 5×31×12/2
  ( 6, 9001,  6, 1006,  372, 1, 1),  -- 4×31× 6/2
  ( 7, 9001,  7, 1007,  155, 1, 1),  -- 10×31×1/2
  ( 8, 9001,  8, 1008,  186, 1, 1),  -- 1×31×12/2
  ( 9, 9001,  9, 1009,  744, 1, 1),  -- 2×31×24/2
  (10, 9001, 10, 1010, 1860, 1, 1),  -- 5×31×24/2
  (11, 9001, 11, 1011,  558, 1, 1),  -- 3×31×12/2
  (12, 9001, 12, 1012,  775, 1, 1),  -- 5×31×10/2
  (13, 9001, 13, 1013,  186, 1, 1),  -- 2×31× 6/2
  (14, 9001, 14, 1014,  186, 1, 1),  -- 1×31×12/2
  (15, 9001, 15, 1015,  372, 1, 1),  -- 2×31×12/2
  (16, 9001, 16, 1016,  372, 1, 1),  -- 4×31× 6/2
  (17, 9001, 17, 1017,  558, 1, 1),  -- 3×31×12/2
  (18, 9001, 18, 1018,  186, 1, 1),  -- 2×31× 6/2
  (19, 9001, 19, 1019,  186, 1, 1),  -- 1×31×12/2
  (20, 9001, 20, 1020,  744, 1, 1),  -- 2×31×24/2
  (21, 9001, 21, 1021,  744, 1, 1),  -- 4×31×12/2
  (22, 9001, 22, 1022, 1116, 1, 1),  -- 3×31×24/2
  (23, 9001, 23, 1023,  186, 1, 1),  -- 2×31× 6/2
  (24, 9001, 24, 1024,  465, 1, 1),  -- 5×31× 6/2
  (25, 9001, 25, 1025, 1116, 1, 1);  -- 3×31×24/2

INSERT INTO sales_receipt (ID, RECORDED_ON, CODE, DATE, CUSTOMER_ID, LOCATION_ID, AMOUNT, STATUS) VALUES
  (9001, NOW(), 'SR-SEED-0001', CURDATE() - INTERVAL 3 DAY, 100, 2, 0, 3);

INSERT INTO sales_receipt_items (ID, SALES_RECEIPT_ID, LINE_NO, ITEM_ID, QUANTITY, UNIT_ID, UNIT_BASE_QUANTITY) VALUES
  ( 1, 9001,  1, 1001,  930, 1, 1),
  ( 2, 9001,  2, 1002,  279, 1, 1),
  ( 3, 9001,  3, 1003,  372, 1, 1),
  ( 4, 9001,  4, 1004, 1488, 1, 1),
  ( 5, 9001,  5, 1005,  930, 1, 1),
  ( 6, 9001,  6, 1006,  372, 1, 1),
  ( 7, 9001,  7, 1007,  155, 1, 1),
  ( 8, 9001,  8, 1008,  186, 1, 1),
  ( 9, 9001,  9, 1009,  744, 1, 1),
  (10, 9001, 10, 1010, 1860, 1, 1),
  (11, 9001, 11, 1011,  558, 1, 1),
  (12, 9001, 12, 1012,  775, 1, 1),
  (13, 9001, 13, 1013,  186, 1, 1),
  (14, 9001, 14, 1014,  186, 1, 1),
  (15, 9001, 15, 1015,  372, 1, 1),
  (16, 9001, 16, 1016,  372, 1, 1),
  (17, 9001, 17, 1017,  558, 1, 1),
  (18, 9001, 18, 1018,  186, 1, 1),
  (19, 9001, 19, 1019,  186, 1, 1),
  (20, 9001, 20, 1020,  744, 1, 1),
  (21, 9001, 21, 1021,  744, 1, 1),
  (22, 9001, 22, 1022, 1116, 1, 1),
  (23, 9001, 23, 1023,  186, 1, 1),
  (24, 9001, 24, 1024,  465, 1, 1),
  (25, 9001, 25, 1025, 1116, 1, 1);

COMMIT;

-- Sanity check: verify DOS for all items (run this after the seed to confirm).
-- Base totals use QUANTITY × UNIT_BASE_QUANTITY (the real ActiveOne convention).
SELECT
  it.CODE,
  it.DESCRIPTION,
  c.NAME                                                                     AS supplier,
  COALESCE(uom.SYMBOL, uom_b.SYMBOL)                                        AS unit,
  COALESCE(iu.QUANTITY, 1)                                                   AS factor,
  COALESCE(inv_q.q, 0) + COALESCE(sr_q.q, 0)                               AS monthly_base,
  inv.ENDING_QUANTITY                                                        AS on_hand_base,
  COALESCE(po_q.incoming_base, 0)                                           AS incoming_base,
  ROUND((COALESCE(inv_q.q,0) + COALESCE(sr_q.q,0)) / 31
        / COALESCE(iu.QUANTITY, 1), 2)                                      AS daily_rate_pu,
  ROUND(inv.ENDING_QUANTITY / COALESCE(iu.QUANTITY, 1), 2)                  AS on_hand_pu,
  ROUND(COALESCE(po_q.incoming_base, 0) / COALESCE(iu.QUANTITY, 1), 2)     AS incoming_pu,
  ROUND(
    (inv.ENDING_QUANTITY + COALESCE(po_q.incoming_base, 0))
    / COALESCE(iu.QUANTITY, 1)
    / ((COALESCE(inv_q.q,0) + COALESCE(sr_q.q,0)) / 31 / COALESCE(iu.QUANTITY, 1))
  , 2)                                                                       AS dos,
  c.CUSTOM_FIELD4                                                            AS lead_time
FROM item it
JOIN contact c ON c.ID = it.PREFERRED_VENDOR_ID
LEFT JOIN item_units iu
  ON iu.ITEM_ID = it.ID AND iu.UNIT_ID = it.PURCHASES_UNIT_ID
LEFT JOIN unit_of_measure uom   ON uom.ID   = it.PURCHASES_UNIT_ID
LEFT JOIN unit_of_measure uom_b ON uom_b.ID = it.BASE_UNIT_ID
LEFT JOIN (
  SELECT ITEM_ID, SUM(QUANTITY * UNIT_BASE_QUANTITY) q
  FROM invoice_items WHERE INVOICE_ID = 9001 GROUP BY ITEM_ID
) inv_q ON inv_q.ITEM_ID = it.ID
LEFT JOIN (
  SELECT ITEM_ID, SUM(QUANTITY * UNIT_BASE_QUANTITY) q
  FROM sales_receipt_items WHERE SALES_RECEIPT_ID = 9001 GROUP BY ITEM_ID
) sr_q ON sr_q.ITEM_ID = it.ID
LEFT JOIN item_inventory inv
  ON inv.ITEM_ID = it.ID AND inv.LOCATION_ID = 2
LEFT JOIN (
  SELECT poi.ITEM_ID, SUM(poi.QUANTITY * poi.UNIT_BASE_QUANTITY - COALESCE(poi.RECEIVED_QTY, 0)) AS incoming_base
  FROM purchase_order_items poi
  JOIN purchase_order po ON po.ID = poi.PO_ID
  WHERE po.STATUS = 2 AND po.LOCATION_ID = 2 AND poi.CLOSED = 0
  GROUP BY poi.ITEM_ID
) po_q ON po_q.ITEM_ID = it.ID
WHERE it.ID BETWEEN 1001 AND 1025
ORDER BY c.NAME, it.CODE;
