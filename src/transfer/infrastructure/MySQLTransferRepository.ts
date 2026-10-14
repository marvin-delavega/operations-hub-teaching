import type { TransferRepository } from "../domain/TransferRepository";
import type { Transfer } from "../domain/Transfer";

export class MySQLTransferRepository implements TransferRepository {
  async getAll(): Promise<Transfer[]> {
    return [];
  }
}
