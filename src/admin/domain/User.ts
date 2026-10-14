export interface User {
  id: string;
  name: string;
  username: string;
  /** RBAC roles the user holds (union of their permissions = effective access). */
  roleIds: string[];
  roleNames: string[];
  isActive: boolean;
  employeeCode: string | null;
  /** ActiveOne login-user id (ERP `user` PK) written to inventory_count.RECORDED_BY_ID. */
  activeOneUserId: string | null;
  /** Locked system admin: permanently pinned to Administrator + active, never editable/deactivatable. */
  isProtected: boolean;
}
