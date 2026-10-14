import type { ManufacturerRepository } from "../domain/ManufacturerRepository";
import type { SupplierManufacturers } from "../domain/Manufacturer";

export class GetManufacturersForSuppliersUseCase {
  constructor(private readonly repository: ManufacturerRepository) {}

  async execute(supplierIds: number[]): Promise<SupplierManufacturers[]> {
    return this.repository.getManufacturersForSuppliers(supplierIds);
  }
}
