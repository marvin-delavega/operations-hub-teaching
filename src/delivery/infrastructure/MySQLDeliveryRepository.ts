import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import {
  PO_OPEN_STATUS,
  PO_CLOSED_STATUS,
  LEAD_TIME_FIELD,
  OBJECT_TYPE_PO,
  OBJECT_TYPE_PO_LINES,
} from "@/shared/infrastructure/activeoneConstants";
import { poCode, withPoMintRetry, acquireNextPoNumber, ensurePoIdCountersLive, acquireNextObjectId } from "@/shared/infrastructure/activeonePoMinting";
import { createGetAppSettingUseCase } from "@/container";
import type { DeliveryRepository } from "../domain/DeliveryRepository";
import {
  classifyLine,
  flaggedFrom,
  PurchaseOrderAlreadyReceivedError,
  DiscrepancyApprovalRequiredError,
  type DeliveryCommit,
  type DeliveryResult,
  type OpenPurchaseOrder,
  type PurchaseOrderForReceiving,
  type StatusBreakdown,
} from "../domain/Delivery";

interface OpenPoRow extends RowDataPacket {
  poId: number;
  poCode: string;
  poDate: string;
  expectedDeliveryDate: string;
  supplierName: string;
  totalItems: number;
  totalQuantity: string;
}
interface PoHeaderRow extends RowDataPacket {
  ID: number;
  CODE: string;
  VENDOR_ID: number;
  LOCATION_ID: number;
  STATUS: number;
  isAppPo: number; // 1 if this PO is an app-created supersede PO (present in `delivery.new_po_id`)
  PAYMENT_TERMS_ID: number | null;
  supplierName: string;
}
interface PoLineRow extends RowDataPacket {
  itemId: number | null;
  code: string | null;
  description: string;
  orderedQuantity: string;
  unitId: number | null;
  rate: string | null;
  unitBaseQuantity: string | null;
  unitSymbol: string;
}
interface ItemRow extends RowDataPacket {
  ID: number;
  CODE: string;
  COST: string | null;
  PURCHASES_UNIT_ID: number | null;
  BASE_UNIT_ID: number | null;
  conversion_factor: string;
}
/**
 * An original PO line after duplicate-code merging. ActiveOne POs can carry the
 * same item on multiple lines; receiving matches quantities by item code, so
 * duplicates must be merged (summed ordered quantity, first line's metadata)
 * before matching — otherwise each copy would absorb the full received quantity.
 */
interface MergedPoLine {
  itemId: number | null;
  code: string | null;
  description: string;
  orderedQuantity: number;
  unitId: number | null;
  rate: string | null;
  unitBaseQuantity: string | null;
}
interface EmployeeCodeRow extends RowDataPacket {
  employee_code: string | null;
}
interface ActiveOneUserRow extends RowDataPacket {
  activeone_user_id: number | null;
}
interface LocationNameRow extends RowDataPacket {
  NAME: string;
}
interface ReceiverNameRow extends RowDataPacket {
  name: string;
}

function emptyBreakdown(): StatusBreakdown {
  return { exact: 0, overServed: 0, underServed: 0, notOrdered: 0, newItem: 0 };
}

function tally(breakdown: StatusBreakdown, status: ReturnType<typeof classifyLine>): void {
  switch (status) {
    case "exact": breakdown.exact++; break;
    case "over_served": breakdown.overServed++; break;
    case "under_served": breakdown.underServed++; break;
    case "not_ordered": breakdown.notOrdered++; break;
    case "new_item": breakdown.newItem++; break;
  }
}

/**
 * Reserved ID units digit for an object table, from app_settings (default 1). Native
 * ActiveOne's own PO stream keeps a different natural units digit, so forcing this onto
 * every app-minted ID keeps app rows in a disjoint sub-stream that native never emits.
 */
async function reservedDigitSetting(key: "po_header_id_reserved_digit" | "po_line_id_reserved_digit"): Promise<number> {
  const raw = await createGetAppSettingUseCase().execute(key);
  const digit = Number(raw ?? "1");
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : 1;
}

