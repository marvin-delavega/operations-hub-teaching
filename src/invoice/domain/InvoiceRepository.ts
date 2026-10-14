import type { Invoice } from "./Invoice";

export interface InvoiceRepository {
  getAll(): Promise<Invoice[]>;
}
