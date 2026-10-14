import { redirect } from "next/navigation";
import { Card } from "@/shared/ui/card";
import { Logo } from "@/shared/ui/logo";
import { bootstrapAllowed } from "@/connect/bootstrapGuard";
import { ConnectForm } from "@/connect/ConnectForm";

// First-run / recovery database setup. Public (no session — the DB that backs auth may not
// exist yet), but self-locking once the connection is configured and reachable.
export default async function ConnectPage() {
  if (!(await bootstrapAllowed())) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg space-y-6 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="size-12 text-primary dark:text-white" />
          <div className="space-y-1">
            <h1 className="type-page-title">Connect to ActiveOne</h1>
            <p className="type-caption max-w-sm">
              Enter the ActiveOne MySQL connection so Operations Hub can reach your data. You
              can change this later from Admin → Database.
            </p>
          </div>
        </div>

        <ConnectForm />
      </Card>
    </main>
  );
}
