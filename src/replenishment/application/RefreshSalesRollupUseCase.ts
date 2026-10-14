import type { SalesRollupRepository } from "../domain/SalesRollupRepository";

export class RefreshSalesRollupUseCase {
  constructor(
    private readonly repository: SalesRollupRepository,
    private readonly windowDays: number,
  ) {}

  async execute(): Promise<{ windowDays: number; rowsAffected: number; durationMs: number }> {
    const start = Date.now();
    const { rowsAffected } = await this.repository.refreshTrailingWindow(this.windowDays);
    return {
      windowDays: this.windowDays,
      rowsAffected,
      durationMs: Date.now() - start,
    };
  }
}
