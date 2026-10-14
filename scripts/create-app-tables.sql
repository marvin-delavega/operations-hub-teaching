-- ============================================================================
-- App-owned tables (NOT part of ActiveOne).
--
-- Operations Hub stores its own configuration alongside the ActiveOne schema in
-- the same database. These tables are ours to own and migrate; deliberately NO
-- foreign keys into ActiveOne tables, so the ERP schema can change/replicate
-- without breaking us. Run once after applying activeone_no_data.sql.
-- ============================================================================

-- Per-module, per-location hidden flag for the shared location picker.
-- A location is VISIBLE by default; it is hidden only when a row exists here
-- with hidden = 1. (`location` module spec, CLAUDE.md.)
CREATE TABLE IF NOT EXISTS `module_location_visibility` (
  `module`      varchar(50)  NOT NULL,
  `location_id` int unsigned NOT NULL,
  `hidden`      tinyint(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`module`, `location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Application-wide key/value configuration (company name, etc.). ActiveOne has
-- no equivalent — this is ours. Read/written by the admin module.
CREATE TABLE IF NOT EXISTS `app_settings` (
  `key`   varchar(100) NOT NULL,
  `value` text         NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Operations Hub users and credentials. App-owned and NOT the ActiveOne `user`
-- table — ERP logins and Ops Hub logins are deliberately separate. `password_hash`
-- is a bcrypt hash; `role` is the app UserRole ('admin' | 'staff').
-- `employee_code` links a user to their ActiveOne type-2 (employee) contact code;
-- the Delivery module writes it to the new PO's CUSTOM_FIELD2 and blocks saving
-- when it is NULL. Set/managed in /admin user management.
CREATE TABLE IF NOT EXISTS `users` (
  `id`            int unsigned NOT NULL AUTO_INCREMENT,
  `name`          varchar(100) NOT NULL,
  `username`      varchar(50)  NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role`          varchar(10)  NOT NULL DEFAULT 'staff',
  `is_active`     tinyint(1)   NOT NULL DEFAULT 1,
  `employee_code` varchar(50)  NULL,
  `is_protected`  tinyint(1)   NOT NULL DEFAULT 0,
  `created_at`    datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Idempotent add of employee_code for databases whose `users` predates it.
SET @users_has_employee_code := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'employee_code'
);
SET @add_employee_code := IF(
  @users_has_employee_code = 0,
  'ALTER TABLE `users` ADD COLUMN `employee_code` varchar(50) NULL AFTER `is_active`',
  'SELECT 1'
);
PREPARE add_employee_code_stmt FROM @add_employee_code;
EXECUTE add_employee_code_stmt;
DEALLOCATE PREPARE add_employee_code_stmt;

-- Idempotent add of is_protected (locked system-admin flag) for older `users`.
SET @users_has_is_protected := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_protected'
);
SET @add_is_protected := IF(
  @users_has_is_protected = 0,
  'ALTER TABLE `users` ADD COLUMN `is_protected` tinyint(1) NOT NULL DEFAULT 0 AFTER `employee_code`',
  'SELECT 1'
);
PREPARE add_is_protected_stmt FROM @add_is_protected;
EXECUTE add_is_protected_stmt;
DEALLOCATE PREPARE add_is_protected_stmt;

-- Idempotent add of created_at for older `users`.
SET @users_has_created_at := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'created_at'
);
SET @add_created_at := IF(
  @users_has_created_at = 0,
  'ALTER TABLE `users` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `is_protected`',
  'SELECT 1'
);
PREPARE add_created_at_stmt FROM @add_created_at;
EXECUTE add_created_at_stmt;
DEALLOCATE PREPARE add_created_at_stmt;

-- Idempotent add of updated_at for older `users`.
SET @users_has_updated_at := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'updated_at'
);
SET @add_updated_at := IF(
  @users_has_updated_at = 0,
  'ALTER TABLE `users` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`',
  'SELECT 1'
);
PREPARE add_updated_at_stmt FROM @add_updated_at;
EXECUTE add_updated_at_stmt;
DEALLOCATE PREPARE add_updated_at_stmt;

-- Idempotent add of activeone_user_id: links a user to their ActiveOne `user` (login)
-- record. Written to inventory_count.RECORDED_BY_ID by the Counting module; required
-- (alongside employee_code) to save a count. Set via a live picker in /admin Users tab.
SET @users_has_activeone_user_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'activeone_user_id'
);
SET @add_activeone_user_id := IF(
  @users_has_activeone_user_id = 0,
  'ALTER TABLE `users` ADD COLUMN `activeone_user_id` int NULL AFTER `employee_code`',
  'SELECT 1'
);
PREPARE add_activeone_user_id_stmt FROM @add_activeone_user_id;
EXECUTE add_activeone_user_id_stmt;
DEALLOCATE PREPARE add_activeone_user_id_stmt;