/**
 * Delivery receiving against ActiveOne POs. The commit supersedes the original PO:
 * a new open PO is written with the actual received quantities and the original is
 * closed — so replenishment never double-counts incoming. ID minting atomically
 * reserves IDs from ActiveOne's own allocator (object_type_map.NEXT_ID, see
 * acquireNextObjectId) and CODE uses the disjoint `OHPO-` namespace; withPoMintRetry
 * re-mints on a concurrent collision. The original PO is re-locked + re-verified open
 * inside every attempt. See PRD-po-id-code-minting.md.
 */
export class MySQLDeliveryRepository implements DeliveryRepository {
  async listOpenPurchaseOrders(): Promise<OpenPurchaseOrder[]> {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<OpenPoRow[]>(
      `SELECT po.ID AS poId,
              po.CODE AS poCode,
              po.DATE AS poDate,
              DATE_ADD(po.DATE, INTERVAL COALESCE(CAST(NULLIF(c.${LEAD_TIME_FIELD}, '') AS UNSIGNED), 0) DAY) AS expectedDeliveryDate,
              c.NAME AS supplierName,
              COUNT(poi.ID) AS totalItems,
              COALESCE(SUM(poi.QUANTITY), 0) AS totalQuantity
       FROM ${ao}.purchase_order po
       JOIN ${ao}.contact c ON c.ID = po.VENDOR_ID
       LEFT JOIN ${ao}.purchase_order_items poi ON poi.PO_ID = po.ID
       WHERE po.STATUS = ?
         AND NOT EXISTS (SELECT 1 FROM delivery d WHERE d.new_po_id = po.ID)
       GROUP BY po.ID, po.CODE, po.DATE, expectedDeliveryDate, c.NAME
       ORDER BY po.DATE DESC, po.CODE`,
      [PO_OPEN_STATUS],
    );

    return rows.map((r) => ({
      poId: r.poId,
      poCode: r.poCode,
      poDate: String(r.poDate),
      expectedDeliveryDate: String(r.expectedDeliveryDate),
      supplierName: r.supplierName,
      totalItems: Number(r.totalItems),
      totalQuantity: Number(r.totalQuantity),
    }));
  }

  async getPurchaseOrderForReceiving(poId: number): Promise<PurchaseOrderForReceiving | null> {
    const ao = activeoneSchemaName();
    const [headers] = await pool.query<PoHeaderRow[]>(
      `SELECT po.ID, po.CODE, po.VENDOR_ID, po.LOCATION_ID, po.STATUS,
              EXISTS (SELECT 1 FROM delivery d WHERE d.new_po_id = po.ID) AS isAppPo,
              c.NAME AS supplierName
       FROM ${ao}.purchase_order po
       JOIN ${ao}.contact c ON c.ID = po.VENDOR_ID
       WHERE po.ID = ?`,
      [poId],
    );
    const header = headers[0];
    if (!header) return null;
    if (header.STATUS !== PO_OPEN_STATUS) return null;
    if (header.isAppPo) return null; // app-created supersede PO — never re-received (FR-4)

    const [lineRows] = await pool.query<PoLineRow[]>(
      `SELECT poi.ITEM_ID AS itemId,
              it.CODE AS code,
              poi.DESCRIPTION AS description,
              poi.QUANTITY AS orderedQuantity,
              COALESCE(uom.SYMBOL, '') AS unitSymbol
       FROM ${ao}.purchase_order_items poi
       LEFT JOIN ${ao}.item it ON it.ID = poi.ITEM_ID
       LEFT JOIN ${ao}.unit_of_measure uom ON uom.ID = poi.UNIT_ID
       WHERE poi.PO_ID = ?
       ORDER BY poi.LINE_NO`,
      [poId],
    );

    // Merge duplicate item codes (same item on multiple PO lines) so the client
    // sees one line per scannable code — mirrors the merge done at commit.
    const lines: PurchaseOrderForReceiving["lines"] = [];
    const lineByCode = new Map<string, PurchaseOrderForReceiving["lines"][number]>();
    for (const r of lineRows) {
      const line = {
        itemId: r.itemId,
        code: r.code,
        description: r.description,
        orderedQuantity: Number(r.orderedQuantity),
        unitSymbol: r.unitSymbol,
      };
      if (r.code === null) {
        lines.push(line);
        continue;
      }
      const existing = lineByCode.get(r.code);
      if (existing) {
        existing.orderedQuantity += line.orderedQuantity;
        continue;
      }
      lineByCode.set(r.code, line);
      lines.push(line);
    }

    return {
      poId: header.ID,
      poCode: header.CODE,
      supplierId: header.VENDOR_ID,
      supplierName: header.supplierName,
      locationId: header.LOCATION_ID,
      lines,
    };
  }

