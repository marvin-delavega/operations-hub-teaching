import { redirect } from "next/navigation";
import { isDbConfigured } from "@/shared/infrastructure/dbConfig";
import { auth } from "@/shared/infrastructure/auth";
import { getCompanyName } from "@/shared/infrastructure/getCompanyName";
import { getSetupStatus } from "@/shared/infrastructure/getSetupStatus";
import { AppHeader } from "@/shared/ui/AppHeader";
import { SessionGuard } from "@/shared/ui/SessionGuard";
import { ScrollToTopButton } from "@/shared/ui/ScrollToTopButton";
import { SetupSoftWall } from "@/shared/ui/SetupSoftWall";
import { hasAnyAdminTabPermission } from "@/shared/domain/Permissions";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No DB connection configured yet → first-run bootstrap. Cheap fs/env check, no DB call.
  if (!isDbConfigured()) redirect("/connect");

  const [session, companyName, setupStatus] = await Promise.all([
    auth(),
    getCompanyName(),
    getSetupStatus(),
  ]);
  const name = session?.user?.name ?? "User";
  const roleNames = session?.user?.roleNames;
  const canAdmin = hasAnyAdminTabPermission(session?.user?.permissions ?? []);

  if (!setupStatus.completed) {
    if (canAdmin) {
      redirect("/setup");
    }
    // Non-admins: show soft wall with header and sign-out preserved.
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SessionGuard />
        <AppHeader companyName={companyName} name={name} roleNames={roleNames} />
        <SetupSoftWall />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SessionGuard />
      <AppHeader companyName={companyName} name={name} roleNames={roleNames} />
      {children}
      <ScrollToTopButton />
    </div>
  );
}