-- Committed inventory counts — our self-contained, immutable mirror of the ActiveOne
-- `inventory_count` document. Human-readable labels are stored alongside the ActiveOne
-- IDs so records survive ERP renames. App-owned; deliberately NO foreign keys into
-- ActiveOne tables (inventory_count_id / *_contact_id / *_activeone_user_id are plain ints).
CREATE TABLE IF NOT EXISTS `stock_count` (
  `id`                          int unsigned NOT NULL AUTO_INCREMENT,
  `inventory_count_id`          int          NOT NULL,
  `inventory_count_code`        varchar(50)  NOT NULL,
  `location_id`                 int          NOT NULL,
  `location_name`               varchar(255) NULL,
  `counted_by_user_id`          int          NOT NULL,
  `counter_name`                varchar(255) NULL,
  `counted_by_contact_id`       int          NOT NULL,
  `recorded_by_activeone_user_id` int        NOT NULL,
  `recorder_name`               varchar(255) NULL,
  `continuous_scanning`         tinyint(1)   NOT NULL DEFAULT 1,
  `note`                        varchar(255) NULL,
  `created_at`                  datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_stock_count_created_at` (`created_at`),
  KEY `ix_stock_count_location_id` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-line snapshot for each committed count. Self-contained (item/unit labels stored,
-- not joined live). FK cascades on stock_count delete.
CREATE TABLE IF NOT EXISTS `stock_count_items` (
  `id`                 int unsigned NOT NULL AUTO_INCREMENT,
  `stock_count_id`     int unsigned NOT NULL,
  `item_id`            int          NOT NULL,
  `item_code`          varchar(50)  NULL,
  `item_description`   text         NOT NULL,
  `unit_id`            int          NULL,
  `unit_symbol`        varchar(50)  NOT NULL,
  `unit_base_quantity` decimal(16,4) NOT NULL,
  `quantity`           int          NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_stock_count_items_stock_count` (`stock_count_id`),
  CONSTRAINT `fk_stock_count_items_stock_count`
    FOREIGN KEY (`stock_count_id`) REFERENCES `stock_count` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-supplier order schedule configuration. App-owned and JOINable against the
-- ActiveOne `contact` table (lead time lives in contact.CUSTOM_FIELD3, never here).
-- `last_ordered_at` is the lead-time anchor; it advances only on POs submitted
-- through this app. Deliberately NO foreign key into ActiveOne `contact`.
CREATE TABLE IF NOT EXISTS `supplier_schedule` (
  `supplier_id`     int          NOT NULL,
  `schedule_type`   enum('weekly','monthly','lead_time') NOT NULL DEFAULT 'lead_time',
  `week_day`        tinyint      NULL,
  `month_day`       tinyint      NULL,
  `last_ordered_at` date         NULL,
  `created_at`      datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Delivery receiving sessions. One row per committed delivery: the original PO it
-- superseded, the new PO it wrote, and who received it. App-owned; deliberately NO
-- foreign keys into ActiveOne tables (original_po_id / new_po_id / supplier_id are
-- ActiveOne IDs kept as plain integers).
CREATE TABLE IF NOT EXISTS `delivery` (
  `id`                       int unsigned NOT NULL AUTO_INCREMENT,
  `original_po_id`           int          NOT NULL,
  `new_po_id`                int          NOT NULL,
  `new_po_code`              varchar(50)  NOT NULL,
  `location_id`              int          NOT NULL,
  `supplier_id`              int          NOT NULL,
  `received_by_user_id`      int          NOT NULL,
  `received_by_employee_code` varchar(50) NOT NULL,
  `created_at`               datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Scanned SKUs absent from the ActiveOne masterlist (New Item). These have no real
-- ITEM_ID so they are NEVER written to ActiveOne — they live only here as code +
-- literal "New Item" until an admin names them downstream.
CREATE TABLE IF NOT EXISTS `delivery_new_items` (
  `id`          int unsigned NOT NULL AUTO_INCREMENT,
  `delivery_id` int unsigned NOT NULL,
  `code`        varchar(50)  NOT NULL,
  `description` varchar(255) NOT NULL,
  `quantity`    int          NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_delivery_new_items_delivery` (`delivery_id`),
  CONSTRAINT `fk_delivery_new_items_delivery`
    FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Cached snapshot of the ActiveOne item masterlist (code + description). Used by the
-- Delivery module to classify scans (in masterlist = Not Ordered vs. New Item) and to
-- supply Not-Ordered line descriptions. Truncated and re-pulled on admin refresh.
-- `item_id` + `unit_symbol` extend the cache so the Counting module can use it as its
-- scannable item index (code -> item id + global purchase-unit symbol for display); the
-- authoritative per-location unit is still resolved live at commit.
CREATE TABLE IF NOT EXISTS `item_master_cache` (
  `code`        varchar(50)  NOT NULL,
  `item_id`     int          NULL,
  `description` varchar(255) NOT NULL,
  `unit_symbol` varchar(50)  NULL,
  `refreshed_at` datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Idempotent add of item_id / unit_symbol for caches created before the Counting module.
SET @imc_has_item_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_master_cache' AND COLUMN_NAME = 'item_id'
);
SET @add_imc_item_id := IF(
  @imc_has_item_id = 0,
  'ALTER TABLE `item_master_cache` ADD COLUMN `item_id` int NULL AFTER `code`',
  'SELECT 1'
);
PREPARE add_imc_item_id_stmt FROM @add_imc_item_id;
EXECUTE add_imc_item_id_stmt;
DEALLOCATE PREPARE add_imc_item_id_stmt;

SET @imc_has_unit_symbol := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_master_cache' AND COLUMN_NAME = 'unit_symbol'
);
SET @add_imc_unit_symbol := IF(
  @imc_has_unit_symbol = 0,
  'ALTER TABLE `item_master_cache` ADD COLUMN `unit_symbol` varchar(50) NULL AFTER `description`',
  'SELECT 1'
);
PREPARE add_imc_unit_symbol_stmt FROM @add_imc_unit_symbol;
EXECUTE add_imc_unit_symbol_stmt;
DEALLOCATE PREPARE add_imc_unit_symbol_stmt;

-- Pre-aggregated daily off-take rollup for the replenishment module. One sparse row per
-- (location_id, item_id, sale_date) = summed base units sold from both invoice_items and
-- sales_receipt_items. Replaces the live `sold` CTE scan (~7s on busy locations).
-- Filters mirror the live CTE: STATUS NOT IN (0,6,7); receipts also RETURN_TRX=0 and
-- VOID_REFERENCE_NO IS NULL. Zero-sales days produce no row (sparse). Keyed on the
-- composite PK so all writes are idempotent (ON DUPLICATE KEY UPDATE).
CREATE TABLE IF NOT EXISTS `item_sales_daily` (
  `location_id` int          NOT NULL,
  `item_id`     int          NOT NULL,
  `sale_date`   date         NOT NULL,
  `units_sold`  decimal(18,4) NOT NULL,
  `updated_at`  datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`location_id`, `item_id`, `sale_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Feeder↔selling-area map. A selling area (display floor with unreliable on-hand)
-- is mapped to exactly one feeder warehouse; the feeder's replenishment pools the
-- selling area's off-take into its own demand. PK on selling_area_location_id
-- enforces the one-feeder rule. No FK into ActiveOne tables.
CREATE TABLE IF NOT EXISTS `selling_area_feeder_map` (
  `selling_area_location_id` int      NOT NULL,
  `feeder_location_id`       int      NOT NULL,
  `created_at`               datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`selling_area_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Pre-computed snapshot of items needing an order (suggested order qty > 0 for the
-- shortest order period) grouped by location × supplier. Truncated and re-inserted on
-- manual refresh or after a PO is submitted. Only rows with items_to_order > 0 stored.
CREATE TABLE IF NOT EXISTS `replenishment_summary` (
  `id`             int unsigned NOT NULL AUTO_INCREMENT,
  `location_id`    int          NOT NULL,
  `location_name`  varchar(255) NOT NULL,
  `supplier_id`    int          NOT NULL,
  `supplier_name`  varchar(255) NOT NULL,
  `items_to_order` int          NOT NULL,
  `computed_at`    datetime     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_location_supplier` (`location_id`, `supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- History module tables
-- ============================================================================

-- Replenishment run header. One row per submitted batch (per path: standard or
-- stockout). Written inside the same transaction as the POs it created.
CREATE TABLE IF NOT EXISTS `replenishment_run` (
  `id`                  int unsigned NOT NULL AUTO_INCREMENT,
  `path`                enum('standard','stockout') NOT NULL,
  `location_id`         int          NOT NULL,
  `location_name`       text         NOT NULL,
  `created_by_user_id`  int          NOT NULL,
  `created_by_name`     text         NOT NULL,
  `created_by_employee_code` varchar(50) NULL,
  `rounding`            enum('up','down') NOT NULL DEFAULT 'up',
  `sales_range_from`    date         NULL,
  `sales_range_to`      date         NULL,
  `supplier_count`      int          NOT NULL DEFAULT 0,
  `po_count`            int          NOT NULL DEFAULT 0,
  `line_count`          int          NOT NULL DEFAULT 0,
  `status`              enum('active','deleted') NOT NULL DEFAULT 'active',
  `created_at`          datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_replenishment_run_created_at` (`created_at`),
  KEY `ix_replenishment_run_location_id` (`location_id`),
  KEY `ix_replenishment_run_created_by` (`created_by_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Idempotent add of created_by_employee_code for runs saved before the linked-employee gate.
SET @run_has_emp_code := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run' AND COLUMN_NAME = 'created_by_employee_code'
);
SET @add_run_emp_code := IF(
  @run_has_emp_code = 0,
  'ALTER TABLE `replenishment_run` ADD COLUMN `created_by_employee_code` varchar(50) NULL AFTER `created_by_name`',
  'SELECT 1'
);
PREPARE add_run_emp_code_stmt FROM @add_run_emp_code;
EXECUTE add_run_emp_code_stmt;
DEALLOCATE PREPARE add_run_emp_code_stmt;

-- One row per ActiveOne PO minted in a run. Groups lines by supplier×manufacturer.
CREATE TABLE IF NOT EXISTS `replenishment_run_po` (
  `id`                  int unsigned NOT NULL AUTO_INCREMENT,
  `run_id`              int unsigned NOT NULL,
  `po_code`             varchar(50)  NOT NULL,
  `supplier_id`         int          NOT NULL,
  `supplier_name`       text         NOT NULL,
  `manufacturer_id`     int          NULL,
  `manufacturer_name`   text         NULL,
  PRIMARY KEY (`id`),
  KEY `ix_replenishment_run_po_run_id` (`run_id`),
  KEY `ix_replenishment_run_po_code` (`po_code`),
  KEY `ix_replenishment_run_po_supplier_id` (`supplier_id`),
  CONSTRAINT `fk_replenishment_run_po_run`
    FOREIGN KEY (`run_id`) REFERENCES `replenishment_run` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Full per-line decision snapshot. Single table, path-discriminated via nullable
-- columns (standard fields null for stockout; stockout fields null for standard).
CREATE TABLE IF NOT EXISTS `replenishment_run_line` (
  `id`                    int unsigned NOT NULL AUTO_INCREMENT,
  `run_po_id`             int unsigned NOT NULL,
  `item_id`               int          NOT NULL,
  `item_code`             varchar(50)  NULL,
  `item_description`      text         NOT NULL,
  `unit_symbol`           varchar(50)  NOT NULL,
  `order_period_days`     int          NOT NULL,
  `sales_rate`            decimal(18,4) NOT NULL,
  `selling_area_demand`   decimal(18,4) NULL,
  `selling_area_names`    text         NULL,
  `effective_available`   decimal(18,4) NULL,
  `dos`                   decimal(18,4) NULL,
  `suggested_qty`         int          NOT NULL,
  `final_qty`             int          NOT NULL,
  `ordered_per_piece`     tinyint(1)   NOT NULL DEFAULT 0,
  `last_sold_date`        date         NULL,
  `stockout_daily_rate`   decimal(18,4) NULL,
  `stockout_window_units` decimal(18,4) NULL,
  `created_at`            datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_replenishment_run_line_run_po_id` (`run_po_id`),
  CONSTRAINT `fk_replenishment_run_line_run_po`
    FOREIGN KEY (`run_po_id`) REFERENCES `replenishment_run_po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Idempotent addition of item_code to existing `replenishment_run_line` installs.
SET @rrl_has_item_code := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_line' AND COLUMN_NAME = 'item_code'
);
SET @add_rrl_item_code := IF(
  @rrl_has_item_code = 0,
  'ALTER TABLE `replenishment_run_line` ADD COLUMN `item_code` varchar(50) NULL AFTER `item_id`',
  'SELECT 1'
);
PREPARE add_rrl_item_code_stmt FROM @add_rrl_item_code;
EXECUTE add_rrl_item_code_stmt;
DEALLOCATE PREPARE add_rrl_item_code_stmt;

-- Idempotent addition of ordered_per_piece to existing `replenishment_run_line` installs.
SET @rrl_has_ordered_per_piece := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_line' AND COLUMN_NAME = 'ordered_per_piece'
);
SET @add_rrl_ordered_per_piece := IF(
  @rrl_has_ordered_per_piece = 0,
  'ALTER TABLE `replenishment_run_line` ADD COLUMN `ordered_per_piece` tinyint(1) NOT NULL DEFAULT 0 AFTER `final_qty`',
  'SELECT 1'
);
PREPARE add_rrl_ordered_per_piece_stmt FROM @add_rrl_ordered_per_piece;
EXECUTE add_rrl_ordered_per_piece_stmt;
DEALLOCATE PREPARE add_rrl_ordered_per_piece_stmt;

-- Idempotent addition of safety_stock_units to existing `replenishment_run_line` installs.
SET @rrl_has_safety_stock_units := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_line' AND COLUMN_NAME = 'safety_stock_units'
);
SET @add_rrl_safety_stock_units := IF(
  @rrl_has_safety_stock_units = 0,
  'ALTER TABLE `replenishment_run_line` ADD COLUMN `safety_stock_units` int NOT NULL DEFAULT 0 AFTER `ordered_per_piece`',
  'SELECT 1'
);
PREPARE add_rrl_safety_stock_units_stmt FROM @add_rrl_safety_stock_units;
EXECUTE add_rrl_safety_stock_units_stmt;
DEALLOCATE PREPARE add_rrl_safety_stock_units_stmt;

-- Idempotent widening of safety_stock_units to decimal so fractional safety stock is preserved.
SET @rrl_safety_stock_units_type := (
  SELECT DATA_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_line' AND COLUMN_NAME = 'safety_stock_units'
);
SET @modify_rrl_safety_stock_units := IF(
  @rrl_safety_stock_units_type = 'int',
  'ALTER TABLE `replenishment_run_line` MODIFY COLUMN `safety_stock_units` decimal(12,4) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE modify_rrl_safety_stock_units_stmt FROM @modify_rrl_safety_stock_units;
EXECUTE modify_rrl_safety_stock_units_stmt;
DEALLOCATE PREPARE modify_rrl_safety_stock_units_stmt;

-- Idempotent addition of safety_stock_percent to existing `replenishment_run_line` installs.
SET @rrl_has_safety_stock_percent := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_line' AND COLUMN_NAME = 'safety_stock_percent'
);
SET @add_rrl_safety_stock_percent := IF(
  @rrl_has_safety_stock_percent = 0,
  'ALTER TABLE `replenishment_run_line` ADD COLUMN `safety_stock_percent` decimal(10,2) NOT NULL DEFAULT 0 AFTER `safety_stock_units`',
  'SELECT 1'
);
PREPARE add_rrl_safety_stock_percent_stmt FROM @add_rrl_safety_stock_percent;
EXECUTE add_rrl_safety_stock_percent_stmt;
DEALLOCATE PREPARE add_rrl_safety_stock_percent_stmt;

-- Idempotent addition of shelf_on_hand to existing `replenishment_run_line` installs.
SET @rrl_has_shelf_on_hand := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_line' AND COLUMN_NAME = 'shelf_on_hand'
);
SET @add_rrl_shelf_on_hand := IF(
  @rrl_has_shelf_on_hand = 0,
  'ALTER TABLE `replenishment_run_line` ADD COLUMN `shelf_on_hand` decimal(18,4) NULL AFTER `effective_available`',
  'SELECT 1'
);
PREPARE add_rrl_shelf_on_hand_stmt FROM @add_rrl_shelf_on_hand;
EXECUTE add_rrl_shelf_on_hand_stmt;
DEALLOCATE PREPARE add_rrl_shelf_on_hand_stmt;

-- Idempotent additions to the existing `delivery` table for history snapshots.
SET @del_has_location_name := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'location_name'
);
SET @add_del_location_name := IF(
  @del_has_location_name = 0,
  'ALTER TABLE `delivery` ADD COLUMN `location_name` varchar(255) NULL AFTER `location_id`',
  'SELECT 1'
);
PREPARE add_del_location_name_stmt FROM @add_del_location_name;
EXECUTE add_del_location_name_stmt;
DEALLOCATE PREPARE add_del_location_name_stmt;

SET @del_has_supplier_name := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'supplier_name'
);
SET @add_del_supplier_name := IF(
  @del_has_supplier_name = 0,
  'ALTER TABLE `delivery` ADD COLUMN `supplier_name` varchar(255) NULL AFTER `supplier_id`',
  'SELECT 1'
);
PREPARE add_del_supplier_name_stmt FROM @add_del_supplier_name;
EXECUTE add_del_supplier_name_stmt;
DEALLOCATE PREPARE add_del_supplier_name_stmt;

SET @del_has_original_po_code := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'original_po_code'
);
SET @add_del_original_po_code := IF(
  @del_has_original_po_code = 0,
  'ALTER TABLE `delivery` ADD COLUMN `original_po_code` varchar(50) NULL AFTER `original_po_id`',
  'SELECT 1'
);
PREPARE add_del_original_po_code_stmt FROM @add_del_original_po_code;
EXECUTE add_del_original_po_code_stmt;
DEALLOCATE PREPARE add_del_original_po_code_stmt;

SET @del_has_receiver_name := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'receiver_name'
);
SET @add_del_receiver_name := IF(
  @del_has_receiver_name = 0,
  'ALTER TABLE `delivery` ADD COLUMN `receiver_name` varchar(255) NULL AFTER `received_by_employee_code`',
  'SELECT 1'
);
PREPARE add_del_receiver_name_stmt FROM @add_del_receiver_name;
EXECUTE add_del_receiver_name_stmt;
DEALLOCATE PREPARE add_del_receiver_name_stmt;

SET @del_has_blind_delivery := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'blind_delivery'
);
SET @add_del_blind_delivery := IF(
  @del_has_blind_delivery = 0,
  'ALTER TABLE `delivery` ADD COLUMN `blind_delivery` tinyint(1) NOT NULL DEFAULT 0 AFTER `receiver_name`',
  'SELECT 1'
);
PREPARE add_del_blind_delivery_stmt FROM @add_del_blind_delivery;
EXECUTE add_del_blind_delivery_stmt;
DEALLOCATE PREPARE add_del_blind_delivery_stmt;

SET @del_has_continuous_scanning := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'continuous_scanning'
);
SET @add_del_continuous_scanning := IF(
  @del_has_continuous_scanning = 0,
  'ALTER TABLE `delivery` ADD COLUMN `continuous_scanning` tinyint(1) NOT NULL DEFAULT 1 AFTER `blind_delivery`',
  'SELECT 1'
);
PREPARE add_del_continuous_scanning_stmt FROM @add_del_continuous_scanning;
EXECUTE add_del_continuous_scanning_stmt;
DEALLOCATE PREPARE add_del_continuous_scanning_stmt;

-- Idempotent indexes on `delivery` for history list queries.
SET @del_idx_created_at := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND INDEX_NAME = 'ix_delivery_created_at'
);
SET @add_del_idx_created_at := IF(
  @del_idx_created_at = 0,
  'ALTER TABLE `delivery` ADD INDEX `ix_delivery_created_at` (`created_at`)',
  'SELECT 1'
);
PREPARE add_del_idx_created_at_stmt FROM @add_del_idx_created_at;
EXECUTE add_del_idx_created_at_stmt;
DEALLOCATE PREPARE add_del_idx_created_at_stmt;

SET @del_idx_location := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND INDEX_NAME = 'ix_delivery_location_id'
);
SET @add_del_idx_location := IF(
  @del_idx_location = 0,
  'ALTER TABLE `delivery` ADD INDEX `ix_delivery_location_id` (`location_id`)',
  'SELECT 1'
);
PREPARE add_del_idx_location_stmt FROM @add_del_idx_location;
EXECUTE add_del_idx_location_stmt;
DEALLOCATE PREPARE add_del_idx_location_stmt;

SET @del_idx_supplier := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND INDEX_NAME = 'ix_delivery_supplier_id'
);
SET @add_del_idx_supplier := IF(
  @del_idx_supplier = 0,
  'ALTER TABLE `delivery` ADD INDEX `ix_delivery_supplier_id` (`supplier_id`)',
  'SELECT 1'
);
PREPARE add_del_idx_supplier_stmt FROM @add_del_idx_supplier;
EXECUTE add_del_idx_supplier_stmt;
DEALLOCATE PREPARE add_del_idx_supplier_stmt;

SET @del_idx_original_po_code := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND INDEX_NAME = 'ix_delivery_original_po_code'
);
SET @add_del_idx_original_po_code := IF(
  @del_idx_original_po_code = 0,
  'ALTER TABLE `delivery` ADD INDEX `ix_delivery_original_po_code` (`original_po_code`(50))',
  'SELECT 1'
);
PREPARE add_del_idx_original_po_code_stmt FROM @add_del_idx_original_po_code;
EXECUTE add_del_idx_original_po_code_stmt;
DEALLOCATE PREPARE add_del_idx_original_po_code_stmt;

SET @del_idx_new_po_code := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND INDEX_NAME = 'ix_delivery_new_po_code'
);
SET @add_del_idx_new_po_code := IF(
  @del_idx_new_po_code = 0,
  'ALTER TABLE `delivery` ADD INDEX `ix_delivery_new_po_code` (`new_po_code`)',
  'SELECT 1'
);
PREPARE add_del_idx_new_po_code_stmt FROM @add_del_idx_new_po_code;
EXECUTE add_del_idx_new_po_code_stmt;
DEALLOCATE PREPARE add_del_idx_new_po_code_stmt;

-- Delivery identifies its own (app-created) supersede POs by `new_po_id` membership rather
-- than an ActiveOne custom field. Index keeps the grid/receiving anti-join on `purchase_order` cheap.
SET @del_idx_new_po_id := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND INDEX_NAME = 'ix_delivery_new_po_id'
);
SET @add_del_idx_new_po_id := IF(
  @del_idx_new_po_id = 0,
  'ALTER TABLE `delivery` ADD INDEX `ix_delivery_new_po_id` (`new_po_id`)',
  'SELECT 1'
);
PREPARE add_del_idx_new_po_id_stmt FROM @add_del_idx_new_po_id;
EXECUTE add_del_idx_new_po_id_stmt;
DEALLOCATE PREPARE add_del_idx_new_po_id_stmt;

-- Blind-delivery discrepancy-gate audit fields on `delivery`.
SET @del_has_discrepancy_approved := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'discrepancy_approved'
);
SET @add_del_discrepancy_approved := IF(
  @del_has_discrepancy_approved = 0,
  'ALTER TABLE `delivery` ADD COLUMN `discrepancy_approved` tinyint(1) NOT NULL DEFAULT 0 AFTER `continuous_scanning`',
  'SELECT 1'
);
PREPARE add_del_discrepancy_approved_stmt FROM @add_del_discrepancy_approved;
EXECUTE add_del_discrepancy_approved_stmt;
DEALLOCATE PREPARE add_del_discrepancy_approved_stmt;

SET @del_has_approved_by_user_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'approved_by_user_id'
);
SET @add_del_approved_by_user_id := IF(
  @del_has_approved_by_user_id = 0,
  'ALTER TABLE `delivery` ADD COLUMN `approved_by_user_id` int NULL AFTER `discrepancy_approved`',
  'SELECT 1'
);
PREPARE add_del_approved_by_user_id_stmt FROM @add_del_approved_by_user_id;
EXECUTE add_del_approved_by_user_id_stmt;
DEALLOCATE PREPARE add_del_approved_by_user_id_stmt;

SET @del_has_approved_at := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'approved_at'
);
SET @add_del_approved_at := IF(
  @del_has_approved_at = 0,
  'ALTER TABLE `delivery` ADD COLUMN `approved_at` datetime NULL AFTER `approved_by_user_id`',
  'SELECT 1'
);
PREPARE add_del_approved_at_stmt FROM @add_del_approved_at;
EXECUTE add_del_approved_at_stmt;
DEALLOCATE PREPARE add_del_approved_at_stmt;

SET @del_has_approver_name := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'approver_name'
);
SET @add_del_approver_name := IF(
  @del_has_approver_name = 0,
  'ALTER TABLE `delivery` ADD COLUMN `approver_name` varchar(255) NULL AFTER `approved_at`',
  'SELECT 1'
);
PREPARE add_del_approver_name_stmt FROM @add_del_approver_name;
EXECUTE add_del_approver_name_stmt;
DEALLOCATE PREPARE add_del_approver_name_stmt;

-- Index for the History "approved discrepancies only" filter.
SET @del_idx_discrepancy_approved := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND INDEX_NAME = 'ix_delivery_discrepancy_approved'
);
SET @add_del_idx_discrepancy_approved := IF(
  @del_idx_discrepancy_approved = 0,
  'ALTER TABLE `delivery` ADD INDEX `ix_delivery_discrepancy_approved` (`discrepancy_approved`)',
  'SELECT 1'
);
PREPARE add_del_idx_discrepancy_approved_stmt FROM @add_del_idx_discrepancy_approved;
EXECUTE add_del_idx_discrepancy_approved_stmt;
DEALLOCATE PREPARE add_del_idx_discrepancy_approved_stmt;

-- Return-Excess events child table: one row per line snapped down to ordered qty inside a blind session.
CREATE TABLE IF NOT EXISTS `delivery_return_excess` (
  `id`               int unsigned NOT NULL AUTO_INCREMENT,
  `delivery_id`      int unsigned NOT NULL,
  `item_code`        varchar(50)  NOT NULL,
  `received_qty`     int          NOT NULL,
  `returned_to_qty`  int          NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_delivery_return_excess_delivery` (`delivery_id`),
  CONSTRAINT `fk_delivery_return_excess_delivery`
    FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-line snapshot for each committed delivery session. FK cascades on delivery delete.
CREATE TABLE IF NOT EXISTS `delivery_line` (
  `id`               int unsigned NOT NULL AUTO_INCREMENT,
  `delivery_id`      int unsigned NOT NULL,
  `item_code`        varchar(50)  NOT NULL,
  `item_description` text         NOT NULL,
  `ordered_qty`      int          NOT NULL DEFAULT 0,
  `received_qty`     int          NOT NULL DEFAULT 0,
  `status`           enum('exact','over','under','not_ordered','new_item') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_delivery_line_delivery_id` (`delivery_id`),
  CONSTRAINT `fk_delivery_line_delivery`
    FOREIGN KEY (`delivery_id`) REFERENCES `delivery` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The minted ActiveOne PO primary key, so a future PO-list module can join a live PO to its
-- manufacturer by key. Replaces the old `purchase_order.CUSTOM_FIELD3` write; nullable for
-- rows created before this column existed.
SET @rrp_has_po_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_po' AND COLUMN_NAME = 'po_id'
);
SET @add_rrp_po_id := IF(
  @rrp_has_po_id = 0,
  'ALTER TABLE `replenishment_run_po` ADD COLUMN `po_id` int NULL AFTER `po_code`',
  'SELECT 1'
);
PREPARE add_rrp_po_id_stmt FROM @add_rrp_po_id;
EXECUTE add_rrp_po_id_stmt;
DEALLOCATE PREPARE add_rrp_po_id_stmt;

-- ============================================================================
-- Role-based access control (RBAC) — app-owned. Replaces the legacy
-- `users.role` enum. A user holds many roles; effective permissions = union of
-- their active roles' permission keys, resolved into the JWT at sign-in. The
-- permission catalog itself is code-defined (src/shared/domain/Permissions.ts),
-- so `role_permission.permission_key` holds catalog keys validated in code.
-- ============================================================================

-- One row per role. "Administrator" is the protected, undeletable full-access
-- role (is_protected = 1); its permission set is resolved in code (the whole
-- catalog), so it deliberately has NO role_permission rows.
CREATE TABLE IF NOT EXISTS `role` (
  `id`           int unsigned NOT NULL AUTO_INCREMENT,
  `name`         varchar(100) NOT NULL,
  `description`  varchar(255) NULL,
  `is_protected` tinyint(1)   NOT NULL DEFAULT 0,
  `is_active`    tinyint(1)   NOT NULL DEFAULT 1,
  `created_at`   datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_role_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One row per permission granted to a role. `permission_key` is a code-catalog
-- key; unknown keys (e.g. a retired catalog entry) are ignored at resolution.
CREATE TABLE IF NOT EXISTS `role_permission` (
  `role_id`        int unsigned NOT NULL,
  `permission_key` varchar(100) NOT NULL,
  PRIMARY KEY (`role_id`, `permission_key`),
  CONSTRAINT `fk_role_permission_role`
    FOREIGN KEY (`role_id`) REFERENCES `role` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Many-to-many user↔role membership.
CREATE TABLE IF NOT EXISTS `user_role` (
  `user_id` int unsigned NOT NULL,
  `role_id` int unsigned NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  CONSTRAINT `fk_user_role_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_role_role`
    FOREIGN KEY (`role_id`) REFERENCES `role` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- Per-supplier minimum order columns (PRD-replenishment-supplier-minimum-order)
-- ============================================================================

-- Idempotent add of min_order_value to `supplier_schedule`.
SET @ss_has_min_order_value := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_schedule' AND COLUMN_NAME = 'min_order_value'
);
SET @add_ss_min_order_value := IF(
  @ss_has_min_order_value = 0,
  'ALTER TABLE `supplier_schedule` ADD COLUMN `min_order_value` decimal(18,2) NULL AFTER `last_ordered_at`',
  'SELECT 1'
);
PREPARE add_ss_min_order_value_stmt FROM @add_ss_min_order_value;
EXECUTE add_ss_min_order_value_stmt;
DEALLOCATE PREPARE add_ss_min_order_value_stmt;

-- Idempotent add of min_order_quantity to `supplier_schedule`.
SET @ss_has_min_order_quantity := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_schedule' AND COLUMN_NAME = 'min_order_quantity'
);
SET @add_ss_min_order_quantity := IF(
  @ss_has_min_order_quantity = 0,
  'ALTER TABLE `supplier_schedule` ADD COLUMN `min_order_quantity` int NULL AFTER `min_order_value`',
  'SELECT 1'
);
PREPARE add_ss_min_order_quantity_stmt FROM @add_ss_min_order_quantity;
EXECUTE add_ss_min_order_quantity_stmt;
DEALLOCATE PREPARE add_ss_min_order_quantity_stmt;

-- Idempotent add of below_min_acknowledged to `replenishment_run`.
SET @run_has_below_min_ack := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run' AND COLUMN_NAME = 'below_min_acknowledged'
);
SET @add_run_below_min_ack := IF(
  @run_has_below_min_ack = 0,
  'ALTER TABLE `replenishment_run` ADD COLUMN `below_min_acknowledged` tinyint(1) NOT NULL DEFAULT 0 AFTER `line_count`',
  'SELECT 1'
);
PREPARE add_run_below_min_ack_stmt FROM @add_run_below_min_ack;
EXECUTE add_run_below_min_ack_stmt;
DEALLOCATE PREPARE add_run_below_min_ack_stmt;

-- Idempotent add of below_min_details (JSON) to `replenishment_run`.
SET @run_has_below_min_details := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run' AND COLUMN_NAME = 'below_min_details'
);
SET @add_run_below_min_details := IF(
  @run_has_below_min_details = 0,
  'ALTER TABLE `replenishment_run` ADD COLUMN `below_min_details` JSON NULL AFTER `below_min_acknowledged`',
  'SELECT 1'
);
PREPARE add_run_below_min_details_stmt FROM @add_run_below_min_details;
EXECUTE add_run_below_min_details_stmt;
DEALLOCATE PREPARE add_run_below_min_details_stmt;

-- Idempotent add of status to `replenishment_run`.
SET @run_has_status := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run' AND COLUMN_NAME = 'status'
);
SET @add_run_status := IF(
  @run_has_status = 0,
  'ALTER TABLE `replenishment_run` ADD COLUMN `status` enum(''active'',''deleted'') NOT NULL DEFAULT ''active'' AFTER `line_count`',
  'SELECT 1'
);
PREPARE add_run_status_stmt FROM @add_run_status;
EXECUTE add_run_status_stmt;
DEALLOCATE PREPARE add_run_status_stmt;

-- Idempotent extend status enum to include 'draft'.
SET @run_has_draft_status := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run'
    AND COLUMN_NAME = 'status' AND COLUMN_TYPE LIKE '%draft%'
);
SET @add_run_draft := IF(
  @run_has_draft_status = 0,
  'ALTER TABLE `replenishment_run` MODIFY COLUMN `status` enum(''draft'',''active'',''deleted'') NOT NULL DEFAULT ''active''',
  'SELECT 1'
);
PREPARE add_run_draft_stmt FROM @add_run_draft;
EXECUTE add_run_draft_stmt;
DEALLOCATE PREPARE add_run_draft_stmt;

-- Idempotent add approved_by columns to replenishment_run.
SET @run_has_approved_by := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run' AND COLUMN_NAME = 'approved_by_user_id'
);
SET @add_run_approved_by := IF(
  @run_has_approved_by = 0,
  'ALTER TABLE `replenishment_run` ADD COLUMN `approved_by_user_id` int NULL AFTER `created_by_employee_code`, ADD COLUMN `approved_by_name` text NULL AFTER `approved_by_user_id`, ADD COLUMN `approved_at` datetime NULL AFTER `approved_by_name`',
  'SELECT 1'
);
PREPARE add_run_approved_by_stmt FROM @add_run_approved_by;
EXECUTE add_run_approved_by_stmt;
DEALLOCATE PREPARE add_run_approved_by_stmt;

-- App-owned global counter for the readable PO CODE number. The CODE number is
-- decoupled from the ActiveOne purchase_order PK ID (PRD-po-code-numbering.md):
-- generation reads next_value, uses it as the CODE tail under the active
-- `po_code_prefix`, and bumps it — inside the same transaction as the PO insert
-- (SELECT … FOR UPDATE serializes concurrent writers). One row per prefix;
-- the row is created lazily on first PO under a prefix (seeded from the max
-- existing `{prefix}-<digits>` CODE tail) or by the admin "Reset numbering to 1"
-- action. App-owned; no foreign key into ActiveOne.
CREATE TABLE IF NOT EXISTS `po_code_counter` (
  `prefix`      varchar(16) NOT NULL,
  `next_value`  bigint      NOT NULL,
  `created_at`  datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
