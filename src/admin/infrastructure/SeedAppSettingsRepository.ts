import type { AppSettingsRepository } from "../domain/AppSettingsRepository";

const store: Record<string, string> = {
  company_name: "Great Wall Trading",
  po_code_prefix: "OHPO",
  po_code_display_width: "6",
  po_header_id_reserved_digit: "1",
  po_line_id_reserved_digit: "1",
};

export class SeedAppSettingsRepository implements AppSettingsRepository {
  async get(key: string): Promise<string | null> {
    return store[key] ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    store[key] = value;
  }

  async getByPrefix(_prefix: string): Promise<Record<string, string>> {
    return {};
  }
}
