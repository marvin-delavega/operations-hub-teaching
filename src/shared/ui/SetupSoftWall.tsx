import { Card } from "@/shared/ui/card";

export function SetupSoftWall() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-sm space-y-2 p-6 text-center">
        <h1 className="type-section-title">Setup in progress</h1>
        <p className="type-body text-muted-foreground">
          An administrator is finishing first-time setup. Please check back shortly.
        </p>
      </Card>
    </main>
  );
}
