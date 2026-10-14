import type { Location } from "./Location";

export interface LocationRepository {
  getAll(module: string, showAll: boolean): Promise<Location[]>;
  getById(id: number): Promise<Location | null>;
}
