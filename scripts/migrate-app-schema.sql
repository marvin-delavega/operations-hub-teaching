-- ============================================================================
-- Migrate app-owned tables OUT of the ActiveOne schema into `ops_hub`.
--
-- Two schemas, one MySQL server. The ActiveOne schema keeps its existing name;
-- the app schema (`ops_hub`) holds every table created by create-app-tables.sql.
-- This preserves cross-schema SQL JOINs and single InnoDB transactions (server-scoped).
--
-- PREREQUISITES
--   1. The DB user you run this as must have privileges on BOTH schemas.
--   2. Edit the two variables below to match your install.
--
-- RUN ORDER
--   Pass 1 (below, safe + idempotent): create the schema, apply the table DDL,
--   and copy rows out of ActiveOne. Safe to re-run.
--   Pass 2 (separate file): drop the originals from ActiveOne via
--   scripts/drop-app-tables-from-activeone.sql — run ONLY after verifying the copy.
-- ============================================================================

SET @activeone_db = 'greatwall_activeone';
SET @app_db        = 'ops_hub';

SET @create_schema := CONCAT(
  'CREATE DATABASE IF NOT EXISTS `', @app_db,
  '` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'
);
PREPARE stmt FROM @create_schema; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Apply the app table DDL into the app schema. The statements below are the body
-- of scripts/create-app-tables.sql, kept in sync by re-running that file with the
-- connection defaulted to the app schema (USE ops_hub). create-app-tables.sql's
-- `TABLE_SCHEMA = DATABASE()` checks resolve against the app schema, so it is the
-- single source of truth for DDL.
--
-- For convenience, run create-app-tables.sql directly:
--   mysql -u <user> -p ops_hub < scripts/create-app-tables.sql
-- and then continue with the COPY section below.
-- ============================================================================

-- ============================================================================
-- COPY (idempotent — re-run safely skips already-copied rows on PK conflict).
-- Column order matches because both schemas' tables come from the same
-- create-app-tables.sql.
-- ============================================================================

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.module_location_visibility   SELECT * FROM `', @activeone_db, '`.module_location_visibility'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.app_settings               SELECT * FROM `', @activeone_db, '`.app_settings'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.users                      SELECT * FROM `', @activeone_db, '`.users'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.stock_count                SELECT * FROM `', @activeone_db, '`.stock_count'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.stock_count_items          SELECT * FROM `', @activeone_db, '`.stock_count_items'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.supplier_schedule          SELECT * FROM `', @activeone_db, '`.supplier_schedule'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.delivery                   SELECT * FROM `', @activeone_db, '`.delivery'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.delivery_new_items         SELECT * FROM `', @activeone_db, '`.delivery_new_items'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.delivery_line              SELECT * FROM `', @activeone_db, '`.delivery_line'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.delivery_return_excess     SELECT * FROM `', @activeone_db, '`.delivery_return_excess'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.item_master_cache          SELECT * FROM `', @activeone_db, '`.item_master_cache'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.item_sales_daily           SELECT * FROM `', @activeone_db, '`.item_sales_daily'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.selling_area_feeder_map    SELECT * FROM `', @activeone_db, '`.selling_area_feeder_map'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

-- `replenishment_summary` is NOT copied: it is a truncated-and-recomputed cache
-- (rebuilt on admin refresh and on read), so its ActiveOne rows are disposable.

-- Explicit column list: the legacy table's `status` column predates the
-- `below_min_*` ALTERs, so its column order differs from the fresh schema.
SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.replenishment_run ',
  '(id, path, location_id, location_name, created_by_user_id, created_by_name, created_by_employee_code, ',
  'approved_by_user_id, approved_by_name, approved_at, rounding, sales_range_from, sales_range_to, ',
  'supplier_count, po_count, line_count, below_min_acknowledged, below_min_details, status, created_at) ',
  'SELECT id, path, location_id, location_name, created_by_user_id, created_by_name, created_by_employee_code, ',
  'approved_by_user_id, approved_by_name, approved_at, rounding, sales_range_from, sales_range_to, ',
  'supplier_count, po_count, line_count, below_min_acknowledged, below_min_details, status, created_at ',
  'FROM `', @activeone_db, '`.replenishment_run'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.replenishment_run_po       SELECT * FROM `', @activeone_db, '`.replenishment_run_po'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.replenishment_run_line     SELECT * FROM `', @activeone_db, '`.replenishment_run_line'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.role                       SELECT * FROM `', @activeone_db, '`.role'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.role_permission            SELECT * FROM `', @activeone_db, '`.role_permission'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

SET @copy := CONCAT(
  'INSERT IGNORE INTO `', @app_db, '`.user_role                  SELECT * FROM `', @activeone_db, '`.user_role'
); PREPARE s FROM @copy; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================================
-- PASS 2 — DESTRUCTIVE: drop the originals from the ActiveOne schema.
-- Extracted to scripts/drop-app-tables-from-activeone.sql (idempotent, uses
-- DROP TABLE IF EXISTS). Run that file only AFTER verifying the copy.
-- ============================================================================
