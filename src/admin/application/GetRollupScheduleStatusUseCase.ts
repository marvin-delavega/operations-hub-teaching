import type { TaskSchedulerPort } from "./TaskSchedulerPort";
import type { AppSettingsRepository } from "../domain/AppSettingsRepository";

export class GetRollupScheduleStatusUseCase {
  constructor(
    private readonly scheduler: TaskSchedulerPort,
    private readonly settings: AppSettingsRepository,
  ) {}

  async execute(): Promise<{
    installed: boolean;
    lastRunAt: string | null;
    lastRunResult: string | null;
    nextRunAt: string | null;
    trailingWindowDays: number;
    runTime: string;
    configError: string | null;
  }> {
    const [windowDaysRaw, runTimeRaw, status] = await Promise.all([
      this.settings.get("rollup_trailing_window_days"),
      this.settings.get("rollup_run_time"),
      this.scheduler.queryStatus("OperationsHub-SalesRollup"),
    ]);

    const trailingWindowDays =
      Math.max(1, Math.min(30, parseInt(windowDaysRaw ?? "7", 10) || 7));
    const runTime = runTimeRaw ?? "00:00";

    const baseUrl = process.env.NEXTAUTH_URL;
    const token = process.env.ROLLUP_REFRESH_TOKEN;

    let configError: string | null = null;
    if (!baseUrl && !token) {
      configError =
        "NEXTAUTH_URL and ROLLUP_REFRESH_TOKEN are not set. Configure them in .env.local before installing the scheduled task.";
    } else if (!baseUrl) {
      configError =
        "NEXTAUTH_URL is not set. Configure it in .env.local before installing the scheduled task.";
    } else if (!token) {
      configError =
        "ROLLUP_REFRESH_TOKEN is not set. Configure it in .env.local before installing the scheduled task.";
    }

    return { ...status, trailingWindowDays, runTime, configError };
  }
}
