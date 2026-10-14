import { exec } from "child_process";
import type { TaskSchedulerPort, TaskSchedulerStatus } from "../application/TaskSchedulerPort";

function execAsync(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    exec(command, { encoding: "utf8" }, (error, stdout, stderr) => {
      const exitCode = error
        ? typeof error.code === "number"
          ? error.code
          : 1
        : 0;
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode });
    });
  });
}

function parseField(output: string, label: string): string | null {
  const regex = new RegExp(`^${label}:\\s*(.+)$`, "im");
  const match = output.match(regex);
  if (!match) return null;
  const value = match[1].trim();
  if (value === "N/A" || value === "Never" || value === "") return null;
  return value;
}

function toIsoOrRaw(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toISOString();
}

export class WindowsTaskSchedulerAdapter implements TaskSchedulerPort {
  async queryStatus(taskName: string): Promise<TaskSchedulerStatus> {
    const { stdout, exitCode } = await execAsync(
      `schtasks /query /tn "${taskName}" /fo LIST /v`,
    );
    if (exitCode !== 0 || stdout.includes("ERROR:")) {
      return { installed: false, lastRunAt: null, lastRunResult: null, nextRunAt: null };
    }
    const lastRunRaw = parseField(stdout, "Last Run Time");
    const lastResultRaw = parseField(stdout, "Last Result");
    const nextRunRaw = parseField(stdout, "Next Run Time");
    return {
      installed: true,
      lastRunAt: lastRunRaw ? toIsoOrRaw(lastRunRaw) : null,
      lastRunResult: lastResultRaw,
      nextRunAt: nextRunRaw ? toIsoOrRaw(nextRunRaw) : null,
    };
  }

  async install(
    taskName: string,
    runCommand: string,
    runTime: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const escapedCmd = runCommand.replace(/"/g, '\\"');
    const { stderr, exitCode } = await execAsync(
      `schtasks /create /tn "${taskName}" /tr "${escapedCmd}" /sc DAILY /st ${runTime} /ru SYSTEM /f`,
    );
    if (exitCode !== 0) {
      return { ok: false, error: stderr.trim() };
    }
    return { ok: true };
  }
}
