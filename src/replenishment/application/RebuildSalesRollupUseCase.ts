import type { SalesRollupRepository } from "../domain/SalesRollupRepository";

export class RebuildSalesRollupUseCase {
  private static readonly MONTHS_BACK = 13;

  constructor(private readonly repository: SalesRollupRepository) {}

  async execute(): Promise<{ monthsBack: number; rowsAffected: number; durationMs: number }> {
    const start = Date.now();
    const { rowsAffected } = await this.repository.rebuild(RebuildSalesRollupUseCase.MONTHS_BACK);
    return {
      monthsBack: RebuildSalesRollupUseCase.MONTHS_BACK,
      rowsAffected,
      durationMs: Date.now() - start,
    };
  }
}
