import type { DbConnectionConfig } from "../domain/DbConnectionConfig";

export interface ConnectionTestResult {
  ok: boolean;
  error?: string;
}

/** Port for verifying a connection config against a live MySQL server without saving it. */
export interface DbConnectionTester {
  test(config: DbConnectionConfig): Promise<ConnectionTestResult>;
}
