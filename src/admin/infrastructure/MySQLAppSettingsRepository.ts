import type { RowDataPacket } from "mysql2";
import pool from "@/shared/infrastructure/db";
import type { AppSettingsRepository } from "../domain/AppSettingsRepository";

interface SettingRow extends RowDataPacket {
  key: string;
  value: string;
}

export class MySQLAppSettingsRepository implements AppSettingsRepository {
  async get(key: string): Promise<string | null> {
    const [rows] = await pool.execute<SettingRow[]>(
      "SELECT `value` FROM app_settings WHERE `key` = ? LIMIT 1",
      [key]
    );
    return rows.length > 0 ? rows[0].value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await pool.execute(
      "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [key, value]
    );
  }

  async getByPrefix(prefix: string): Promise<Record<string, string>> {
    const [rows] = await pool.execute<SettingRow[]>(
      "SELECT `key`, `value` FROM app_settings WHERE `key` LIKE ?",
      [`${prefix}%`]
    );
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }
}
