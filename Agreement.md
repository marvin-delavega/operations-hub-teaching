# Receiving Application Project Proposal

| | |
|---|---|
| **Date** | 6/9/26 |
| **Proponent** | Marvin D. de la Vega |
| **Client** | Davao Great Wall Trading |

---

## A. Summary

The client has requested the development of a receiving application to act as a middleware between Purchase Order and Enter Bill. There's an expressed need for quantity aggregation, receiving status, and support for unknown item SKU which does not exist in ActiveOne.

---

## B. Scope

The project's scope is mostly dictated by the objectives, and deliverables listed below. The project phase will conclude when the deliverables are accepted by the client based strictly on the Success Criteria outlined in Section E. After agreement, scope changes are subject for another project proposal, or expedite on the same project at a cost.

---

## C. Work Location & On-Site Alignment

### 1. Remote Development

To maximize efficiency, the majority of software development, coding, and testing will be conducted remotely (off-site/at home) by the Proponent.

### 2. On-Site Activities

On-site presence at the Client's premises is strictly limited to information gathering/requirements analysis, system deployment, and user acceptance testing phases.

In the event of conflicting schedules, urgent, non-project service requests from the Client will take absolute priority over scheduled on-site project work. If an urgent service request is triggered, the Proponent's entire schedule for that duration will be dedicated to resolving the service request. Consequently, current project priorities and milestone timelines will be postponed without penalty to the Proponent. The project schedule will resume once the urgent service is completed.

---

## D. Features

| # | Title | Description |
|---|---|---|
| 1 | **Delivery Receiving** | - Load PO and Item List from ActiveOne<br>- Delivery status based on Ordered versus Delivered<br>- Scan unknown SKU and tag as New Item<br>- See receiving progress and summary<br>- Manual receiving control locked behind admin authorization<br>- Save as ActiveOne Delivery PO<br>- Cache receiving progress locally |
| 2 | **Sales Rate and Generate PO** | - View sales rate with extensive parameters support<br>- Generate PO based on Suggested Order<br>- Manual PO adjustment before final save<br>- Printable Generated PO<br>- Save as ActiveOne PO |
| 3 | **User Login and Role-based Security** | - User and role management<br>- Required user login to allow access<br>- Hide modules based on role (e.g., floor staff can only scan, not delete or finalize)<br>- Ask for admin credentials for admin-only actions |
| 4 | **Delivery History** | - See list of deliveries<br>- See delivery summary and full detail<br>- Printable delivery report<br>- Searchable deliveries by Receiver, or by Date |
| 5 | **Inventory Transfer & Bad Orders (BO)** | - Select source and target locations (Selling Area, Stockrooms, Warehouses, BO Room)<br>- Dedicated option to tag items as "Bad Order" with reason codes from the floor<br>- Detect insufficient on-hand quantity<br>- Save as staging and let admin process the final transfer after review |
| 6 | **Invoice Releasing** | - Select Invoice number<br>- Scan items and validate scanned vs listed<br>- Strictly block saving or releasing if scanned vs listed quantities are not balanced<br>- Save as Warehouse Release |
| 7 | **Inventory Counting** | - Scanning for inventory counting<br>- Select location scope for scan (specific stockrooms or warehouses)<br>- See status of scan depending on scanned vs on-hand<br>- Save as inventory count |
| 8 | **Bar Code Scanner & Mobile Integration** | - Application layout fully optimized/responsive for Android mobile and tablet screens<br>- Support Eyoyo wireless bluetooth scanner integration<br>- Input fields must auto-advance (instantly placing the cursor in the quantity box upon a barcode scan so staff can type counts without tapping the screen)<br>- Support Eyoyo internal memory bulk storage/batch upload mode for areas with zero Wi-Fi |

---

## E. Objectives

### 1. Requirements Analysis

| Deliverable | Timeline | Success Criteria |
|---|---|---|
| a) Requirements document | 4 hours | a) Gathered all requirements<br>b) Client agrees to the requirements, including mobile layout and BO mapping.<br>c) The moment they finish scanning and hit "Save" or "Submit" on their mobile screen, the application sends that entire list over to the system's Inventory Transfer/BO module. |

### 2. Designing and Prototyping

| Deliverable | Timeline | Success Criteria |
|---|---|---|
| a) Working prototype | 8 hours | a) Prototype follows the requirements<br>b) Prototype demonstrates easy to read and use layouts for Android devices.<br>c) Client agrees to the prototype |

### 3. Software Development

| Deliverable | Timeline | Success Criteria |
|---|---|---|
| a) Alpha version | 30 days | a) Alpha version follows the agreed prototype<br>b) Includes functioning Inventory Transfer module with Bad Order tagging and staging logic.<br>c) Tested on real data<br>d) Running with minimal bugs<br>e) Delivered on time |

