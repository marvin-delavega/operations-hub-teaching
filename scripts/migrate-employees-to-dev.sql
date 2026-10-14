-- ============================================================================
-- Migrate employee contacts from the real ActiveOne dump into the dev DB.
--
--   Source : `greatwall_activeone`  (full-year ActiveOne MySQL dump)
--   Target : `activeone`            (dev DB the app runs against)
--
-- Copies every employee contact (contact.TYPE = 2) so the Admin > Users
-- employee-link picker (MySQLEmployeeDirectory, TYPE=2 keyed by ACCOUNT_NO)
-- has real data to search against. IDs are preserved 1:1 from the source.
--
-- TYPE reference (contact_type_map, verified 2026-06-26):
--   0=Vendor  1=Customer  2=Employee  3=Tax Agency  4=Other Contacts
-- Employees are TYPE=2 (NOT 3 — that's Tax Agency). See activeoneConstants.ts.
--
-- Idempotent: REPLACE re-copies/refreshes on every run.
--
-- FOREIGN_KEY_CHECKS is disabled for the copy: employee rows may carry
-- GROUP_ID / PAYMENT_TERMS_ID / SALES_REP_ID / TAX_ID etc. that reference
-- lookup rows not present in the lean dev DB. The app reads only
-- NAME / ACCOUNT_NO / TYPE / INACTIVE for employees, so leaving those FKs
-- unresolved in dev is harmless. Adjust the DB names below if yours differ.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

START TRANSACTION;

-- Ensure the Employee type exists in the target (FK target for contact.TYPE).
INSERT IGNORE INTO `activeone`.`contact_type_map` (`ID`, `DESCRIPTION`) VALUES
  (2, 'Employee');

-- Copy/refresh all employee contacts. Explicit column list = column-order safe.
REPLACE INTO `activeone`.`contact` (
  `ID`, `TYPE`, `NAME`, `COMPANY_NAME`, `SALUTATION`, `FIRST_NAME`, `MIDDLE_NAME`,
  `LAST_NAME`, `PRINT_NAME_AS`, `POSTAL_ADDRESS`, `CONTACT_PERSON`, `TELEPHONE_NO`,
  `FAX_NO`, `MOBILE_NO`, `ALT_TELEPHONE_NO`, `ALT_CONTACT_PERSON`, `EMAIL`,
  `ACCOUNT_NO`, `INACTIVE`, `GROUP_ID`, `PAYMENT_TERMS_ID`, `CREDIT_LIMIT`,
  `PREF_PAYMENT_METHOD_ID`, `CREDIT_CARD_NO`, `CREDIT_CARD_EXPIRY_DATE`,
  `SALES_REP_ID`, `PRICE_LEVEL_ID`, `APPLY_FINANCE_CHARGE`, `TAXPAYER_ID`,
  `TAX_ID`, `EW_TAX_ID`, `SSS_NO`, `PAGIBIG_NO`, `PHIC_NO`, `GENDER`,
  `DATE_OF_BIRTH`, `NICKNAME`, `HIRE_DATE`, `POSITION`,
  `CUSTOM_FIELD1`, `CUSTOM_FIELD2`, `CUSTOM_FIELD3`, `CUSTOM_FIELD4`, `CUSTOM_FIELD5`
)
SELECT
  `ID`, `TYPE`, `NAME`, `COMPANY_NAME`, `SALUTATION`, `FIRST_NAME`, `MIDDLE_NAME`,
  `LAST_NAME`, `PRINT_NAME_AS`, `POSTAL_ADDRESS`, `CONTACT_PERSON`, `TELEPHONE_NO`,
  `FAX_NO`, `MOBILE_NO`, `ALT_TELEPHONE_NO`, `ALT_CONTACT_PERSON`, `EMAIL`,
  `ACCOUNT_NO`, `INACTIVE`, `GROUP_ID`, `PAYMENT_TERMS_ID`, `CREDIT_LIMIT`,
  `PREF_PAYMENT_METHOD_ID`, `CREDIT_CARD_NO`, `CREDIT_CARD_EXPIRY_DATE`,
  `SALES_REP_ID`, `PRICE_LEVEL_ID`, `APPLY_FINANCE_CHARGE`, `TAXPAYER_ID`,
  `TAX_ID`, `EW_TAX_ID`, `SSS_NO`, `PAGIBIG_NO`, `PHIC_NO`, `GENDER`,
  `DATE_OF_BIRTH`, `NICKNAME`, `HIRE_DATE`, `POSITION`,
  `CUSTOM_FIELD1`, `CUSTOM_FIELD2`, `CUSTOM_FIELD3`, `CUSTOM_FIELD4`, `CUSTOM_FIELD5`
FROM `greatwall_activeone`.`contact`
WHERE `TYPE` = 2;

COMMIT;

SET FOREIGN_KEY_CHECKS = 1;

-- Sanity check: how many employees landed, and a sample the picker would surface.
SELECT COUNT(*) AS employees_migrated
FROM `activeone`.`contact`
WHERE `TYPE` = 2;

SELECT `ID`, `NAME`, `ACCOUNT_NO`, `INACTIVE`
FROM `activeone`.`contact`
WHERE `TYPE` = 2
ORDER BY `NAME`
LIMIT 20;
