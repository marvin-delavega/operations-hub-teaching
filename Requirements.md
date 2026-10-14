# Requirements

*Extracted from Agreement.md — Receiving Application Project Proposal*
*Client: Davao Great Wall Trading | Proponent: Marvin D. de la Vega | Date: 6/9/26*

---

## 1. General Requirements

### 1.1 Platform & Layout
- Application layout must be fully optimized and responsive for Android mobile and tablet screens.
- Desktop layout is acceptable for Sales Rate and Generate PO module (Phase 1).

### 1.2 Barcode Scanner Integration
- Support Eyoyo wireless Bluetooth scanner integration.
- Input fields must auto-advance: upon a barcode scan, the cursor must instantly move to the quantity field so staff can type counts without tapping the screen.
- When a checker pulls the trigger on the Eyoyo scanner, the item count must increase automatically and the screen must instantly clear for the next scan — no manual screen tap required between scans.
- Support Eyoyo internal memory bulk storage / batch upload mode for areas with zero Wi-Fi.

### 1.3 User Authentication & Role-Based Access
- User login is required to access any part of the application.
- User and role management must be supported.
- Modules must be hidden or restricted based on the user's role (e.g., floor staff can only scan, not delete or finalize).
- Admin-only actions must require admin credential verification before proceeding.

### 1.4 ActiveOne Integration
- The application acts as middleware between Purchase Order and Enter Bill in ActiveOne.
- Data (POs, item lists, deliveries, transfers, counts) must be loaded from and saved back to ActiveOne.
- Approved transfers and inventory changes must be sent to ActiveOne automatically, without manual re-entry.

### 1.5 Local Caching
- Receiving progress must be cached locally to prevent data loss during connectivity issues.

### 1.6 Unknown / New Item Handling
- The application must support scanning unknown SKUs that do not exist in ActiveOne and tag them as "New Item."

---

## 2. Module Requirements

### 2.1 Delivery Receiving
- Load Purchase Orders and Item Lists from ActiveOne.
- Display delivery status based on Ordered vs. Delivered quantities.
- Scan unknown SKUs and tag them as New Item.
- Show receiving progress and summary.
- Manual receiving control must be locked behind admin authorization.
- Save completed receiving as ActiveOne Delivery PO.
- Cache receiving progress locally.

### 2.2 Sales Rate and Generate PO
- View sales rate with extensive parameter support.
- Generate a Purchase Order based on Suggested Order quantities.
- Allow manual PO adjustment before final save.
- Support printing of the Generated PO.
- Save the generated PO to ActiveOne.

### 2.3 User Login and Role-Based Security
- Manage users and roles within the application.
- Require user login before granting access.
- Hide or restrict modules based on assigned role.
- Prompt for admin credentials when an admin-only action is triggered.

### 2.4 Delivery History
- Display a searchable list of past deliveries.
- Show delivery summary and full detail per delivery.
- Support printing of delivery reports.
- Allow searching by Receiver or by Date.

### 2.5 Inventory Transfer & Bad Orders (BO)
- Allow selection of source and target locations: Selling Area, Stockrooms, Warehouses, BO Room.
- Provide a dedicated option to tag items as "Bad Order" with reason codes from the floor.
- Detect and flag insufficient on-hand quantity before saving.
- Save transfers as staging; require admin review and approval before the final transfer is processed in ActiveOne.
- When approved, the transfer (including BO items) must be sent directly to ActiveOne automatically.

### 2.6 Invoice Releasing
- Allow selection of an Invoice number.
- Scan items and validate scanned quantities against the listed quantities.
- Strictly block saving or releasing if scanned vs. listed quantities are not balanced.
- Save the validated release as a Warehouse Release in ActiveOne.

### 2.7 Inventory Counting
- Support scan-to-count across a selected location scope (specific stockrooms or warehouses).
- Display count status showing scanned count vs. system on-hand, flagging missing or extra items.
- Support Eyoyo internal memory bulk storage / batch upload mode.
- Apply role-based access and require admin approval for overrides.
- Save the count as an inventory count record in ActiveOne.

### 2.8 Barcode Scanner & Mobile Integration
- Application layout fully optimized/responsive for Android mobile and tablet screens.
- Support Eyoyo wireless Bluetooth scanner integration.
- Input fields auto-advance on scan (cursor moves to quantity box immediately).
- Support Eyoyo internal memory bulk storage / batch upload mode for zero-Wi-Fi areas.
