/**
 * ActiveOne magic values.
 *
 * VERIFIED 2026-06-26 against a full-year ActiveOne MySQL dump (db `greatwall_activeone`):
 * decoded from `document_status_map`, `contact_type_map`, and real `contact`/`purchase_order`
 * rows. These replace the earlier guesses pinned to the dev seed — several of which were wrong
 * (status 0/1, vendor type 3, lead-time CUSTOM_FIELD3). See docs/activeone-schema-insights.md.
 *
 * These are cross-cutting ActiveOne integration constants consumed by multiple
 * modules (replenishment, delivery, shared supplier-schedule), so they live in shared.
 */

/**
 * purchase_order.STATUS for an open (undelivered) PO.
 * `document_status_map`: 0=Draft, 1=Pending, 2=Open, 3=Closed, 6=Canceled, 7=Void,
 * 12=Received in full. Open POs are the only ones that count as "incoming".
 */
export const PO_OPEN_STATUS = 2;

/**
 * purchase_order.STATUS for a closed PO. The Delivery module sets it when superseding
 * the original PO so it stops counting as incoming. (3 = Closed; the natural terminal
 * state once an order is finished. ActiveOne also uses 12 = Received in full after billing.)
 */
export const PO_CLOSED_STATUS = 3;

/**
 * object_type_map.TABLE_NAME for the PO header and line tables — the rows of
 * ActiveOne's own document-ID allocator. Native ActiveOne mints the next PO ID from
 * object_type_map.NEXT_ID and bumps it by INCREMENT; when the counter lags (e.g. an
 * external writer like this app inserted rows without advancing it) native hits a
 * duplicate-ID error and self-heals from MAX instead. This app must therefore advance
 * these two counters whenever it creates a PO so native never re-issues an app-taken
 * ID. See src/shared/infrastructure/activeonePoMinting.ts.
 */
export const OBJECT_TYPE_PO = "PURCHASE_ORDER";
export const OBJECT_TYPE_PO_LINES = "PURCHASE_ORDER_LINES";

/**
 * purchase_order.STATUS for a canceled PO. Set by the History module when a
 * replenishment run is deleted, cancelling its associated POs. (6 = Canceled.)
 */
export const PO_CANCELED_STATUS = 6;

/**
 * purchase_order.STATUS for a received-in-full (delivered) PO.
 * (12 = Received in full, set by ActiveOne after billing.)
 */
export const PO_RECEIVED_IN_FULL_STATUS = 12;

/**
 * Human-readable PO code generation for POs THIS APP creates.
 *
 * App POs use a disjoint `OHPO-` namespace so they never collide with — or
 * perturb — ActiveOne's own numbering: ActiveOne derives the next code from MAX
 * over *numeric* codes, and `OHPO-…` casts to 0, so it is ignored. The PK `ID`
 * is minted contiguously above MAX(ID) and this app advances ActiveOne's
 * object_type_map NEXT_ID allocator after each save so native never re-issues an
 * app-taken ID. See PRD-po-id-code-minting.md and
 * src/shared/infrastructure/activeonePoMinting.ts.
 *
 * Since PRD-po-code-numbering.md the CODE's trailing number is an app-owned
 * global counter (`po_code_counter`), decoupled from the PK `ID`; leading-zero
 * padding is display-only (see src/shared/infrastructure/poCodeDisplay.ts).
 *
 * Default prefix; can be overridden at runtime via app_settings.po_code_prefix.
 */
export const DEFAULT_PO_CODE_PREFIX = "OHPO";

/**
 * contact.TYPE for a supplier/vendor.
 * `contact_type_map`: 0=Vendor, 1=Customer, 2=Employee, 3=Tax Agency, 4=Other Contacts.
 * Confirmed: all 33,914 POs reference type-0 contacts as VENDOR_ID.
 */
export const VENDOR_CONTACT_TYPE = 0;

/**
 * contact.TYPE for an employee.
 * `contact_type_map`: 0=Vendor, 1=Customer, 2=Employee, 3=Tax Agency, 4=Other Contacts.
 * The user-management employee picker links Ops Hub users to these contacts via
 * their `ACCOUNT_NO` (stored in `users.employee_code`); Delivery persists the receiver's
 * code in our own `delivery.received_by_employee_code` (no ActiveOne custom-field write).
 */
export const EMPLOYEE_CONTACT_TYPE = 2;

/**
 * Which contact.CUSTOM_FIELDn holds the supplier lead-time in days.
 * Confirmed against live data: lead-time days live in CUSTOM_FIELD4 (CUSTOM_FIELD3 is
 * empty for every vendor; CUSTOM_FIELD1 holds unrelated large numbers).
 * Allow-listed (never user input) so it is safe to interpolate into SQL.
 */
export const LEAD_TIME_FIELD = "CUSTOM_FIELD4";

const ALLOWED_LEAD_TIME_FIELDS = new Set([
  "CUSTOM_FIELD1",
  "CUSTOM_FIELD2",
  "CUSTOM_FIELD3",
  "CUSTOM_FIELD4",
  "CUSTOM_FIELD5",
]);

if (!ALLOWED_LEAD_TIME_FIELDS.has(LEAD_TIME_FIELD)) {
  throw new Error(`LEAD_TIME_FIELD must be one of contact.CUSTOM_FIELD1..5, got "${LEAD_TIME_FIELD}"`);
}
