import Link from "next/link";
import { Card } from "@/shared/ui/card";
import { ClipboardList, Truck } from "lucide-react";

export default function Page() {
  return (
    <main className="mx-auto max-w-screen-sm space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="type-body text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Home
        </Link>
        <h1 className="type-page-title">History</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          asChild
          className="flex min-h-[120px] flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:border-primary hover:bg-accent motion-safe:active:scale-95"
        >
          <Link href="/history/replenishment">
            <ClipboardList className="size-8 text-primary" />
            <div>
              <p className="type-section-title">Replenishment History</p>
              <p className="type-caption mt-1 text-muted-foreground">Submitted PO runs</p>
            </div>
          </Link>
        </Card>

        <Card
          asChild
          className="flex min-h-[120px] flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:border-primary hover:bg-accent motion-safe:active:scale-95"
        >
          <Link href="/history/delivery">
            <Truck className="size-8 text-primary" />
            <div>
              <p className="type-section-title">Delivery History</p>
              <p className="type-caption mt-1 text-muted-foreground">Committed receiving sessions</p>
            </div>
          </Link>
        </Card>
      </div>
    </main>
  );
}
