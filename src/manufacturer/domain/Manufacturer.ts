export interface Manufacturer {
  manufacturerId: number | null;
  manufacturerName: string | null;
}

export interface SupplierManufacturers {
  supplierId: number;
  supplierName: string;
  manufacturers: Manufacturer[];
}
