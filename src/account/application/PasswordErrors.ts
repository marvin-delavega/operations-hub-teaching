/** Wrong (or unverifiable) current password on self-service change. Maps to HTTP 400. */
export class IncorrectPasswordError extends Error {
  constructor() {
    super("Current password is incorrect");
  }
}

/** New password fails the length policy. Maps to HTTP 400. */
export class PasswordValidationError extends Error {}
