/** Bad input at the use-case boundary (missing field, short password, unknown user).
 *  Maps to HTTP 400. */
export class UserValidationError extends Error {}

/** Username collision on create/edit. Maps to HTTP 409. */
export class UsernameTakenError extends Error {
  constructor() {
    super("Username already taken");
  }
}

/** Attempt to edit/deactivate/reset the locked system admin. Maps to HTTP 403. */
export class ProtectedUserError extends Error {
  constructor() {
    super("This user is protected and cannot be modified");
  }
}
