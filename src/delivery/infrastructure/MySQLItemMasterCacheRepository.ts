import type { RowDataPacket } from "mysql2/promise";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type { ItemMasterCacheRepository } from "../domain/ItemMasterCacheRepository";
import type { MasterlistItem } from "../domain/Delivery";

interface MasterlistRow extends RowDataPacket {
  code: string;
  description: string;
}
interface CountRow extends RowDataPacket {
  c: number;
}

/**
 * Caches the active ActiveOne item masterlist used by the Delivery receiving screen to
 * classify scans (in masterlist = Not Ordered vs. unknown = New Item) and by the Counting
 * module as its scannable item index. `item_id` + `unit_symbol` (global purchase unit,
 * falling back to base) are cached for Counting; Delivery only reads code + description.
 * Refresh is a full re-pull inside one transaction.
 */
export class MySQLItemMasterCacheRepository implements ItemMasterCacheRepository {
  async refresh(): Promise<number> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute("DELETE FROM item_master_cache");
      await conn.execute(
        `INSERT INTO item_master_cache (code, item_id, description, unit_symbol, refreshed_at)
         SELECT it.CODE, it.ID, it.DESCRIPTION, COALESCE(uom.SYMBOL, ''), NOW()
         FROM ${activeoneSchemaName()}.item it
         LEFT JOIN ${activeoneSchemaName()}.unit_of_measure uom ON uom.ID = COALESCE(it.PURCHASES_UNIT_ID, it.BASE_UNIT_ID)
         WHERE it.INACTIVE = 0`,
      );
      const [rows] = await conn.query<CountRow[]>(
        "SELECT COUNT(*) AS c FROM item_master_cache",
      );
      await conn.commit();
      return Number(rows[0].c);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async listAll(): Promise<MasterlistItem[]> {
    const [rows] = await pool.query<MasterlistRow[]>(
      "SELECT code, description FROM item_master_cache ORDER BY code",
    );
    return rows.map((r) => ({ code: r.code, description: r.description }));
  }
}
