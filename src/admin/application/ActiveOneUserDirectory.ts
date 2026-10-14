import type { ActiveOneUser } from "../domain/ActiveOneUser";

/** External-service port over the ActiveOne `user` (login) table. Read-only; never copies
 *  ERP-user data into our schema beyond `users.activeone_user_id`. */
export interface ActiveOneUserDirectory {
  search(query: string): Promise<ActiveOneUser[]>;
  /** Maps each present id to its current ActiveOne user name. Ids with no live match are
   *  simply absent (the mapping is never auto-cleared — caller falls back to the raw id). */
  resolveNames(ids: string[]): Promise<Map<string, string>>;
}