  async getReceiverEmployeeCode(userId: number): Promise<string | null> {
    const [rows] = await pool.query<EmployeeCodeRow[]>(
      "SELECT employee_code FROM users WHERE id = ? AND is_active = 1 LIMIT 1",
      [userId],
    );
    const code = rows[0]?.employee_code?.trim();
    return code ? code : null;
  }

  async commit(input: DeliveryCommit): Promise<DeliveryResult> {
    const receivedByCode = new Map(input.lines.map((l) => [l.code, l.receivedQuantity]));
    // Build a lookup for Return-Excess events by code — used for the carve-out from ActiveOne PO write.
    const returnExcessByCode = new Map(
      input.returnExcessEvents.map((e) => [e.code, e]),
    );

    return withPoMintRetry(async (conn) => {
      const ao = activeoneSchemaName();

      // Fetch PO code prefix + reserved ID digits from settings (once per transaction).
      const poCodePrefix = (await createGetAppSettingUseCase().execute("po_code_prefix")) ?? "OHPO";
      const headerDigit = await reservedDigitSetting("po_header_id_reserved_digit");
      const lineDigit = await reservedDigitSetting("po_line_id_reserved_digit");

      // Optimistic concurrency: lock + re-verify the original PO is still open.
      const [headers] = await conn.query<PoHeaderRow[]>(
        `SELECT po.ID, po.CODE, po.VENDOR_ID, po.LOCATION_ID, po.STATUS, po.PAYMENT_TERMS_ID,
                EXISTS (SELECT 1 FROM delivery d WHERE d.new_po_id = po.ID) AS isAppPo,
                c.NAME AS supplierName
         FROM ${ao}.purchase_order po
         JOIN ${ao}.contact c ON c.ID = po.VENDOR_ID
         WHERE po.ID = ? FOR UPDATE`,
        [input.poId],
      );
      const original = headers[0];
      if (!original || original.STATUS !== PO_OPEN_STATUS || original.isAppPo) {
        throw new PurchaseOrderAlreadyReceivedError();
      }

      const [originalLines] = await conn.query<PoLineRow[]>(
        `SELECT poi.ITEM_ID AS itemId, it.CODE AS code, poi.DESCRIPTION AS description,
                poi.QUANTITY AS orderedQuantity, poi.UNIT_ID AS unitId, poi.RATE AS rate,
                poi.UNIT_BASE_QUANTITY AS unitBaseQuantity
         FROM ${ao}.purchase_order_items poi
         LEFT JOIN ${ao}.item it ON it.ID = poi.ITEM_ID
         WHERE poi.PO_ID = ?
         ORDER BY poi.LINE_NO`,
        [input.poId],
      );
      // Merge duplicate item codes before matching received quantities (see
      // MergedPoLine). Lines with no resolvable code cannot be scanned and are
      // kept as-is (written back with received = 0).
      const mergedLines: MergedPoLine[] = [];
      const orderedByCode = new Map<string, MergedPoLine>();
      for (const row of originalLines) {
        const line: MergedPoLine = {
          itemId: row.itemId,
          code: row.code,
          description: row.description,
          orderedQuantity: Number(row.orderedQuantity),
          unitId: row.unitId,
          rate: row.rate,
          unitBaseQuantity: row.unitBaseQuantity,
        };
        if (row.code === null) {
          mergedLines.push(line);
          continue;
        }
        const existing = orderedByCode.get(row.code);
        if (existing) {
          existing.orderedQuantity += line.orderedQuantity;
          continue;
        }
        orderedByCode.set(row.code, line);
        mergedLines.push(line);
      }

      // Resolve item rows (cost + units) for any Not-Ordered codes.
      const notOrderedCodes = input.lines
        .map((l) => l.code)
        .filter((code) => !orderedByCode.has(code));
      const itemByCode = new Map<string, ItemRow>();
      if (notOrderedCodes.length > 0) {
        const [itemRows] = await conn.query<ItemRow[]>(
          `SELECT it.ID, it.CODE, it.COST, it.PURCHASES_UNIT_ID, it.BASE_UNIT_ID,
                  COALESCE(iu.QUANTITY, 1) AS conversion_factor
           FROM ${ao}.item it
           LEFT JOIN ${ao}.item_units iu ON iu.ITEM_ID = it.ID AND iu.UNIT_ID = it.PURCHASES_UNIT_ID
           WHERE it.CODE IN (?)`,
          [[...new Set(notOrderedCodes)]],
        );
        for (const row of itemRows) itemByCode.set(row.CODE, row);
      }

      // ── Blind-delivery discrepancy gate (server-side enforcement) ────────────────
      // The server re-derives the flagged (Over/Not-Ordered) set from the actual classified
      // lines every commit. In blind mode, any flagged line requires the committing user to
      // hold the "Approve Delivery Discrepancies" permission — the committer IS the approver
      // (no cross-user authorize-as). No approval token/snapshot is trusted from the client.
      let discrepancyApproved = false;
      if (input.blindDelivery) {
        const allLines = [
          ...mergedLines
            .filter((l) => l.code !== null)
            .map((l) => ({
              code: l.code as string,
              orderedQuantity: l.orderedQuantity,
              receivedQuantity: receivedByCode.get(l.code as string) ?? 0,
              inMasterlist: true,
            })),
          ...input.lines
            .filter((l) => !orderedByCode.has(l.code))
            .filter((l) => itemByCode.has(l.code))
            .map((l) => ({
              code: l.code,
              orderedQuantity: 0,
              receivedQuantity: l.receivedQuantity,
              inMasterlist: true,
            })),
        ];
        const actualFlagged = flaggedFrom(allLines);

        if (actualFlagged.length > 0) {
          if (!input.canApproveDiscrepancies) throw new DiscrepancyApprovalRequiredError();
          discrepancyApproved = true;
        }
      }
      // ── End gate ─────────────────────────────────────────────────────────────────

      const breakdown = emptyBreakdown();
      const lineValues: unknown[][] = [];
      const snapshotLines: Array<{
        code: string;
        description: string;
        orderedQty: number;
        receivedQty: number;
        status: "exact" | "over" | "under" | "not_ordered" | "new_item";
      }> = [];
      let poAmount = 0;
      let lineNo = 1;

      // Mint header + line IDs from ActiveOne's own allocator (object_type_map.NEXT_ID),
      // atomically per ID, so concurrent native saves never share an ID. The superseding
      // PO header ID is minted first because every line references it.
      await ensurePoIdCountersLive(conn, ao);
      const newPoId = await acquireNextObjectId(conn, ao, OBJECT_TYPE_PO, headerDigit);
      // CODE number is our own global counter (not the ActiveOne PK), minted
      // under the same row lock as the superseding PO insert.
      const newPoNumber = await acquireNextPoNumber(conn, ao, poCodePrefix);
      const newCode = poCode(newPoNumber, poCodePrefix);

      // Ordered lines: kept even when received = 0; RATE copied from original line.
      for (const orig of mergedLines) {
        const received = (orig.code !== null && receivedByCode.get(orig.code)) || 0;
        const orderedQuantity = orig.orderedQuantity;
        const lineStatus = classifyLine(orderedQuantity, received, true);
        tally(breakdown, lineStatus);

        const rate = Number(orig.rate ?? 0);
        const amount = received * rate;
        poAmount += amount;
        const perUnitFactor = Number(orig.unitBaseQuantity ?? 1);

        const lineId = await acquireNextObjectId(conn, ao, OBJECT_TYPE_PO_LINES, lineDigit);
        lineValues.push([
          lineId, newPoId, lineNo++, orig.itemId, orig.description,
          received, orig.unitId, perUnitFactor, rate, amount, null, 0,
          0, 1, 0, 0, // RATE_TYPE, TAXABLE, TAXABLE_AMOUNT, TAX_AMOUNT (ERP defaults; no VAT)
        ]);

        if (orig.code !== null) {
          const statusEnum = lineStatus === "over_served" ? "over" : lineStatus === "under_served" ? "under" : lineStatus as "exact";
          snapshotLines.push({
            code: orig.code,
            description: orig.description,
            orderedQty: orderedQuantity,
            receivedQty: received,
            status: statusEnum,
          });
        }
      }

      // Not-Ordered lines. FR-31: a returned-to-0 Not-Ordered line is kept in our
      // delivery snapshot but excluded from the ActiveOne superseding PO write.
      for (const line of input.lines) {
        if (orderedByCode.has(line.code)) continue;
        const item = itemByCode.get(line.code);
        if (!item) continue;
        tally(breakdown, classifyLine(0, line.receivedQuantity, true));

        snapshotLines.push({
          code: line.code,
          description: item.CODE,
          orderedQty: 0,
          receivedQty: line.receivedQuantity,
          status: "not_ordered",
        });

        // Exclude from ActiveOne if this code was returned to 0 (FR-31 carve-out).
        const returnEvent = returnExcessByCode.get(line.code);
        if (returnEvent && returnEvent.returnedToQuantity === 0) continue;

        const unitId = item.PURCHASES_UNIT_ID ?? item.BASE_UNIT_ID ?? null;
        const perUnitFactor = Number(item.conversion_factor ?? 1);
        const rate = Number(item.COST ?? 0) * perUnitFactor;
        const amount = line.receivedQuantity * rate;
        poAmount += amount;

        const lineId = await acquireNextObjectId(conn, ao, OBJECT_TYPE_PO_LINES, lineDigit);
        lineValues.push([
          lineId, newPoId, lineNo++, item.ID, item.CODE,
          line.receivedQuantity, unitId, perUnitFactor, rate, amount, null, 0,
          0, 1, 0, 0, // RATE_TYPE, TAXABLE, TAXABLE_AMOUNT, TAX_AMOUNT (ERP defaults; no VAT)
        ]);
      }

      // Reconstruct returned-to-0 Not-Ordered lines that were snapped to 0 and dropped
      // from input.lines (client drops zero-qty lines). Their snapshot row is still needed.
      for (const event of input.returnExcessEvents) {
        if (event.returnedToQuantity !== 0) continue;
        if (orderedByCode.has(event.code)) continue;
        if (input.lines.some((l) => l.code === event.code)) continue; // already processed above
        // Resolve description via masterlist cache or item table.
        const item = itemByCode.get(event.code);
        snapshotLines.push({
          code: event.code,
          description: item?.CODE ?? event.code,
          orderedQty: 0,
          receivedQty: 0,
          status: "not_ordered",
        });
      }

      // New Items never reach ActiveOne; count for the breakdown only.
      for (const newItem of input.newItems) {
        if (newItem.quantity > 0) {
          tally(breakdown, classifyLine(0, newItem.quantity, false));
          snapshotLines.push({
            code: newItem.code,
            description: "New Item",
            orderedQty: 0,
            receivedQty: newItem.quantity,
            status: "new_item",
          });
        }
      }

      // Receiver's ActiveOne login-user id → the superseding PO's CUSTOM_FIELD2 (who recorded
      // it in the ERP), matching native ActiveOne population. Null when the receiver has no
      // ERP-login mapping. The receiver code + original PO ref stay in our own `delivery` table
      // (per the custom-field decoupling); CUSTOM_FIELD1/2 now carry native-semantic PO data only.
      const [receiverUserRows] = await conn.query<ActiveOneUserRow[]>(
        "SELECT activeone_user_id FROM users WHERE id = ? LIMIT 1",
        [input.receiverUserId],
      );
      const receiverActiveOneUserId = receiverUserRows[0]?.activeone_user_id ?? null;

      // Tax columns are written 0 (we don't model VAT), CUSTOM_FIELD1 = expected date as
      // `M/D/YYYY` text — mirroring how native ActiveOne fills a newly-created PO.
      await conn.execute(
        `INSERT INTO ${ao}.purchase_order
           (ID, RECORDED_ON, CODE, DATE, DATE_EXPECTED, VENDOR_ID, LOCATION_ID, PAYMENT_TERMS_ID,
            AMOUNT, STATUS, STATUS_DATE,
            INPUT_TAX_AMOUNT, TAXABLE_AMOUNT, NONTAXABLE_AMOUNT, CUSTOM_FIELD1, CUSTOM_FIELD2)
         VALUES (?, NOW(), ?, CURDATE(), CURDATE(), ?, ?, ?, ?, ?, CURDATE(),
                 0, 0, 0, DATE_FORMAT(CURDATE(), '%c/%e/%Y'), ?)`,
        [newPoId, newCode, original.VENDOR_ID, original.LOCATION_ID, original.PAYMENT_TERMS_ID,
          poAmount, PO_OPEN_STATUS, receiverActiveOneUserId],
      );

      if (lineValues.length > 0) {
        await conn.query(
          `INSERT INTO ${ao}.purchase_order_items
             (ID, PO_ID, LINE_NO, ITEM_ID, DESCRIPTION, QUANTITY, UNIT_ID, UNIT_BASE_QUANTITY, RATE, AMOUNT, RECEIVED_QTY, CLOSED,
              RATE_TYPE, TAXABLE, TAXABLE_AMOUNT, TAX_AMOUNT)
           VALUES ?`,
          [lineValues],
        );
      }

      await conn.execute(
        `UPDATE ${ao}.purchase_order SET STATUS = ?, STATUS_DATE = CURDATE() WHERE ID = ?`,
        [PO_CLOSED_STATUS, input.poId],
      );

      await this.persistDeliveryRecord(conn, input, original, newPoId, newCode, snapshotLines, discrepancyApproved);

      return {
        newPoCode: newCode,
        closedOriginalPoCode: original.CODE,
        statusBreakdown: breakdown,
      };
    });
  }

