import type { RowDataPacket } from "mysql2";
import pool from "@/shared/infrastructure/db";
import type { AccountRepository } from "../domain/AccountRepository";

interface HashRow extends RowDataPacket {
  password_hash: string;
}

export class MySQLAccountRepository implements AccountRepository {
  async getPasswordHash(userId: string): Promise<string | null> {
    const [rows] = await pool.execute<HashRow[]>(
      "SELECT password_hash FROM users WHERE id = ? AND is_active = 1 LIMIT 1",
      [userId],
    );
    return rows[0]?.password_hash ?? null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
  }
}
