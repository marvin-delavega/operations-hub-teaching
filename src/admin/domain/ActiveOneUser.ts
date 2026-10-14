/** An ActiveOne login-user (the ERP `user` table), resolved live for the per-user
 *  RECORDED_BY mapping picker and for display-name resolution. `id` is the user's PK. */
export interface ActiveOneUser {
  id: string;
  name: string;
}
