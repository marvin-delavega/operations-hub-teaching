import type { Employee } from "../domain/Employee";

/** External-service port over the ActiveOne `contact` table (type-2 employees).
 *  Read-only; never copies employee data into our schema beyond `users.employee_code`. */
export interface EmployeeDirectory {
  search(query: string): Promise<Employee[]>;
  /** Maps each present employee_code to its current ActiveOne name. Codes with no
   *  live match are simply absent (the link is never auto-cleared — caller falls back
   *  to the raw stored code). */
  resolveNames(codes: string[]): Promise<Map<string, string>>;
}