### 4. Client Acceptance

| Deliverable | Timeline | Success Criteria |
|---|---|---|
| a) Beta version | 7 days | a) Fixed all bugs found<br>b) Added missing features<br>c) We must test and confirm that when a worker pulls the trigger on the Eyoyo scanner, the item count increases automatically and the screen instantly clears for the next scan, without making the worker stop to tap the phone screen between items.<br>d) Client agreement and go signal for test deployment |

### 5. Test Deployment

| Deliverable | Timeline | Success Criteria |
|---|---|---|
| a) Testing environment | 4 hours | a) Deployed to receiving station<br>b) Deployed to enter bill station<br>c) Deployed to mobile test devices for floor walk testing.<br>d) Working beta version |

### 6. User Acceptance

| Deliverable | Timeline | Success Criteria |
|---|---|---|
| a) Version 1.0 | 7 days | a) Fixed user-reported bugs<br>b) Checkers confirm smooth scanning workflows without manual screen taps.<br>c) User agreements and go signal for production deployment |

### 7. Production Deployment

| Deliverable | Timeline | Success Criteria |
|---|---|---|
| a) Production environment | 4 hours | a) Deployed to receiving station<br>b) Deployed to enter bill station<br>c) The system must instantly send all approved transfers (including items moved to the BO room) straight into ActiveOne, making sure our main accounting and stock records match what is actually happening in the store without anyone needing to re-type the numbers manually.<br>d) Working version 1 |

### 8. Continuous Support

| Deliverable | Timeline | Success Criteria |
|---|---|---|
| a) Incident support | Until Independent Technical Consultancy Agreement is terminated | a) Version 1 is working for 30 continuous days<br>b) Incidents are resolved within the day |

---

## F. Intellectual Property (IP) Ownership

### 1. Ownership of Pre-Existing Intellectual Property

The Proponent retains all rights, title, and interest in any pre-existing code, frameworks, software components, tools, modules, and developer methodologies utilized or developed prior to or independently of this Project Proposal ("Pre-Existing IP"). Nothing in this agreement transfers ownership of Pre-Existing IP to the Client.

### 2. Ownership of Deliverables and Custom Code

Upon full and final payment of the total project cost, the proprietary application logic, integration settings, and custom software configurations developed specifically for Davao Great Wall Trading (the "Client") under this proposal shall be licensed to the Client under the terms set forth in this section.

### 3. Source Code Handover for Internal Maintenance

As a gesture of good faith, and upon full and final payment of the total project cost, the Proponent agrees to provide the Client with the full source code of the custom-developed application at no additional charge. This handover is granted strictly for the purpose of internal maintenance and operation by the Client's own staff or internally retained personnel.

### 4. License Grant

The Proponent grants the Client a perpetual, irrevocable, non-exclusive, royalty-free, worldwide license to use, run, execute, and maintain the Receiving Application software solely for its internal business operations. The Client is strictly prohibited from:

a) Selling, sublicensing, leasing, renting, or distributing the software source code or application binaries to any third party.

b) Using the software or any derivative thereof for any commercial purpose beyond the Client's own internal operations.

c) Rebranding or white-labeling the software for use or resale by another business entity.

### 5. Non-Compete Restriction

The Client agrees not to use the source code, architecture, design patterns, or any component of the delivered software as the basis for developing, commissioning, or distributing a competing software product or service — whether directly or through a third party — without prior written consent from the Proponent.

### 6. Attribution Requirement

The Proponent's name and authorship credit shall be retained within the application's source code, documentation, and any about or credits screen visible within the application. The Client and any internally retained personnel who maintain or modify the source code are prohibited from removing, altering, or obscuring this attribution. Any modifications made by the Client or their personnel must be clearly marked as such and must not misrepresent the original authorship.

### 7. Right of First Refusal

Should the Client require significant new features, modules, system integrations, or any development work beyond the scope of internal bug fixes and maintenance, the Client agrees to offer the Proponent the opportunity to perform such work first, under terms to be negotiated at that time. The Client may only engage another developer for such work if the Proponent declines in writing or fails to respond within seven (7) calendar days of the written offer.

### 8. Third-Party Integrations and ActiveOne

The Client acknowledges that the software integrates with third-party environments (including ActiveOne, MySQL, and barcode scanning hardware). The Proponent claims no ownership over ActiveOne software, schemas, or data belonging to the Client. The Client is responsible for maintaining all necessary licenses for third-party systems required for the software to operate.

### 9. Source Code Condition

