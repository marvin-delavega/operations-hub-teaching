import { unstable_cache } from "next/cache";
import { createGetSetupStatusUseCase } from "@/container";
import type { SetupStatus } from "@/setup/domain/SetupState";

// Fail-open: a transient DB error defaults to completed=true so a blip can't
// wall everyone out of the app. Only finish/reset invalidate this tag.
export const getSetupStatus = unstable_cache(
  async (): Promise<SetupStatus> => {
    try {
      return await createGetSetupStatusUseCase().execute();
    } catch {
      return { completed: true, currentStep: 1 };
    }
  },
  ["setup-status"],
  { tags: ["setup-status"] },
);
