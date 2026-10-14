import type { ActiveOneUser } from "../domain/ActiveOneUser";
import type { ActiveOneUserDirectory } from "./ActiveOneUserDirectory";

export class SearchActiveOneUsersUseCase {
  constructor(private readonly directory: ActiveOneUserDirectory) {}

  async execute(query: string): Promise<ActiveOneUser[]> {
    return this.directory.search(query.trim());
  }
}
