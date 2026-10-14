import type { DbConnectionConfigInput } from "../domain/DbConnectionConfig";
import { validateDbConnectionConfig } from "../domain/DbConnectionConfig";
import { coerceDbConfigInput } from "./CoerceDbConfigInput";
import type { DbConfigStore } from "./DbConfigStore";
import type { DbConnectionTester } from "./DbConnectionTester";

export interface SaveDbConfigResult {
  ok: boolean;
  error?: string;
}

export class SaveDbConfigUseCase {
  constructor(
    private readonly store: DbConfigStore,
    private readonly tester: DbConnectionTester,
  ) {}

  /** Validate → verify connection → persist + hot-swap. Never saves an unreachable config. */
  async execute(input: DbConnectionConfigInput): Promise<SaveDbConfigResult> {
    const config = coerceDbConfigInput(input, this.store.get());
    const valid = validateDbConnectionConfig(config);
    if (!valid.ok) return { ok: false, error: valid.error };

    const test = await this.tester.test(config);
    if (!test.ok) return { ok: false, error: test.error ?? "Could not connect with these settings." };

    await this.store.save(config);
    return { ok: true };
  }
}
