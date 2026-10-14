"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { isSensitivePermission } from "@/shared/domain/Permissions";
import { cn } from "@/shared/ui/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/shared/ui/sheet";

interface Role {
  id: string;
  name: string;
  description: string | null;
  isProtected: boolean;
  isActive: boolean;
  permissions: string[];
  memberCount: number;
}

interface PermissionEntry {
  key: string;
  label: string;
  reserved?: boolean;
}

interface PermissionGroup {
  group: string;
  permissions: PermissionEntry[];
}

interface RoleMember {
  userId: string;
  name: string;
  username: string;
}

interface UserOption {
  id: string;
  name: string;
  username: string;
  isProtected?: boolean;
}

interface SheetState {
  role: Role | null; // null = create
}

function MembersSection({
  members,
  allUsers,
  protectedRole,
  onChange,
}: {
  members: string[];
  allUsers: UserOption[];
  protectedRole: boolean;
  onChange: (userIds: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const protectedUserId = allUsers.find((u) => u.isProtected)?.id;

  const term = search.trim().toLowerCase();
  const candidates = term
    ? allUsers.filter(
        (u) => u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term),
      )
    : allUsers;

  function toggle(userId: string) {
    onChange(members.includes(userId) ? members.filter((m) => m !== userId) : [...members, userId]);
  }

  return (
    <div className="space-y-2">
      <Label>Members</Label>
      <Input
        placeholder="Search users…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
      />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-1">
        {candidates.length === 0 ? (
          <p className="px-2 py-2 type-caption">No users found.</p>
        ) : (
          candidates.map((user) => {
            const checked = members.includes(user.id);
            // The protected system account can never be removed from the Administrator role.
            const locked = protectedRole && user.id === protectedUserId;
            return (
              <label
                key={user.id}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-sm px-2 py-1",
                  locked && "opacity-70",
                )}
              >
                <Checkbox checked={checked} disabled={locked} onCheckedChange={() => toggle(user.id)} />
                <span className="min-w-0 flex-1">
                  <span className="type-body text-foreground">{user.name}</span>
                  <span className="ml-2 type-data text-muted-foreground">{user.username}</span>
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function RoleSheet({
  state,
  catalog,
  allUsers,
  onClose,
  onSaved,
}: {
  state: SheetState | null;
  catalog: PermissionGroup[];
  allUsers: UserOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state?.role ?? null;
  const readOnly = !!editing?.isProtected;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmGrant, setConfirmGrant] = useState(false);
  // The confirm dialog is a Radix modal nested inside this sheet (also a Radix modal). When it
  // closes it fires a focus/interact-outside on the sheet that would dismiss it — so guard the
  // sheet against outside-dismissal while the confirm is driving it. Stays true through the
  // confirm's synchronous close events, then clears on the next microtask.
  const confirmOpenRef = useRef(false);

  function closeConfirm() {
    setConfirmGrant(false);
    queueMicrotask(() => {
      confirmOpenRef.current = false;
    });
  }

  useEffect(() => {
    if (!state) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setIsActive(editing?.isActive ?? true);
    setPermissions(editing?.permissions ?? []);
    setError(null);
    setConfirmGrant(false);
    confirmOpenRef.current = false;
    setMembers([]);
    if (editing) {
      fetch(`/admin/api/roles/${editing.id}/members`)
        .then((r) => r.json())
        .then((data: { members?: RoleMember[] }) => setMembers((data.members ?? []).map((m) => m.userId)))
        .catch(() => setMembers([]));
    }
  }, [state, editing]);

  function togglePermission(entry: PermissionEntry) {
    setPermissions((prev) =>
      prev.includes(entry.key) ? prev.filter((p) => p !== entry.key) : [...prev, entry.key],
    );
  }

  // Sensitive permissions (admin-tab / supervisor) newly added in this edit. Their grant is
  // confirmed once at Save time — not per-checkbox — so the confirm dialog closing never
  // dismisses the parent sheet (a nested-modal focus-outside would).
  function newlySensitiveLabels(): string[] {
    const original = new Set(editing?.permissions ?? []);
    const labelFor = new Map(
      catalog.flatMap((g) => g.permissions).map((p) => [p.key, p.label] as const),
    );
    return permissions
      .filter((key) => !original.has(key) && isSensitivePermission(key))
      .map((key) => labelFor.get(key) ?? key);
  }

  function handleSaveClick() {
    if (!name.trim()) return setError("Role name is required");
    if (newlySensitiveLabels().length > 0) {
      confirmOpenRef.current = true;
      setConfirmGrant(true);
      return;
    }
    void save();
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Role name is required");

    setSubmitting(true);
    try {
      const url = editing ? `/admin/api/roles/${editing.id}` : "/admin/api/roles";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() || null,
          isActive,
          permissions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save role.");
        setSubmitting(false);
        return;
      }
      const roleId = editing ? editing.id : String(data.id);
      // Persist membership (both create and edit) via the members endpoint.
      await fetch(`/admin/api/roles/${roleId}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: members }),
      });
      onSaved();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveProtectedMembers() {
    if (!editing) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/roles/${editing.id}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: members }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update members.");
        setSubmitting(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Sheet open={state !== null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent onInteractOutside={(e) => confirmOpenRef.current && e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>{editing ? (readOnly ? editing.name : "Edit role") : "New role"}</SheetTitle>
            <SheetDescription>
              {readOnly
                ? "The Administrator role is protected — only its membership can change."
                : "Define the role's permissions and members. Changes apply at each affected user's next sign-in."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            {!readOnly && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="role-name">Name</Label>
                  <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="role-description">Description (optional)</Label>
                  <Input
                    id="role-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={255}
                  />
                </div>
                <label className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
                  <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
                  <span className="min-w-0 flex-1">
                    <span className="type-body text-foreground">Active</span>
                    <span className="ml-2 type-caption">A disabled role grants no permissions.</span>
                  </span>
                </label>

                <div className="space-y-3">
                  <Label>Permissions</Label>
                  {catalog.map((group) => (
                    <div key={group.group} className="space-y-1">
                      <p className="type-label text-muted-foreground uppercase tracking-wide">{group.group}</p>
                      {group.permissions.map((entry) => (
                        <label
                          key={entry.key}
                          className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                        >
                          <Checkbox
                            checked={permissions.includes(entry.key)}
                            onCheckedChange={() => togglePermission(entry)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="type-body text-foreground">{entry.label}</span>
                            {entry.reserved && <span className="ml-2 type-caption">(reserved)</span>}
                            {isSensitivePermission(entry.key) && (
                              <ShieldCheck className="ml-1 inline size-3.5 text-warning" />
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            <MembersSection
              members={members}
              allUsers={allUsers}
              protectedRole={readOnly}
              onChange={setMembers}
            />

            {error && <p className="type-body text-destructive">{error}</p>}
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </SheetClose>
            <Button onClick={() => (readOnly ? saveProtectedMembers() : handleSaveClick())} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmGrant}
        onOpenChange={(o) => !o && closeConfirm()}
        title="Grant sensitive permissions?"
        description={`This role grants elevated access: ${newlySensitiveLabels().join(", ")}. Users holding it gain these at their next sign-in.`}
        confirmLabel="Grant"
        onConfirm={() => {
          closeConfirm();
          void save();
        }}
      />
    </>
  );
}

export function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/admin/api/roles")
      .then((r) => r.json())
      .then((data: { roles?: Role[] }) => setRoles(data.roles ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    fetch("/admin/api/permissions")
      .then((r) => r.json())
      .then((data: { catalog?: PermissionGroup[] }) => setCatalog(data.catalog ?? []))
      .catch(() => setCatalog([]));
    fetch("/admin/api/users")
      .then((r) => r.json())
      .then((data: { users?: (UserOption & { isProtected?: boolean })[] }) => setAllUsers(data.users ?? []))
      .catch(() => setAllUsers([]));
  }, []);

  async function confirmDelete() {
    if (!deleteRole) return;
    setDeleteError(null);
    const res = await fetch(`/admin/api/roles/${deleteRole.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteRole(null);
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error ?? "Failed to delete role.");
    }
  }

  const term = search.trim().toLowerCase();
  const filtered = term ? roles.filter((r) => r.name.toLowerCase().includes(term)) : roles;

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 type-caption">
        Changes apply the next time affected users sign in.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          autoComplete="off"
          name="role-search"
        />
        <Button onClick={() => setSheet({ role: null })} className="gap-2">
          <Plus className="size-4" /> New role
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="type-body text-muted-foreground">No roles found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((role) => (
            <Card
              key={role.id}
              className={cn("flex items-center gap-3 p-4", !role.isActive && "opacity-60")}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-body font-semibold text-foreground">{role.name}</span>
                  {role.isProtected && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-warning/25 bg-warning/12 px-2 py-0.5 text-xs font-semibold text-warning">
                      <ShieldCheck className="size-3.5" /> Protected
                    </span>
                  )}
                  {!role.isActive && (
                    <span className="inline-flex items-center rounded-md border border-transparent bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      Disabled
                    </span>
                  )}
                </div>
                {role.description && <p className="type-caption">{role.description}</p>}
                <p className="type-caption">
                  {role.memberCount} member{role.memberCount === 1 ? "" : "s"} · {role.permissions.length} permission
                  {role.permissions.length === 1 ? "" : "s"}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Actions for ${role.name}`}
                  className="flex size-12 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreVertical className="size-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setSheet({ role })}>
                    <UserCog className="size-4" /> {role.isProtected ? "Manage members" : "Edit"}
                  </DropdownMenuItem>
                  {!role.isProtected && (
                    <DropdownMenuItem
                      onSelect={() => { setDeleteError(null); setDeleteRole(role); }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
        </div>
      )}

      <RoleSheet
        state={sheet}
        catalog={catalog}
        allUsers={allUsers}
        onClose={() => setSheet(null)}
        onSaved={load}
      />

      <ConfirmDialog
        open={deleteRole !== null}
        onOpenChange={(o) => !o && setDeleteRole(null)}
        title="Delete role?"
        description={
          deleteError
            ? deleteError
            : deleteRole && deleteRole.memberCount > 0
              ? `${deleteRole.memberCount} user(s) hold "${deleteRole.name}". Reassign them before deleting.`
              : `"${deleteRole?.name}" will be permanently deleted.`
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteRole && deleteRole.memberCount > 0) {
            setDeleteRole(null);
            return;
          }
          void confirmDelete();
        }}
      />
    </div>
  );
}
