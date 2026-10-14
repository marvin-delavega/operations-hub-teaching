/** Bad input at the use-case boundary (missing/empty name, reserved name). Maps to HTTP 400. */
export class RoleValidationError extends Error {}

/** Role name collision on create/edit. Maps to HTTP 409. */
export class RoleNameTakenError extends Error {
  constructor() {
    super("Role name already taken");
  }
}

/** Attempt to delete a role still held by users. Maps to HTTP 409. */
export class RoleInUseError extends Error {
  constructor(public readonly memberCount: number) {
    super(`${memberCount} user(s) hold this role`);
  }
}

/** Attempt to mutate/delete/disable the protected Administrator role, or to unpin the
 *  protected system account from it. Maps to HTTP 403. */
export class ProtectedRoleError extends Error {
  constructor(message = "This role is protected and cannot be modified") {
    super(message);
  }
}
