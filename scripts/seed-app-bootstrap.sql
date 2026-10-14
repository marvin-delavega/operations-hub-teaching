-- ============================================================================
-- Bootstrap data for app-owned tables (run after create-app-tables.sql).
-- Safe to re-run: uses idempotent upserts.
--
-- Run against the APP schema (ops_hub), not the ActiveOne schema:
--   mysql -u <user> -p ops_hub < scripts/seed-app-bootstrap.sql
--
-- Seeds:
--   * app_settings.company_name -> "Great Wall Trading" (CLAUDE.md seed value)
--   * one admin user so production-style login works without the dev backdoor.
--
-- Default admin credentials (CHANGE in any real deployment):
--   username: admin
--   password: admin123
-- The hash below is bcrypt(admin123, cost 10). To rotate it:
--   node -e "console.log(require('bcryptjs').hashSync('NEW_PASSWORD',10))"
-- and replace the password_hash value.
-- ============================================================================

-- `setup_completed` is intentionally NOT seeded here so that a fresh install
-- triggers the first-run setup wizard. Only `finish/reset` API calls write it.
INSERT INTO app_settings (`key`, `value`) VALUES
  ('company_name', 'Great Wall Trading'),
  ('scan_batch_delay_ms', '2000')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- The shipped admin is the permanent, locked system admin (is_protected = 1):
-- always role=admin + is_active=1, never editable/deactivatable in the UI. It is
-- the guaranteed break-glass account. password_hash is intentionally NOT updated
-- on re-run so a rotated password (via self-service) survives re-seeding.
INSERT INTO users (name, username, password_hash, role, is_active, is_protected) VALUES
  ('Administrator', 'admin', '$2b$10$pxCFza/lJxPPeKn9qBI.2eLuGBtzIFZTFkCDE.mW2yg49YkTwscIG', 'admin', 1, 1)
ON DUPLICATE KEY UPDATE
  name          = VALUES(name),
  role          = VALUES(role),
  is_active     = VALUES(is_active),
  is_protected  = VALUES(is_protected);

-- ============================================================================
-- RBAC seed & migration (run after create-app-tables.sql adds role tables).
--
-- Administrator (protected): full-access, permissions resolved in code — so it
-- deliberately gets NO role_permission rows. Staff: reproduces today's staff
-- behavior (Open Delivery/Counting/Replenishment). Legacy `users.role` is then
-- mapped into user_role membership; the protected account is pinned to Administrator.
-- ============================================================================

INSERT INTO role (name, description, is_protected, is_active) VALUES
  ('Administrator', 'Full access — protected system role.', 1, 1),
  ('Staff', 'Floor staff: Delivery, Counting, Replenishment, and Shelf Guide.', 0, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Staff permission set (idempotent). Administrator gets none by design.
INSERT IGNORE INTO role_permission (role_id, permission_key)
SELECT r.id, k.permission_key
FROM role r
JOIN (
  SELECT 'module.delivery' AS permission_key
  UNION ALL SELECT 'module.counting'
  UNION ALL SELECT 'module.replenishment'
  UNION ALL SELECT 'module.shelfguide'
) k
WHERE r.name = 'Staff';

-- Map every existing legacy role into membership: admin -> Administrator, else Staff.
INSERT IGNORE INTO user_role (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN role r ON r.name = (CASE u.role WHEN 'admin' THEN 'Administrator' ELSE 'Staff' END);

-- Pin the protected system account to Administrator (break-glass guarantee).
INSERT IGNORE INTO user_role (user_id, role_id)
SELECT u.id, (SELECT id FROM role WHERE name = 'Administrator')
FROM users u
WHERE u.is_protected = 1;
