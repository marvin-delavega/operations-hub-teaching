import type { Transfer } from "./Transfer";

export interface TransferRepository {
  getAll(): Promise<Transfer[]>;
}
