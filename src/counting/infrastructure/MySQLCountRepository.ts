import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { EMPLOYEE_CONTACT_TYPE } from "@/shared/infrastructure/activeoneConstants";
import { withPoMintRetry } from "@/shared/infrastructure/activeonePoMinting";
import type { CountRepository } from "../domain/CountRepository";
import type {
  CountableItem,
  CountCommit,
  CounterGate,
  CountResult,
} from "../domain/Count";
import pool, { activeoneSchemaName } from "@/shared/infrastructure/db";

/** Increment for the inventory_count / inventory_count_items MAX(ID)+n mint. */
const ID_INCREMENT = 1;
const CODE_WIDTH = 4;

interface CountableItemRow extends RowDataPacket {
  itemId: number;
  code: string;
  description: string;
  unitSymbol: string;
}
interface CounterGateRow extends RowDataPacket {
  counterName: string | null;
  recordedByUserId: number | null;
  countedByContactId: number | null;
  recorderName: string | null;
}
interface UnitRow extends RowDataPacket {
  itemId: number;
  code: string;
  description: string;
  unitId: number | null;
  unitSymbol: string;
  factor: string;
}
interface MaxRow extends RowDataPacket {
  m: number | null;
}
interface LocationNameRow extends RowDataPacket {
  NAME: string;
}

/**
 * Records inventory counts against ActiveOne. Each Save writes a fresh inventory_count
 * (+items) document with STATUS = 3 (finalized) and ADJUSTED = 0 — counting NEVER touches
 * on-hand — plus a self-contained stock_count mirror, in one atomic transaction. ID/CODE
 * are minted MAX(ID)+1 / next zero-padded sequence inside the transaction; withPoMintRetry
 * re-mints on a concurrent collision with ActiveOne's native writer.
 */
export class MySQLCountRepository implements CountRepository {
  async getCountableItems(): Promise<CountableItem[]> {
    // Read the shared item-master cache (populated via /admin item-cache refresh), not the
    // live `item` table — mirrors Delivery's cached masterlist load. Rows without an
    // `item_id` predate the cache extension and are skipped (unusable: no ITEM_ID to write).
    const [rows] = await pool.query<CountableItemRow[]>(
      `SELECT item_id AS itemId, code, description, COALESCE(unit_symbol, '') AS unitSymbol
       FROM item_master_cache
       WHERE item_id IS NOT NULL
       ORDER BY code`,
    );
    return rows.map((r) => ({
      itemId: r.itemId,
      code: r.code,
      description: r.description,
      unitSymbol: r.unitSymbol,
    }));
  }

  async getCounterGate(userId: number): Promise<CounterGate> {
    const ao = activeoneSchemaName();
    const [rows] = await pool.query<CounterGateRow[]>(
      `SELECT u.name AS counterName,
              au.ID AS recordedByUserId,
              c.ID AS countedByContactId,
              au.NAME AS recorderName
       FROM users u
       LEFT JOIN ${ao}.contact c ON c.ACCOUNT_NO = u.employee_code AND c.TYPE = ?
       LEFT JOIN ${ao}.\`user\` au ON au.ID = u.activeone_user_id
       WHERE u.id = ? AND u.is_active = 1
       LIMIT 1`,
      [EMPLOYEE_CONTACT_TYPE, userId],
    );
    const row = rows[0];
    if (!row) {
      return { countedByContactId: null, recordedByUserId: null, counterName: null, recorderName: null };
    }
    return {
      countedByContactId: row.countedByContactId ?? null,
      recordedByUserId: row.recordedByUserId ?? null,
      counterName: row.counterName ?? null,
      recorderName: row.recorderName ?? null,
    };
  }

