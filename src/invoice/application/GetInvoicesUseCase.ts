import type { Invoice } from "../domain/Invoice";
import type { InvoiceRepository } from "../domain/InvoiceRepository";

export class GetInvoicesUseCase {
  constructor(private readonly repository: InvoiceRepository) {}

  async execute(): Promise<Invoice[]> {
    return this.repository.getAll();
  }
}
