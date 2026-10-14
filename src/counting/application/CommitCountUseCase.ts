import {
  CounterNotLinkedError,
  EmptyCountError,
  type CountCommit,
  type CountResult,
} from "../domain/Count";
import type { CountRepository } from "../domain/CountRepository";

export class CommitCountUseCase {
  constructor(private readonly repository: CountRepository) {}

  async execute(input: CountCommit): Promise<CountResult> {
    const gate = await this.repository.getCounterGate(input.counterUserId);
    if (gate.countedByContactId === null || gate.recordedByUserId === null) {
      throw new CounterNotLinkedError({
        employee: gate.countedByContactId === null,
        activeOneUser: gate.recordedByUserId === null,
      });
    }

    if (input.lines.length === 0) throw new EmptyCountError();

    return this.repository.commit({
      ...input,
      countedByContactId: gate.countedByContactId,
      recordedByUserId: gate.recordedByUserId,
      counterName: gate.counterName,
      recorderName: gate.recorderName,
    });
  }
}
