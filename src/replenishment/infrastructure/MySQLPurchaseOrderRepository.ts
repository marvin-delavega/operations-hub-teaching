import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type { PurchaseOrderRepository } from "../domain/PurchaseOrderRepository";
import type { ReplenishmentDraftRepository, DraftSaveResult } from "../domain/ReplenishmentDraftRepository";
import { UnknownSkuError } from "../domain/PurchaseOrder";
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderResult } from "../domain/PurchaseOrder";
import type { ReplenishmentRunDetail } from "@/history/domain/ReplenishmentRunSummary";
import { PO_OPEN_STATUS, LEAD_TIME_FIELD, OBJECT_TYPE_PO, OBJECT_TYPE_PO_LINES } from "@/shared/infrastructure/activeoneConstants";
import { poCode, withPoMintRetry, acquireNextPoNumber, ensurePoIdCountersLive, acquireNextObjectId } from "@/shared/infrastructure/activeonePoMinting";
import { createGetAppSettingUseCase } from "@/container";

interface ItemRow extends RowDataPacket {
  ID: number;
  CODE: string;
  COST: string | null;            // DECIMAL -> string
  BASE_UNIT_ID: number | null;
  PURCHASES_UNIT_ID: number | null;
  conversion_factor: string;  // DECIMAL -> string; base units per 1 purchase unit
  MANUFACTURER_ID: number | null;
  manufacturer_name: string | null;
}
interface ContactRow extends RowDataPacket {
  ID: number;
  NAME: string;
  PAYMENT_TERMS_ID: number | null;
  lead_time: number | null;
}
interface LocationNameRow extends RowDataPacket {
  NAME: string;
}
interface EmployeeCodeRow extends RowDataPacket {
  employee_code: string | null;
}
interface ActiveOneUserRow extends RowDataPacket {
  activeone_user_id: number | null;
}

interface PhysicalOrderLine {
  quantity: number;
  unitId: number | null;
  unitBaseQuantity: number;
  rate: number;
  unitSymbol: string;
  suggestedQty: number;
  orderedPerPiece: boolean;
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
 * Expands one submitted line into the physical PO lines actually written to
 * ActiveOne. A normal case line yields one physical line (purchase unit). A
 * per-piece (split) line yields up to two: `quantity` whole cases in the purchase
 * unit plus `pieceQty` remainder pieces in the base unit — matching the Review
 * screen's two editable fields. If a split is requested but the item's base unit
 * can't be resolved (factor > 1 yet BASE_UNIT_ID is null), the remainder is rolled
 * up into one extra case so we never silently under-order (FR-13 safety).
 */
function expandOrderLine(line: PurchaseOrderLine, item: ItemRow | undefined): PhysicalOrderLine[] {
  const cost = Number(item?.COST ?? 0);
  const factor = Number(item?.conversion_factor ?? 1);
  const baseUnitId = item?.BASE_UNIT_ID ?? null;
  const purchaseUnitId = item?.PURCHASES_UNIT_ID ?? baseUnitId ?? null;
  const caseSymbol = line.unitSymbol ?? "";
  const baseSymbol = line.baseUnitSymbol ?? caseSymbol;

  const canPiece = line.orderedPerPiece === true && factor > 1 && baseUnitId != null;
  let caseQty = Math.max(0, Math.trunc(line.quantity));
  const pieceQty = canPiece ? Math.max(0, Math.trunc(line.pieceQty ?? 0)) : 0;
  // Split requested but no usable base unit: fold the remainder into a case.
  if (line.orderedPerPiece === true && !canPiece && (line.pieceQty ?? 0) > 0) {
    caseQty += 1;
  }

  const physical: PhysicalOrderLine[] = [];
  if (caseQty > 0) {
    physical.push({
      quantity: caseQty,
      unitId: purchaseUnitId,
      unitBaseQuantity: factor,
      rate: cost * factor, // COST is per base unit; case RATE = cost × factor
      unitSymbol: caseSymbol,
      suggestedQty: line.suggestedQty,
      orderedPerPiece: false,
    });
  }
  if (pieceQty > 0) {
    physical.push({
      quantity: pieceQty,
      unitId: baseUnitId,
      unitBaseQuantity: 1,
      rate: cost, // piece RATE = cost (per base unit)
      unitSymbol: baseSymbol,
      suggestedQty: line.suggestedPieceQty ?? 0,
      orderedPerPiece: true,
    });
  }
  return physical;
}

/**
 * Writes one purchase_order (+ purchase_order_items) per supplier+manufacturer combination,
 * all inside a single transaction: if any insert fails the whole submission rolls back.
 * New POs are written with STATUS = open, so they immediately count as "incoming" on the
 * next replenishment run.
 *
 * ID minting atomically reserves header + line IDs from ActiveOne's own allocator
 * (object_type_map.NEXT_ID, no AUTO_INCREMENT on these tables — see
 * acquireNextObjectId); CODE uses the disjoint `OHPO-` namespace. A concurrent native
 * PO grabbing the same ID fails on the PK / UNIQUE(CODE) and is re-minted by
 * withPoMintRetry. See PRD-po-id-code-minting.md.
 *
 * The manufacturer name (NULL for "No Brand") is persisted in our own
 * `replenishment_run_po` snapshot, not in any ActiveOne PO custom field.
 */
export class MySQLPurchaseOrderRepository implements PurchaseOrderRepository, ReplenishmentDraftRepository {
  async getCreatorEmployeeCode(userId: number): Promise<string | null> {
    const [rows] = await pool.query<EmployeeCodeRow[]>(
      "SELECT employee_code FROM users WHERE id = ? AND is_active = 1 LIMIT 1",
      [userId],
    );
    const code = rows[0]?.employee_code?.trim();
    return code ? code : null;
  }