  async commit(
    input: CountCommit & {
      countedByContactId: number;
      recordedByUserId: number;
      counterName: string | null;
      recorderName: string | null;
    },
  ): Promise<CountResult> {
    const itemIds = [...new Set(input.lines.map((l) => l.itemId))];

    return withPoMintRetry(async (conn) => {
      const ao = activeoneSchemaName();
      // Resolve display unit + factor per item at this location (server-authoritative, FR-9).
      const resolvedUnit = "COALESCE(ilu.PURCHASES_UNIT_ID, it.PURCHASES_UNIT_ID, it.BASE_UNIT_ID)";
      const [unitRows] = await conn.query<UnitRow[]>(
        `SELECT it.ID AS itemId, it.CODE AS code, it.DESCRIPTION AS description,
                ${resolvedUnit} AS unitId,
                COALESCE(uom.SYMBOL, '') AS unitSymbol,
                COALESCE(iu.QUANTITY, 1) AS factor
         FROM ${ao}.item it
         LEFT JOIN ${ao}.item_location_units ilu ON ilu.ITEM_ID = it.ID AND ilu.LOCATION_ID = ?
         LEFT JOIN ${ao}.unit_of_measure uom ON uom.ID = ${resolvedUnit}
         LEFT JOIN ${ao}.item_units iu ON iu.ITEM_ID = it.ID AND iu.UNIT_ID = ${resolvedUnit}
         WHERE it.ID IN (?)`,
        [input.locationId, itemIds],
      );
      const unitByItem = new Map<number, UnitRow>();
      for (const r of unitRows) if (!unitByItem.has(r.itemId)) unitByItem.set(r.itemId, r);

      // Fail-fast: every submitted item must resolve to a real ActiveOne item.
      for (const line of input.lines) {
        if (!unitByItem.has(line.itemId)) {
          throw new Error(`Item ${line.itemId} not found`);
        }
      }

      const [locRows] = await conn.query<LocationNameRow[]>(
        `SELECT NAME FROM ${activeoneSchemaName()}.location WHERE ID = ?`,
        [input.locationId],
      );
      const locationName = locRows[0]?.NAME ?? null;

      // Mint header ID + CODE (own numbering, independent of ID).
      const [headerMax] = await conn.query<MaxRow[]>(
        `SELECT MAX(ID) AS m FROM ${activeoneSchemaName()}.inventory_count`,
      );
      const headerId = (headerMax[0].m ?? 0) + ID_INCREMENT;
      const [codeMax] = await conn.query<MaxRow[]>(
        `SELECT MAX(CAST(CODE AS UNSIGNED)) AS m FROM ${activeoneSchemaName()}.inventory_count`,
      );
      const code = String((codeMax[0].m ?? 0) + 1).padStart(CODE_WIDTH, "0");

      await conn.execute(
        `INSERT INTO ${activeoneSchemaName()}.inventory_count
           (ID, CODE, DATE, RECORDED_ON, LOCATION_ID, COUNTED_BY_ID, RECORDED_BY_ID, NOTES, STATUS, STATUS_DATE, ADJUSTED)
         VALUES (?, ?, CURDATE(), NOW(), ?, ?, ?, ?, 3, CURDATE(), 0)`,
        [headerId, code, input.locationId, input.countedByContactId, input.recordedByUserId, input.note],
      );

      const [lineMax] = await conn.query<MaxRow[]>(
        `SELECT MAX(ID) AS m FROM ${activeoneSchemaName()}.inventory_count_items`,
      );
      let nextLineId = (lineMax[0].m ?? 0) + ID_INCREMENT;

      const erpLineValues: unknown[][] = [];
      const mirrorLineValues: unknown[][] = [];
      let lineNo = 1;
      let totalUnits = 0;
      for (const line of input.lines) {
        const u = unitByItem.get(line.itemId)!;
        const factor = Number(u.factor ?? 1);
        erpLineValues.push([nextLineId, headerId, lineNo, line.itemId, null, line.quantity, u.unitId, factor, 1]);
        mirrorLineValues.push([line.itemId, u.code, u.description, u.unitId, u.unitSymbol, factor, line.quantity]);
        nextLineId += ID_INCREMENT;
        lineNo += 1;
        totalUnits += line.quantity;
      }

      await conn.query(
        `INSERT INTO ${activeoneSchemaName()}.inventory_count_items
           (ID, INVENTORY_COUNT_ID, LINE_NO, ITEM_ID, DESCRIPTION, QUANTITY, UNIT_ID, UNIT_BASE_QUANTITY, CLOSED)
         VALUES ?`,
        [erpLineValues],
      );

      const [mirrorHeader] = await conn.execute<ResultSetHeader>(
        `INSERT INTO stock_count
           (inventory_count_id, inventory_count_code, location_id, location_name,
            counted_by_user_id, counter_name, counted_by_contact_id,
            recorded_by_activeone_user_id, recorder_name, continuous_scanning, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          headerId, code, input.locationId, locationName,
          input.counterUserId, input.counterName, input.countedByContactId,
          input.recordedByUserId, input.recorderName,
          input.continuousScanning ? 1 : 0, input.note,
        ],
      );
      const stockCountId = mirrorHeader.insertId;

      await conn.query(
        `INSERT INTO stock_count_items
           (stock_count_id, item_id, item_code, item_description, unit_id, unit_symbol, unit_base_quantity, quantity)
         VALUES ?`,
        [mirrorLineValues.map((v) => [stockCountId, ...v])],
      );

      return { code, inventoryCountId: headerId, itemCount: input.lines.length, totalUnits };
    });
  }
}
