export interface AppSettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  getByPrefix(prefix: string): Promise<Record<string, string>>;
}
