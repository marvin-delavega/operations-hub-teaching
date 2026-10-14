import type { DbConnectionConfigInput } from "../domain/DbConnectionConfig";
import { validateDbConnectionConfig } from "../domain/DbConnectionConfig";
import { coerceDbConfigInput } from "./CoerceDbConfigInput";
import type { DbConfigStore } from "./DbConfigStore";
import type { ConnectionTestResult, DbConnectionTester } from "./DbConnectionTester";

export class TestDbConnectionUseCase {
  constructor(
    private readonly store: DbConfigStore,
    private readonly tester: DbConnectionTester,
  ) {}

  async execute(input: DbConnectionConfigInput): Promise<ConnectionTestResult> {
    const config = coerceDbConfigInput(input, this.store.get());
    const valid = validateDbConnectionConfig(config);
    if (!valid.ok) return { ok: false, error: valid.error };
    return this.tester.test(config);
  }
}
