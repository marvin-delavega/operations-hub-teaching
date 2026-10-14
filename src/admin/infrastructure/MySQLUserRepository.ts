import type { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "@/shared/infrastructure/db";
import type {
  UserRepository,
  CreateUserInput,
  UpdateUserInput,
} from "../domain/UserRepository";
import type { User } from "../domain/User";

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  username: string;
  is_active: number;
  employee_code: string | null;
  activeone_user_id: number | null;
  is_protected: number;
}

interface UserRoleRow extends RowDataPacket {
  user_id: number;
  role_id: number;
  role_name: string;
}

const COLUMNS = "id, name, username, is_active, employee_code, activeone_user_id, is_protected";

/** Reads/writes Operations Hub users and their RBAC role membership (never ActiveOne). */
export class MySQLUserRepository implements UserRepository {
  async getAll(): Promise<User[]> {
    const [rows] = await pool.query<UserRow[]>(
      `SELECT ${COLUMNS} FROM users ORDER BY name`,
    );
    const [roleRows] = await pool.query<UserRoleRow[]>(
      `SELECT ur.user_id, ur.role_id, r.name AS role_name
       FROM user_role ur JOIN role r ON r.id = ur.role_id
       ORDER BY r.name`,
    );
    const byUser = this.groupRoles(roleRows);
    return rows.map((row) => this.toUser(row, byUser.get(row.id)));
  }

  async findById(id: string): Promise<User | null> {
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT ${COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    const [roleRows] = await pool.execute<UserRoleRow[]>(
      `SELECT ur.user_id, ur.role_id, r.name AS role_name
       FROM user_role ur JOIN role r ON r.id = ur.role_id
       WHERE ur.user_id = ? ORDER BY r.name`,
      [id],
    );
    return this.toUser(rows[0], this.groupRoles(roleRows).get(rows[0].id));
  }

  async usernameExists(username: string, excludeId?: string): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM users WHERE username = ?${excludeId ? " AND id <> ?" : ""} LIMIT 1`,
      excludeId ? [username, excludeId] : [username],
    );
    return rows.length > 0;
  }

  async create(input: CreateUserInput): Promise<string> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO users (name, username, password_hash, is_active, employee_code, activeone_user_id)
         VALUES (?, ?, ?, 1, ?, ?)`,
        [input.name, input.username, input.passwordHash, input.employeeCode,
          input.activeOneUserId === null ? null : Number(input.activeOneUserId)],
      );
      const userId = result.insertId;
      for (const roleId of input.roleIds) {
        await conn.execute(`INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?, ?)`, [userId, roleId]);
      }
      await conn.commit();
      return String(userId);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async update(id: string, input: UpdateUserInput): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `UPDATE users SET name = ?, username = ?, employee_code = ?, activeone_user_id = ? WHERE id = ?`,
        [input.name, input.username, input.employeeCode,
          input.activeOneUserId === null ? null : Number(input.activeOneUserId), id],
      );
      await conn.execute(`DELETE FROM user_role WHERE user_id = ?`, [id]);
      for (const roleId of input.roleIds) {
        await conn.execute(`INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?, ?)`, [id, roleId]);
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await pool.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, id]);
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await pool.execute(`UPDATE users SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, id]);
  }

  private groupRoles(rows: UserRoleRow[]): Map<number, { ids: string[]; names: string[] }> {
    const map = new Map<number, { ids: string[]; names: string[] }>();
    for (const row of rows) {
      const entry = map.get(row.user_id) ?? { ids: [], names: [] };
      entry.ids.push(String(row.role_id));
      entry.names.push(row.role_name);
      map.set(row.user_id, entry);
    }
    return map;
  }

  private toUser(row: UserRow, roles?: { ids: string[]; names: string[] }): User {
    return {
      id: String(row.id),
      name: row.name,
      username: row.username,
      roleIds: roles?.ids ?? [],
      roleNames: roles?.names ?? [],
      isActive: row.is_active === 1,
      employeeCode: row.employee_code,
      activeOneUserId: row.activeone_user_id === null ? null : String(row.activeone_user_id),
      isProtected: row.is_protected === 1,
    };
  }
}
