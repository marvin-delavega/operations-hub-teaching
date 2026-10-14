import { auth } from "@/shared/infrastructure/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Truck,
  ClipboardList,
  Receipt,
  ArrowLeftRight,
  History,
  Settings,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { hasAnyAdminTabPermission } from "@/shared/domain/Permissions";
import {
  createCountPendingReplenishmentDraftsUseCase,
} from "@/container";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { ReplenishmentWidget } from "@/shared/ui/ReplenishmentWidget";

interface ModuleCard {
  name: string;
  description: string;
  icon: LucideIcon;
  route: string;
  active: boolean;
  // The permission that gates this card. "ANY_ADMIN" = any admin-tab permission (the Admin card).
  permission: string | "ANY_ADMIN";
}

const MODULES: ModuleCard[] = [
  {
    name: "Delivery",
    description: "Scan and receive incoming deliveries from suppliers.",
    icon: Truck,
    route: "/delivery",
    active: true,
    permission: "module.delivery",
  },
  {
    name: "Counting",
    description: "Perform physical inventory counts and reconcile stock.",
    icon: ClipboardList,
    route: "/location?module=counting&returnTo=%2Fcounting",
    active: true,
    permission: "module.counting",
  },
  {
    name: "Invoice",
    description: "Review and process supplier invoices.",
    icon: Receipt,
    route: "/invoice",
    active: false,
    permission: "module.invoice",
  },
  {
    name: "Shelf Guide",
    description: "See how fast each supplier's items sell to allocate shelf space.",
    icon: LayoutGrid,
    route: "/shelfguide",
    active: true,
    permission: "module.shelfguide",
  },
  {
    name: "Transfer",
    description: "Move stock between warehouse locations.",
    icon: ArrowLeftRight,
    route: "/transfer",
    active: false,
    permission: "module.transfer",
  },
  {
    name: "History",
    description: "View past replenishment runs and delivery sessions.",
    icon: History,
    route: "/history",
    active: true,
    permission: "module.history",
  },
  {
    name: "Admin",
    description: "Manage system settings and location visibility.",
    icon: Settings,
    route: "/admin",
    active: true,
    permission: "ANY_ADMIN",
  },
];

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  const permissions = session.user.permissions ?? [];
  const name = session.user.name ?? "User";

  const holds = (permission: string) =>
    permission === "ANY_ADMIN" ? hasAnyAdminTabPermission(permissions) : permissions.includes(permission);

  const visibleModules = MODULES.filter((m) => holds(m.permission));
  const canReplenishment = permissions.includes("module.replenishment");
  const hasAnyModule = visibleModules.length > 0 || canReplenishment;

  // Approval worklist surfacing: approvers with history access see how many
  // replenishment drafts are waiting. Failure is non-fatal — the banner just hides.
  let pendingDraftCount: number | null = null;
  if (permissions.includes("replenishment.approve") && permissions.includes("module.history")) {
    try {
      pendingDraftCount = await createCountPendingReplenishmentDraftsUseCase().execute();
    } catch {
      pendingDraftCount = null;
    }
  }

  return (
    <main className="mx-auto max-w-screen-xl p-4">
      <h1 className="type-page-title mb-6 mt-4">Welcome, {name}</h1>

      {pendingDraftCount !== null && pendingDraftCount > 0 && (
        <Link
          href="/history/replenishment?status=draft"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 transition-colors hover:bg-warning/20 motion-safe:active:scale-[0.99]"
        >
          <span className="type-body font-medium text-foreground">
            {pendingDraftCount} replenishment {pendingDraftCount === 1 ? "draft" : "drafts"} awaiting approval
          </span>
          <Badge variant="warning" className="rounded-full">
            {pendingDraftCount}
          </Badge>
        </Link>
      )}

      {!hasAnyModule ? (
        <Card className="mt-4 p-8 text-center">
          <p className="type-body font-semibold text-foreground">No modules assigned</p>
          <p className="type-caption mt-1">Contact an administrator to get access.</p>
        </Card>
      ) : (
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[420px_1fr] lg:items-start lg:gap-6">
        {canReplenishment && (
          <ReplenishmentWidget className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]" />
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {visibleModules.map((module) => {
            const Icon = module.icon;

            if (module.active) {
              return (
                <Card
                  key={module.name}
                  asChild
                  className="flex flex-col gap-3 p-4 transition-colors hover:border-primary hover:bg-accent motion-safe:active:scale-95 sm:p-5"
                >
                  <Link href={module.route}>
                    <Icon className="h-7 w-7 text-primary" />
                    <div>
                      <div className="type-body font-semibold">{module.name}</div>
                      <p className="type-caption mt-1 leading-snug">
                        {module.description}
                      </p>
                    </div>
                  </Link>
                </Card>
              );
            }

            return (
              <Card
                key={module.name}
                className="flex cursor-not-allowed select-none flex-col gap-3 bg-muted/40 p-4 sm:p-5"
              >
                <Icon className="h-7 w-7 text-muted-foreground/50" />
                <div>
                  <div className="type-body font-semibold text-muted-foreground">
                    {module.name}
                  </div>
                  <p className="type-caption mt-1 leading-snug">
                    {module.description}
                  </p>
                </div>
                <Badge variant="neutral" className="self-start rounded-full">
                  Coming Soon
                </Badge>
              </Card>
            );
          })}
        </div>
      </div>
      )}
    </main>
  );
}