The source code is provided as-is at the time of handover. The Proponent makes no guarantees regarding its continued compatibility with future third-party system updates, hardware changes, or operating environment changes after the handover date, unless covered under a separate service agreement.

---

## G. Project and Development Pricing

The total project cost is **PHP 85,000**, billed progressively upon the completion of each modular phase as outlined below.

| Phase | Modules | Operational Criteria | Amount |
|---|---|---|---|
| 1 | **Sales Rate and Generate PO** | View sales rates, generate suggested POs, manual adjustments, printable logs, and save to ActiveOne. Optimized for desktop layout. | PHP 17,000 |
| 2 | **Delivery Receiving** | Load POs; scan unknown SKUs as New Items. When a checker scans a barcode, the application must instantly pull up the item and automatically place the blinking cursor inside the quantity box. The checker can immediately type the Qty number on their keypad and press Enter. | PHP 17,000 |
| 3 | **Inventory Transfer** | Mobile interface to transfer stock between physical zones (Selling Area, Stockrooms, Warehouses, BO Room). Includes "Bad Order" tagging with reason codes. Saves to queue as a pending transfer for final admin approval into ActiveOne. Flags insufficient on-hand quantities. | PHP 17,000 |
| 4 | **Invoice Releasing** | Scan items to validate against invoice numbers before warehouse release. Blocks saving if scanned quantities do not balance. Printable and searchable history reports. | PHP 17,000 |
| 5 | **Inventory Counting** | Scan-to-count functionality across selected location. Displays variances against system on-hand levels. Supports Eyoyo storage/batch upload mode. Role-based access and admin overrides. The app will instantly show if the scanned count matches what the computer thinks is on the shelves, flagging any missing or extra items. The app can monitor on who is logged in and forces admin approval for any changes. | PHP 17,000 |
| | | **Total** | **PHP 85,000** |

---

## H. Payment Terms

1. Each invoice is due within **7 calendar days** of the milestone completion.
2. Scope changes after agreement are subject to a separate project proposal or an expedite fee, billed accordingly.
3. Any consultation, troubleshooting, maintenance, or general IT services requested by the Client that are not explicitly outlined in the "Features" or "Objectives" of this project proposal are considered out-of-scope. These services are in the domain of the **Independent Technical Consultancy Agreement**.
4. All scheduled, project-related tasks performed on-site are already factored into the progressive milestone pricing and will **not** be billed separately.

---

## I. Non-Refundability and Developer-Initiated Termination Guarantee

### 1. Non-Refundability

All fees are non-refundable once the corresponding phase deliverable has been accepted by the Client. Acceptance of a deliverable constitutes acknowledgment that the phase has been satisfactorily completed.

### 2. Source Code Handover Contingent on Full Payment

The source code handover described in Section F.3 is strictly contingent upon full and final payment of the total project cost across all phases. Partial payment — regardless of how many phases have been completed and accepted — does not entitle the Client to the source code handover. In the event of incomplete payment, the Client's rights remain limited to the license grant described in Section F.4 for phases that have been paid in full, and the Proponent retains the right to withhold the source code until the outstanding balance is settled.

### 3. Developer-Initiated Termination Guarantee

In the event that the Proponent terminates or stops the project mid-development prior to final completion, the Proponent guarantees that all existing development files — including but not limited to source code, project documentation, working prototypes, integration settings, local database configurations, and assets developed up to the date of termination — shall be immediately surrendered to the Client at no additional cost.

### 4. Scope of Surrendered Materials Upon Termination

Materials surrendered under Clause I.3 are limited to work completed and paid for up to the date of termination. The Client retains full rights to utilize these materials to continue or complete the project independently. However, the following conditions apply to surrendered materials:

a) The attribution requirements outlined in Section F.6 remain binding.

b) The non-compete restrictions outlined in Section F.5 remain binding.

c) The non-commercial restrictions outlined in Section F.4 remain binding.

d) The Right of First Refusal outlined in Section F.7 is **waived** in the event of Proponent-initiated termination, as the Client would need to engage another developer to complete the project.

### 5. Client-Initiated Termination

Should the Client choose to terminate the project prior to completion, all fees paid for accepted phases remain non-refundable. The Client is not entitled to source code or development files for phases that have not been paid or whose deliverables have not been accepted. The Proponent retains all IP rights over work not yet delivered or paid for.

---

## Acceptance of Agreement

If the proposal and terms outlined in this document are agreed upon by both parties, please signify your approval by signing below. After signing, the project will start immediately.

&nbsp;

Date: _______________

&nbsp;

________________________________
Marvin D. de la Vega
**Proponent**

&nbsp;

Date: _______________

&nbsp;

________________________________
Jacob Chua
**Davao Greatwall Trading**
