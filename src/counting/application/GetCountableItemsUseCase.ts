import type { CountableItem } from "../domain/Count";
import type { CountRepository } from "../domain/CountRepository";

export class GetCountableItemsUseCase {
  constructor(private readonly repository: CountRepository) {}

  async execute(): Promise<CountableItem[]> {
    return this.repository.getCountableItems();
  }
}
