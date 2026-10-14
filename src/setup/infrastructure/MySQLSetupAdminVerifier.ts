import type { RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";
import pool from "@/shared/infrastructure/db";
import type { SetupAdminVerifier } from "../domain/SetupState";

interface AdminRow extends RowDataPacket {
  password_hash: string;
}

export class MySQLSetupAdminVerifier implements SetupAdminVerifier {
  async verifyById(userId: string, password: string): Promise<boolean> {
    if (!userId || !password) return false;

    const [rows] = await pool.execute<AdminRow[]>(
      "SELECT password_hash FROM users WHERE id = ? AND is_active = 1 AND role = 'admin' LIMIT 1",
      [userId],
    );
    const admin = rows[0];
    if (!admin) return false;

    return bcrypt.compare(password, admin.password_hash);
  }
}
