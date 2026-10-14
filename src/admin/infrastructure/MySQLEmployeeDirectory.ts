import type { RowDataPacket } from "mysql2";
import { activeonePool as pool } from "@/shared/infrastructure/db";
import { EMPLOYEE_CONTACT_TYPE } from "@/shared/infrastructure/activeoneConstants";
import type { EmployeeDirectory } from "../application/EmployeeDirectory";
import type { Employee } from "../domain/Employee";

interface EmployeeRow extends RowDataPacket {
  code: string | null;
  name: string;
}

/** Cap the live picker result set — a constant, never user input, safe to interpolate. */
const SEARCH_LIMIT = 20;

/** Live ActiveOne type-2 (employee) contacts, keyed by ACCOUNT_NO. */
export class MySQLEmployeeDirectory implements EmployeeDirectory {
  async search(query: string): Promise<Employee[]> {
    const [rows] = await pool.execute<EmployeeRow[]>(
      `SELECT ACCOUNT_NO AS code, NAME AS name
       FROM contact
       WHERE TYPE = ? AND INACTIVE = 0 AND ACCOUNT_NO IS NOT NULL AND ACCOUNT_NO <> ''
         AND NAME LIKE ?
       ORDER BY NAME
       LIMIT ${SEARCH_LIMIT}`,
      [EMPLOYEE_CONTACT_TYPE, `%${query}%`],
    );
    return rows
      .filter((row): row is EmployeeRow & { code: string } => Boolean(row.code))
      .map((row) => ({ code: row.code, name: row.name }));
  }

  async resolveNames(codes: string[]): Promise<Map<string, string>> {
    if (codes.length === 0) return new Map();
    const [rows] = await pool.query<EmployeeRow[]>(
      `SELECT ACCOUNT_NO AS code, NAME AS name
       FROM contact
       WHERE TYPE = ? AND ACCOUNT_NO IN (?)`,
      [EMPLOYEE_CONTACT_TYPE, codes],
    );
    const names = new Map<string, string>();
    for (const row of rows) if (row.code) names.set(row.code, row.name);
    return names;
  }
}
