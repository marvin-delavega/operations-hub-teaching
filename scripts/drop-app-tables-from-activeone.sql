-- ============================================================================
-- DROP the app-owned tables from the ActiveOne schema (Pass 2 of the schema
-- extraction migration).
--
-- DESTRUCTIVE. Run only AFTER:
--   1. create-app-tables.sql has been applied to `ops_hub`, and
--   2. migrate-app-schema.sql has copied the rows, and
--   3. you have verified row counts match per table.
--
-- Idempotent: DROP TABLE IF EXISTS, so re-running is safe.
--
-- PREREQUISITES
--   1. The DB user must have DROP privileges on the ActiveOne schema.
--   2. Edit @activeone_db below to match your install.
-- ============================================================================

SET @activeone_db = 'greatwall_activeone';

-- App-owned tables reference each other (e.g. user_role -> users,
-- delivery_line -> delivery). Disable FK checks so parents can be dropped
-- before their children without order-dependency errors.
SET FOREIGN_KEY_CHECKS = 0;

SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.module_location_visibility');  PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.app_settings');               PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.users');                      PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.stock_count');                PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.stock_count_items');          PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.supplier_schedule');          PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.delivery');                   PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.delivery_new_items');         PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.delivery_line');              PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.delivery_return_excess');     PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.item_master_cache');          PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.item_sales_daily');           PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.selling_area_feeder_map');    PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.replenishment_summary');      PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.replenishment_run');          PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.replenishment_run_po');       PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.replenishment_run_line');     PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.role');                       PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.role_permission');            PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;
SET @drop := CONCAT('DROP TABLE IF EXISTS `', @activeone_db, '`.user_role');                  PREPARE s FROM @drop; EXECUTE s; DEALLOCATE PREPARE s;

SET FOREIGN_KEY_CHECKS = 1;
