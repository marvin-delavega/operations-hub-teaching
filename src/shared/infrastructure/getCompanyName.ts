import { unstable_cache } from "next/cache";
import { createGetAppSettingUseCase } from "@/container";

export const getCompanyName = unstable_cache(
  async (): Promise<string> => {
    try {
      const value = await createGetAppSettingUseCase().execute("company_name");
      if (value && value.trim()) return value.trim();
    } catch {}
    return "Operations Hub";
  },
  ["app-settings-company-name"],
  { tags: ["app-settings"] }
);
