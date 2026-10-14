"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, MoreVertical, Plus, ShieldCheck, UserCog, X } from "lucide-react";
import { isSensitivePermission } from "@/shared/domain/Permissions";
import { MIN_PASSWORD_LENGTH } from "@/shared/domain/Password";
import { cn } from "@/shared/ui/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/shared/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/shared/ui/sheet";

interface User {
  id: string;
  name: string;
  username: string;
  roleIds: string[];
  roleNames: string[];
  isActive: boolean;
  employeeCode: string | null;
  employeeName: string | null;
  activeOneUserId: string | null;
  activeOneUserName: string | null;
  isProtected: boolean;
}

interface RoleOption {
  id: string;
  name: string;
  isProtected: boolean;
  isActive: boolean;
  permissions: string[];
}

interface Employee {
  code: string;
  name: string;
}

interface ActiveOneUser {
  id: string;
  name: string;
}

/** A role whose grant should prompt a confirm: Administrator (protected) or any role that
 *  carries an admin-tab / supervisor permission. */
function isSensitiveRole(role: RoleOption): boolean {
  return role.isProtected || role.permissions.some(isSensitivePermission);
}

/** Live ActiveOne employee picker. Stores the selected contact's code; displays its name. */
function EmployeePicker({
  code,
  name,
  onChange,
}: {
  code: string | null;
  name: string | null;
  onChange: (code: string | null, name: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/admin/api/users/employees?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data: { employees?: Employee[] }) => setResults(data.employees ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  if (code) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
        <span className="type-body text-foreground">
          {name ?? code}
          {name && <span className="ml-2 type-data text-muted-foreground">{code}</span>}
        </span>
        <button
          type="button"
          aria-label="Remove employee link"
          onClick={() => onChange(null, null)}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Search ActiveOne employees…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {searching && <p className="px-2 py-2 type-caption">Searching…</p>}
          {!searching && results.length === 0 && (
            <p className="px-2 py-2 type-caption">No employees found</p>
          )}
          {!searching &&
            results.map((employee) => (
              <button
                key={employee.code}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(employee.code, employee.name);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex min-h-12 w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span>{employee.name}</span>
                <span className="type-data text-muted-foreground">{employee.code}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** Live ActiveOne login-user picker. Stores the selected ERP user's id; displays its name. */
function ActiveOneUserPicker({
  id,
  name,
  onChange,
}: {
  id: string | null;
  name: string | null;
  onChange: (id: string | null, name: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ActiveOneUser[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/admin/api/users/activeone-users?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data: { users?: ActiveOneUser[] }) => setResults(data.users ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  if (id) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2">
        <span className="type-body text-foreground">
          {name ?? id}
          {name && <span className="ml-2 type-data text-muted-foreground">#{id}</span>}
        </span>
        <button
          type="button"
          aria-label="Remove ActiveOne login mapping"
          onClick={() => onChange(null, null)}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Search ActiveOne login users…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {searching && <p className="px-2 py-2 type-caption">Searching…</p>}
          {!searching && results.length === 0 && (
            <p className="px-2 py-2 type-caption">No login users found</p>
          )}
          {!searching &&
            results.map((user) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(user.id, user.name);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex min-h-12 w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span>{user.name}</span>
                <span className="type-data text-muted-foreground">#{user.id}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

interface SheetState {
  user: User | null; // null = create
}

function UserSheet({
  state,
  roles,
  onClose,
  onSaved,
}: {
  state: SheetState | null;
  roles: RoleOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state?.user ?? null;
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [employeeCode, setEmployeeCode] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [activeOneUserId, setActiveOneUserId] = useState<string | null>(null);
  const [activeOneUserName, setActiveOneUserName] = useState<string | null>(null);
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
    setUsername(editing?.username ?? "");
    setRoleIds(editing?.roleIds ?? []);
    setPassword("");
    setEmployeeCode(editing?.employeeCode ?? null);
    setEmployeeName(editing?.employeeName ?? null);
    setActiveOneUserId(editing?.activeOneUserId ?? null);
    setActiveOneUserName(editing?.activeOneUserName ?? null);
    setError(null);
    setConfirmGrant(false);
    confirmOpenRef.current = false;
  }, [state, editing]);

  function toggleRole(id: string) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  // Roles newly added in this edit that are sensitive (Administrator or carry a sensitive permission).
  function newlySensitiveGrants(): RoleOption[] {
    const originalIds = new Set(editing?.roleIds ?? []);
    return roles.filter(
      (role) => roleIds.includes(role.id) && !originalIds.has(role.id) && isSensitiveRole(role),
    );
  }

  function validate(): string | null {
    if (!name.trim()) return "Name is required";
    if (!username.trim()) return "Username is required";
    if (!editing && password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    return null;
  }

  async function save() {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const url = editing ? `/admin/api/users/${editing.id}` : "/admin/api/users";
      const method = editing ? "PUT" : "POST";
      const body = editing
        ? { name, username, roleIds, employeeCode, activeOneUserId }
        : { name, username, roleIds, password, employeeCode, activeOneUserId };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        setError(data.error ?? "Failed to save user.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaveClick() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (newlySensitiveGrants().length > 0) {
      confirmOpenRef.current = true;
      setConfirmGrant(true);
      return;
    }
    void save();
  }

  const grantNames = newlySensitiveGrants().map((r) => r.name).join(", ");

  return (
    <>
      <Sheet open={state !== null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent onInteractOutside={(e) => confirmOpenRef.current && e.preventDefault()}>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit user" : "New user"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Update identity, role, and the linked ActiveOne employee."
                : "Create an Operations Hub account."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>ActiveOne employee link (optional)</Label>
              <EmployeePicker
                code={employeeCode}
                name={employeeName}
                onChange={(c, n) => {
                  setEmployeeCode(c);
                  setEmployeeName(n);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>ActiveOne login user (optional)</Label>
              <ActiveOneUserPicker
                id={activeOneUserId}
                name={activeOneUserName}
                onChange={(i, n) => {
                  setActiveOneUserId(i);
                  setActiveOneUserName(n);
                }}
              />
              <p className="type-caption">Required to save an inventory count. Recorded as the count&apos;s ActiveOne login user.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-name">Display name</Label>
              <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-username">Username</Label>
              <Input
                id="user-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={50}
                autoCapitalize="none"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              {roles.length === 0 ? (
                <p className="type-caption">No roles defined yet.</p>
              ) : (
                <div className="space-y-1">
                  {roles.map((role) => {
                    const checked = roleIds.includes(role.id);
                    // The protected system account is permanently pinned to Administrator.
                    const locked = !!editing?.isProtected && role.isProtected;
                    return (
                      <label
                        key={role.id}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-md border border-border bg-card px-3 py-2",
                          locked && "opacity-70",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={locked}
                          onCheckedChange={() => toggleRole(role.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="type-body text-foreground">{role.name}</span>
                          {isSensitiveRole(role) && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-warning/25 bg-warning/12 px-1.5 py-0.5 text-xs font-semibold text-warning">
                              <ShieldCheck className="size-3" /> Sensitive
                            </span>
                          )}
                          {!role.isActive && (
                            <span className="ml-2 type-caption">(disabled)</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {!editing && (
              <div className="space-y-1">
                <Label htmlFor="user-password">Password</Label>
                <PasswordInput
                  id="user-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {error && <p className="type-body text-destructive">{error}</p>}
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </SheetClose>
            <Button onClick={handleSaveClick} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmGrant}
        onOpenChange={(o) => !o && closeConfirm()}
        title="Grant sensitive access?"
        description={`This grants ${name || "this user"} the following role(s) with elevated permissions: ${grantNames}. Changes apply at their next sign-in.`}
        confirmLabel="Grant"
        onConfirm={() => {
          closeConfirm();
          void save();
        }}
      />
    </>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setPassword("");
    setMessage(null);
  }, [user]);

  async function submit() {
    if (!user) return;
    setMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage({ type: "error", text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/admin/api/users/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "success", text: "Password reset." });
        setPassword("");
        setTimeout(onClose, 1000);
      } else {
        setMessage({ type: "error", text: data.error ?? "Failed to reset password." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for {user?.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="reset-password">New password</Label>
            <PasswordInput
              id="reset-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {message && (
            <p className={cn("type-body", message.type === "success" ? "text-success" : "text-destructive")}>
              {message.text}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={submit} disabled={submitting || !password}>
            {submitting ? "Saving…" : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<User | null>(null);

  function load() {
    setLoading(true);
    fetch("/admin/api/users")
      .then((r) => r.json())
      .then((data: { users?: User[] }) => setUsers(data.users ?? []))
      .finally(() => setLoading(false));
  }

  function loadRoles() {
    fetch("/admin/api/roles")
      .then((r) => r.json())
      .then((data: { roles?: RoleOption[] }) => setRoles(data.roles ?? []))
      .catch(() => setRoles([]));
  }

  useEffect(load, []);
  useEffect(loadRoles, []);

  async function setActive(user: User, isActive: boolean) {
    const res = await fetch(`/admin/api/users/${user.id}/active`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) load();
  }

  const term = search.trim().toLowerCase();
  const filtered = term
    ? users.filter(
        (u) => u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term),
      )
    : users;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          autoComplete="off"
          name="user-search"
        />
        <Button onClick={() => setSheet({ user: null })} className="gap-2">
          <Plus className="size-4" /> New user
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="type-body text-muted-foreground">No users found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <Card
              key={user.id}
              className={cn("flex items-center gap-3 p-4", !user.isActive && "opacity-60")}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-body font-semibold text-foreground">{user.name}</span>
                  {user.roleNames.length > 0 ? (
                    <span className="type-caption text-muted-foreground">
                      {user.roleNames.join(", ")}
                    </span>
                  ) : (
                    <span className="type-caption text-muted-foreground">No roles</span>
                  )}
                  {user.isProtected && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-warning/25 bg-warning/12 px-2 py-0.5 text-xs font-semibold text-warning">
                      <ShieldCheck className="size-3.5" /> Protected
                    </span>
                  )}
                  {!user.isActive && (
                    <span className="inline-flex items-center rounded-md border border-transparent bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="type-data text-muted-foreground">{user.username}</p>
                <p className="type-caption">
                  {user.employeeName
                    ? `Employee: ${user.employeeName}`
                    : user.employeeCode
                      ? `Employee: ${user.employeeCode}`
                      : "Not linked"}
                </p>
                <p className="type-caption">
                  {user.activeOneUserName
                    ? `Login user: ${user.activeOneUserName}`
                    : user.activeOneUserId
                      ? `Login user: #${user.activeOneUserId}`
                      : "No login user"}
                </p>
              </div>

              {!user.isProtected && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${user.name}`}
                    className="flex size-12 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreVertical className="size-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setSheet({ user })}>
                      <UserCog className="size-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setResetUser(user)}>
                      <KeyRound className="size-4" /> Reset password
                    </DropdownMenuItem>
                    {user.isActive ? (
                      <DropdownMenuItem
                        onSelect={() => setDeactivateUser(user)}
                        className="text-destructive focus:text-destructive"
                      >
                        Deactivate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => setActive(user, true)}>
                        Activate
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Card>
          ))}
        </div>
      )}

      <UserSheet state={sheet} roles={roles} onClose={() => setSheet(null)} onSaved={load} />
      <ResetPasswordDialog user={resetUser} onClose={() => setResetUser(null)} />
      <ConfirmDialog
        open={deactivateUser !== null}
        onOpenChange={(o) => !o && setDeactivateUser(null)}
        title="Deactivate user?"
        description={`${deactivateUser?.name ?? "This user"} will be blocked from new logins. Existing sessions persist until their next login.`}
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => {
          if (deactivateUser) void setActive(deactivateUser, false);
          setDeactivateUser(null);
        }}
      />
    </div>
  );
}
