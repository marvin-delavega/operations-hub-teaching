import Link from "next/link";
import { AccountMenu } from "@/shared/ui/AccountMenu";

interface AppHeaderProps {
  companyName: string;
  name: string;
  roleNames?: string[];
}

export function AppHeader({ companyName, name, roleNames }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-2 backdrop-blur print:hidden">
      <Link
        href="/"
        className="type-body font-semibold text-foreground transition-colors hover:text-primary"
      >
        {companyName} · Ops Hub
      </Link>
      <AccountMenu name={name} roleNames={roleNames} />
    </header>
  );
}
