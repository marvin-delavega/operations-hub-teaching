export interface Role {
  id: string;
  name: string;
  description: string | null;
  isProtected: boolean;
  isActive: boolean;
  /** Catalog permission keys granted to this role. The Administrator role reports the full catalog. */
  permissions: string[];
  memberCount: number;
}

export interface RoleMember {
  userId: string;
  name: string;
  username: string;
}
