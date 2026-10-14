import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type { ReplenishmentHistoryRepository, CreatedByEntry, DeleteReplenishmentRunResult, DraftLineQtyUpdate, UpdateReplenishmentDraftResult } from "../domain/ReplenishmentHistoryRepository";
import type { ReplenishmentRunSummary, ReplenishmentRunDetail, ReplenishmentRunPoDetail, ReplenishmentRunLineDetail } from "../domain/ReplenishmentRunSummary";
import type { HistoryFilters, Page } from "../domain/HistoryFilters";
import { PO_RECEIVED_IN_FULL_STATUS, PO_CANCELED_STATUS } from "@/shared/infrastructure/activeoneConstants";

const DEFAULT_LIMIT = 25;

let hasStatusColumn: boolean | null = null;
let hasPoIdColumn: boolean | null = null;

async function ensureStatusColumn(): Promise<boolean> {
  if (hasStatusColumn !== null) return hasStatusColumn;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run' AND COLUMN_NAME = 'status'`,
  );
  hasStatusColumn = (rows[0] as unknown as { cnt: number }).cnt > 0;
  return hasStatusColumn;
}

async function ensurePoIdColumn(): Promise<boolean> {
  if (hasPoIdColumn !== null) return hasPoIdColumn;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_po' AND COLUMN_NAME = 'po_id'`,
  );
  hasPoIdColumn = (rows[0] as unknown as { cnt: number }).cnt > 0;
  return hasPoIdColumn;
}

let hasApprovedByColumns: boolean | null = null;

async function ensureApprovedByColumns(): Promise<boolean> {
  if (hasApprovedByColumns !== null) return hasApprovedByColumns;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run' AND COLUMN_NAME = 'approved_by_name'`,
  );
  hasApprovedByColumns = (rows[0] as unknown as { cnt: number }).cnt > 0;
  return hasApprovedByColumns;
}

function approvedByExpr(hasCols: boolean): string {
  return hasCols ? "r.approved_by_name, r.approved_at" : "NULL AS approved_by_name, NULL AS approved_at";
}

function statusExpr(hasStatus: boolean): string {
  return hasStatus ? "r.status" : "'active' AS status";
}
interface RunSummaryRow extends RowDataPacket {
  id: number;
  path: "standard" | "stockout";
  status: "draft" | "active" | "deleted";
  location_id: number;
  location_name: string;
  created_by_user_id: number;
  created_by_name: string;
  supplier_count: number;
  supplier_names_csv: string | null;
  po_count: number;
  po_codes_csv: string | null;
  line_count: number;
  created_at: string;
  approved_by_name: string | null;
  approved_at: string | null;
}

interface RunDetailRow extends RowDataPacket {
  id: number;
  path: "standard" | "stockout";
  status: "draft" | "active" | "deleted";
  location_id: number;
  location_name: string;
  created_by_user_id: number;
  created_by_name: string;
  rounding: "up" | "down";
  sales_range_from: string | null;
  sales_range_to: string | null;
  created_at: string;
  approved_by_name: string | null;
  approved_at: string | null;
}

interface RunPoRow extends RowDataPacket {
  id: number;
  run_id: number;
  po_code: string;
  supplier_id: number;
  supplier_name: string;
  manufacturer_id: number | null;
  manufacturer_name: string | null;
}

interface RunLineRow extends RowDataPacket {
  id: number;
  run_po_id: number;
  item_id: number;
  item_code: string | null;
  item_description: string;
  unit_symbol: string;
  order_period_days: number;
  sales_rate: string;
  selling_area_demand: string | null;
  selling_area_names: string | null;
  effective_available: string | null;
  shelf_on_hand: string | null;
  dos: string | null;
  suggested_qty: number;
  final_qty: number;
  ordered_per_piece: number;
  last_sold_date: string | null;
  stockout_daily_rate: string | null;
  stockout_window_units: string | null;
}

interface CreatedByRow extends RowDataPacket {
  created_by_user_id: number;
  created_by_name: string;
}

function parseCursor(cursor: string): { createdAt: string; id: number } | null {
  const parts = cursor.split(":");
  if (parts.length !== 2) return null;
  const id = Number(parts[1]);
  if (!Number.isFinite(id)) return null;
  return { createdAt: parts[0], id };
}

function makeCursor(createdAt: string, id: number): string {
  return `${createdAt}:${id}`;
}