  private async persistDeliveryRecord(
    conn: PoolConnection,
    input: DeliveryCommit,
    original: PoHeaderRow,
    newPoId: number,
    newCode: string,
    snapshotLines: Array<{
      code: string;
      description: string;
      orderedQty: number;
      receivedQty: number;
      status: "exact" | "over" | "under" | "not_ordered" | "new_item";
    }>,
    discrepancyApproved: boolean,
  ): Promise<void> {
    const [locRows] = await conn.query<LocationNameRow[]>(
      `SELECT NAME FROM ${activeoneSchemaName()}.location WHERE ID = ?`,
      [original.LOCATION_ID],
    );
    const locationName = (locRows[0] as LocationNameRow | undefined)?.NAME ?? null;

    const [userRows] = await conn.query<ReceiverNameRow[]>(
      "SELECT name FROM users WHERE id = ?",
      [input.receiverUserId],
    );
    const receiverName = (userRows[0] as ReceiverNameRow | undefined)?.name ?? null;

    // The committer is the approver (no cross-user authorize-as).
    const [result] = await conn.execute(
      `INSERT INTO delivery
         (original_po_id, original_po_code, new_po_id, new_po_code, location_id, location_name,
          supplier_id, supplier_name, received_by_user_id, received_by_employee_code,
          receiver_name, blind_delivery, continuous_scanning,
          discrepancy_approved, approved_by_user_id, approved_at, approver_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.poId, original.CODE, newPoId, newCode,
        original.LOCATION_ID, locationName,
        original.VENDOR_ID, original.supplierName,
        input.receiverUserId, input.receiverEmployeeCode,
        receiverName,
        input.blindDelivery ? 1 : 0,
        input.continuousScanning ? 1 : 0,
        discrepancyApproved ? 1 : 0,
        discrepancyApproved ? input.receiverUserId : null,
        discrepancyApproved ? new Date().toISOString().replace("T", " ").substring(0, 19) : null,
        discrepancyApproved ? receiverName : null,
      ],
    );
    const deliveryId = (result as { insertId: number }).insertId;

    if (snapshotLines.length > 0) {
      const lineRows = snapshotLines.map((l) => [
        deliveryId, l.code, l.description, l.orderedQty, l.receivedQty, l.status,
      ]);
      await conn.query(
        "INSERT INTO delivery_line (delivery_id, item_code, item_description, ordered_qty, received_qty, status) VALUES ?",
        [lineRows],
      );
    }

    const newItemRows = input.newItems
      .filter((n) => n.quantity > 0)
      .map((n) => [deliveryId, n.code, "New Item", n.quantity]);
    if (newItemRows.length > 0) {
      await conn.query(
        "INSERT INTO delivery_new_items (delivery_id, code, description, quantity) VALUES ?",
        [newItemRows],
      );
    }

    // Persist Return-Excess audit events (FR-30).
    if (input.returnExcessEvents.length > 0) {
      const returnRows = input.returnExcessEvents.map((e) => [
        deliveryId, e.code, e.receivedQuantity, e.returnedToQuantity,
      ]);
      await conn.query(
        "INSERT INTO delivery_return_excess (delivery_id, item_code, received_qty, returned_to_qty) VALUES ?",
        [returnRows],
      );
    }
  }
}
