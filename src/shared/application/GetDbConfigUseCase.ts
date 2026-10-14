import type { DbConfigStore } from "./DbConfigStore";

/** Connection config safe to send to a client — never includes the password. */
export interface RedactedDbConfig {
  host: string;
  port: number;
  user: string;
  database: string;
  appDatabase: string | null;
}

export interface DbConfigView {
  configured: boolean;
  config: RedactedDbConfig | null;
}

export class GetDbConfigUseCase {
  constructor(private readonly store: DbConfigStore) {}

  execute(): DbConfigView {
    const config = this.store.get();
    if (!config) return { configured: false, config: null };
    return {
      configured: true,
      config: {
        host: config.host,
        port: config.port,
        user: config.user,
        database: config.database,
        appDatabase: config.appDatabase ?? null,
      },
    };
  }
}