export class MySQLReplenishmentHistoryRepository implements ReplenishmentHistoryRepository {
  async countPendingDrafts(): Promise<number> {
    const hasStatus = await ensureStatusColumn();
    if (!hasStatus) return 0;
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM replenishment_run WHERE status = 'draft'",
    );
    return (rows[0] as unknown as { cnt: number }).cnt;
  }

  async list(filters: HistoryFilters): Promise<Page<ReplenishmentRunSummary>> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, 100);
    const conditions: string[] = [];
    const params: unknown[] = [];
    const hasStatus = await ensureStatusColumn();
    const hasApproved = await ensureApprovedByColumns();

    if (filters.q) {
      conditions.push(
        "EXISTS (SELECT 1 FROM replenishment_run_po rp WHERE rp.run_id = r.id AND rp.po_code LIKE ?)",
      );
      params.push(`%${filters.q}%`);
    }
    if (filters.from) {
      conditions.push("DATE(CONVERT_TZ(r.created_at, '+00:00', '+08:00')) >= ?");
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push("DATE(CONVERT_TZ(r.created_at, '+00:00', '+08:00')) <= ?");
      params.push(filters.to);
    }
    if (filters.locationId) {
      conditions.push("r.location_id = ?");
      params.push(filters.locationId);
    }
    if (filters.supplierId) {
      conditions.push(
        "EXISTS (SELECT 1 FROM replenishment_run_po rp WHERE rp.run_id = r.id AND rp.supplier_id = ?)",
      );
      params.push(filters.supplierId);
    }
    if (filters.createdByUserId) {
      conditions.push("r.created_by_user_id = ?");
      params.push(filters.createdByUserId);
    }
    if (filters.status) {
      conditions.push(`r.status = ?`);
      params.push(filters.status);
    }
    if (filters.excludeOtherUsersDrafts && filters.draftOwnerUserId != null) {
      conditions.push("(r.status != 'draft' OR r.created_by_user_id = ?)");
      params.push(filters.draftOwnerUserId);
    }
    if (filters.cursor) {
      const parsed = parseCursor(filters.cursor);
      if (parsed) {
        conditions.push("(r.created_at < ? OR (r.created_at = ? AND r.id < ?))");
        params.push(parsed.createdAt, parsed.createdAt, parsed.id);
      }
    }

