import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import { PO_ID_INCREMENT } from "@/shared/infrastructure/activeonePoMinting";
import { OBJECT_TYPE_PO, OBJECT_TYPE_PO_LINES } from "@/shared/infrastructure/activeoneConstants";
import { requirePermission } from "@/admin/api/requirePermission";

interface MaxRow extends RowDataPacket {
  m: number | null;
}

/**
 * Admin heal for ActiveOne's PO ID allocators (object_type_map.NEXT_ID). Native
 * ActiveOne mints the next PO ID from these counters; when they lag behind the
 * real MAX(ID) (e.g. after app POs were written before counter-sync existed), the
 * next native save hits a duplicate-ID error and self-heals from MAX. Running this
 * resets both counters (PO header + lines) to MAX(ID) + 10 so native's allocator is
 * live again immediately. App PO saves keep them live going forward; this is the
 * manual repair for when one has drifted.
 */
export async function POST() {
  if (!(await requirePermission("admin.general_settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ao = activeoneSchemaName();

    const [poMaxRows] = await conn.query<MaxRow[]>(
      `SELECT MAX(ID) AS m FROM ${ao}.purchase_order`,
    );
    const [lineMaxRows] = await conn.query<MaxRow[]>(
      `SELECT MAX(ID) AS m FROM ${ao}.purchase_order_items`,
    );
    const poNext = (poMaxRows[0]?.m ?? 0) + PO_ID_INCREMENT;
    const lineNext = (lineMaxRows[0]?.m ?? 0) + PO_ID_INCREMENT;

    await conn.execute(
      `UPDATE ${ao}.object_type_map SET NEXT_ID = ? WHERE TABLE_NAME = ?`,
      [poNext, OBJECT_TYPE_PO],
    );
    await conn.execute(
      `UPDATE ${ao}.object_type_map SET NEXT_ID = ? WHERE TABLE_NAME = ?`,
      [lineNext, OBJECT_TYPE_PO_LINES],
    );

    await conn.commit();
    return NextResponse.json({
      purchaseOrderNextId: poNext,
      purchaseOrderLinesNextId: lineNext,
    });
  } catch {
    await conn.rollback();
    return NextResponse.json(
      { error: "Failed to fix ActiveOne PO ID counters" },
      { status: 500 },
    );
  } finally {
    conn.release();
  }
}
