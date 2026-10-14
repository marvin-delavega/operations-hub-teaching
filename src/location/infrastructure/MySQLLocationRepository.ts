import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type { LocationRepository } from "../domain/LocationRepository";
import type { Location } from "../domain/Location";

interface LocationRow extends RowDataPacket {
  id: number;
  name: string;
  hidden: number; // 0 / 1
}

/**
 * Locations come from ActiveOne `location`; the per-module hidden flag is joined
 * in from our own `module_location_visibility` table (absent row = visible).
 */
export class MySQLLocationRepository implements LocationRepository {
  async getAll(module: string, showAll: boolean): Promise<Location[]> {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<LocationRow[]>(
      `SELECT l.ID AS id, l.NAME AS name, COALESCE(mlv.hidden, 0) AS hidden
       FROM ${ao}.location l
       LEFT JOIN module_location_visibility mlv
         ON mlv.location_id = l.ID AND mlv.module = ?
       WHERE l.INACTIVE = 0
         AND (? = 1 OR COALESCE(mlv.hidden, 0) = 0)
       ORDER BY l.NAME`,
      [module, showAll ? 1 : 0],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, hidden: r.hidden === 1 }));
  }

  async getById(id: number): Promise<Location | null> {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<LocationRow[]>(
      `SELECT l.ID AS id, l.NAME AS name, 0 AS hidden
       FROM ${ao}.location l
       WHERE l.ID = ? AND l.INACTIVE = 0`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, name: row.name, hidden: false };
  }
}
