import type { RowDataPacket } from "mysql2";
import pool from "@/shared/infrastructure/db";
import type { DeliverySettings } from "../application/DeliverySettings";

interface SettingRow extends RowDataPacket {
  value: string;
}

/** Reads delivery mode flags from app_settings. Missing key = blind mode off. */
export class MySQLDeliverySettings implements DeliverySettings {
  async isBlindDeliveryEnabled(): Promise<boolean> {
    const [rows] = await pool.execute<SettingRow[]>(
      "SELECT `value` FROM app_settings WHERE `key` = 'delivery_blind_delivery' LIMIT 1",
    );
    return rows[0]?.value === "on";
  }
}