const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query<RunSummaryRow[]>(
      `SELECT r.id, r.path, ${statusExpr(hasStatus)}, r.location_id, r.location_name,
              r.created_by_user_id, r.created_by_name,
              r.supplier_count,
              (SELECT GROUP_CONCAT(DISTINCT supplier_name ORDER BY supplier_name SEPARATOR ', ')
               FROM replenishment_run_po rp WHERE rp.run_id = r.id) AS supplier_names_csv,
              r.po_count,
              (SELECT GROUP_CONCAT(DISTINCT po_code ORDER BY po_code SEPARATOR ', ')
               FROM replenishment_run_po rp WHERE rp.run_id = r.id) AS po_codes_csv,
              r.line_count,
              r.created_at, ${approvedByExpr(hasApproved)}
         FROM replenishment_run r
         ${where}
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT ?`,
      [...params, limit + 1],
    );

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? makeCursor(String(items[items.length - 1].created_at), items[items.length - 1].id)
      : null;

    return {
      items: items.map((r) => ({
        id: r.id,
        path: r.path,
        status: r.status,
        locationId: r.location_id,
        locationName: r.location_name,
        createdByUserId: r.created_by_user_id,
        createdByName: r.created_by_name,
        supplierCount: r.supplier_count,
        supplierNames: r.supplier_names_csv ? r.supplier_names_csv.split(", ") : [],
        poCount: r.po_count,
        poCodes: r.po_codes_csv ? r.po_codes_csv.split(", ") : [],
        lineCount: r.line_count,
        createdAt: String(r.created_at),
        approvedByUserName: r.approved_by_name ?? undefined,
        approvedAt: r.approved_at ? String(r.approved_at) : undefined,
      })),
      nextCursor,
    };
  }

  async getById(runId: number): Promise<ReplenishmentRunDetail | null> {
    const hasStatus = await ensureStatusColumn();
    const hasApproved = await ensureApprovedByColumns();
    const [runRows] = await pool.query<RunDetailRow[]>(
      `SELECT r.id, r.path, ${statusExpr(hasStatus)}, r.location_id, r.location_name, r.created_by_user_id, r.created_by_name,
              r.rounding, r.sales_range_from, r.sales_range_to, r.created_at, ${approvedByExpr(hasApproved)}
       FROM replenishment_run r WHERE r.id = ?`,
      [runId],
    );
    const run = runRows[0];
    if (!run) return null;

    const [poRows] = await pool.query<RunPoRow[]>(
      `SELECT id, run_id, po_code, supplier_id, supplier_name, manufacturer_id, manufacturer_name
       FROM replenishment_run_po WHERE run_id = ?
       ORDER BY supplier_name, COALESCE(manufacturer_name, '')`,
      [runId],
    );

    if (poRows.length === 0) {
      return {
        id: run.id,
        path: run.path,
        status: run.status,
        locationId: run.location_id,
        locationName: run.location_name,
        createdByUserId: run.created_by_user_id,
        createdByName: run.created_by_name,
        rounding: run.rounding,
        salesRangeFrom: run.sales_range_from ? String(run.sales_range_from) : null,
        salesRangeTo: run.sales_range_to ? String(run.sales_range_to) : null,
        createdAt: String(run.created_at),
        approvedByUserName: run.approved_by_name ?? undefined,
        approvedAt: run.approved_at ? String(run.approved_at) : undefined,
        pos: [],
      };
    }

    const poIds = poRows.map((p) => p.id);
    const [lineRows] = await pool.query<RunLineRow[]>(
      `SELECT id, run_po_id, item_id, item_code, item_description, unit_symbol, order_period_days,
              sales_rate, selling_area_demand, selling_area_names, effective_available, shelf_on_hand, dos,
              suggested_qty, final_qty, ordered_per_piece, last_sold_date, stockout_daily_rate, stockout_window_units
       FROM replenishment_run_line
       WHERE run_po_id IN (?)
       ORDER BY run_po_id, id`,
      [poIds],
    );

    const linesByPoId = new Map<number, RunLineRow[]>();
    for (const line of lineRows) {
      const list = linesByPoId.get(line.run_po_id) ?? [];
      list.push(line);
      linesByPoId.set(line.run_po_id, list);
    }

    const pos: ReplenishmentRunPoDetail[] = poRows.map((po) => ({
      id: po.id,
      poCode: po.po_code,
      supplierId: po.supplier_id,
      supplierName: po.supplier_name,
      manufacturerId: po.manufacturer_id,
      manufacturerName: po.manufacturer_name,
      lines: (linesByPoId.get(po.id) ?? []).map((l): ReplenishmentRunLineDetail => ({
        id: l.id,
        itemId: l.item_id,
        itemCode: l.item_code,
        itemDescription: l.item_description,
        unitSymbol: l.unit_symbol,
        orderPeriodDays: l.order_period_days,
        salesRate: Number(l.sales_rate),
        sellingAreaDemand: l.selling_area_demand !== null ? Number(l.selling_area_demand) : null,
        sellingAreaNames: l.selling_area_names,
        effectiveAvailable: l.effective_available !== null ? Number(l.effective_available) : null,
        shelfOnHand: l.shelf_on_hand !== null ? Number(l.shelf_on_hand) : null,
        dos: l.dos !== null ? Number(l.dos) : null,
        suggestedQty: l.suggested_qty,
        finalQty: l.final_qty,
        orderedPerPiece: Boolean(l.ordered_per_piece),
        lastSoldDate: l.last_sold_date ? String(l.last_sold_date) : null,
        stockoutDailyRate: l.stockout_daily_rate !== null ? Number(l.stockout_daily_rate) : null,
        stockoutWindowUnits: l.stockout_window_units !== null ? Number(l.stockout_window_units) : null,
      })),
    }));

    return {
      id: run.id,
      path: run.path,
      status: run.status,
      locationId: run.location_id,
      locationName: run.location_name,
      createdByUserId: run.created_by_user_id,
      createdByName: run.created_by_name,
      rounding: run.rounding,
      salesRangeFrom: run.sales_range_from ? String(run.sales_range_from) : null,
      salesRangeTo: run.sales_range_to ? String(run.sales_range_to) : null,
      createdAt: String(run.created_at),
      approvedByUserName: run.approved_by_name ?? undefined,
      approvedAt: run.approved_at ? String(run.approved_at) : undefined,
      pos,
    };
  }

  async listCreatedBy(): Promise<CreatedByEntry[]> {
    const [rows] = await pool.query<CreatedByRow[]>(
      `SELECT DISTINCT created_by_user_id, created_by_name
       FROM replenishment_run
       ORDER BY created_by_name`,
    );
    return rows.map((r) => ({ userId: r.created_by_user_id, userName: r.created_by_name }));
  }

  async delete(runId: number): Promise<DeleteReplenishmentRunResult> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const hasStatus = await ensureStatusColumn();
      if (!hasStatus) {
        await conn.rollback();
        return { success: false, reason: "Database schema needs updating. Please run create-app-tables.sql." };
      }

      const [runRows] = await conn.query<RunDetailRow[]>(
        "SELECT id, status FROM replenishment_run WHERE id = ? FOR UPDATE",
        [runId],
      );
      const run = runRows[0];
      if (!run) {
        await conn.rollback();
        return { success: false, reason: "Run not found." };
      }
      if (run.status === "deleted") {
        await conn.rollback();
        return { success: false, reason: "Run is already deleted." };
      }

      const hasPoId = await ensurePoIdColumn();
      const poIdCol = hasPoId ? "po_id" : "NULL AS po_id";
      const [poRows] = await conn.query<RowDataPacket[]>(
        `SELECT ${poIdCol}, po_code FROM replenishment_run_po WHERE run_id = ?`,
        [runId],
      );

      const poIds = poRows
        .map((r) => r.po_id)
        .filter((id): id is number => id !== null && id !== undefined);

      if (poIds.length > 0) {
        const [deliveredRows] = await conn.query<RowDataPacket[]>(
          `SELECT ID, CODE, STATUS FROM ${activeoneSchemaName()}.purchase_order
           WHERE ID IN (?) AND STATUS = ?`,
          [poIds, PO_RECEIVED_IN_FULL_STATUS],
        );
        if (deliveredRows.length > 0) {
          const codes = (deliveredRows as { CODE: string }[]).map((r) => r.CODE).join(", ");
          await conn.rollback();
          return {
            success: false,
            reason: `Cannot delete run: ${deliveredRows.length === 1 ? "PO" : "POs"} ${codes} ${deliveredRows.length === 1 ? "has" : "have"} already been delivered.`,
          };
        }

        await conn.query(
          `UPDATE ${activeoneSchemaName()}.purchase_order SET STATUS = ?, STATUS_DATE = CURDATE() WHERE ID IN (?)`,
          [PO_CANCELED_STATUS, poIds],
        );
      }

      await conn.query(
        "UPDATE replenishment_run SET status = 'deleted' WHERE id = ?",
        [runId],
      );

      await conn.commit();
      return { success: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async approveDraft(runId: number, approvedByUserId: number, approvedByName: string): Promise<void> {
    await pool.execute(
      `UPDATE replenishment_run
       SET status = 'active', approved_by_user_id = ?, approved_by_name = ?, approved_at = NOW()
       WHERE id = ? AND status = 'draft'`,
      [approvedByUserId, approvedByName, runId],
    );
  }

  async hardDeleteDraft(runId: number): Promise<DeleteReplenishmentRunResult> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const hasStatus = await ensureStatusColumn();
      if (!hasStatus) {
        await conn.rollback();
        return { success: false, reason: "Database schema needs updating. Please run create-app-tables.sql." };
      }

      const [runRows] = await conn.query<RunDetailRow[]>(
        "SELECT id, status FROM replenishment_run WHERE id = ? FOR UPDATE",
        [runId],
      );
      const run = runRows[0];
      if (!run) {
        await conn.rollback();
        return { success: false, reason: "Draft not found." };
      }
      if (run.status !== "draft") {
        await conn.rollback();
        return { success: false, reason: "Only drafts can be permanently deleted." };
      }

      await conn.execute("DELETE FROM replenishment_run WHERE id = ?", [runId]);
      await conn.commit();
      return { success: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async updateDraftLineQuantities(runId: number, updates: DraftLineQtyUpdate[]): Promise<UpdateReplenishmentDraftResult> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const hasStatus = await ensureStatusColumn();
      if (!hasStatus) {
        await conn.rollback();
        return { success: false, reason: "Database schema needs updating. Please run create-app-tables.sql." };
      }

      const [runRows] = await conn.query<RunDetailRow[]>(
        "SELECT id, status FROM replenishment_run WHERE id = ? FOR UPDATE",
        [runId],
      );
      const run = runRows[0];
      if (!run) {
        await conn.rollback();
        return { success: false, reason: "Run not found." };
      }
      // Row lock above also closes the approve-mid-edit race: an approval
      // cannot flip status between this check and the line updates.
      if (run.status !== "draft") {
        await conn.rollback();
        return { success: false, reason: "Only drafts can be edited." };
      }

      for (const update of updates) {
        await conn.execute(
          `UPDATE replenishment_run_line SET final_qty = ?
           WHERE id = ? AND final_qty <> ? AND run_po_id IN (SELECT id FROM replenishment_run_po WHERE run_id = ?)`,
          [update.finalQty, update.lineId, update.finalQty, runId],
        );
      }

      await conn.commit();
      return { success: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}
