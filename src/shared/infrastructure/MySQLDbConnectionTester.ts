import type { DbConnectionConfig } from "../domain/DbConnectionConfig";
import type { ConnectionTestResult, DbConnectionTester } from "../application/DbConnectionTester";
import { testConnection } from "./db";

export class MySQLDbConnectionTester implements DbConnectionTester {
  test(config: DbConnectionConfig): Promise<ConnectionTestResult> {
    return testConnection(config);
  }
}
