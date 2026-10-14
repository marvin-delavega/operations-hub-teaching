import type { SupplierManufacturers } from "./Manufacturer";

export interface ManufacturerRepository {
  getManufacturersForSuppliers(supplierIds: number[]): Promise<SupplierManufacturers[]>;
}