  async saveDraft(po: PurchaseOrder): Promise<DraftSaveResult> {
    const validLines = po.lines.filter(
      (l) => l.quantity > 0 || (l.orderedPerPiece === true && (l.pieceQty ?? 0) > 0),
    );
    if (validLines.length === 0) return { success: false, error: "No line has a positive quantity" };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const ao = activeoneSchemaName();

      const skus = [...new Set(validLines.map((l) => l.sku))];
      const [itemRows] = await conn.query<ItemRow[]>(
        `SELECT it.ID, it.CODE, it.COST, it.BASE_UNIT_ID, it.PURCHASES_UNIT_ID,
                COALESCE(iu.QUANTITY, 1) AS conversion_factor,
                it.MANUFACTURER_ID,
                m.NAME AS manufacturer_name
         FROM ${ao}.item it
         LEFT JOIN ${ao}.item_units iu ON iu.ITEM_ID = it.ID AND iu.UNIT_ID = it.PURCHASES_UNIT_ID
         LEFT JOIN ${ao}.manufacturer m ON m.ID = it.MANUFACTURER_ID
         WHERE it.CODE IN (?)`,
        [skus],
      );
      const itemByCode = new Map(itemRows.map((r) => [r.CODE, r]));

      const unknownSkus = [...new Set(validLines.filter((l) => !itemByCode.has(l.sku)).map((l) => l.sku))];
      if (unknownSkus.length > 0) {
        await conn.rollback();
        return { success: false, error: `Unknown item code(s): ${unknownSkus.join(", ")}` };
      }

      const supplierIds = [...new Set(validLines.map((l) => l.supplierId))].map(Number);
      const [contactRows] = await conn.query<ContactRow[]>(
        `SELECT ID, NAME FROM ${ao}.contact WHERE ID IN (?)`,
        [supplierIds],
      );
      const supplierById = new Map(contactRows.map((r) => [String(r.ID), r]));

      const [locRows] = await conn.query<LocationNameRow[]>(
        `SELECT NAME FROM ${ao}.location WHERE ID = ?`,
        [po.locationId],
      );
      const locationName = (locRows[0] as LocationNameRow | undefined)?.NAME ?? String(po.locationId);

      let createdByEmployeeCode: string | null = null;
      if (po.createdByUserId) {
        const [userRows] = await conn.query<EmployeeCodeRow[]>(
          "SELECT employee_code FROM users WHERE id = ? AND is_active = 1 LIMIT 1",
          [po.createdByUserId],
        );
        createdByEmployeeCode = userRows[0]?.employee_code?.trim() ?? null;
      }

      const groupMap = new Map<
        string,
        { supplierId: string; manufacturerId: number | null; manufacturerName: string | null; lines: PurchaseOrderLine[] }
      >();
      for (const line of validLines) {
        const item = itemByCode.get(line.sku);
        const manufacturerId = item?.MANUFACTURER_ID ?? null;
        const manufacturerName = item?.manufacturer_name ?? null;
        const groupKey = `${line.supplierId}:${manufacturerName ?? ""}`;
        const group = groupMap.get(groupKey) ?? { supplierId: line.supplierId, manufacturerId, manufacturerName, lines: [] };
        group.lines.push(line);
        groupMap.set(groupKey, group);
      }

      const snapshotRunIds = new Map<string, number>();
      for (const path of ["standard", "stockout"] as const) {
        const pathLines = validLines.filter((l) => l.path === path);
        if (pathLines.length === 0) continue;
        const rounding = po.rounding ?? "up";
        // below_min_ack only relevant for Standard runs (Stockout has no minimums);
        // mirrors what a direct submit records so approval history is equivalent.
        const belowMinAck =
          path === "standard" &&
          Array.isArray(po.belowMinAck) &&
          po.belowMinAck.length > 0
            ? po.belowMinAck
            : null;
        const [runResult] = await conn.execute(
          `INSERT INTO replenishment_run
             (path, location_id, location_name, created_by_user_id, created_by_name,
              created_by_employee_code, rounding, sales_range_from, sales_range_to, status,
              below_min_acknowledged, below_min_details)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            path,
            po.locationId,
            locationName,
            po.createdByUserId ?? 0,
            po.createdByName ?? "Unknown",
            createdByEmployeeCode,
            rounding,
            path === "standard" ? (po.salesRangeFrom ?? null) : null,
            path === "standard" ? (po.salesRangeTo ?? null) : null,
            "draft",
            belowMinAck ? 1 : 0,
            belowMinAck ? JSON.stringify(belowMinAck) : null,
          ],
        );
        snapshotRunIds.set(path, (runResult as { insertId: number }).insertId);
      }

      const draftPoRows: Array<{
        runId: number;
        supplierId: number;
        supplierName: string;
        manufacturerId: number | null;
        manufacturerName: string | null;
        lines: PurchaseOrderLine[];
      }> = [];

      for (const [, { supplierId, manufacturerId, manufacturerName, lines }] of groupMap) {
        const pathsInGroup = [...new Set(lines.map((l) => l.path))];
        for (const path of pathsInGroup) {
          const runId = snapshotRunIds.get(path);
          if (!runId) continue;
          draftPoRows.push({
            runId,
            supplierId: Number(supplierId),
            supplierName: supplierById.get(supplierId)?.NAME ?? supplierId,
            manufacturerId,
            manufacturerName,
            lines: lines.filter((l) => l.path === path),
          });
        }
      }

      const runPoLineCount = new Map<number, { suppliers: Set<number>; pos: number; lines: number }>();
      for (const poRow of draftPoRows) {
        const runId = poRow.runId;
        if (!runPoLineCount.has(runId)) {
          runPoLineCount.set(runId, { suppliers: new Set(), pos: 0, lines: 0 });
        }
        const agg = runPoLineCount.get(runId)!;
        agg.suppliers.add(poRow.supplierId);
        agg.pos += 1;

        const [runPoResult] = await conn.execute(
          `INSERT INTO replenishment_run_po
             (run_id, po_id, po_code, supplier_id, supplier_name, manufacturer_id, manufacturer_name)
           VALUES (?, NULL, ?, ?, ?, ?, ?)`,
          [runId, `DRAFT-${runId}-${agg.pos}`, poRow.supplierId, poRow.supplierName, poRow.manufacturerId, poRow.manufacturerName],
        );
        const runPoId = (runPoResult as { insertId: number }).insertId;

        const physicalRows = poRow.lines.flatMap((line) =>
          expandOrderLine(line, itemByCode.get(line.sku)).map((phys) => ({ line, phys })),
        );
        agg.lines += physicalRows.length;

        if (physicalRows.length > 0) {
          const lineValues = physicalRows.map(({ line, phys }) => {
            const item = itemByCode.get(line.sku);
            return [
              runPoId,
              item?.ID ?? 0,
              line.sku,
              line.description,
              phys.unitSymbol,
              line.orderPeriodDays,
              line.salesRate,
              line.sellingAreaDemand > 0 ? line.sellingAreaDemand : null,
              line.sellingAreaNames?.length > 0 ? line.sellingAreaNames.join(", ") : null,
              line.effectiveAvailable,
              line.shelfOnHand ?? null,
              line.dos,
              phys.suggestedQty,
              phys.quantity,
              phys.orderedPerPiece ? 1 : 0,
              line.lastSoldDate ?? null,
              line.stockoutDailyRate ?? null,
              line.stockoutWindowUnits ?? null,
            ];
          });
          await conn.query(
            `INSERT INTO replenishment_run_line
               (run_po_id, item_id, item_code, item_description, unit_symbol, order_period_days,
                sales_rate, selling_area_demand, selling_area_names, effective_available, shelf_on_hand,
                dos, suggested_qty, final_qty, ordered_per_piece, last_sold_date, stockout_daily_rate, stockout_window_units)
             VALUES ?`,
            [lineValues],
          );
        }
      }

      for (const [runId, agg] of runPoLineCount) {
        await conn.execute(
          "UPDATE replenishment_run SET supplier_count = ?, po_count = ?, line_count = ? WHERE id = ?",
          [agg.suppliers.size, agg.pos, agg.lines, runId],
        );
      }

      await conn.commit();
      const firstRunId = snapshotRunIds.values().next().value;
      return { success: true, runId: firstRunId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async createAll(po: PurchaseOrder): Promise<PurchaseOrderResult[]> {
    const validLines = po.lines.filter(
      (l) => l.quantity > 0 || (l.orderedPerPiece === true && (l.pieceQty ?? 0) > 0),
    );
    if (validLines.length === 0) return [];

    return withPoMintRetry(async (conn) => {
      const ao = activeoneSchemaName();
      // Resolve items (sku = item.CODE) with UOM and manufacturer data.
      const skus = [...new Set(validLines.map((l) => l.sku))];
      const [itemRows] = await conn.query<ItemRow[]>(
        `SELECT it.ID, it.CODE, it.COST, it.BASE_UNIT_ID, it.PURCHASES_UNIT_ID,
                COALESCE(iu.QUANTITY, 1) AS conversion_factor,
                it.MANUFACTURER_ID,
                m.NAME AS manufacturer_name
         FROM ${ao}.item it
         LEFT JOIN ${ao}.item_units iu ON iu.ITEM_ID = it.ID AND iu.UNIT_ID = it.PURCHASES_UNIT_ID
         LEFT JOIN ${ao}.manufacturer m ON m.ID = it.MANUFACTURER_ID
         WHERE it.CODE IN (?)`,
        [skus],
      );
      const itemByCode = new Map(itemRows.map((r) => [r.CODE, r]));

      // Reject the whole submission if any ordered SKU doesn't resolve —
      // writing ITEM_ID = NULL into ActiveOne would corrupt the ERP.
      const unknownSkus = [...new Set(validLines.filter((l) => !itemByCode.has(l.sku)).map((l) => l.sku))];
      if (unknownSkus.length > 0) {
        throw new UnknownSkuError(unknownSkus);
      }

      const supplierIds = [...new Set(validLines.map((l) => l.supplierId))].map(Number);
      const [contactRows] = await conn.query<ContactRow[]>(
        `SELECT ID, NAME, PAYMENT_TERMS_ID,
                CAST(NULLIF(${LEAD_TIME_FIELD}, '') AS UNSIGNED) AS lead_time
         FROM ${ao}.contact WHERE ID IN (?)`,
        [supplierIds],
      );
      const supplierById = new Map(contactRows.map((r) => [String(r.ID), r]));

      // Resolve location name for the snapshot label.
      const [locRows] = await conn.query<LocationNameRow[]>(
        `SELECT NAME FROM ${ao}.location WHERE ID = ?`,
        [po.locationId],
      );
      const locationName = (locRows[0] as LocationNameRow | undefined)?.NAME ?? String(po.locationId);

      // Recorder's ActiveOne login-user id → written to each PO's CUSTOM_FIELD2, mirroring
      // how native ActiveOne records who entered the order. Null when the user has no
      // ERP-login mapping (matches the ~0.7% of native POs with a blank CUSTOM_FIELD2).
      let recorderActiveOneUserId: number | null = null;
      if (po.createdByUserId) {
        const [userRows] = await conn.query<ActiveOneUserRow[]>(
          "SELECT activeone_user_id FROM users WHERE id = ? LIMIT 1",
          [po.createdByUserId],
        );
        recorderActiveOneUserId = userRows[0]?.activeone_user_id ?? null;
      }

      // Fetch PO code prefix + reserved ID digits from settings (once per transaction).
      const poCodePrefix = (await createGetAppSettingUseCase().execute("po_code_prefix")) ?? "OHPO";
      const headerDigit = await reservedDigitSetting("po_header_id_reserved_digit");
      const lineDigit = await reservedDigitSetting("po_line_id_reserved_digit");

      // Group lines by supplier + manufacturer combination.
      // Manufacturer is derived from the item's DB record — not trusted from the client.
      const groupMap = new Map<
        string,
        { supplierId: string; manufacturerId: number | null; manufacturerName: string | null; lines: PurchaseOrderLine[] }
      >();
      for (const line of validLines) {
        const item = itemByCode.get(line.sku);
        const manufacturerId = item?.MANUFACTURER_ID ?? null;
        const manufacturerName = item?.manufacturer_name ?? null;
        const groupKey = `${line.supplierId}:${manufacturerName ?? ""}`;
        const group = groupMap.get(groupKey) ?? { supplierId: line.supplierId, manufacturerId, manufacturerName, lines: [] };
        group.lines.push(line);
        groupMap.set(groupKey, group);
      }

      // Mint header + line IDs from ActiveOne's own allocator (object_type_map.NEXT_ID),
      // atomically per ID (fetch-then-bump), so concurrent native saves never share an ID.
      // ensurePoIdCountersLive first raises a stale counter to current reality.
      await ensurePoIdCountersLive(conn, ao);

      const results: PurchaseOrderResult[] = [];

      // In-memory snapshot accumulators keyed by path (at most two: standard + stockout).
      const snapshotRunIds = new Map<string, number>();
      const snapshotPoRows: Array<{
        runId: number;
        poId: number;
        poCode: string;
        supplierId: number;
        supplierName: string;
        manufacturerId: number | null;
        manufacturerName: string | null;
        lines: PurchaseOrderLine[];
      }> = [];

      for (const [, { supplierId, manufacturerId, manufacturerName, lines }] of groupMap) {
        const poId = await acquireNextObjectId(conn, ao, OBJECT_TYPE_PO, headerDigit);
        // CODE number is our own global counter (not the ActiveOne PK), minted
        // under the same row lock as the PO insert so batch POs never collide.
        const poNumber = await acquireNextPoNumber(conn, ao, poCodePrefix);
        const code = poCode(poNumber, poCodePrefix);

        let poAmount = 0;
        let lineNo = 0;
        const lineValues: unknown[][] = [];

        // A per-piece line expands into a whole-cases line + a remainder-pieces
        // line, so one submitted item can write two purchase_order_items rows.
        for (const line of lines) {
          const item = itemByCode.get(line.sku);
          for (const phys of expandOrderLine(line, item)) {
            const amount = phys.quantity * phys.rate;
            poAmount += amount;

            const lineId = await acquireNextObjectId(conn, ao, OBJECT_TYPE_PO_LINES, lineDigit);
            lineNo += 1;
            lineValues.push([
              lineId,
              poId,
              lineNo,             // LINE_NO
              item?.ID ?? null,   // ITEM_ID (nullable)
              line.description,
              phys.quantity,      // QUANTITY (purchase units for cases, base units for pieces)
              phys.unitId,        // UNIT_ID
              phys.unitBaseQuantity, // UNIT_BASE_QUANTITY
              phys.rate,          // RATE
              amount,             // AMOUNT
              0,                  // RECEIVED_QTY
              0,                  // CLOSED
              0,                  // RATE_TYPE (ERP default for a normal priced line)
              1,                  // TAXABLE (ERP default; we don't model VAT so amounts stay 0)
              0,                  // TAXABLE_AMOUNT
              0,                  // TAX_AMOUNT
            ]);
          }
        }

        const supplier = supplierById.get(supplierId);
        const leadDays = Number(supplier?.lead_time ?? 0);
        // DATE_EXPECTED = DATE + lead time; STATUS_DATE = DATE; PAYMENT_TERMS_ID from vendor
        // — all match how native ActiveOne POs are populated. For faithfulness with native
        // POs we also write the tax columns ActiveOne always fills (0 — we don't model VAT),
        // CUSTOM_FIELD1 = the expected date as `M/D/YYYY` text (ActiveOne's own display copy,
        // no leading zeros), and CUSTOM_FIELD2 = the recorder's ERP login-user id. CUSTOM_FIELD3
        // (native: salesman/agent) is left NULL — the app has no source for it, and the
        // manufacturer label lives in our own `replenishment_run_po` snapshot, never a PO field.
        await conn.execute(
          `INSERT INTO ${ao}.purchase_order
             (ID, RECORDED_ON, CODE, DATE, DATE_EXPECTED, VENDOR_ID, LOCATION_ID,
              PAYMENT_TERMS_ID, AMOUNT, STATUS, STATUS_DATE,
              INPUT_TAX_AMOUNT, TAXABLE_AMOUNT, NONTAXABLE_AMOUNT, CUSTOM_FIELD1, CUSTOM_FIELD2)
           VALUES (?, NOW(), ?, ?, DATE_ADD(?, INTERVAL ? DAY), ?, ?, ?, ?, ?, ?,
                   0, 0, 0, DATE_FORMAT(DATE_ADD(?, INTERVAL ? DAY), '%c/%e/%Y'), ?)`,
          [poId, code, po.poDate, po.poDate, leadDays, Number(supplierId), po.locationId,
            supplier?.PAYMENT_TERMS_ID ?? null, poAmount, PO_OPEN_STATUS, po.poDate,
            po.poDate, leadDays, recorderActiveOneUserId],
        );

        await conn.query(
          `INSERT INTO ${ao}.purchase_order_items
             (ID, PO_ID, LINE_NO, ITEM_ID, DESCRIPTION, QUANTITY, UNIT_ID, UNIT_BASE_QUANTITY, RATE, AMOUNT, RECEIVED_QTY, CLOSED,
              RATE_TYPE, TAXABLE, TAXABLE_AMOUNT, TAX_AMOUNT)
           VALUES ?`,
          [lineValues],
        );

        // Determine runId for this PO: prefer standard path runId, fallback to stockout.
        const standardRunId = snapshotRunIds.get("standard");
        const stockoutRunId = snapshotRunIds.get("stockout");
        const primaryRunId = standardRunId ?? stockoutRunId;

        results.push({
          supplierId,
          supplierName: supplier?.NAME ?? supplierId,
          poNumber: code,
          itemCount: lines.length,
          manufacturerName,
          runId: primaryRunId ?? undefined,
        });

        // Accumulate per-path snapshot data. Each distinct path in this PO's lines
        // gets its own run record (split into up to two run rows: standard + stockout).
        const pathsInGroup = [...new Set(lines.map((l) => l.path))];
        for (const path of pathsInGroup) {
          if (!snapshotRunIds.has(path)) {
            const rounding = po.rounding ?? "up";
            // below_min_ack only relevant for Standard runs (Stockout has no minimums).
            const belowMinAck =
              path === "standard" &&
              Array.isArray(po.belowMinAck) &&
              po.belowMinAck.length > 0
                ? po.belowMinAck
                : null;
            const [runResult] = await conn.execute(
              `INSERT INTO replenishment_run
                 (path, location_id, location_name, created_by_user_id, created_by_name,
                  created_by_employee_code, rounding, sales_range_from, sales_range_to,
                  below_min_acknowledged, below_min_details)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                path,
                po.locationId,
                locationName,
                po.createdByUserId ?? 0,
                po.createdByName ?? "Unknown",
                po.createdByEmployeeCode ?? null,
                rounding,
                path === "standard" ? (po.salesRangeFrom ?? null) : null,
                path === "standard" ? (po.salesRangeTo ?? null) : null,
                belowMinAck ? 1 : 0,
                belowMinAck ? JSON.stringify(belowMinAck) : null,
              ],
            );
            snapshotRunIds.set(path, (runResult as { insertId: number }).insertId);
          }

