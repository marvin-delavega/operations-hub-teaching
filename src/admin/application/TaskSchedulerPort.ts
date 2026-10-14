export interface TaskSchedulerStatus {
  installed: boolean;
  lastRunAt: string | null;
  lastRunResult: string | null;
  nextRunAt: string | null;
}

export interface TaskSchedulerPort {
  queryStatus(taskName: string): Promise<TaskSchedulerStatus>;
  install(taskName: string, runCommand: string, runTime: string): Promise<{ ok: boolean; error?: string }>;
}
