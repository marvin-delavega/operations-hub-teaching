import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isDbConfigured } from "@/shared/infrastructure/dbConfig";
import { auth } from "@/shared/infrastructure/auth";
import { getCompanyName } from "@/shared/infrastructure/getCompanyName";
import { getSetupStatus } from "@/shared/infrastructure/getSetupStatus";
import { AppHeader } from "@/shared/ui/AppHeader";
import { SetupSoftWall } from "@/shared/ui/SetupSoftWall";
import { hasAnyAdminTabPermission } from "@/shared/domain/Permissions";

export const metadata: Metadata = { title: "Setup" };

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No DB connection configured yet → first-run bootstrap. Cheap fs/env check, no DB call.
  if (!isDbConfigured()) redirect("/connect");

  const [session, companyName, status] = await Promise.all([
    auth(),
    getCompanyName(),
    getSetupStatus(),
  ]);

  const name = session?.user?.name ?? "User";
  const roleNames = session?.user?.roleNames;
  const canAdmin = hasAnyAdminTabPermission(session?.user?.permissions ?? []);

  // Setup is done — send the admin back to the app.
  if (status.completed) redirect("/");

  const header = (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader companyName={companyName} name={name} roleNames={roleNames} />
      {children}
    </div>
  );

  // Non-admins see a soft wall — header/account-menu/sign-out preserved.
  if (!canAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader companyName={companyName} name={name} roleNames={roleNames} />
        <SetupSoftWall />
      </div>
    );
  }

  return header;
}
