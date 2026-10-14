"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/ui/utils";
import { Button } from "@/shared/ui/button";
import { CompanyNameCard } from "@/admin/CompanyNameCard";
import { LocationVisibilityManager } from "@/admin/LocationVisibilityManager";
import { DeliverySettingsCard } from "@/admin/DeliverySettingsCard";
import { UsersTab } from "@/admin/UsersTab";

const TOTAL_STEPS = 4;

const STEP_LABELS = ["General", "Users", "Locations", "Delivery"] as const;

export default function SetupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);
  const [companyNameSaved, setCompanyNameSaved] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);

  // Resume from persisted progress on mount.
  useEffect(() => {
    fetch("/setup/api/status")
      .then((r) => r.json())
      .then((data: { currentStep: number }) => {
        if (data.currentStep) {
          setStep(Math.min(Math.max(data.currentStep, 1), TOTAL_STEPS));
        }
      })
      .catch(() => {});

    // Defer enabling transitions so the initial panel position snaps in
    // without animation (same pattern as login page).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTransitionsEnabled(true));
    });
  }, []);

  const advanceTo = useCallback(async (nextStep: number) => {
    try {
      await fetch("/setup/api/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextStep }),
      });
    } catch {
      // Non-fatal: UI still advances; progress marker may not update.
    }
    setStep(nextStep);
  }, []);

  async function finish() {
    setFinishing(true);
    try {
      await fetch("/setup/api/finish", { method: "POST" });
      setFinished(true);
    } catch {
      // Retry handled by the user re-clicking Finish.
    } finally {
      setFinishing(false);
    }
  }

  // Success screen shown after finish.
  if (finished) {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="space-y-2">
          <h1 className="type-page-title">You&rsquo;re all set!</h1>
          <p className="type-body text-muted-foreground">
            Operations Hub is configured and ready to use.
          </p>
        </div>
        <Button onClick={() => router.push("/")}>Go to home</Button>
      </main>
    );
  }

  const trackTranslate = `translateX(-${(step - 1) * 25}%)`;

  return (
    <main className="mx-auto max-w-screen-md p-6 space-y-6">
      {/* Step indicator */}
      <div className="space-y-1">
        <p className="type-caption text-muted-foreground">Step {step} of {TOTAL_STEPS}</p>
        <div className="flex gap-1.5">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i + 1 <= step ? "bg-primary" : "bg-muted",
              )}
              aria-hidden
            />
          ))}
        </div>
        <p className="type-section-title pt-1">{STEP_LABELS[step - 1]}</p>
      </div>

      {/* Sliding panel track */}
      <div className="overflow-hidden">
        <div
          className={cn(transitionsEnabled && "motion-safe:transition-transform motion-safe:duration-300")}
          style={{ width: `${TOTAL_STEPS * 100}%`, transform: trackTranslate }}
        >
          <div className="flex">
            {/* Step 1 — General */}
            <div className="w-1/4 space-y-4" aria-hidden={step !== 1}>
              <p className="type-body text-muted-foreground">
                Set the company name that appears across the app.
              </p>
              <CompanyNameCard
                onSaved={(name) => setCompanyNameSaved(!!name.trim())}
              />
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => advanceTo(2)}
                  disabled={!companyNameSaved}
                  tabIndex={step === 1 ? 0 : -1}
                >
                  Next
                </Button>
              </div>
            </div>

            {/* Step 2 — Users */}
            <div className="w-1/4 space-y-4" aria-hidden={step !== 2}>
              <p className="type-body text-muted-foreground">
                Create user accounts and assign roles. You can skip and add users later from Admin.
              </p>
              <UsersTab />
              <div className="flex justify-between pt-2">
                <Button variant="secondary" onClick={() => setStep(1)} tabIndex={step === 2 ? 0 : -1}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => advanceTo(3)} tabIndex={step === 2 ? 0 : -1}>
                    Skip
                  </Button>
                  <Button onClick={() => advanceTo(3)} tabIndex={step === 2 ? 0 : -1}>
                    Next
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 3 — Location Visibility */}
            <div className="w-1/4 space-y-4" aria-hidden={step !== 3}>
              <p className="type-body text-muted-foreground">
                Control which locations appear in the replenishment module. You can change this anytime from Admin.
              </p>
              <LocationVisibilityManager />
              <div className="flex justify-between pt-2">
                <Button variant="secondary" onClick={() => setStep(2)} tabIndex={step === 3 ? 0 : -1}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => advanceTo(4)} tabIndex={step === 3 ? 0 : -1}>
                    Skip
                  </Button>
                  <Button onClick={() => advanceTo(4)} tabIndex={step === 3 ? 0 : -1}>
                    Next
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 4 — Delivery */}
            <div className="w-1/4 space-y-4" aria-hidden={step !== 4}>
              <p className="type-body text-muted-foreground">
                Configure global delivery receiving policies. Defaults work for most setups.
              </p>
              <DeliverySettingsCard />
              <div className="flex justify-between pt-2">
                <Button variant="secondary" onClick={() => setStep(3)} tabIndex={step === 4 ? 0 : -1}>
                  Back
                </Button>
                <Button onClick={finish} disabled={finishing} tabIndex={step === 4 ? 0 : -1}>
                  {finishing ? "Finishing…" : "Finish setup"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