          const runId = snapshotRunIds.get(path)!;
          snapshotPoRows.push({
            runId,
            poId,
            poCode: code,
            supplierId: Number(supplierId),
            supplierName: supplier?.NAME ?? supplierId,
            manufacturerId,
            manufacturerName,
            lines: lines.filter((l) => l.path === path),
          });
        }
      }

      // Write run_po + run_line rows and update the run header counts.
      if (po.createdByUserId && snapshotRunIds.size > 0) {
        await this.persistRunSnapshot(conn, snapshotRunIds, snapshotPoRows, itemByCode);
      }

      return results;
    });
  }

  async createPOsFromDraft(draft: ReplenishmentRunDetail): Promise<PurchaseOrderResult[]> {
    const allLines = draft.pos.flatMap((po) =>
      po.lines.filter((l) => l.finalQty > 0),
    );
    if (allLines.length === 0) return [];

    return withPoMintRetry(async (conn) => {
      const ao = activeoneSchemaName();
      const skus = [...new Set(allLines.map((l) => l.itemCode).filter((c): c is string => c !== null))];
      const [itemRows] = await conn.query<ItemRow[]>(
        `SELECT it.ID, it.CODE, it.COST, it.BASE_UNIT_ID, it.PURCHASES_UNIT_ID,
                COALESCE(iu.QUANTITY, 1) AS conversion_factor,
                it.MANUFACTURER_ID,
                m.NAME AS manufacturer_name
         FROM ${ao}.item it
         LEFT JOIN ${ao}.item_units iu ON iu.ITEM_ID = it.ID AND iu.UNIT_ID = it.PURCHASES_UNIT_ID
         LEFT JOIN ${ao}.manufacturer m ON m.ID = it.MANUFACTURER_ID
         WHERE it.CODE IN (?)`,
        [skus],
      );
      const itemByCode = new Map(itemRows.map((r) => [r.CODE, r]));

      const missingSkus = skus.filter((c) => !itemByCode.has(c));
      if (missingSkus.length > 0) throw new UnknownSkuError(missingSkus);

      const supplierIds = [...new Set(draft.pos.map((po) => po.supplierId))];
      const [contactRows] = await conn.query<ContactRow[]>(
        `SELECT ID, NAME, PAYMENT_TERMS_ID,
                CAST(NULLIF(${LEAD_TIME_FIELD}, '') AS UNSIGNED) AS lead_time
         FROM ${ao}.contact WHERE ID IN (?)`,
        [supplierIds],
      );
      const supplierById = new Map(contactRows.map((r) => [r.ID, r]));

      let recorderActiveOneUserId: number | null = null;
      if (draft.createdByUserId) {
        const [userRows] = await conn.query<ActiveOneUserRow[]>(
          "SELECT activeone_user_id FROM users WHERE id = ? LIMIT 1",
          [draft.createdByUserId],
        );
        recorderActiveOneUserId = userRows[0]?.activeone_user_id ?? null;
      }

      // Fetch PO code prefix + reserved ID digits from settings (once per transaction).
      const poCodePrefix = (await createGetAppSettingUseCase().execute("po_code_prefix")) ?? "OHPO";
      const headerDigit = await reservedDigitSetting("po_header_id_reserved_digit");
      const lineDigit = await reservedDigitSetting("po_line_id_reserved_digit");

      const today = new Date();
      const poDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      // Mint header + line IDs from ActiveOne's own allocator (object_type_map.NEXT_ID),
      // atomically per ID, so concurrent native saves never share an ID.
      await ensurePoIdCountersLive(conn, ao);

      const results: PurchaseOrderResult[] = [];

      for (const po of draft.pos) {
        const poId = await acquireNextObjectId(conn, ao, OBJECT_TYPE_PO, headerDigit);
        // CODE number is our own global counter (not the ActiveOne PK).
        const poNumber = await acquireNextPoNumber(conn, ao, poCodePrefix);
        const code = poCode(poNumber, poCodePrefix);

        let poAmount = 0;
        let lineNo = 0;
        const lineValues: unknown[][] = [];

        for (const l of po.lines) {
          if (l.finalQty <= 0) continue;
          const item = itemByCode.get(l.itemCode ?? "");
          if (!item) continue;

          const cost = Number(item.COST ?? 0);
          const factor = Number(item.conversion_factor ?? 1);
          const purchaseUnitId = item.PURCHASES_UNIT_ID ?? item.BASE_UNIT_ID ?? null;

          let unitId: number | null;
          let unitBaseQuantity: number;
          let rate: number;
          const qty = l.finalQty;

          if (l.orderedPerPiece) {
            unitId = item.BASE_UNIT_ID ?? null;
            unitBaseQuantity = 1;
            rate = cost;
          } else {
            unitId = purchaseUnitId;
            unitBaseQuantity = factor;
            rate = cost * factor;
          }

          const amount = qty * rate;
          poAmount += amount;

          const lineId = await acquireNextObjectId(conn, ao, OBJECT_TYPE_PO_LINES, lineDigit);
          lineNo += 1;
          lineValues.push([
            lineId,
            poId,
            lineNo,
            item.ID ?? null,
            l.itemDescription,
            qty,
            unitId,
            unitBaseQuantity,
            rate,
            amount,
            0, 0, 0, 1, 0, 0,
          ]);
        }

        if (lineValues.length === 0) continue;

        const supplier = supplierById.get(po.supplierId);
        const leadDays = Number(supplier?.lead_time ?? 0);

        await conn.execute(
          `INSERT INTO ${ao}.purchase_order
             (ID, RECORDED_ON, CODE, DATE, DATE_EXPECTED, VENDOR_ID, LOCATION_ID,
              PAYMENT_TERMS_ID, AMOUNT, STATUS, STATUS_DATE,
              INPUT_TAX_AMOUNT, TAXABLE_AMOUNT, NONTAXABLE_AMOUNT, CUSTOM_FIELD1, CUSTOM_FIELD2)
           VALUES (?, NOW(), ?, ?, DATE_ADD(?, INTERVAL ? DAY), ?, ?, ?, ?, ?, ?,
                   0, 0, 0, DATE_FORMAT(DATE_ADD(?, INTERVAL ? DAY), '%c/%e/%Y'), ?)`,
          [poId, code, poDate, poDate, leadDays, po.supplierId, draft.locationId,
            supplier?.PAYMENT_TERMS_ID ?? null, poAmount, PO_OPEN_STATUS, poDate,
            poDate, leadDays, recorderActiveOneUserId],
        );

        await conn.query(
          `INSERT INTO ${ao}.purchase_order_items
             (ID, PO_ID, LINE_NO, ITEM_ID, DESCRIPTION, QUANTITY, UNIT_ID, UNIT_BASE_QUANTITY, RATE, AMOUNT, RECEIVED_QTY, CLOSED,
               RATE_TYPE, TAXABLE, TAXABLE_AMOUNT, TAX_AMOUNT)
           VALUES ?`,
          [lineValues],
        );

        // Back-fill the minted ActiveOne PO onto this draft's snapshot row so
        // history shows real PO references instead of DRAFT-{runId}-{n} forever.
        // Same transaction as the PO writes — an approval either records both or neither.
        await conn.execute(
          "UPDATE replenishment_run_po SET po_id = ?, po_code = ? WHERE id = ?",
          [poId, code, po.id],
        );

        results.push({
          supplierId: String(po.supplierId),
          supplierName: supplier?.NAME ?? String(po.supplierId),
          poNumber: code,
          itemCount: po.lines.filter((l) => l.finalQty > 0).length,
          manufacturerName: po.manufacturerName,
          runId: draft.id,
        });
      }

      return results;
    });
  }

  private async persistRunSnapshot(
    conn: import("mysql2/promise").PoolConnection,
    runIds: Map<string, number>,
    poRows: Array<{
      runId: number;
      poId: number;
      poCode: string;
      supplierId: number;
      supplierName: string;
      manufacturerId: number | null;
      manufacturerName: string | null;
      lines: PurchaseOrderLine[];
    }>,
    itemByCode: Map<string, ItemRow>,
  ): Promise<void> {
    const runPoLineCount = new Map<number, { suppliers: Set<number>; pos: number; lines: number }>();

    for (const poRow of poRows) {
      const runId = poRow.runId;
      if (!runPoLineCount.has(runId)) {
        runPoLineCount.set(runId, { suppliers: new Set(), pos: 0, lines: 0 });
      }
      const agg = runPoLineCount.get(runId)!;
      agg.suppliers.add(poRow.supplierId);
      agg.pos += 1;

      const [runPoResult] = await conn.execute(
        `INSERT INTO replenishment_run_po
           (run_id, po_id, po_code, supplier_id, supplier_name, manufacturer_id, manufacturer_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [runId, poRow.poId, poRow.poCode, poRow.supplierId, poRow.supplierName, poRow.manufacturerId, poRow.manufacturerName],
      );
      const runPoId = (runPoResult as { insertId: number }).insertId;

      // Expand each submitted line into its physical rows (a split line becomes a
      // cases row + a pieces row) so the snapshot mirrors the ActiveOne PO exactly.
      const physicalRows = poRow.lines.flatMap((line) =>
        expandOrderLine(line, itemByCode.get(line.sku)).map((phys) => ({ line, phys })),
      );
      agg.lines += physicalRows.length;

      if (physicalRows.length > 0) {
        const lineValues = physicalRows.map(({ line, phys }) => {
          const item = itemByCode.get(line.sku);
          return [
            runPoId,
            item?.ID ?? 0,
            line.sku,               // item_code (item.CODE)
            line.description,
            phys.unitSymbol,        // cases → purchase symbol; pieces → base symbol
            line.orderPeriodDays,
            line.salesRate,
            line.sellingAreaDemand > 0 ? line.sellingAreaDemand : null,
            line.sellingAreaNames?.length > 0 ? line.sellingAreaNames.join(", ") : null,
            line.effectiveAvailable,
            line.shelfOnHand ?? null,
            line.dos,
            phys.suggestedQty,
            phys.quantity,
            phys.orderedPerPiece ? 1 : 0,
            line.lastSoldDate ?? null,
            line.stockoutDailyRate ?? null,
            line.stockoutWindowUnits ?? null,
            line.safetyStockUnits ?? 0,
            line.safetyStockPercent ?? 0,
          ];
        });
        await conn.query(
           `INSERT INTO replenishment_run_line
              (run_po_id, item_id, item_code, item_description, unit_symbol, order_period_days,
               sales_rate, selling_area_demand, selling_area_names, effective_available, shelf_on_hand,
               dos, suggested_qty, final_qty, ordered_per_piece, last_sold_date, stockout_daily_rate, stockout_window_units,
               safety_stock_units, safety_stock_percent)
            VALUES ?`,
          [lineValues],
        );
      }
    }

    // Update each run's denormalized counts.
    for (const [runId, agg] of runPoLineCount) {
      await conn.execute(
        `UPDATE replenishment_run
         SET supplier_count = ?, po_count = ?, line_count = ?
         WHERE id = ?`,
        [agg.suppliers.size, agg.pos, agg.lines, runId],
      );
    }
  }
}
