import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import pool from "@/shared/infrastructure/db";
import type {
  RoleRepository,
  CreateRoleInput,
  UpdateRoleInput,
} from "../domain/RoleRepository";
import type { Role, RoleMember } from "../domain/Role";

interface RoleRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  is_protected: number;
  is_active: number;
  member_count: number;
}

interface PermissionRow extends RowDataPacket {
  role_id: number;
  permission_key: string;
}

interface MemberRow extends RowDataPacket {
  id: number;
  name: string;
  username: string;
}

/** Reads/writes RBAC roles, their permissions, and membership in our own tables (never ActiveOne). */
export class MySQLRoleRepository implements RoleRepository {
  async getAll(): Promise<Role[]> {
    const [roleRows] = await pool.query<RoleRow[]>(
      `SELECT r.id, r.name, r.description, r.is_protected, r.is_active,
              (SELECT COUNT(*) FROM user_role ur WHERE ur.role_id = r.id) AS member_count
       FROM role r
       ORDER BY r.is_protected DESC, r.name`,
    );
    if (!roleRows.length) return [];

    const [permRows] = await pool.query<PermissionRow[]>(
      `SELECT role_id, permission_key FROM role_permission`,
    );
    const permsByRole = new Map<number, string[]>();
    for (const row of permRows) {
      const list = permsByRole.get(row.role_id) ?? [];
      list.push(row.permission_key);
      permsByRole.set(row.role_id, list);
    }

    return roleRows.map((row) => this.toRole(row, permsByRole.get(row.id) ?? []));
  }

  async findById(id: string): Promise<Role | null> {
    const [roleRows] = await pool.execute<RoleRow[]>(
      `SELECT r.id, r.name, r.description, r.is_protected, r.is_active,
              (SELECT COUNT(*) FROM user_role ur WHERE ur.role_id = r.id) AS member_count
       FROM role r WHERE r.id = ? LIMIT 1`,
      [id],
    );
    if (!roleRows[0]) return null;

    const [permRows] = await pool.execute<PermissionRow[]>(
      `SELECT role_id, permission_key FROM role_permission WHERE role_id = ?`,
      [id],
    );
    return this.toRole(roleRows[0], permRows.map((r) => r.permission_key));
  }

  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM role WHERE name = ?${excludeId ? " AND id <> ?" : ""} LIMIT 1`,
      excludeId ? [name, excludeId] : [name],
    );
    return rows.length > 0;
  }

  async create(input: CreateRoleInput): Promise<string> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO role (name, description, is_protected, is_active) VALUES (?, ?, 0, ?)`,
        [input.name, input.description, input.isActive ? 1 : 0],
      );
      const roleId = result.insertId;
      await this.replacePermissions(conn, roleId, input.permissions);
      await conn.commit();
      return String(roleId);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async update(id: string, input: UpdateRoleInput): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `UPDATE role SET name = ?, description = ?, is_active = ? WHERE id = ?`,
        [input.name, input.description, input.isActive ? 1 : 0, id],
      );
      await this.replacePermissions(conn, Number(id), input.permissions);
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async delete(id: string): Promise<void> {
    // role_permission and user_role cascade on the FK.
    await pool.execute(`DELETE FROM role WHERE id = ?`, [id]);
  }

  async memberCount(id: string): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM user_role WHERE role_id = ?`,
      [id],
    );
    return Number((rows[0] as { c: number }).c);
  }

  async getMembers(id: string): Promise<RoleMember[]> {
    const [rows] = await pool.execute<MemberRow[]>(
      `SELECT u.id, u.name, u.username
       FROM user_role ur JOIN users u ON u.id = ur.user_id
       WHERE ur.role_id = ? ORDER BY u.name`,
      [id],
    );
    return rows.map((row) => ({ userId: String(row.id), name: row.name, username: row.username }));
  }

  async setMembers(id: string, userIds: string[]): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(`DELETE FROM user_role WHERE role_id = ?`, [id]);
      for (const userId of userIds) {
        await conn.execute(
          `INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?, ?)`,
          [userId, id],
        );
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  private async replacePermissions(
    conn: PoolConnection,
    roleId: number,
    permissions: string[],
  ): Promise<void> {
    await conn.execute(`DELETE FROM role_permission WHERE role_id = ?`, [roleId]);
    for (const key of permissions) {
      await conn.execute(
        `INSERT IGNORE INTO role_permission (role_id, permission_key) VALUES (?, ?)`,
        [roleId, key],
      );
    }
  }

  private toRole(row: RoleRow, permissions: string[]): Role {
    return {
      id: String(row.id),
      name: row.name,
      description: row.description,
      isProtected: row.is_protected === 1,
      isActive: row.is_active === 1,
      permissions,
      memberCount: Number(row.member_count),
    };
  }
}
