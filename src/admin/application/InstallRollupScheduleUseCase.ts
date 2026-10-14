import type { TaskSchedulerPort } from "./TaskSchedulerPort";
import type { AppSettingsRepository } from "../domain/AppSettingsRepository";

export class InstallRollupScheduleUseCase {
  constructor(
    private readonly scheduler: TaskSchedulerPort,
    private readonly settings: AppSettingsRepository,
  ) {}

  async execute(
    trailingWindowDays: number,
    runTime: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const baseUrl = process.env.NEXTAUTH_URL;
    const token = process.env.ROLLUP_REFRESH_TOKEN;

    if (!baseUrl || !token) {
      const missing = [!baseUrl && "NEXTAUTH_URL", !token && "ROLLUP_REFRESH_TOKEN"]
        .filter(Boolean)
        .join(" and ");
      return { ok: false, error: `${missing} is not configured. Set it in .env.local first.` };
    }

    await Promise.all([
      this.settings.set("rollup_trailing_window_days", String(trailingWindowDays)),
      this.settings.set("rollup_run_time", runTime),
    ]);

    const curlCmd = `curl -s -o NUL -X POST "${baseUrl}/replenishment/api/rollup/refresh" -H "Authorization: Bearer ${token}"`;

    return this.scheduler.install("OperationsHub-SalesRollup", curlCmd, runTime);
  }
}
