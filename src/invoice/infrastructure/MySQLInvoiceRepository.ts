import type { InvoiceRepository } from "../domain/InvoiceRepository";
import type { Invoice } from "../domain/Invoice";

export class MySQLInvoiceRepository implements InvoiceRepository {
  async getAll(): Promise<Invoice[]> {
    return [];
  }
}
