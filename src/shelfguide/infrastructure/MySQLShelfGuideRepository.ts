import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type { ShelfGuideRepository, ShelfGuideSaleRow } from "../domain/ShelfGuideRepository";

interface SaleRow extends RowDataPacket {
  item_id: number;
  code: string;
  description: string;
  supplier_id: number;
  supplier_name: string;
  sale_date: string;
  units_sold: string;
}

interface LocationIdRow extends RowDataPacket {
  id: number;
}

interface OnHandRow extends RowDataPacket {
  item_id: number;
  on_hand: string;
}

interface SettingRow extends RowDataPacket {
  value: string;
}

export class MySQLShelfGuideRepository implements ShelfGuideRepository {
  async getSalesByItem(locationId: number, from: string, to: string): Promise<ShelfGuideSaleRow[]> {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<SaleRow[]>(
      `SELECT it.ID AS item_id, it.CODE AS code, it.DESCRIPTION AS description,
              it.PREFERRED_VENDOR_ID AS supplier_id, c.NAME AS supplier_name,
              DATE_FORMAT(isd.sale_date, '%Y-%m-%d') AS sale_date,
              isd.units_sold AS units_sold
       FROM item_sales_daily isd
       JOIN ${ao}.item it ON it.ID = isd.item_id AND it.INACTIVE = 0
       JOIN ${ao}.contact c ON c.ID = it.PREFERRED_VENDOR_ID
       WHERE isd.location_id = ? AND isd.sale_date BETWEEN ? AND ?
         AND isd.units_sold > 0
       ORDER BY c.NAME, it.DESCRIPTION, isd.sale_date`,
      [locationId, from, to],
    );
    return rows.map((r) => ({
      itemId: r.item_id,
      code: r.code,
      description: r.description,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      saleDate: r.sale_date,
      unitsSold: Number(r.units_sold),
    }));
  }

  async getOnHandByItem(locationId: number, itemIds: number[]): Promise<Map<number, number>> {
    if (itemIds.length === 0) return new Map();
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<OnHandRow[]>(
      `SELECT inv.ITEM_ID AS item_id, SUM(inv.ENDING_QUANTITY) AS on_hand
       FROM ${ao}.item_inventory inv
       JOIN (
         SELECT ITEM_ID, BATCH_ID, MAX(SEQUENCE_NO) AS max_seq
         FROM ${ao}.item_inventory
         WHERE LOCATION_ID = ? AND ITEM_ID IN (?)
         GROUP BY ITEM_ID, BATCH_ID
       ) latest
         ON latest.ITEM_ID = inv.ITEM_ID
        AND latest.BATCH_ID = inv.BATCH_ID
        AND latest.max_seq = inv.SEQUENCE_NO
       WHERE inv.LOCATION_ID = ?
       GROUP BY inv.ITEM_ID`,
      [locationId, itemIds, locationId],
    );
    return new Map(rows.map((r) => [r.item_id, Number(r.on_hand)]));
  }

  async getFirstActiveLocationId(): Promise<number | null> {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<LocationIdRow[]>(
      `SELECT ID AS id FROM ${ao}.location WHERE INACTIVE = 0 ORDER BY NAME LIMIT 1`,
    );
    return rows[0]?.id ?? null;
  }

  async getDefaultLocationId(): Promise<number | null> {
    const [rows] = await pool.query<SettingRow[]>(
      "SELECT `value` FROM app_settings WHERE `key` = 'shelfguide_default_location_id' LIMIT 1",
    );
    const raw = rows[0]?.value;
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
}
