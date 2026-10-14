import type { RowDataPacket } from "mysql2";
import pool from "@/shared/infrastructure/db";
import type { DeliveryHistoryRepository, CreatedByEntry } from "../domain/DeliveryHistoryRepository";
import type { DeliverySessionSummary, DeliverySessionDetail, DeliveryLineDetail, DeliveryNewItemDetail, ReturnExcessDetail } from "../domain/DeliverySessionSummary";
import type { HistoryFilters, Page } from "../domain/HistoryFilters";

const DEFAULT_LIMIT = 25;

interface SessionSummaryRow extends RowDataPacket {
  id: number;
  location_id: number;
  location_name: string | null;
  supplier_id: number;
  supplier_name: string | null;
  original_po_code: string | null;
  new_po_code: string;
  receiver_name: string | null;
  received_by_user_id: number;
  discrepancy_approved: number;
  created_at: string;
}

interface SessionDetailRow extends RowDataPacket {
  id: number;
  original_po_id: number;
  original_po_code: string | null;
  new_po_id: number;
  new_po_code: string;
  location_id: number;
  location_name: string | null;
  supplier_id: number;
  supplier_name: string | null;
  received_by_user_id: number;
  receiver_name: string | null;
  blind_delivery: number;
  continuous_scanning: number;
  discrepancy_approved: number;
  approved_by_user_id: number | null;
  approver_name: string | null;
  approved_at: string | null;
  created_at: string;
}

interface LineRow extends RowDataPacket {
  id: number;
  item_code: string;
  item_description: string;
  ordered_qty: number;
  received_qty: number;
  status: "exact" | "over" | "under" | "not_ordered" | "new_item";
}

interface NewItemRow extends RowDataPacket {
  id: number;
  code: string;
  description: string;
  quantity: number;
}

interface ReturnExcessRow extends RowDataPacket {
  item_code: string;
  received_qty: number;
  returned_to_qty: number;
}

interface CreatedByRow extends RowDataPacket {
  received_by_user_id: number;
  receiver_name: string | null;
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

export class MySQLDeliveryHistoryRepository implements DeliveryHistoryRepository {
  async list(filters: HistoryFilters): Promise<Page<DeliverySessionSummary>> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, 100);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.q) {
      conditions.push(
        "(d.original_po_code LIKE ? OR d.new_po_code LIKE ?)",
      );
      params.push(`%${filters.q}%`, `%${filters.q}%`);
    }
    if (filters.from) {
      conditions.push("DATE(CONVERT_TZ(d.created_at, '+00:00', '+08:00')) >= ?");
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push("DATE(CONVERT_TZ(d.created_at, '+00:00', '+08:00')) <= ?");
      params.push(filters.to);
    }
    if (filters.locationId) {
      conditions.push("d.location_id = ?");
      params.push(filters.locationId);
    }
    if (filters.supplierId) {
      conditions.push("d.supplier_id = ?");
      params.push(filters.supplierId);
    }
    if (filters.createdByUserId) {
      conditions.push("d.received_by_user_id = ?");
      params.push(filters.createdByUserId);
    }
    if (filters.approvedOnly) {
      conditions.push("d.discrepancy_approved = 1");
    }
    if (filters.cursor) {
      const parsed = parseCursor(filters.cursor);
      if (parsed) {
        conditions.push("(d.created_at < ? OR (d.created_at = ? AND d.id < ?))");
        params.push(parsed.createdAt, parsed.createdAt, parsed.id);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query<SessionSummaryRow[]>(
      `SELECT d.id, d.location_id, d.location_name, d.supplier_id, d.supplier_name,
              d.original_po_code, d.new_po_code, d.receiver_name, d.received_by_user_id,
              d.discrepancy_approved, d.created_at
       FROM delivery d
       ${where}
       ORDER BY d.created_at DESC, d.id DESC
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
        locationId: r.location_id,
        locationName: r.location_name,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        originalPoCode: r.original_po_code,
        newPoCode: r.new_po_code,
        receiverName: r.receiver_name,
        discrepancyApproved: Boolean(r.discrepancy_approved),
        createdAt: String(r.created_at),
      })),
      nextCursor,
    };
  }

  async getById(deliveryId: number): Promise<DeliverySessionDetail | null> {
    const [detailRows] = await pool.query<SessionDetailRow[]>(
      `SELECT id, original_po_id, original_po_code, new_po_id, new_po_code,
              location_id, location_name, supplier_id, supplier_name,
              received_by_user_id, receiver_name, blind_delivery, continuous_scanning,
              discrepancy_approved, approved_by_user_id, approver_name, approved_at,
              created_at
       FROM delivery WHERE id = ?`,
      [deliveryId],
    );
    const detail = detailRows[0];
    if (!detail) return null;

    const [lineRows] = await pool.query<LineRow[]>(
      `SELECT id, item_code, item_description, ordered_qty, received_qty, status
       FROM delivery_line WHERE delivery_id = ? ORDER BY id`,
      [deliveryId],
    );

    const [newItemRows] = await pool.query<NewItemRow[]>(
      `SELECT id, code, description, quantity
       FROM delivery_new_items WHERE delivery_id = ? ORDER BY id`,
      [deliveryId],
    );

    const [returnExcessRows] = await pool.query<ReturnExcessRow[]>(
      `SELECT item_code, received_qty, returned_to_qty
       FROM delivery_return_excess WHERE delivery_id = ? ORDER BY id`,
      [deliveryId],
    );

    const lines: DeliveryLineDetail[] = lineRows.map((l) => ({
      id: l.id,
      itemCode: l.item_code,
      itemDescription: l.item_description,
      orderedQty: l.ordered_qty,
      receivedQty: l.received_qty,
      status: l.status,
    }));

    const newItems: DeliveryNewItemDetail[] = newItemRows.map((n) => ({
      id: n.id,
      code: n.code,
      description: n.description,
      quantity: n.quantity,
    }));

    const returnExcess: ReturnExcessDetail[] = returnExcessRows.map((r) => ({
      itemCode: r.item_code,
      receivedQty: r.received_qty,
      returnedToQty: r.returned_to_qty,
    }));

    return {
      id: detail.id,
      locationId: detail.location_id,
      locationName: detail.location_name,
      supplierId: detail.supplier_id,
      supplierName: detail.supplier_name,
      originalPoId: detail.original_po_id,
      originalPoCode: detail.original_po_code,
      newPoId: detail.new_po_id,
      newPoCode: detail.new_po_code,
      receivedByUserId: detail.received_by_user_id,
      receiverName: detail.receiver_name,
      blindDelivery: Boolean(detail.blind_delivery),
      continuousScanning: Boolean(detail.continuous_scanning),
      discrepancyApproved: Boolean(detail.discrepancy_approved),
      approvedByUserId: detail.approved_by_user_id,
      approverName: detail.approver_name,
      approvedAt: detail.approved_at ? String(detail.approved_at) : null,
      returnExcess,
      createdAt: String(detail.created_at),
      lines,
      newItems,
    };
  }

  async listCreatedBy(): Promise<CreatedByEntry[]> {
    const [rows] = await pool.query<CreatedByRow[]>(
      `SELECT DISTINCT received_by_user_id, receiver_name
       FROM delivery
       WHERE receiver_name IS NOT NULL
       ORDER BY receiver_name`,
    );
    return rows.map((r) => ({
      userId: r.received_by_user_id,
      userName: r.receiver_name ?? String(r.received_by_user_id),
    }));
  }
}
