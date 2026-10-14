/** Single source of truth for the password policy shared by admin user management
 *  (create / reset) and self-service password change. Length only — no complexity
 *  rules, per PRD-user-role-management.md non-goals. */
export const MIN_PASSWORD_LENGTH = 8;
