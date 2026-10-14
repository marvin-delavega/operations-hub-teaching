import type { SalesRollupRepository, SalesRollupHealth } from "../domain/SalesRollupRepository";

export class GetSalesRollupHealthUseCase {
  constructor(private readonly repository: SalesRollupRepository) {}

  async execute(): Promise<SalesRollupHealth> {
    return this.repository.getHealth();
  }
}
