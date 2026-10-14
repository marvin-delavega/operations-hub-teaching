import type { RowDataPacket } from "mysql2";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";
import type {
  SupplierScheduleInput,
  SupplierScheduleRepository,
} from "@/shared/domain/SupplierScheduleRepository";
import type { ScheduleType, SupplierScheduleData } from "@/shared/domain/SupplierSchedule";
import { LEAD_TIME_FIELD, VENDOR_CONTACT_TYPE } from "@/shared/infrastructure/activeoneConstants";

interface DataRow extends RowDataPacket {
  supplier_id: number;
  name: string;
  schedule_type: ScheduleType | null;
  week_day: number | null;
  month_day: number | null;
  last_ordered_at: Date | null;
  lead_time_days: number | null;
  min_order_value: string | null;  // DECIMAL returned as string by mysql2
  min_order_quantity: number | null;
}

interface DateRow extends RowDataPacket {
  d: Date | null;
}

/** mysql2 returns DATE as a local-midnight Date; format from local parts, never UTC. */
function toDateOnly(value: Date | null): string | null {
  if (value == null) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * supplier_schedule joined with the live ActiveOne lead time (contact.CUSTOM_FIELD4).
 * LEAD_TIME_FIELD is allow-listed (not user input) so it is safe to interpolate.
 * `contact` lives in the ActiveOne schema, so it is qualified per-call (schema name
 * can change on reconfigure).
 */
const DATA_SQL = (ao: string) => `
SELECT c.ID                                            AS supplier_id,
       c.NAME                                          AS name,
       ss.schedule_type                                AS schedule_type,
       ss.week_day                                     AS week_day,
       ss.month_day                                    AS month_day,
       ss.last_ordered_at                              AS last_ordered_at,
       CAST(NULLIF(c.${LEAD_TIME_FIELD}, '') AS SIGNED) AS lead_time_days,
       ss.min_order_value                              AS min_order_value,
       ss.min_order_quantity                           AS min_order_quantity
FROM ${ao}.contact c
LEFT JOIN supplier_schedule ss ON ss.supplier_id = c.ID
WHERE c.TYPE = ? AND c.INACTIVE = 0
`;

export class MySQLSupplierScheduleRepository implements SupplierScheduleRepository {
  async getData(supplierIds?: number[]): Promise<SupplierScheduleData[]> {
    if (supplierIds && supplierIds.length === 0) return [];

    const scoped = supplierIds && supplierIds.length > 0;
    const sql = `${DATA_SQL(activeoneSchemaName())}${scoped ? " AND c.ID IN (?)" : ""} ORDER BY c.NAME`;
    const params = scoped ? [VENDOR_CONTACT_TYPE, supplierIds] : [VENDOR_CONTACT_TYPE];

    const [rows] = await pool.query<DataRow[]>(sql, params);
    return rows.map((row) => ({
      supplierId: row.supplier_id,
      name: row.name,
      scheduleType: row.schedule_type,
      weekDay: row.week_day,
      monthDay: row.month_day,
      lastOrderedAt: toDateOnly(row.last_ordered_at),
      leadTimeDays: row.lead_time_days == null ? null : Number(row.lead_time_days),
      minOrderValue: row.min_order_value == null ? null : Number(row.min_order_value),
      minOrderQuantity: row.min_order_quantity == null ? null : Number(row.min_order_quantity),
    }));
  }

  async getMostRecentPoDate(supplierId: number): Promise<string | null> {
    const [rows] = await pool.query<DateRow[]>(
      `SELECT MAX(DATE) AS d FROM ${activeoneSchemaName()}.purchase_order WHERE VENDOR_ID = ?`,
      [supplierId],
    );
    return toDateOnly(rows[0]?.d ?? null);
  }

  async upsert(input: SupplierScheduleInput): Promise<void> {
    await pool.query(
      `INSERT INTO supplier_schedule
         (supplier_id, schedule_type, week_day, month_day, last_ordered_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         schedule_type   = VALUES(schedule_type),
         week_day        = VALUES(week_day),
         month_day       = VALUES(month_day),
         last_ordered_at = VALUES(last_ordered_at)`,
      [
        input.supplierId,
        input.scheduleType,
        input.weekDay,
        input.monthDay,
        input.lastOrderedAt,
      ],
    );
  }

  async markOrdered(supplierIds: number[], date: string): Promise<void> {
    if (supplierIds.length === 0) return;
    const values = supplierIds.map((id) => [id, "lead_time", date]);
    await pool.query(
      `INSERT INTO supplier_schedule (supplier_id, schedule_type, last_ordered_at)
       VALUES ?
       ON DUPLICATE KEY UPDATE last_ordered_at = VALUES(last_ordered_at)`,
      [values],
    );
  }

  async setMinimums(
    supplierId: number,
    minOrderValue: number | null,
    minOrderQuantity: number | null,
  ): Promise<void> {
    // Creates a lead_time row when no schedule row exists yet (FR-4). Never
    // touches schedule_type / week_day / month_day / last_ordered_at on an
    // existing row — touching only the two min columns (SRP).
    await pool.query(
      `INSERT INTO supplier_schedule (supplier_id, schedule_type, min_order_value, min_order_quantity)
       VALUES (?, 'lead_time', ?, ?)
       ON DUPLICATE KEY UPDATE
         min_order_value    = VALUES(min_order_value),
         min_order_quantity = VALUES(min_order_quantity)`,
      [supplierId, minOrderValue, minOrderQuantity],
    );
  }
}
