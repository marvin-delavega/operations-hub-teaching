import pool from "@/shared/infrastructure/db";
import type { LocationVisibilityRepository } from "../domain/LocationVisibilityRepository";

/** Upserts the per-module hidden flag into our own module_location_visibility table. */
export class MySQLLocationVisibilityRepository implements LocationVisibilityRepository {
  async setHidden(module: string, locationId: number, hidden: boolean): Promise<void> {
    await pool.query(
      `INSERT INTO module_location_visibility (module, location_id, hidden)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE hidden = VALUES(hidden)`,
      [module, locationId, hidden ? 1 : 0],
    );
  }
}
