import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "./db";
import type { SellingAreaMapRepository } from "../domain/SellingAreaMapRepository";
import type { SellingAreaMapping, SellingAreaMapInput } from "../domain/SellingAreaMap";

interface MappingRow extends RowDataPacket {
  selling_area_location_id: number;
  feeder_location_id: number;
  selling_area_name: string | null;
  sa_inactive: number | null;
  feeder_name: string | null;
  f_inactive: number | null;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface FeederNameRow extends RowDataPacket {
  selling_area_location_id: number;
  feeder_name: string;
}

export class MySQLSellingAreaMapRepository implements SellingAreaMapRepository {
  async getAll(): Promise<SellingAreaMapping[]> {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<MappingRow[]>(
      `SELECT saf.selling_area_location_id, saf.feeder_location_id,
              sa.NAME  AS selling_area_name, sa.INACTIVE  AS sa_inactive,
              f.NAME   AS feeder_name,       f.INACTIVE   AS f_inactive
       FROM selling_area_feeder_map saf
       LEFT JOIN ${ao}.location sa ON sa.ID = saf.selling_area_location_id
       LEFT JOIN ${ao}.location f  ON f.ID  = saf.feeder_location_id
       ORDER BY f.NAME, sa.NAME`,
    );
    return rows.map((row) => ({
      sellingAreaLocationId: row.selling_area_location_id,
      sellingAreaName: row.selling_area_name ?? null,
      feederLocationId: row.feeder_location_id,
      feederName: row.feeder_name ?? null,
      stale:
        row.selling_area_name === null ||
        (row.sa_inactive ?? 0) === 1 ||
        row.feeder_name === null ||
        (row.f_inactive ?? 0) === 1,
    }));
  }

  async getSellingAreaIdsByFeeder(feederLocationId: number): Promise<number[]> {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<IdRow[]>(
      `SELECT saf.selling_area_location_id AS id
       FROM selling_area_feeder_map saf
       JOIN ${ao}.location sa ON sa.ID = saf.selling_area_location_id AND sa.INACTIVE = 0
       JOIN ${ao}.location f  ON f.ID  = saf.feeder_location_id        AND f.INACTIVE  = 0
       WHERE saf.feeder_location_id = ?`,
      [feederLocationId],
    );
    return rows.map((r) => r.id);
  }

  async getSellingAreaFeederNames(): Promise<Map<number, string>> {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<FeederNameRow[]>(
      `SELECT saf.selling_area_location_id, f.NAME AS feeder_name
       FROM selling_area_feeder_map saf
       JOIN ${ao}.location sa ON sa.ID = saf.selling_area_location_id AND sa.INACTIVE = 0
       JOIN ${ao}.location f  ON f.ID  = saf.feeder_location_id        AND f.INACTIVE  = 0`,
    );
    const map = new Map<number, string>();
    for (const row of rows) {
      map.set(row.selling_area_location_id, row.feeder_name);
    }
    return map;
  }

  async upsert(input: SellingAreaMapInput): Promise<void> {
    await pool.query(
      `INSERT INTO selling_area_feeder_map (selling_area_location_id, feeder_location_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE feeder_location_id = VALUES(feeder_location_id)`,
      [input.sellingAreaLocationId, input.feederLocationId],
    );
  }

  async remove(sellingAreaLocationId: number): Promise<void> {
    await pool.query(
      `DELETE FROM selling_area_feeder_map WHERE selling_area_location_id = ?`,
      [sellingAreaLocationId],
    );
  }

  async getFeederIds(): Promise<number[]> {
    const [rows] = await pool.query<IdRow[]>(
      `SELECT DISTINCT feeder_location_id AS id FROM selling_area_feeder_map`,
    );
    return rows.map((r) => r.id);
  }

  async getSellingAreaIds(): Promise<number[]> {
    const [rows] = await pool.query<IdRow[]>(
      `SELECT selling_area_location_id AS id FROM selling_area_feeder_map`,
    );
    return rows.map((r) => r.id);
  }
}
