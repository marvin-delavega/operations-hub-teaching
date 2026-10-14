import type { Transfer } from "../domain/Transfer";
import type { TransferRepository } from "../domain/TransferRepository";

export class GetTransfersUseCase {
  constructor(private readonly repository: TransferRepository) {}

  async execute(): Promise<Transfer[]> {
    return this.repository.getAll();
  }
}
