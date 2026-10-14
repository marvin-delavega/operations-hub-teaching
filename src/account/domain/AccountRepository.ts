/** Self-service access to the caller's own credentials in the `users` table.
 *  Scoped to a single user id (taken from the session, never the request body);
 *  deliberately has no protected-user guard — any active user, including the system
 *  admin, may rotate its own password. */
export interface AccountRepository {
  getPasswordHash(userId: string): Promise<string | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}
