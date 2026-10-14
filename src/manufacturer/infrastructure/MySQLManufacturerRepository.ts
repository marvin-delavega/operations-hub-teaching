import type { RowDataPacket } from "mysql2";
import { activeonePool as pool } from "@/shared/infrastructure/db";
import type { ManufacturerRepository } from "../domain/ManufacturerRepository";
import type { SupplierManufacturers } from "../domain/Manufacturer";

interface ManufacturerRow extends RowDataPacket {
  supplier_id: number;
  supplier_name: string;
  manufacturer_id: number | null;
  manufacturer_name: string | null;
}

/**
 * Distinct (supplier, manufacturer) pairs carried by the selected suppliers' active
 * items (FR-6/FR-7) — location-independent. Sorted supplier name asc; within each
 * supplier, "No Brand" (null MANUFACTURER_ID) first, then manufacturer name asc (FR-8).
 */
function buildManufacturersSQL(supplierCount: number): string {
  const placeholders = Array(supplierCount).fill("?").join(", ");
  return `
    SELECT DISTINCT
      it.PREFERRED_VENDOR_ID AS supplier_id,
      c.NAME                 AS supplier_name,
      it.MANUFACTURER_ID     AS manufacturer_id,
      mfr.NAME                AS manufacturer_name
    FROM item it
    JOIN contact c ON c.ID = it.PREFERRED_VENDOR_ID
    LEFT JOIN manufacturer mfr ON mfr.ID = it.MANUFACTURER_ID
    WHERE it.INACTIVE = 0 AND it.PREFERRED_VENDOR_ID IN (${placeholders})
    ORDER BY c.NAME, (it.MANUFACTURER_ID IS NULL) DESC, mfr.NAME
  `;
}

export class MySQLManufacturerRepository implements ManufacturerRepository {
  async getManufacturersForSuppliers(supplierIds: number[]): Promise<SupplierManufacturers[]> {
    if (supplierIds.length === 0) return [];

    const [rows] = await pool.execute<ManufacturerRow[]>(
      buildManufacturersSQL(supplierIds.length),
      supplierIds,
    );

    const supplierMap = new Map<number, SupplierManufacturers>();
    for (const row of rows) {
      if (!supplierMap.has(row.supplier_id)) {
        supplierMap.set(row.supplier_id, {
          supplierId: row.supplier_id,
          supplierName: row.supplier_name,
          manufacturers: [],
        });
      }
      supplierMap.get(row.supplier_id)!.manufacturers.push({
        manufacturerId: row.manufacturer_id ?? null,
        manufacturerName: row.manufacturer_name ?? null,
      });
    }

    return [...supplierMap.values()];
  }
}
