import type { RowDataPacket } from "mysql2";
import pool from "@/shared/infrastructure/db";
import type { SetupStatus, SetupStateRepository } from "../domain/SetupState";

interface SettingRow extends RowDataPacket {
  key: string;
  value: string;
}

function toManilaTimestamp(date: Date): string {
  return date
    .toLocaleString("sv-SE", { timeZone: "Asia/Manila" })
    .replace("T", " ");
}

export class MySQLSetupStateRepository implements SetupStateRepository {
  async getStatus(): Promise<SetupStatus> {
    const [rows] = await pool.execute<SettingRow[]>(
      "SELECT `key`, `value` FROM app_settings WHERE `key` IN ('setup_completed', 'setup_progress_step')",
    );

    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const completed = map["setup_completed"] === "true";
    const rawStep = Number(map["setup_progress_step"]);
    const currentStep = Number.isInteger(rawStep) && rawStep >= 1 && rawStep <= 4 ? rawStep : 1;

    return { completed, currentStep };
  }

  async setProgress(step: number): Promise<void> {
    await pool.execute(
      "INSERT INTO app_settings (`key`, `value`) VALUES ('setup_progress_step', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [String(step)],
    );
  }

  async markCompleted(by: string, at: Date): Promise<void> {
    const timestamp = toManilaTimestamp(at);
    await pool.execute(
      `INSERT INTO app_settings (\`key\`, \`value\`) VALUES
        ('setup_completed', 'true'),
        ('setup_progress_step', '4'),
        ('setup_completed_at', ?),
        ('setup_completed_by', ?)
      ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
      [timestamp, by],
    );
  }

  async markReset(by: string, at: Date): Promise<void> {
    const timestamp = toManilaTimestamp(at);
    await pool.execute(
      `INSERT INTO app_settings (\`key\`, \`value\`) VALUES
        ('setup_completed', 'false'),
        ('setup_progress_step', '1'),
        ('setup_reset_at', ?),
        ('setup_reset_by', ?)
      ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
      [timestamp, by],
    );
  }
}
