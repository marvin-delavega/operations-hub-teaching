import type { CounterGate } from "../domain/Count";
import type { CountRepository } from "../domain/CountRepository";

export class GetCounterGateUseCase {
  constructor(private readonly repository: CountRepository) {}

  async execute(userId: number): Promise<CounterGate> {
    return this.repository.getCounterGate(userId);
  }
}
