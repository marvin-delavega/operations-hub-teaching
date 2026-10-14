import type { RowDataPacket } from "mysql2";
import { activeonePool as pool } from "@/shared/infrastructure/db";
import type { ActiveOneUserDirectory } from "../application/ActiveOneUserDirectory";
import type { ActiveOneUser } from "../domain/ActiveOneUser";

interface ActiveOneUserRow extends RowDataPacket {
  id: number;
  name: string;
}

/** Cap the live picker result set — a constant, never user input, safe to interpolate. */
const SEARCH_LIMIT = 20;

/** Live ActiveOne login users (the ERP `user` table), keyed by ID. */
export class MySQLActiveOneUserDirectory implements ActiveOneUserDirectory {
  async search(query: string): Promise<ActiveOneUser[]> {
    const [rows] = await pool.execute<ActiveOneUserRow[]>(
      `SELECT ID AS id, NAME AS name
       FROM \`user\`
       WHERE NAME LIKE ?
       ORDER BY NAME
       LIMIT ${SEARCH_LIMIT}`,
      [`%${query}%`],
    );
    return rows.map((row) => ({ id: String(row.id), name: row.name }));
  }

  async resolveNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const [rows] = await pool.query<ActiveOneUserRow[]>(
      "SELECT ID AS id, NAME AS name FROM `user` WHERE ID IN (?)",
      [ids],
    );
    const names = new Map<string, string>();
    for (const row of rows) names.set(String(row.id), row.name);
    return names;
  }
}
