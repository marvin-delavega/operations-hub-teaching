"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { KeyRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/shared/ui/dropdown-menu";
import { ChangePasswordDialog } from "@/shared/ui/ChangePasswordDialog";
import { APP_VERSION } from "@/shared/lib/version";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AccountMenuProps {
  name: string;
  roleNames?: string[];
}

export function AccountMenu({ name, roleNames }: AccountMenuProps) {
  const { theme, setTheme } = useTheme();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {initialsOf(name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="text-sm font-semibold text-foreground">{name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {roleNames && roleNames.length > 0 ? roleNames.join(", ") : "No roles"}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => setChangePasswordOpen(true)}>
          <KeyRound className="size-4" /> Change password
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            if (typeof BroadcastChannel !== "undefined") {
              const channel = new BroadcastChannel("auth");
              channel.postMessage({ type: "SIGN_OUT" });
              channel.close();
            }
            signOut({ callbackUrl: "/login" });
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="flex justify-center px-2 py-1 type-caption text-muted-foreground">
          v{APP_VERSION}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>

    <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
}
