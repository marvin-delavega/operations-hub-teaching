import type { Employee } from "../domain/Employee";
import type { EmployeeDirectory } from "./EmployeeDirectory";

export class SearchEmployeesUseCase {
  constructor(private readonly employees: EmployeeDirectory) {}

  async execute(query: string): Promise<Employee[]> {
    return this.employees.search(query.trim());
  }
}
